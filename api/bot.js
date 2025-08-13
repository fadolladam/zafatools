// File: api/bot.js

// Import the necessary libraries
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN || '8469761825:AAEWqHvpgJ_nx8Ah18Y9hYy9Iw6YXSy1RBQ';
const facebookAccessToken = process.env.FACEBOOK_ACCESS_TOKEN || 'EAAJ7CYH7R7ABPAv4XcFeIYC89azmf5bVcxtDJZAe9VPSnp8HpaJ7B4l8wEOdrA8eVcCJ8CZBU1MZCCVwe9mBQCfZBdFUunllNWgYyslbL87BjakoUuu8nMibyjCh8VXQpWkzZBjfvlYlyUotOFfsCmWxLvu6Od2pMTzb8zS5Bepf8QLUnTw45VrTqZC1NF0Kbf6frbuVbSXyIVgEzkF1nKACWIzFwpLNkvbqCoNhfQAI4sRS2MqaZBi';
const adAccountId = 'act_243431363942629';

let bot;
if (telegramBotToken) {
    bot = new TelegramBot(telegramBotToken);
}

/**
 * Fetches data from the Facebook Graph API.
 * @returns {Promise<object>} A promise that resolves with the ad account data.
 */
async function fetchAccountDetails() {
    // Check if the Facebook token is missing
    if (!facebookAccessToken) {
        throw new Error('Facebook Access Token is not configured.');
    }

    const fields = 'name,balance,currency';
    const url = `https://graph.facebook.com/v19.0/${adAccountId}?fields=${fields}&access_token=${facebookAccessToken}`;

    try {
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        // Log the detailed error from Facebook on the server for debugging
        console.error('Error fetching from Facebook API:', error.response ? error.response.data.error.message : error.message);
        throw new Error('Failed to fetch details from Facebook. The token might be invalid or expired.');
    }
}

// --- Vercel Serverless Function ---
// This is the main handler for Vercel.
module.exports = async (req, res) => {
    // Ensure the bot is initialized before processing updates.
    if (!bot) {
        console.error('Bot not initialized. Telegram Token is missing.');
        return res.status(500).send('Bot not initialized');
    }

    // --- Bot Command Handlers (defined inside the main function) ---
    bot.onText(/\/balance/, async (msg) => {
        const chatId = msg.chat.id;
        bot.sendMessage(chatId, 'Hold on, fetching your ad account balance... ⏳');

        try {
            const accountDetails = await fetchAccountDetails();
            const formattedBalance = (parseFloat(accountDetails.balance) / 100).toFixed(2);
            const replyMessage = `
✅ **Ad Account Details** ✅

**Account Name:** ${accountDetails.name}
**Current Balance:** ${formattedBalance} ${accountDetails.currency}
            `;
            bot.sendMessage(chatId, replyMessage, { parse_mode: 'Markdown' });
        } catch (error) {
            bot.sendMessage(chatId, `❌ Oops! Something went wrong.\n\n**Error:** ${error.message}`);
        }
    });

    bot.on('message', (msg) => {
        if (msg.text && (msg.text.startsWith('/balance') || msg.text.startsWith('/start'))) {
            return; // Ignore commands handled by onText
        }
        bot.sendMessage(msg.chat.id, "Hi! I'm your Ad Balance Bot. Send /balance to get the latest update.");
    });
    
    // This command is useful for checking if the bot is alive.
    bot.onText(/\/start/, (msg) => {
        bot.sendMessage(msg.chat.id, "I'm alive! Send /balance to get your ad account details.");
    });


    try {
        // We need to process the update and then remove all listeners to prevent them from stacking up on Vercel
        await bot.processUpdate(req.body);
        bot.removeAllListeners();
    } catch (error) {
        console.error('Error processing update:', error);
    }
    
    res.status(200).send('OK');
};
