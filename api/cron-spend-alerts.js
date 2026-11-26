const TelegramBot = require('node-telegram-bot-api');
const config = require('../lib/config');
const db = require('../lib/db');
const { graphGet, fetchAccountDetails } = require('../lib/facebook');

const bot = config.telegramBotToken ? new TelegramBot(config.telegramBotToken) : null;

function accountDateKey(timeZone) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: timeZone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!config.cronSecret || !config.safeEqual(req.headers.authorization, `Bearer ${config.cronSecret}`)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!bot || !config.facebookAccessToken) {
    return res.status(500).json({ error: 'Telegram or Facebook API is not configured.' });
  }

  let checked = 0;
  let notified = 0;
  let failed = 0;

  try {
    const users = await db.getUsers();
    for (const account of Object.values(users)) {
      if (!account.chatId || !account.adAccountId || !Number.isFinite(account.spendLimit) || account.spendLimit <= 0) continue;
      checked++;
      let stage = 'fetch_spend';
      try {
        const accountId = String(account.adAccountId);
        if (!/^act_\d+$/.test(accountId)) throw new Error('Invalid ad account id');

        const [insights, details] = await Promise.all([
          graphGet(`${accountId}/insights`, { fields: 'spend', date_preset: 'today', level: 'account', limit: 1 }),
          fetchAccountDetails(accountId)
        ]);
        const spend = Number(insights.data?.[0]?.spend || 0);
        if (!Number.isFinite(spend) || spend < account.spendLimit) continue;

        stage = 'claim_alert';
        const alertDate = accountDateKey(details.timezone_name);
        const claim = await db.claimSpendAlert(account.slug, alertDate);
        if (!claim.claimed) continue;

        let sent = false;
        try {
          stage = 'send_telegram';
          await bot.sendMessage(
            account.chatId,
            `🚨 Ad spend limit reached\n\nAccount: ${account.name}\nToday's spend: ${details.currency} ${spend.toFixed(2)}\nYour limit: ${details.currency} ${account.spendLimit.toFixed(2)}\n\nWhile spend stays at or above the limit, reminders repeat every 15 minutes.`
          );
          sent = true;
          notified++;
        } finally {
          if (sent) stage = 'finish_alert';
          await db.finishSpendAlert(account.slug, claim.claimToken, sent);
        }
      } catch (error) {
        failed++;
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Spend alert check failed for ${account.slug} during ${stage}: ${message}`);
      }
    }
    return res.status(failed ? 503 : 200).json({ ok: failed === 0, checked, notified, failed });
  } catch (error) {
    console.error('Spend alert cron failed.');
    return res.status(500).json({ error: 'Spend alert check failed.' });
  }
};
