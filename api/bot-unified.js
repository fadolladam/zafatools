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
        const users = await db.getUsers();
        return res.status(200).json({
          facebookAccessToken,
          telegramBotToken,
          customers: users
        });
      }

      if (slug) {
        console.log(`Fetching data for slug: ${slug}`);
        const customer = await db.getUserBySlug(slug);
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

      // Fetch all accounts for this chat ID
      const accounts = await db.getAccountsForChat(chatId);
      const isRegistered = accounts.length > 0;

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
          await db.registerUser(chatId, name, adAccountId, slug);
          const successMsg = [
            "Registration Successful!",
            "Name: " + name,
            "Ad Account: " + adAccountId,
            "Simple Name: " + slug,
            "",
            "View your page: https://" + (req.headers.host || 'zafatools.vercel.app') + "/c.html?id=" + slug
          ].join("\n");
          
          await bot.sendMessage(chatId, successMsg);
        } catch (error) {
          await bot.sendMessage(chatId, "❌ Error: " + error.message);
        }
        return res.status(200).json({ status: 'OK' });
      }

      // --- Public Commands (No registration needed) ---
      if (text === '/start') {
        const chatType = message.chat.type;
        const welcomeMsg = [
          "✨ <b>Ads Monitor Bot</b> ✨",
          "",
          "Diagnostics for your connection:",
          `🆔 <b>Chat ID:</b> <code>${chatId}</code>`,
          `📂 <b>Chat Type:</b> <code>${chatType}</code>`,
          "",
          "<b>Available Commands:</b>",
          "• /register - Add an ad account",
          "• /list - List connected accounts",
          "• /balance - Check financial status",
          "• /help - Detailed guide",
          "• /status - System diagnostics",
          "",
          "<i>Tip: You can use /register multiple times for different accounts!</i>"
        ].join("\n");
        await bot.sendMessage(chatId, welcomeMsg, { parse_mode: 'HTML' });
        return res.status(200).json({ status: 'OK' });
      }

      if (text === '/help') {
        const helpMessage = `
📖 <b>Ads Monitor Help Guide</b>

<b>1. Registration</b>
Format: <code>/register &lt;Nickname&gt; &lt;AccountID&gt; [Slug]</code>
Example: <code>/register Shop1 act_705976080055297 shop1</code>
<i>The Slug is used for your personal web link.</i>

<b>2. Commands</b>
• /list - View all accounts in this groups
• /balance - Fetch real-time balances for all
• /remove <code>&lt;slug&gt;</code> - Delete an account
• /status - Check if API tokens are valid

<b>3. Web Dashboard</b>
Available at: <code>https://${req.headers.host || 'your-app'}/ads.html</code>
        `;
        await bot.sendMessage(chatId, helpMessage, { parse_mode: 'HTML' });
        return res.status(200).json({ status: 'OK' });
      }

      if (text === '/status') {
        const tokenDisplay = facebookAccessToken 
          ? `✅ Connected (...${facebookAccessToken.slice(-4)})` 
          : "❌ Missing Token";
          
        const statusMsg = [
          "🏥 <b>System Status</b>",
          "",
          "✅ <b>Telegram Bot:</b> Online",
          `🔑 <b>Facebook API:</b> ${tokenDisplay}`,
          db.GOOGLE_SHEET_URL ? "✅ <b>Database:</b> Google Sheets" : "⚠️ <b>Database:</b> Local File (Temporary)",
          `📡 <b>Host:</b> ${req.headers.host || 'Vercel'}`,
          `⏱ <b>Server Time:</b> ${new Date().toLocaleTimeString()}`
        ].join("\n");
        await bot.sendMessage(chatId, statusMsg, { parse_mode: 'HTML' });
        return res.status(200).json({ status: 'OK' });
      }

      // --- Registered Commands Only ---
      if (!isRegistered && !text.startsWith('/register')) {
        console.log(`Unknown chat ID: ${chatId}. Sending unauthorized message.`);
        await bot.sendMessage(
          chatId,
          `⚠️ <b>Not Registered!</b>\n\nThis Chat ID (<code>${chatId}</code>) is not found in the database.\n\nUse <code>/register &lt;Name&gt; &lt;Ad_Account_Id&gt;</code> to start monitoring this chat.`,
          { parse_mode: 'HTML' }
        );
        return res.status(200).json({ status: 'OK' });
      }

      // We already fetched accounts at the top

      if (text === '/balance') {
        console.log(`Processing /balance command for chat ${chatId}.`);
        if (accounts.length === 0) {
          await bot.sendMessage(chatId, "❌ No registered accounts here. Use /register first.");
          return res.status(200).json({ status: 'OK' });
        }

        await bot.sendMessage(chatId, `⏳ Fetching financial snapshot for <b>${accounts.length}</b> account(s)...`, { parse_mode: 'HTML' });

        for (const account of accounts) {
          try {
            const accountDetails = await fetchAccountDetails(account.adAccountId);
            const formattedBalance = (parseFloat(accountDetails.balance) / 100).toFixed(2);
            const replyMessage = `
✅ <b>${esc(account.name)} Snapshot</b> ✅

<b>Account:</b> ${esc(accountDetails.name)}
<b>Balance:</b> <code>${esc(formattedBalance)} ${esc(accountDetails.currency)}</code>
<b>Link:</b> https://${req.headers.host || 'zafatools.vercel.app'}/c.html?id=${esc(account.slug)}
            `;
            await bot.sendMessage(chatId, replyMessage, { parse_mode: 'HTML' });
          } catch (error) {
            await bot.sendMessage(chatId, `❌ Error [${esc(account.name)}]: ${esc(error.message)}`, { parse_mode: 'HTML' });
          }
        }
      } else if (text === '/list') {
        if (accounts.length === 0) {
           await bot.sendMessage(chatId, "📭 No accounts registered in this chat.");
        } else {
           const list = accounts.map(a => `• <b>${esc(a.name)}</b> (ID: <code>${esc(a.adAccountId)}</code>) [Slug: <code>${esc(a.slug)}</code>]`).join("\n");
           await bot.sendMessage(chatId, `📋 <b>Connected Accounts:</b>\n\n${list}`, { parse_mode: 'HTML' });
        }
      } else if (text.startsWith('/remove ')) {
        const slugToRemove = text.split(' ')[1]?.toLowerCase();
        if (!slugToRemove) {
          await bot.sendMessage(chatId, "❌ Usage: <code>/remove &lt;slug&gt;</code>", { parse_mode: 'HTML' });
        } else {
          // Verify it belongs to this chat
          const target = accounts.find(a => a.slug === slugToRemove);
          if (!target) {
            await bot.sendMessage(chatId, "❌ Account not found in this chat.");
          } else {
            await bot.sendMessage(chatId, `⚠️ Removing <b>${esc(target.name)}</b>...`, { parse_mode: 'HTML' });
            try {
              await db.removeUser(slugToRemove);
              await bot.sendMessage(chatId, `✅ <b>${esc(target.name)}</b> removed successfully.`, { parse_mode: 'HTML' });
            } catch (err) {
              await bot.sendMessage(chatId, `❌ Delete error: ${esc(err.message)}`, { parse_mode: 'HTML' });
            }
          }
        }
      } else {
        // Fallback for registered chats sending random text
        const oneAccount = accounts[0];
        if (oneAccount) {
            await bot.sendMessage(chatId, `Hi <b>${esc(oneAccount.name)}</b>! Send /balance to see your data or /help for more options.`, { parse_mode: 'HTML' });
        }
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
