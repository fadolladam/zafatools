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
- **Babiya Page**: `https://your-project.vercel.app/babiya.html`
- **Ema Page**: `https://your-project.vercel.app/ema.html`
- **Babiya API**: `https://your-project.vercel.app/api/bot-babiya`
- **Ema API**: `https://your-project.vercel.app/api/bot-ema`

## 🤖 Setup Telegram Bot

1. **Get your Vercel URL** (replace `your-project` below)

2. **Set webhook for Babiya:**
   ```
   https://api.telegram.org/bot8469761825:AAEWqHvpgJ_nx8Ah18Y9hYy9Iw6YXSy1RBQ/setWebhook?url=https://your-project.vercel.app/api/bot-babiya
   ```

3. **Test in Telegram:**
   - Send `/start`
   - Send `/balance`

## ✅ That's It!

Your pages and bot will work on Vercel!

