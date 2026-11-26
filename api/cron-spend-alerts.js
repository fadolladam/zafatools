const TelegramBot = require('node-telegram-bot-api');
const config = require('../lib/config');
const db = require('../lib/db');
const { fetchAccountDetails } = require('../lib/facebook');

const bot = config.telegramBotToken ? new TelegramBot(config.telegramBotToken) : null;

function accountDateKey(timeZone) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: timeZone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function fromMetaCurrencyUnits(amount, currency) {
  const rawAmount = Number(amount);
  if (!Number.isFinite(rawAmount)) throw new Error('Meta returned an invalid outstanding balance');
  let fractionDigits = 2;
  try {
    fractionDigits = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits;
  } catch (_) {
    // Use two decimal places for an unrecognized currency code.
  }
  return rawAmount / (10 ** fractionDigits);
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
      if (!account.chatId || !account.adAccountId || !Number.isFinite(account.balanceLimit) || account.balanceLimit <= 0) continue;
      checked++;
      let stage = 'fetch_balance';
      try {
        const accountId = String(account.adAccountId);
        if (!/^act_\d+$/.test(accountId)) throw new Error('Invalid ad account id');

        const details = await fetchAccountDetails(accountId);
        const outstandingBalance = fromMetaCurrencyUnits(details.balance, details.currency);
        if (outstandingBalance < account.balanceLimit) continue;

        stage = 'claim_alert';
        const alertDate = accountDateKey(details.timezone_name);
        const claim = await db.claimSpendAlert(account.slug, alertDate);
        if (!claim.claimed) continue;

        let sent = false;
        try {
          stage = 'send_telegram';
          await bot.sendMessage(
            account.chatId,
            `🚨 Outstanding balance limit reached\n\nAccount: ${account.name}\nAmount due: ${details.currency} ${outstandingBalance.toFixed(2)}\nYour alert limit: ${details.currency} ${account.balanceLimit.toFixed(2)}\n\nWhile the outstanding balance stays at or above the limit, reminders repeat every 15 minutes.`
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
