// File: api/cron-babiya.js

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
const adAccountId = 'act_243431363942629'; // Babiya's account

// --- Babiya's Telegram Chat ID ---
// TODO: Replace this with Babiya's actual Telegram Chat ID
const BABIYA_CHAT_ID = '-1002884568379'; // UPDATE THIS WITH BABIYA'S CHAT ID

// Initialize the Telegram Bot
let bot;
try {
  bot = new TelegramBot(telegramBotToken);
} catch (error) {
  console.error('Error initializing Telegram bot:', error.message);
}

/**
 * Fetches data from the Facebook Graph API.
 */
async function fetchAccountDetails() {
  console.log('BABIYA CRON: Attempting to fetch Facebook account details...');
  if (!facebookAccessToken) {
    console.error('BABIYA CRON: Facebook Access Token is missing!');
    throw new Error('Facebook Access Token is not configured.');
  }
  const fields = 'name,balance,currency';
  const url = `https://graph.facebook.com/v19.0/${adAccountId}?fields=${fields}&access_token=${facebookAccessToken}`;
  try {
    const response = await axios.get(url);
    console.log('BABIYA CRON: Successfully fetched details from Facebook.');
    return response.data;
  } catch (error) {
    const errorMessage = error.response
      ? error.response.data.error.message
      : 'An unknown error occurred';
    console.error('BABIYA CRON: Facebook API Error:', errorMessage);
    throw new Error('Failed to fetch details from Facebook.');
  }
}

// --- Vercel Serverless Function (for Cron Job) ---
module.exports = async (req, res) => {
  console.log('--- BABIYA CRON JOB STARTED ---');
  console.log('Request method:', req.method);

  // Handle GET requests for health checks
  if (req.method === 'GET') {
    return res.status(200).json({ status: 'BABIYA Cron endpoint active' });
  }

  if (!bot) {
    console.error('BABIYA CRON FATAL: Bot not initialized.');
    return res.status(500).json({ error: 'Bot not initialized' });
  }

  if (!BABIYA_CHAT_ID) {
    console.error(
      'BABIYA CRON FATAL: Telegram Chat ID is not set in the code.'
    );
    return res.status(500).json({ error: 'Chat ID not configured' });
  }

  try {
    const accountDetails = await fetchAccountDetails();
    const balance = parseFloat(accountDetails.balance) / 100;
    const formattedBalance = balance.toFixed(2);

    // --- 1. Send the Daily 9 AM Report ---
    const dailyReportMessage = `
☀️ **Babiya's Morning Report** ☀️

**Account Name:** ${accountDetails.name}
**Current Balance:** $${formattedBalance} ${accountDetails.currency}
        `;
    await bot.sendMessage(BABIYA_CHAT_ID, dailyReportMessage, {
      parse_mode: 'Markdown',
    });
    console.log('BABIYA CRON: Successfully sent daily report.');

    // --- 2. Check if Balance Exceeds $600 ---
    if (balance > 600) {
      const alertMessage = `
🚨 **High Balance Alert!** 🚨

The ad account balance is **$${formattedBalance}**, which is over the $600 threshold.
            `;
      await bot.sendMessage(BABIYA_CHAT_ID, alertMessage, {
        parse_mode: 'Markdown',
      });
      console.log('BABIYA CRON: High balance alert sent.');
    }
  } catch (error) {
    console.error('BABIYA CRON JOB FAILED:', error.message);
    // Send an error message if the job fails
    try {
      await bot.sendMessage(
        BABIYA_CHAT_ID,
        `⚠️ **Babiya's Bot Cron Job Error:**\nFailed to run scheduled task. \nError: ${error.message}`
      );
    } catch (sendError) {
      console.error(
        'BABIYA CRON FATAL: Could not even send the error message to Telegram.',
        sendError.message
      );
    }
  }

  console.log('--- BABIYA CRON JOB FINISHED ---');
  res.status(200).json({ status: 'OK' });
};
