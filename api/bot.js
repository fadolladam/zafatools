// File: api/bot.js

// Import the necessary libraries
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// --- Configuration ---
// SECURITY WARNING: Hardcoding tokens is risky. It's safer to use Vercel Environment Variables.
// This code will use the hardcoded tokens below if they are not found in Vercel's settings.

const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN || '8469761825:AAEWqHvpgJ_nx8Ah18Y9hYy9Iw6YXSy1RBQ';
const facebookAccessToken = process.env.FACEBOOK_ACCESS_TOKEN || 'EAAJ7CYH7R7ABPAv4XcFeIYC89azmf5bVcxtDJZAe9VPSnp8HpaJ7B4l8wEOdrA8eVcCJ8CZBU1MZCCVwe9mBQCfZBdFUunllNWgYyslbL87BjakoUuu8nMibyjCh8VXQpWkzZBjfvlYlyUotOFfsCmWxLvu6Od2pMTzb8zS5Bepf8QLUnTw45VrTqZC1NF0Kbf6frbuVbSXyIVgEzkF1nKACWIzFwpLNkvbqCoNhfQAI4sRS2MqaZBi';

const adAccountId = 'act_243431363942629';

// Initialize the Telegram Bot
// A check is added to prevent the bot from crashing if tokens are missing.
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

    try {
        const message = req.body.message;

        // Check if there is a message and text to process
        if (message && message.text) {
            const chatId = message.chat.id;
            const text = message.text;

            // Handle commands directly instead of using listeners
            if (text === '/start') {
                await bot.sendMessage(chatId, "I'm alive! Send /balance to get your ad account details.");
            } else if (text === '/balance') {
                await bot.sendMessage(chatId, 'Hold on, fetching your ad account balance... ⏳');
                try {
                    const accountDetails = await fetchAccountDetails();
                    const formattedBalance = (parseFloat(accountDetails.balance) / 100).toFixed(2);
                    const replyMessage = `
✅ **Ad Account Details** ✅

**Account Name:** ${accountDetails.name}
**Current Balance:** ${formattedBalance} ${accountDetails.currency}
                    `;
                    await bot.sendMessage(chatId, replyMessage, { parse_mode: 'Markdown' });
                } catch (error) {
                    await bot.sendMessage(chatId, `❌ Oops! Something went wrong.\n\n**Error:** ${error.message}`);
                }
            } else {
                // Default message for any other text
                await bot.sendMessage(chatId, "Hi! I'm your Ad Balance Bot. Send /balance to get the latest update.");
            }
        }
    } catch (error) {
        console.error('Error processing update:', error);
    }
    
    // Always respond to Telegram to acknowledge the webhook
    res.status(200).send('OK');
};
