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

// --- Helpers ---
const esc = (text) => {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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
            "❌ <b>Usage:</b> <code>/register &lt;Name&gt; &lt;Ad_Account_Id&gt; [Simple_Name]</code>\n\nExample: <code>/register John act_123456789 johnny</code>",
            { parse_mode: 'HTML' }
          );
          return res.status(200).json({ status: 'OK' });
        }

        const name = parts[1];
        const adAccountId = parts[2];
        const slug = parts[3] || name.toLowerCase().replace(/[^a-z0-9]/g, '');

        try {
          db.registerUser(chatId, name, adAccountId, slug);
          const successMsg = [
            "Registration Successful!",
            "Name: " + name,
            "Ad Account: " + adAccountId,
            "Simple Name: " + slug,
            "",
            "View your page: c.html?id=" + slug
          ].join("\n");
          
          await bot.sendMessage(chatId, successMsg);
        } catch (error) {
          await bot.sendMessage(chatId, "❌ Error: " + error.message);
        }
        return res.status(200).json({ status: 'OK' });
      }

      if (!customer) {
        console.log(`Unknown chat ID: ${chatId}. Sending unauthorized message.`);
        await bot.sendMessage(
          chatId,
          "⚠️ <b>Unauthorized or Unregistered!</b>\n\nUse <code>/register &lt;Name&gt; &lt;Ad_Account_Id&gt;</code> to get started.",
          { parse_mode: 'HTML' }
        );
        return res.status(200).json({ status: 'OK' });
      }

      if (text === '/start') {
        console.log(`Processing /start command for ${customer.name}.`);
        await bot.sendMessage(
          chatId,
          `Hi <b>${esc(customer.name)}</b>! I'm alive! Send /balance to get your ad account details.`,
          { parse_mode: 'HTML' }
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
✅ <b>${esc(customer.name)}'s Ad Account Details</b> ✅

<b>Account Name:</b> ${esc(accountDetails.name)}
<b>Current Balance:</b> <code>${esc(formattedBalance)} ${esc(accountDetails.currency)}</code>
                    `;
          await bot.sendMessage(chatId, replyMessage, {
            parse_mode: 'HTML',
          });
          console.log(`Successfully sent balance details to ${customer.name}.`);
        } catch (error) {
          console.error(
            `Error in /balance handler for ${customer.name}:`,
            error.message
          );
          await bot.sendMessage(
            chatId,
            `❌ Oops! Something went wrong.\n\n<b>Error:</b> ${esc(error.message)}`,
            { parse_mode: 'HTML' }
          );
        }
      } else if (text === '/help') {
        const helpMessage = `
🤖 <b>Ad Balance Bot Help</b> 🤖

<b>Commands:</b>
/start - Initial greeting
/register &lt;Name&gt; &lt;Ad_Account_Id&gt; - Register your ad account
/balance - Fetch your current account balance
/help - Show this help message

<b>Example Registration:</b>
<code>/register John act_123456789</code>
        `;
        await bot.sendMessage(chatId, helpMessage, { parse_mode: 'HTML' });
      } else {
        console.log(`Processing default message for ${customer.name}.`);
        await bot.sendMessage(
          chatId,
          `Hi <b>${esc(customer.name)}</b>! I'm your Ad Balance Bot. Send /balance to get the latest update.`,
          { parse_mode: 'HTML' }
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
