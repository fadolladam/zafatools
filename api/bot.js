// File: api/bot.js

// This top-level try/catch is a safety net for any unexpected initialization errors.
try {
    // Import the necessary libraries
    const TelegramBot = require('node-telegram-bot-api');
    const axios = require('axios');

    // --- Configuration ---
    const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN || '8469761825:AAEWqHvpgJ_nx8Ah18Y9hYy9Iw6YXSy1RBQ';
    const facebookAccessToken = process.env.FACEBOOK_ACCESS_TOKEN || 'EAAJ7CYH7R7ABPOXZAu2NVdXkh9OYYLi8PucbaMvXBSDOvMmkiLrxnIY8wzJnp3FKySTNvJLwxTDZABnMd6CREfniDC2OhOYG2U7XVjf2GBkR0xQicIAr7FzsqbdxxCjQTx98G4ElVE4hfaPTwai2ACctxVRRH4oAflatPbPUZBHmbkRziY2osVJe6ZBavTr2jOIMgTLvWSUx';
    const adAccountId = 'act_243431363942629';

    // Initialize the Telegram Bot
    let bot;
    if (telegramBotToken) {
        bot = new TelegramBot(telegramBotToken);
    }

    /**
     * Fetches data from the Facebook Graph API.
     */
    async function fetchAccountDetails() {
        console.log("Attempting to fetch Facebook account details...");
        if (!facebookAccessToken) {
            console.error("Facebook Access Token is missing!");
            throw new Error('Facebook Access Token is not configured.');
        }

        const fields = 'name,balance,currency';
        const url = `https://graph.facebook.com/v19.0/${adAccountId}?fields=${fields}&access_token=${facebookAccessToken}`;

        try {
            const response = await axios.get(url);
            console.log("Successfully fetched details from Facebook.");
            return response.data;
        } catch (error) {
            const errorMessage = error.response ? error.response.data.error.message : error.message;
            console.error("Facebook API Error:", errorMessage);
            throw new Error('Failed to fetch details from Facebook. The token might be invalid or expired.');
        }
    }

    // --- Vercel Serverless Function ---
    module.exports = async (req, res) => {
        console.log("--- Vercel Function Started ---");

        if (!bot) {
            console.error("FATAL: Bot not initialized. Telegram Token is likely missing.");
            return res.status(500).send('Bot not initialized');
        }

        try {
            const message = req.body.message;

            if (message && message.text) {
                const chatId = message.chat.id;
                const text = message.text;
                console.log(`Received message from chat ID ${chatId}: "${text}"`);

                if (text === '/start') {
                    console.log("Processing /start command.");
                    await bot.sendMessage(chatId, "I'm alive! Send /balance to get your ad account details.");
                } else if (text === '/balance') {
                    console.log("Processing /balance command.");
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
                        console.log("Successfully sent balance details.");
                    } catch (error) {
                        console.error("Error in /balance handler:", error.message);
                        await bot.sendMessage(chatId, `❌ Oops! Something went wrong.\n\n**Error:** ${error.message}`);
                    }
                } else {
                    console.log("Processing default message.");
                    await bot.sendMessage(chatId, "Hi! I'm your Ad Balance Bot. Send /balance to get the latest update.");
                }
            } else {
                 console.log("Received a request without a message body, ignoring.");
            }
        } catch (error) {
            console.error("A critical error occurred in the main handler:", error);
        }
        
        console.log("--- Vercel Function Finished ---");
        res.status(200).send('OK');
    };

} catch (e) {
    // This will log any errors that happen during the initial setup of the file.
    console.error("A fatal error occurred during initialization:", e);
}
