// File: api/dashboard.js - Password-protected backend for ads.html.
// The browser never sees the Facebook or Telegram tokens; it calls this endpoint instead.
const TelegramBot = require('node-telegram-bot-api');
const config = require('../lib/config');
const db = require('../lib/db');
const { graphGet } = require('../lib/facebook');

const bot = config.telegramBotToken ? new TelegramBot(config.telegramBotToken) : null;

const DATE_PRESETS = {
  today: 'today',
  yesterday: 'yesterday',
  last_7_days: 'last_7d',
  lifetime: 'lifetime'
};

module.exports = async (req, res) => {
  if (!config.dashboardPassword) {
    return res.status(500).json({ error: 'DASHBOARD_PASSWORD is not configured on the server.' });
  }
  if (!config.safeEqual(req.headers['x-dashboard-password'], config.dashboardPassword)) {
    return res.status(401).json({ error: 'Invalid dashboard password' });
  }

  const action = req.query?.action;

  try {
    if (req.method === 'GET' && action === 'config') {
      const users = await db.getUsers();
      return res.status(200).json({
        telegramConnected: Boolean(bot),
        facebookConnected: Boolean(config.facebookAccessToken),
        customers: users
      });
    }

    if (req.method === 'GET' && action === 'adaccounts') {
      const data = await graphGet('me', {
        fields: 'adaccounts{name,account_id,account_status,currency}'
      });
      return res.status(200).json({ adAccounts: data.adaccounts?.data || [] });
    }

    if (req.method === 'GET' && action === 'insights') {
      const adAccountId = String(req.query.adAccountId || '');
      if (!/^act_\d+$/.test(adAccountId)) {
        return res.status(400).json({ error: 'Invalid ad account id' });
      }
      const data = await graphGet(`${adAccountId}/insights`, {
        level: 'ad',
        fields: 'ad_name,ad_id,campaign_name,adset_name,impressions,clicks,spend,ctr,inline_link_clicks,actions',
        date_preset: DATE_PRESETS[req.query.range] || 'today',
        effective_status: "['ACTIVE']",
        limit: '150'
      });
      return res.status(200).json({ data: data.data || [] });
    }

    if (req.method === 'POST' && action === 'send') {
      const { slug, text } = req.body || {};
      if (!slug || !text) {
        return res.status(400).json({ error: 'slug and text are required' });
      }
      // Only allow sending to chats of registered customers.
      const customer = await db.getUserBySlug(String(slug));
      if (!customer?.chatId) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      if (!bot) {
        return res.status(500).json({ error: 'Telegram bot is not configured.' });
      }
      await bot.sendMessage(customer.chatId, String(text), { parse_mode: 'Markdown' });
      return res.status(200).json({ status: 'OK' });
    }

    return res.status(404).json({ error: 'Unknown action' });
  } catch (error) {
    console.error('Dashboard API error:', error.message);
    return res.status(500).json({ error: error.message });
  }
};
