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

Generate random secrets with: `openssl rand -hex 32`

## 2. Google Apps Script (customer database)

1. Open your Google Sheet → **Extensions → Apps Script**.
2. Replace the code with [`apps-script/Code.gs`](apps-script/Code.gs). It uses a tab named `Users`
   with headers `slug | chatId | name | adAccountId | lastMessageId` (change `SHEET_NAME` if yours differs).
3. **Project Settings (gear icon) → Script Properties → Add script property**
   - Property: `SHEET_SECRET` — Value: your `GOOGLE_SHEET_SECRET`
4. **Deploy → New deployment → Web app** (Execute as: *Me*, Who has access: *Anyone*).
   Copy the new URL into `GOOGLE_SHEET_URL`.
5. **Deploy → Manage deployments → Archive the old deployment** — its URL was public and doesn't check the secret.

## 3. Vercel

1. vercel.com → project `zafatools` → **Settings → Environment Variables**.
2. Add all six variables from step 1 (Production, Preview and Development).
3. Redeploy (Deployments → ⋯ → Redeploy) so the new values take effect.

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

`https://<YOUR_APP>.vercel.app/ads.html` — asks for `DASHBOARD_PASSWORD`. The browser never
receives the Facebook or Telegram tokens; all calls go through `/api/dashboard`.

## 💻 Local development

```
cp .env.example .env   # fill in values (.env is gitignored)
npm install
npm start              # vercel dev — requires `vercel login` + `vercel link`
```
