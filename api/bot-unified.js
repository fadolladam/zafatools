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
// To add a new customer:
// 1. Add the bot to their Telegram group
// 2. Send a message to the bot from that group
// 3. Check the logs to see the chat ID that appears
// 4. Add the chat ID and their ad account details below

const CUSTOMERS = {
  // Babiya's Chat ID (already configured)
  '-1002884568379': {
    name: 'Babiya',
    adAccountId: 'act_243431363942629',
  },
  // Ema's Chat ID
  '-4870481368': {
    name: 'Ema',
    adAccountId: 'act_2976599279147919'
  }
};

const ADS_DATE_PRESETS = {
  today: 'today',
  yesterday: 'yesterday',
  '7day': 'last_7d',
  maximum: 'lifetime',
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

async function fetchActiveAds(adAccountId, presetKey = 'today', limit = 5) {
  if (!facebookAccessToken) {
    throw new Error('Facebook Access Token is not configured.');
  }

  const datePreset = ADS_DATE_PRESETS[presetKey] || ADS_DATE_PRESETS.today;
  const url = `https://graph.facebook.com/v19.0/${adAccountId}/insights`;
  const params = {
    access_token: facebookAccessToken,
    level: 'ad',
    date_preset: datePreset,
    fields: [
      'ad_name',
      'campaign_name',
      'spend',
      'actions',
      'cost_per_action_type',
      'impressions',
      'clicks',
    ].join(','),
    effective_status: '["ACTIVE"]',
    limit,
  };

  try {
    const response = await axios.get(url, { params });
    const records = response.data?.data || [];

    return records.map((entry) => {
      const actions = entry.actions || [];
      const costPer = entry.cost_per_action_type || [];

      let messagingResults = 0;
      actions.forEach((action) => {
        if (action.action_type && MESSAGING_ACTION_TYPES.has(action.action_type)) {
          messagingResults += parseFloat(action.value || 0);
        }
      });

      const messagingCostEntry = costPer.find(
        (action) => action.action_type && MESSAGING_ACTION_TYPES.has(action.action_type)
      );

      return {
        adName: entry.ad_name || 'Unnamed Ad',
        campaignName: entry.campaign_name || '—',
        spend: parseFloat(entry.spend || 0),
        messagingResults,
        costPerMessaging: messagingCostEntry
          ? parseFloat(messagingCostEntry.value || 0)
          : null,
      };
    });
  } catch (error) {
    const errorMessage =
      error.response?.data?.error?.message || error.message || 'Unknown error';
    throw new Error(errorMessage);
  }
}

function normalisePresetKey(rawPreset = '') {
  const value = rawPreset.toLowerCase();
  if (value === 'today') return 'today';
  if (value === 'yesterday') return 'yesterday';
  if (['7day', '7days', 'last7', 'week', '7d'].includes(value)) return '7day';
  if (['maximum', 'max', 'lifetime', 'all'].includes(value)) return 'maximum';
  return 'today';
}

function escapeMarkdown(text = '') {
  return String(text).replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

function formatAdsMessage(customerName, presetLabel, ads) {
  if (!ads.length) {
    return `⚠️ No active ads found for *${escapeMarkdown(customerName)}* (${escapeMarkdown(
      presetLabel
    )}).`;
  }

  const lines = [
    `📊 *${escapeMarkdown(customerName)} — Active Ads (${escapeMarkdown(presetLabel)})*`,
    '',
  ];

  ads.forEach((ad, index) => {
    const spendText = ad.spend != null ? ad.spend.toFixed(2) : '0.00';
    const messagingText =
      ad.messagingResults != null ? ad.messagingResults.toFixed(0) : '0';
    const costText =
      ad.costPerMessaging != null ? ad.costPerMessaging.toFixed(2) : 'N/A';

    lines.push(`*${index + 1}. ${escapeMarkdown(ad.adName)}*`);
    lines.push(`Campaign: ${escapeMarkdown(ad.campaignName)}`);
    lines.push(`Messaging Conversations: ${messagingText}`);
    lines.push(`Cost per Messaging Conversation: ${costText}`);
    lines.push(`Amount Spent: ${spendText}`);
    lines.push('');
  });

  lines.push('_Messaging metrics include supported conversation action types._');
  return lines.join('\n');
}

// --- Vercel Serverless Function ---
module.exports = async (req, res) => {
  console.log('--- Unified Bot Function Started ---');
  console.log('Request method:', req.method);

  try {
    // Handle webhook verification from Telegram
    if (req.method === 'GET') {
      const mode = req.query?.mode;
      if (mode === 'config') {
        console.log('Serving configuration payload for frontend client.');
        return res.status(200).json({
          telegramBotToken,
          facebookAccessToken,
          customers: CUSTOMERS,
        });
      }

      return res.status(200).send('Unified Telegram Bot Webhook Endpoint');
    }

    if (!bot) {
      console.error('FATAL: Bot not initialized.');
      return res.status(500).json({ error: 'Bot not initialized' });
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
      } else if (text.startsWith('/ads')) {
        console.log(`Processing /ads command for ${customer.name}: "${text}"`);

        const parts = text.trim().split(/\s+/);
        const requestedPreset = parts[1] || 'today';
        const presetKey = normalisePresetKey(requestedPreset);
        const presetLabel = PRESET_LABELS[presetKey] || PRESET_LABELS.today;

        await bot.sendMessage(
          chatId,
          `Fetching active ads for ${presetLabel}... ⏳`
        );

        try {
          const ads = await fetchActiveAds(customer.adAccountId, presetKey);
          const replyMessage = formatAdsMessage(customer.name, presetLabel, ads);
          await bot.sendMessage(chatId, replyMessage, { parse_mode: 'Markdown' });
        } catch (error) {
          console.error(
            `Error in /ads handler for ${customer.name}:`,
            error.message
          );
          await bot.sendMessage(
            chatId,
            `❌ Failed to fetch ads.\n\n**Error:** ${error.message}`
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
