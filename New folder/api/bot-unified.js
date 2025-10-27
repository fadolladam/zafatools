// File: api/bot-unified.js - Single bot that routes based on chat ID

// Import the necessary libraries
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// --- Configuration ---
const telegramBotToken =
  process.env.TELEGRAM_BOT_TOKEN ||
  '8469761825:AAEWqHvpgJ_nx8Ah18Y9hYy9Iw6YXSy1RBQ';
const facebookAccessToken =
  process.env.FACEBOOK_ACCESS_TOKEN ||
  'EAATGRDWf4ZBgBPeBjRKJVq0bDQHq03IO5utySt6JCgm6P7wQw0vqhlc2S5aqZCMLwWFB2GzZAPwZB4OsAQOFzZCAKyJt0NPLq1GPXKuQ5Uv9WmqYofZCntjRhDKb3qLE6edAkGVt2UFcv4zwV3DoXwbMygXZBqGG2VfEcXKevOoZB8On8w7wa4xz8xn71uwtgnDeSXZAgrzS4RXIphnFD';

// --- Customer Configuration ---
const CUSTOMERS = {
  // Babiya's Chat ID
  '-1002884568379': {
    name: 'Babiya',
    adAccountId: 'act_243431363942629',
  },
  // Add Ema's Chat ID here when you know it
  // Replace 'EMA_CHAT_ID_HERE' with Ema's actual Telegram Chat ID
  // Example: '-1001234567890': {
  //   name: 'Ema',
  //   adAccountId: 'act_2976599279147919'
  // }
};

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
 * Fetches data from the Facebook Graph API for a specific ad account.
 */
async function fetchAccountDetails(adAccountId) {
  console.log(
    `Attempting to fetch Facebook account details for: ${adAccountId}`
  );
  if (!facebookAccessToken) {
    console.error('Facebook Access Token is missing!');
    throw new Error('Facebook Access Token is not configured.');
  }

  const fields = 'name,balance,currency';
  const url = `https://graph.facebook.com/v19.0/${adAccountId}?fields=${fields}&access_token=${facebookAccessToken}`;

  try {
    const response = await axios.get(url);
    console.log(`Successfully fetched details for account: ${adAccountId}`);
    return response.data;
  } catch (error) {
    const errorMessage = error.response
      ? error.response.data.error.message
      : error.message;
    console.error('Facebook API Error:', errorMessage);
    throw new Error(
      'Failed to fetch details from Facebook. The token might be invalid or expired.'
    );
  }
}

// --- Vercel Serverless Function ---
module.exports = async (req, res) => {
  console.log('--- Unified Bot Function Started ---');
  console.log('Request method:', req.method);

  if (!bot) {
    console.error('FATAL: Bot not initialized.');
    return res.status(500).json({ error: 'Bot not initialized' });
  }

  try {
    // Handle webhook verification from Telegram
    if (req.method === 'GET') {
      return res.status(200).send('Unified Telegram Bot Webhook Endpoint');
    }

    const message = req.body?.message;

    if (message && message.text) {
      const chatId = message.chat.id;
      const text = message.text;
      console.log(`Received message from chat ID ${chatId}: "${text}"`);

      // Check if this chat ID belongs to a known customer
      const customer = CUSTOMERS[chatId.toString()];

      if (!customer) {
        console.log(`Unknown chat ID: ${chatId}. Ignoring message.`);
        await bot.sendMessage(
          chatId,
          "⚠️ Sorry, you're not authorized to use this bot."
        );
        return res.status(200).json({ status: 'OK' });
      }

      if (text === '/start') {
        console.log(`Processing /start command for ${customer.name}.`);
        await bot.sendMessage(
          chatId,
          `Hi ${customer.name}! I'm alive! Send /balance to get your ad account details.`
        );
      } else if (text === '/balance') {
        console.log(`Processing /balance command for ${customer.name}.`);
        await bot.sendMessage(
          chatId,
          'Hold on, fetching your ad account balance... ⏳'
        );

        try {
          const accountDetails = await fetchAccountDetails(
            customer.adAccountId
          );
          const formattedBalance = (
            parseFloat(accountDetails.balance) / 100
          ).toFixed(2);
          const replyMessage = `
✅ **${customer.name}'s Ad Account Details** ✅

**Account Name:** ${accountDetails.name}
**Current Balance:** ${formattedBalance} ${accountDetails.currency}
                    `;
          await bot.sendMessage(chatId, replyMessage, {
            parse_mode: 'Markdown',
          });
          console.log(`Successfully sent balance details to ${customer.name}.`);
        } catch (error) {
          console.error(
            `Error in /balance handler for ${customer.name}:`,
            error.message
          );
          await bot.sendMessage(
            chatId,
            `❌ Oops! Something went wrong.\n\n**Error:** ${error.message}`
          );
        }
      } else {
        console.log(`Processing default message for ${customer.name}.`);
        await bot.sendMessage(
          chatId,
          `Hi ${customer.name}! I'm your Ad Balance Bot. Send /balance to get the latest update.`
        );
      }
    } else {
      console.log('Received a request without a message body, ignoring.');
    }
  } catch (error) {
    console.error('A critical error occurred in the main handler:', error);
  }

  console.log('--- Unified Bot Function Finished ---');
  res.status(200).json({ status: 'OK' });
};
