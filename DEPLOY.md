# 🚀 ZafaTools: Unified Ad Balance Bot

Simplified guide to deploy and manage your dynamic Facebook Ad Account Balance Bot.

## 1. Quick Deploy to Vercel

1.  **Push code to GitHub.**
2.  **Import to Vercel** (Search for `zafatools` on vercel.com).
3.  **Environment Variables**: Add your `FACEBOOK_ACCESS_TOKEN` and `TELEGRAM_BOT_TOKEN`.
4.  **Deploy**.

## 2. Connect Your Bot

Once deployed, set your bot's webhook to:
`https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://<YOUR_APP>.vercel.app/api/bot-unified`

## 3. Manage Multiple Customers

This version is **Dynamic**. You no longer need to edit code to add customers.

### Registering New Customers
1.  Add the bot to a Telegram group.
2.  Send `/register <NiceName> <AdAccountId> [ShortID]`
    *   Example: `/register John act_1234567 john`
3.  The bot will remember this group and the ad account. You can run `/register` multiple times in the same group to add different ad accounts!

### Viewing Account Snapshots
New customers automatically get a personal web link:
`https://<YOUR_APP>.vercel.app/c.html?id=<ShortID>`

Example: `.../c.html?id=john`

---

---

## 🛠️ Unified Dashboard
You can manage all registered accounts and view active ads via the main dashboard:
`https://<YOUR_APP>.vercel.app/ads.html`

## 💡 Managing Updates
**IMPORTANT**: This project saves data to `/tmp/db.json` on Vercel. This means that if you update your code and redeploy, your registered customers will be lost and you will need to `/register` them again. This is the simplest way to keep your project lightweight without external databases!
