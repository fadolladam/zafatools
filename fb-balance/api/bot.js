/**
 * This is the enhanced server logic for your Telegram bot.
 * Save this file as `bot.js` inside an `api` folder in your project.
 * It is designed to be deployed as a Vercel Serverless Function.
 */

// We use 'node-fetch' for making HTTP requests, as it's common in serverless environments.
import fetch from 'node-fetch';

// --- Environment Variables ---
// These sensitive values will be set in your Vercel project settings, not in the code.
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
const fbAccessToken = process.env.FB_ACCESS_TOKEN;
const adAccountId = process.env.FB_AD_ACCOUNT_ID;

/**
 * A helper function to call the Facebook Graph API.
 * @returns {Promise<object>} The ad account details from Facebook.
 */
async function getFacebookAdAccountDetails() {
    // Ensure server environment variables are configured before making a call.
    if (!adAccountId || !fbAccessToken) {
        throw new Error('Facebook Access Token or Ad Account ID is not configured on the server.');
    }
    
    // We only request the fields we absolutely need: name, balance, and currency.
    const fields = 'name,balance,currency';
    const url = `https://graph.facebook.com/v19.0/${adAccountId}?fields=${fields}&access_token=${fbAccessToken}`;
    
    const response = await fetch(url);
    const data = await response.json();

    // If the API returns an error, log it and throw a descriptive error.
    if (data.error) {
        console.error('Facebook API Error:', data.error);
        throw new Error(`Facebook API Error: ${data.error.message}`);
    }
    return data;
}

/**
 * A helper function to send a message via the Telegram Bot API.
 * @param {string} chatId The ID of the chat to send the message to.
 * @param {string} text The message text to send.
 * @param {object} [options] Optional parameters for the message, like parse_mode.
 */
async function sendTelegramMessage(chatId, text, options = {}) {
    const url = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: text,
                ...options,
            }),
        });
    } catch (error) {
        console.error("Failed to send Telegram message:", error);
    }
}

/**
 * This is the main handler for the Vercel Serverless Function.
 * Vercel will run this function every time Telegram sends an update.
 * @param {object} request The incoming request from Telegram.
 * @param {object} response The response we send back to acknowledge receipt.
 */
export default async function handler(request, response) {
    // Ensure the request is a POST request, which is what Telegram webhooks use.
    if (request.method !== 'POST') {
        return response.status(405).send({ message: 'Only POST requests are allowed' });
    }

    const { body } = request;
    const chatId = body?.message?.chat?.id;
    const messageText = body?.message?.text;

    // If there's no message or chat ID, we can't do anything.
    if (!chatId || !messageText) {
        return response.status(200).send('OK');
    }

    try {
        // --- Command Router ---
        switch (messageText) {
            case '/start':
                const startMessage = "Hello! I'm the Ad Balance Bot. Type `/balance` to get the latest balance for your ad account.";
                await sendTelegramMessage(chatId, startMessage);
                break;

            case '/balance':
                // Immediately send a "loading" message so the user knows the bot is working.
                await sendTelegramMessage(chatId, 'Hold on, fetching the latest balance from Facebook...');

                // Get the latest data from the Facebook API.
                const accountDetails = await getFacebookAdAccountDetails();
                
                // Format the final response message using Markdown for nice formatting.
                const displayBalance = accountDetails.balance ? (parseFloat(accountDetails.balance) / 100).toFixed(2) : '0.00';
                const currency = accountDetails.currency || 'USD'; // Default to USD if not provided
                
                // Get current timestamp
                const now = new Date();
                const timestamp = now.toLocaleString('en-US', { timeZone: 'Asia/Phnom_Penh' });

                const balanceMessage = `
*Ad Account Balance* ✅

*Account Name:* \`${accountDetails.name || 'N/A'}\`
*Current Balance:* \`${currency} ${displayBalance}\`

_Last updated: ${timestamp} (Phnom Penh time)_
                `;

                // Send the formatted message back to the Telegram group.
                await sendTelegramMessage(chatId, balanceMessage, { parse_mode: 'Markdown' });
                break;
        }

    } catch (error) {
        // If anything goes wrong, log the error to the Vercel console
        // and send a helpful error message back to the user.
        console.error('Error processing command:', error);
        await sendTelegramMessage(chatId, `❌ Sorry, an error occurred while fetching your data. Please check the server logs.\n\n*Error:* \`${error.message}\``, { parse_mode: 'Markdown' });
    }

    // Finally, send a 200 OK response to Telegram to let them know we received the update.
    response.status(200).send('OK');
}
