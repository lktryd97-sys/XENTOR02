# راهنمای نصب بک‌اند XENTOR

این پروژه بک‌اند مینی‌اپ تلگرام XENTOR است.

## امکانات فعلی
- اتصال به سرور
- بررسی اعتبار اطلاعات تلگرام
- اتصال به پایگاه داده Supabase
- دریافت اطلاعات حساب کاربر
- ثبت درخواست برداشت

## پیش‌نیازها
- Node.js
- حساب Supabase
- ربات تلگرام

## نصب
ابتدا وابستگی‌ها را نصب کنید:

npm install

## اجرای سرور

npm start

## مسیرهای API

GET /health

POST /api/auth/telegram

GET /api/me

POST /api/withdrawals

## تنظیم متغیرهای محیطی

متغیرهای زیر باید در تنظیمات هاست وارد شوند:

SUPABASE_URL

SUPABASE_SERVICE_ROLE_KEY

TELEGRAM_BOT_TOKEN

ALLOWED_ORIGIN

MINING_RATE_PER_HOUR

MAX_OFFLINE_HOURS

MIN_WITHDRAWAL

## پایگاه داده

فایل زیر را در SQL Editor سایت Supabase اجرا کنید:

supabase/schema.sql

## نکته مهم

این نسخه اولیه بک‌اند است.
درخواست برداشت به‌صورت خودکار روی بلاکچین پرداخت نمی‌شود و نیاز به بررسی مدیر دارد.

قبل از استفاده واقعی، امنیت و عملکرد سرور باید آزمایش شود.
