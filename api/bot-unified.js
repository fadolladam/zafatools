// File: api/bot-unified.js - Single bot that routes based on chat ID
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// --- Configuration ---
const telegramBotToken =
  process.env.TELEGRAM_BOT_TOKEN ||
  '8469761825:AAEWqHvpgJ_nx8Ah18Y9hYy9Iw6YXSy1RBQ';
const facebookAccessToken =
  process.env.FACEBOOK_ACCESS_TOKEN ||
  'EAATGRDWf4ZBgBPeBjRKJVq0bDQHq03IO5utySt6JCgm6P7wQw0vqhlc2S5aqZCMLwWFB2GzZAPwZB4OsAQOFzZCAKyJt0NPLq1GPXKuQ5Uv9WmqYofZCntjRhDKb3qLE6edAkGVt2UFcv4zwV3DoXwbMygXZBqGG2VfEcXKevOoZB8On8w7wa4xz8xn71uwtgnDeSXZAgrzS4RXIphnFD';

const db = require('./db');

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
    // Handle webhook verification and config requests
    if (req.method === 'GET') {
      const mode = req.query?.mode;
      const slug = req.query?.slug;

      if (mode === 'config') {
        const users = db.getUsers();
        return res.status(200).json({
          facebookAccessToken,
          telegramBotToken,
          customers: users
        });
      }

      if (slug) {
        console.log(`Fetching data for slug: ${slug}`);
        const customer = db.getUserBySlug(slug);
        if (!customer) {
          return res.status(404).json({ error: 'Customer not found' });
        }
        try {
          const accountDetails = await fetchAccountDetails(customer.adAccountId);
          return res.status(200).json({
            ...accountDetails,
            customerName: customer.name
          });
        } catch (error) {
          return res.status(500).json({ error: error.message });
        }
      }

      return res.status(200).send('Unified Telegram Bot Webhook Endpoint');
    }

    const message = req.body?.message;

    if (message && message.text) {
      const chatId = message.chat.id;
      const text = message.text;
      console.log(`Received message from chat ID ${chatId}: "${text}"`);

      // Check if this chat ID belongs to a known customer
      const customer = db.getUser(chatId);

      // Registration Flow
      if (text.startsWith('/register')) {
        const parts = text.split(' ');
        if (parts.length < 3) {
          await bot.sendMessage(
            chatId,
            "❌ **Usage:** `/register <Name> <Ad_Account_Id> [Simple_Name]`\n\nExample: `/register John act_123456789 johnny`",
            { parse_mode: 'Markdown' }
          );
          return res.status(200).json({ status: 'OK' });
        }

        const name = parts[1];
        const adAccountId = parts[2];
        const slug = parts[3] || name.toLowerCase().replace(/[^a-z0-9]/g, '');

        try {
          db.registerUser(chatId, name, adAccountId, slug);
          await bot.sendMessage(
            chatId,
            `✅ **Registration Successful!**\n\n**Name:** ${name}\n**Ad Account:** ${adAccountId}\n**Simple Name:** ${slug}\n\nYou can now use /balance or view your page at:\n\`.../c.html?id=${slug}\``,
            { parse_mode: 'Markdown' }
          );
        } catch (error) {
          await bot.sendMessage(chatId, `❌ Error during registration: ${error.message}`);
        }
        return res.status(200).json({ status: 'OK' });
      }

      if (!customer) {
        console.log(`Unknown chat ID: ${chatId}. Sending unauthorized message.`);
        await bot.sendMessage(
          chatId,
          "⚠️ **Unauthorized or Unregistered!**\n\nUse `/register <Name> <Ad_Account_Id>` to get started.",
          { parse_mode: 'Markdown' }
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
      } else if (text === '/help') {
        const helpMessage = `
🤖 **Ad Balance Bot Help** 🤖

**Commands:**
/start - Initial greeting
/register <Name> <Ad_Account_Id> - Register your ad account
/balance - Fetch your current account balance
/help - Show this help message

**Example Registration:**
\`/register John act_123456789\`
        `;
        await bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
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
