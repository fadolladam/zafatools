# 🚀 Deploy to Vercel

## Quick Deploy

### Method 1: Deploy via Vercel Website (Easiest)

1. **Push your code to GitHub**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Go to vercel.com** and sign in
3. **Click "New Project"**
4. **Import your GitHub repository**
5. **Configure:**
   - Framework Preset: Other
   - Root Directory: ./
6. **Click Deploy**

### Method 2: Deploy via CLI

1. **Install Vercel CLI:**
   ```powershell
   npm install -g vercel
   ```

2. **Login:**
   ```powershell
   vercel login
   ```

3. **Deploy:**
   ```powershell
   vercel --prod
   ```

## 🌐 Your URLs

After deployment, you'll get:
- **Babiya Page**: `https://zafatools.vercel.app/babiya.html`
- **Ema Page**: `https://zafatools.vercel.app/ema.html`
- **Babiya API**: `https://zafatools.vercel.app/api/babiya`
- **Ema API**: `https://zafatools.vercel.app/api/ema`
- **Unified Bot**: `https://zafatools.vercel.app/api/bot-unified`

## 🤖 Setup Telegram Bot (UNIFIED)

1. **Set webhook for the Unified Bot:**
   ```
   https://api.telegram.org/bot8469761825:AAEWqHvpgJ_nx8Ah18Y9hYy9Iw6YXSy1RBQ/setWebhook?url=https://zafatools.vercel.app/api/bot-unified
   ```

2. **Configure Multiple Groups:**
   - Add the bot to both groups (Babiya's and Ema's)
   - Send a message from each group
   - Check the logs to get the chat IDs
   - Update `api/bot-unified.js` with the chat IDs

3. **Test in Telegram:**
   - From Babiya's group: Send `/start` or `/balance`
   - From Ema's group: Send `/start` or `/balance`

## 📝 Adding Ema's Chat ID

To add Ema's chat ID:
1. Add the bot to Ema's Telegram group
2. Send a message like `/start` from that group
3. Check Vercel logs to see the chat ID (it will appear in the logs)
4. Edit `api/bot-unified.js` and uncomment/update Ema's configuration:
   ```javascript
   'EMA_CHAT_ID_HERE': {
     name: 'Ema',
     adAccountId: 'act_2976599279147919'
   }
   ```
5. Redeploy to Vercel

## ✅ That's It!

Your unified bot will work with multiple groups!

