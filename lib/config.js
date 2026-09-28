// All secrets come from environment variables (Vercel → Project Settings → Environment Variables).
// Never hardcode tokens in this repo — it is public.
const crypto = require('crypto');

const config = {
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  facebookAccessToken: process.env.FACEBOOK_ACCESS_TOKEN || '',
  googleSheetUrl: process.env.GOOGLE_SHEET_URL || '',
  googleSheetSecret: process.env.GOOGLE_SHEET_SECRET || '',
  telegramWebhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || '',
  dashboardPassword: process.env.DASHBOARD_PASSWORD || ''
};

const missing = Object.entries({
  TELEGRAM_BOT_TOKEN: config.telegramBotToken,
  FACEBOOK_ACCESS_TOKEN: config.facebookAccessToken,
  GOOGLE_SHEET_URL: config.googleSheetUrl,
  GOOGLE_SHEET_SECRET: config.googleSheetSecret,
  TELEGRAM_WEBHOOK_SECRET: config.telegramWebhookSecret,
  DASHBOARD_PASSWORD: config.dashboardPassword
}).filter(([, v]) => !v).map(([k]) => k);

if (missing.length) {
  console.warn(`Missing environment variables: ${missing.join(', ')}`);
}

// Constant-time string comparison so secrets can't be guessed via response timing.
function safeEqual(a, b) {
  if (!a || !b) return false;
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

module.exports = { ...config, missing, safeEqual };
