# Setup Instructions for Babiya & Ema

## Answer: Do You Need Different Bots?

**NO!** You can use the **SAME Telegram Bot** for both customers. The bot will automatically route to the correct account based on which Telegram Chat ID sends the message.

## How It Works

### Using the Unified Bot (Recommended)
1. **One bot** handles both Babiya and Ema
2. Automatically detects which customer is messaging based on their Chat ID
3. Sends the correct account details to each customer

### Step-by-Step Setup

#### 1. Get Ema's Telegram Chat ID
Visit this URL to find Ema's Chat ID:
```
https://api.telegram.org/bot8469761825:AAEWqHvpgJ_nx8Ah18Y9hYy9Iw6YXSy1RBQ/getUpdates
```
Look for the `"chat":{"id":-123456789}` in the response.

#### 2. Update Two Files

**File 1: `api/bot-unified.js` (lines 22-27)**
```javascript
// Add Ema's Chat ID here
'-1002884568379': {  // EXAMPLE: This is Babiya's ID
  name: 'Babiya',
  adAccountId: 'act_243431363942629'
},
'YOUR_EMA_CHAT_ID_HERE': {  // Replace with Ema's actual Chat ID
  name: 'Ema',
  adAccountId: 'act_2976599279147919'
}
```

**File 2: `api/cron-ema.js` (line 18)**
```javascript
const EMA_CHAT_ID = 'YOUR_EMA_CHAT_ID_HERE'; // Replace with actual Chat ID like '-1001234567890'
```

#### 3. Configure Telegram Webhook
Set the webhook to use the unified bot:
```
https://api.telegram.org/bot8469761825:AAEWqHvpgJ_nx8Ah18Y9hYy9Iw6YXSy1RBQ/setWebhook?url=https://YOUR_VERCEL_URL.vercel.app/api/bot-unified
```

## What Each Customer Will See

### Babiya
- Receives reports at 9 AM daily from: `/api/cron-babiya`
- Shows account: `act_243431363942629`
- Chat ID: `-1002884568379`

### Ema
- Receives reports at 9 AM daily from: `/api/cron-ema`
- Shows account: `act_2976599279147919`
- Chat ID: (needs to be configured)

## Current Status
✅ **Babiya**: Fully configured
⏳ **Ema**: Waiting for Chat ID

