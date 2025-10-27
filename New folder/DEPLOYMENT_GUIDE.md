# Deployment Guide - Telegram Facebook Ad Balance Bot

## ✅ Deployment Complete!

Your project has been successfully deployed to Vercel.

---

## 📍 Step 1: Find Your Vercel URL

Your Vercel URL should be one of these:
- `https://zafatools.vercel.app`
- `https://zafatools-[something].vercel.app`

**Check your Vercel dashboard** or look at your GitHub repository settings to find the exact URL.

---

## 🔗 Step 2: Configure Telegram Webhook

Replace `YOUR_VERCEL_URL` with your actual Vercel URL:

### Option 1: Using Browser
Visit this URL:
```
https://api.telegram.org/bot8469761825:AAEWqHvpgJ_nx8Ah18Y9hYy9Iw6YXSy1RBQ/setWebhook?url=https://YOUR_VERCEL_URL/api/bot
```

### Option 2: Using curl (Command Line)
```bash
curl -X POST "https://api.telegram.org/bot8469761825:AAEWqHvpgJ_nx8Ah18Y9hYy9Iw6YXSy1RBQ/setWebhook?url=https://YOUR_VERCEL_URL/api/bot"
```

### Expected Response:
```json
{
  "ok": true,
  "result": true,
  "description": "Webhook was set"
}
```

---

## 🧪 Step 3: Test Your Setup

### Test 1: Bot Endpoint
Visit in browser: `https://YOUR_VERCEL_URL.vercel.app/api/bot`

Expected: "Telegram Bot Webhook Endpoint"

### Test 2: Cron Endpoint
Visit in browser: `https://YOUR_VERCEL_URL.vercel.app/api/cron`

Expected: `{"status":"Cron endpoint active"}`

### Test 3: Telegram Bot
1. Open your Telegram bot
2. Send `/start` - Should reply: "I'm alive! Send /balance to get your ad account details."
3. Send `/balance` - Should fetch and display your Facebook ad account balance

---

## 📊 What Happens Now?

1. **Telegram Bot** (`/api/bot`):
   - Responds to `/start` command
   - Responds to `/balance` command - fetches Facebook ad account balance
   - Sends formatted response to user

2. **Cron Job** (`/api/cron`):
   - Runs **every hour** (schedule: `0 * * * *`)
   - Sends automated balance report to chat ID `-1002884568379`
   - Sends high balance alert if balance exceeds $600

---

## 🔍 Monitoring & Debugging

1. **Vercel Logs**: Check your Vercel dashboard → Functions → View logs
2. **GitHub Repository**: `github.com/fadolladam/zafatools`
3. **Deployment**: Auto-deploys on every push to `main` branch

---

## 📝 Configuration Files

- `vercel.json` - Vercel configuration & cron schedule
- `api/bot.js` - Telegram bot handler
- `api/cron.js` - Automated hourly reports
- `babiya.html` - Standalone balance viewer (HTML)

---

## 🚀 Need Help?

If the webhook returns errors:
1. Check that your Vercel URL is correct
2. Make sure the `/api/bot` endpoint is accessible
3. Check Vercel logs for errors
4. Verify the Telegram bot token is correct

---

## 🎉 You're All Set!

Your bot is now live and will:
- ✅ Respond to Telegram commands
- ✅ Send automated hourly reports
- ✅ Alert you when balance exceeds $600
- ✅ Auto-deploy on every GitHub push

