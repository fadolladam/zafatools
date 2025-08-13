/**
 * This is the final server logic for your Telegram bot.
 * It includes your tokens directly in the code.
 * WARNING: Ensure your GitHub repository for this project is set to PRIVATE.
 * Save this file as `bot.js` inside an `api` folder in your project.
 */

import fetch from 'node-fetch';

// --- Hardcoded Tokens ---
// This is less secure than environment variables. Your GitHub repo MUST be private.
const telegramBotToken = '8469761825:AAEWqHvpgJ_nx8Ah18Y9hYy9Iw6YXSy1RBQ';
const fbAccessToken = 'EAAJ7CYH7R7ABPJm6ldz6SK8N2l4HAuJjc3GrSa2igKrn2KgOJtyZBWeZAgseIw0FIHtkC3grDZCpz4nXrWQn8men3gj8GSFggWh5bNEV9YLwJsVUeZCSwJXsbdGDCDRGf8rpmCmhCpo995g3DiFek4lNy3CYTZAKUL3h9GZCeZBhjpd1nZAqha9IGG15RFAID6v81e3gLZBDzm1xVhoFI';
const adAccountId = 'act_243431363942629';

/**
 * A helper function to call the Facebook Graph API.
 * @returns {Promise<object>} The ad account details from Facebook.
 */
async function getFacebookAdAccountDetails() {
    const fields = 'name,balance,currency';
    const url = `https://graph.facebook.com/v19.0/${adAccountId}?fields=${fields}&access_token=${fbAccessToken}`;
    
    const response = await fetch(url);
    const data = await response.json();

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
 * @param {object} request The incoming request from Telegram.
 * @param {object} response The response we send back to acknowledge receipt.
 */
export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).send({ message: 'Only POST requests are allowed' });
    }

    const { body } = request;
    const chatId = body?.message?.chat?.id;
    const messageText = body?.message?.text;

    if (!chatId || !messageText) {
        return response.status(200).send('OK');
    }

    try {
        switch (messageText) {
            case '/start':
                const startMessage = "Hello! I'm the Ad Balance Bot. Type `/balance` to get the latest balance for your ad account.";
                await sendTelegramMessage(chatId, startMessage);
                break;

            case '/balance':
                await sendTelegramMessage(chatId, 'Hold on, fetching the latest balance from Facebook...');
                const accountDetails = await getFacebookAdAccountDetails();
                
                const displayBalance = accountDetails.balance ? (parseFloat(accountDetails.balance) / 100).toFixed(2) : '0.00';
                const currency = accountDetails.currency || 'USD';
                
                const now = new Date();
                const timestamp = now.toLocaleString('en-US', { timeZone: 'Asia/Phnom_Penh' });

                const balanceMessage = `
*Ad Account Balance* ✅

*Account Name:* \`${accountDetails.name || 'N/A'}\`
*Current Balance:* \`${currency} ${displayBalance}\`

_Last updated: ${timestamp} (Phnom Penh time)_
                `;
                await sendTelegramMessage(chatId, balanceMessage, { parse_mode: 'Markdown' });
                break;
        }

    } catch (error) {
        console.error('Error processing command:', error);
        await sendTelegramMessage(chatId, `❌ Sorry, an error occurred while fetching your data.\n\n*Error:* \`${error.message}\``, { parse_mode: 'Markdown' });
    }

    response.status(200).send('OK');
}
