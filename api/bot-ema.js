// File: api/bot-ema.js

// Import the necessary libraries
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// --- Configuration for Ema ---
const telegramBotToken =
  process.env.TELEGRAM_BOT_TOKEN ||
  '8469761825:AAEWqHvpgJ_nx8Ah18Y9hYy9Iw6YXSy1RBQ';
const facebookAccessToken =
  process.env.FACEBOOK_ACCESS_TOKEN ||
  'EAATGRDWf4ZBgBPeBjRKJVq0bDQHq03IO5utySt6JCgm6P7wQw0vqhlc2S5aqZCMLwWFB2GzZAPwZB4OsAQOFzZCAKyJt0NPLq1GPXKuQ5Uv9WmqYofZCntjRhDKb3qLE6edAkGVt2UFcv4zwV3DoXwbMygXZBqGG2VfEcXKevOoZB8On8w7wa4xz8xn71uwtgnDeSXZAgrzS4RXIphnFD';
const adAccountId = 'act_2976599279147919'; // Ema's account

// Initialize the Telegram Bot
let bot;
try {
  if (telegramBotToken) {
    bot = new TelegramBot(telegramBotToken);
  }
} catch (error) {
  console.error('Error initializing Telegram bot:', error.message);
}

/**
 * Fetches data from the Facebook Graph API.
 */
async function fetchAccountDetails() {
  console.log('EMA: Attempting to fetch Facebook account details...');
  if (!facebookAccessToken) {
    console.error('EMA: Facebook Access Token is missing!');
    throw new Error('Facebook Access Token is not configured.');
  }

  const fields = 'name,balance,currency';
  const url = `https://graph.facebook.com/v19.0/${adAccountId}?fields=${fields}&access_token=${facebookAccessToken}`;

  try {
    const response = await axios.get(url);
    console.log('EMA: Successfully fetched details from Facebook.');
    return response.data;
  } catch (error) {
    const errorMessage = error.response
      ? error.response.data.error.message
      : error.message;
    console.error('EMA: Facebook API Error:', errorMessage);
    throw new Error(
      'Failed to fetch details from Facebook. The token might be invalid or expired.'
    );
  }
}

// --- Vercel Serverless Function ---
module.exports = async (req, res) => {
  console.log('--- EMA Bot Function Started ---');
  console.log('Request method:', req.method);

  if (!bot) {
    console.error('EMA: Bot not initialized.');
    return res.status(500).json({ error: 'Bot not initialized' });
  }

  try {
    // Handle webhook verification from Telegram
    if (req.method === 'GET') {
      return res.status(200).send('EMA: Telegram Bot Webhook Endpoint');
    }

    const message = req.body?.message;

    if (message && message.text) {
      const chatId = message.chat.id;
      const text = message.text;
      console.log(`EMA: Received message from chat ID ${chatId}: "${text}"`);

      if (text === '/start') {
        console.log('EMA: Processing /start command.');
        await bot.sendMessage(
          chatId,
          "Hi Ema! I'm alive! Send /balance to get your ad account details."
        );
      } else if (text === '/balance') {
        console.log('EMA: Processing /balance command.');
        await bot.sendMessage(
          chatId,
          'Hold on, fetching your ad account balance... ⏳'
        );

        try {
          const accountDetails = await fetchAccountDetails();
          const formattedBalance = (
            parseFloat(accountDetails.balance) / 100
          ).toFixed(2);
          const replyMessage = `
✅ **Ema's Ad Account Details** ✅

**Account Name:** ${accountDetails.name}
**Current Balance:** ${formattedBalance} ${accountDetails.currency}
                    `;
          await bot.sendMessage(chatId, replyMessage, {
            parse_mode: 'Markdown',
          });
          console.log('EMA: Successfully sent balance details.');
        } catch (error) {
          console.error('EMA: Error in /balance handler:', error.message);
          await bot.sendMessage(
            chatId,
            `❌ Oops! Something went wrong.\n\n**Error:** ${error.message}`
          );
        }
      } else {
        console.log('EMA: Processing default message.');
        await bot.sendMessage(
          chatId,
          "Hi! I'm your Ad Balance Bot. Send /balance to get the latest update."
        );
      }
    } else {
      console.log('EMA: Received a request without a message body, ignoring.');
    }
  } catch (error) {
    console.error('EMA: A critical error occurred in the main handler:', error);
  }

  console.log('--- EMA Bot Function Finished ---');
  res.status(200).json({ status: 'OK' });
};
