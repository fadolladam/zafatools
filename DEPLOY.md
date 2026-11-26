# 🚀 ZafaTools: Unified Ad Balance Bot

Guide to deploy and manage your dynamic Facebook Ad Account Balance Bot.

> 🔒 **Security rule:** this repo is public. Tokens, passwords and the Google Sheet URL must
> **only** live in Vercel Environment Variables and Apps Script Script Properties — never in code.
> Anything ever committed must be treated as stolen and rotated.

## 1. Secrets checklist

| Variable | Where it comes from |
|---|---|
| `TELEGRAM_BOT_TOKEN` | @BotFather → `/revoke` then `/token` for a fresh token |
| `FACEBOOK_ACCESS_TOKEN` | Meta Business Settings → System Users → Generate new token (revoke the old one) |
| `GOOGLE_SHEET_URL` | Apps Script web app URL (step 2) |
| `GOOGLE_SHEET_SECRET` | Random string you generate — must equal `SHEET_SECRET` in Apps Script |
| `TELEGRAM_WEBHOOK_SECRET` | Random string you generate (letters, digits, `_`, `-` only) |
| `DASHBOARD_PASSWORD` | Password for `ads.html` |
| `CRON_SECRET` | Random secret shared by the protected endpoint and GitHub scheduled workflow |

Generate random secrets with: `openssl rand -hex 32`

## 2. Google Apps Script (customer database)

1. Open your Google Sheet → **Extensions → Apps Script**.
2. Replace the code with [`apps-script/Code.gs`](apps-script/Code.gs). It uses a tab named `Users`
   with headers `ChatID | Name | AdAccountID | Slug | CreatedAt | LastMessageID`.
3. **Project Settings (gear icon) → Script Properties → Add script property**
   - Property: `SHEET_SECRET` — Value: your `GOOGLE_SHEET_SECRET`
4. **Deploy → New deployment → Web app** (Execute as: *Me*, Who has access: *Anyone*).
   Copy the new URL into `GOOGLE_SHEET_URL`.
5. **Deploy → Manage deployments → Archive the old deployment** — its URL was public and doesn't check the secret.

## 3. Vercel

1. vercel.com → project `zafatools` → **Settings → Environment Variables**.
2. Add all seven variables from step 1 (Production, Preview and Development).
3. Redeploy (Deployments → ⋯ → Redeploy) so the new values take effect.

### Daily spend alerts

The dashboard lets you set a daily spend limit for each registered account. The
limit is saved in the Google Sheet and can be changed or disabled in the
dashboard at any time. The protected endpoint checks Meta account-level spend
and sends one Telegram group message per account day after the limit is reached.
This project is on Vercel Hobby, so five-minute checks are scheduled by GitHub
Actions instead of Vercel Cron. Add the same `CRON_SECRET` value to Vercel
Production Environment Variables and the GitHub repository Actions secret named
`CRON_SECRET`. Generate a long random value locally with `openssl rand -hex 32`.
GitHub schedules support five-minute intervals, though actual runs can be delayed.

## 4. Connect the bot (with webhook secret)

Telegram sends the secret in a header on every update; the bot rejects calls without it.

```
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://<YOUR_APP>.vercel.app/api/bot-unified&secret_token=<TELEGRAM_WEBHOOK_SECRET>
```

## 5. Manage customers

1. Add the bot to a Telegram group.
2. Send `/register <NiceName> <AdAccountId> [ShortID]` — e.g. `/register John act_1234567 john`
3. Run `/register` again in the same group to add more ad accounts.

Each customer gets a public balance page: `https://<YOUR_APP>.vercel.app/c.html?id=<ShortID>`

## 🛠️ Dashboard

`https://<YOUR_APP>.vercel.app/ads.html` — asks for `DASHBOARD_PASSWORD`. Set the limit
under **Daily Spend Alert** for each customer. The browser never
receives the Facebook or Telegram tokens; all calls go through `/api/dashboard`.

## 💻 Local development

```
cp .env.example .env   # fill in values (.env is gitignored)
npm install
npm start              # vercel dev — requires `vercel login` + `vercel link`
```
