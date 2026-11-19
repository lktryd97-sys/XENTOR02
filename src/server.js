import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'TELEGRAM_BOT_TOKEN']) {
  if (!process.env[k]) {
    console.error(`Missing ${k}`);
    process.exit(1);
  }
}

const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const app = express();
app.set('trust proxy', 1);
app.use(helmet());

app.use(cors({
  origin: (process.env.ALLOWED_ORIGIN || '')
    .split(',')
    .map(x => x.trim())
    .filter(Boolean)
}));

app.use(express.json({ limit: '32kb' }));
app.use('/api', rateLimit({ windowMs: 60000, limit: 90 }));

function verifyInitData(raw) {
  if (!raw || raw.length > 10000) {
    throw Error('اطلاعات ورود تلگرام نامعتبر است.');
  }

  const p = new URLSearchParams(raw);
  const hash = p.get('hash');
  const authDate = Number(p.get('auth_date'));
  const now = Math.floor(Date.now() / 1000);

  if (!hash || !authDate || authDate > now + 60 || now - authDate > 86400) {
    throw Error('ورود تلگرام منقضی یا ناقص است.');
  }

  p.delete('hash');
  p.delete('signature');

  const check = [...p.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secret = crypto
    .createHmac('sha256', 'WebAppData')
    .update(process.env.TELEGRAM_BOT_TOKEN)
    .digest();

  const expected = crypto
    .createHmac('sha256', secret)
    .update(check)
    .digest();

  const supplied = Buffer.from(hash, 'hex');

  if (
    supplied.length !== expected.length ||
    !crypto.timingSafeEqual(supplied, expected)
  ) {
    throw Error('امضای تلگرام تأیید نشد.');
  }

  const user = JSON.parse(p.get('user') || 'null');

  if (!user?.id) {
    throw Error('شناسه کاربر پیدا نشد.');
  }

  return user;
}

function auth(req, res, next) {
  try {
    req.tg = verifyInitData(req.get('X-Telegram-Init-Data'));
    next();
  } catch (e) {
    res.status(401).json({ error: e.message });
  }
}

const wrap = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'xentor-backend' });
});

app.post('/api/auth/telegram', auth, wrap(async (req, res) => {
  const u = req.tg;

  const { data, error } = await db.rpc('xentor_ensure_user', {
    p_telegram_id: u.id,
    p_username: u.username ?? null,
    p_first_name: u.first_name ?? null,
    p_referrer_telegram_id: null
  });

  if (error) throw error;

  res.json({ ok: true, user: data });
}));

app.get('/api/me', auth, wrap(async (req, res) => {
  const rate = Math.max(0, Number(process.env.MINING_RATE_PER_HOUR || 0));
  const cap = Math.max(1, Number(process.env.MAX_OFFLINE_HOURS || 24));

  const { data, error } = await db.rpc('xentor_sync_mining', {
    p_telegram_id: req.tg.id,
    p_rate_per_hour: rate,
    p_max_hours: cap
  });

  if (error) throw error;

  res.json({ ok: true, account: data, mining_rate_per_hour: rate });
}));

app.post('/api/withdrawals', auth, wrap(async (req, res) => {
  const amount = Number(req.body?.amount);
  const wallet = String(req.body?.wallet || '').trim();
  const min = Math.max(0, Number(process.env.MIN_WITHDRAWAL || 500));

  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: 'مقدار برداشت معتبر نیست.' });
  }

  if (amount < min) {
    return res.status(400).json({
      error: `حداقل برداشت ${min} XENTOR است.`
    });
  }

  if (
    !(/^(EQ|UQ)[A-Za-z0-9_-]{46}$/.test(wallet) ||
      /^-?\d:[0-9a-fA-F]{64}$/.test(wallet))
  ) {
    return res.status(400).json({
      error: 'قالب آدرس TON درست به نظر نمی‌رسد.'
    });
  }

  const { data, error } = await db.rpc('xentor_request_withdrawal', {
    p_telegram_id: req.tg.id,
    p_amount: amount,
    p_wallet: wallet
  });

  if (error) throw error;

  res.status(201).json({
    ok: true,
    message: 'درخواست ثبت شد؛ پرداخت پس از بررسی مدیر انجام می‌شود.',
    withdrawal: data
  });
}));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({
    error: 'خطای سرور رخ داد. بعداً تلاش کنید.'
  });
});

app.listen(Number(process.env.PORT || 8000), '0.0.0.0', () => {
  console.log('XENTOR API started');
});
