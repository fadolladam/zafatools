// File: api/cron.js

// Import the necessary libraries
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// --- Configuration ---
// These are the same tokens from your bot.js file
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN || '8469761825:AAEWqHvpgJ_nx8Ah18Y9hYy9Iw6YXSy1RBQ';
const facebookAccessToken = process.env.FACEBOOK_ACCESS_TOKEN || 'EAAJ7CYH7R7ABPAv4XcFeIYC89azmf5bVcxtDJZAe9VPSnp8HpaJ7B4l8wEOdrA8eVcCJ8CZBU1MZCCVwe9mBQCfZBdFUunllNWgYyslbL87BjakoUuu8nMibyjCh8VXQpWkzZBjfvlYlyUotOFfsCmWxLvu6Od2pMTzb8zS5Bepf8QLUnTw45VrTqZC1NF0Kbf6frbuVbSXyIVgEzkF1nKACWIzFwpLNkvbqCoNhfQAI4sRS2MqaZBi';
const adAccountId = 'act_243431363942629';

// --- IMPORTANT ---
// The ID below is your BOT's ID. This will NOT work.
// You MUST replace it with your PERSONAL User ID from @userinfobot.
const MY_CHAT_ID = '8469761825'; 

// Initialize the Telegram Bot
const bot = new TelegramBot(telegramBotToken);

/**
 * Fetches data from the Facebook Graph API.
 */
async function fetchAccountDetails() {
    if (!facebookAccessToken) {
        throw new Error('Facebook Access Token is not configured.');
    }
    const fields = 'name,balance,currency';
    const url = `https://graph.facebook.com/v19.0/${adAccountId}?fields=${fields}&access_token=${facebookAccessToken}`;
    try {
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        const errorMessage = error.response ? error.response.data.error.message : error.message;
        console.error("Facebook API Error:", errorMessage);
        throw new Error('Failed to fetch details from Facebook.');
    }
}

// --- Vercel Serverless Function (for Cron Job) ---
module.exports = async (req, res) => {
    // Security check to ensure the request is from Vercel's Cron service
    if (req.headers['x-vercel-cron-secret'] !== process.env.CRON_SECRET) {
        // For local testing, you might want to bypass this check.
        // But for production, it's a good security measure.
        // return res.status(401).send('Unauthorized');
    }

    console.log("--- Cron Job Started ---");

    if (!MY_CHAT_ID || MY_CHAT_ID === 'YOUR_CHAT_ID') {
        console.error("FATAL: Telegram Chat ID is not set in the code.");
        return res.status(500).send("Chat ID not configured.");
    }

    try {
        const accountDetails = await fetchAccountDetails();
        const balance = parseFloat(accountDetails.balance) / 100;
        const formattedBalance = balance.toFixed(2);

        // --- 1. Send the Daily 7 AM Report ---
        const dailyReportMessage = `
☀️ **Good Morning! Here is your 7 AM Report** ☀️

**Account Name:** ${accountDetails.name}
**Current Balance:** $${formattedBalance} ${accountDetails.currency}
        `;
        await bot.sendMessage(MY_CHAT_ID, dailyReportMessage, { parse_mode: 'Markdown' });
        console.log("Successfully sent daily report.");

        // --- 2. Check if Balance Exceeds $600 ---
        if (balance > 600) {
            const alertMessage = `
🚨 **High Balance Alert!** 🚨

The ad account balance is **$${formattedBalance}**, which is over the $600 threshold.
            `;
            await bot.sendMessage(MY_CHAT_ID, alertMessage, { parse_mode: 'Markdown' });
            console.log("High balance alert sent.");
        }

    } catch (error) {
        console.error("Cron Job Error:", error.message);
        // Send an error message to yourself if the job fails
        await bot.sendMessage(MY_CHAT_ID, `⚠️ **Bot Error:**\nFailed to run scheduled task. \nError: ${error.message}`);
    }

    console.log("--- Cron Job Finished ---");
    res.status(200).send('OK');
};
