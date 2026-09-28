// Customer database backed by the Google Apps Script web app (see apps-script/Code.gs).
const axios = require('axios');
const { googleSheetUrl: GOOGLE_SHEET_URL, googleSheetSecret: GOOGLE_SHEET_SECRET } = require('./config');

async function sheetPost(payload) {
  if (!GOOGLE_SHEET_URL) throw new Error('GOOGLE_SHEET_URL is not configured.');
  const response = await axios.post(GOOGLE_SHEET_URL, { ...payload, secret: GOOGLE_SHEET_SECRET }, {
    maxRedirects: 5,
    validateStatus: (status) => status >= 200 && status < 400
  });
  if (response.data?.status !== 'OK') {
    throw new Error(`Google Sheets error: ${response.data?.message || 'unexpected response'}`);
  }
  return response.data;
}

const db = {
  getUsers: async () => {
    if (!GOOGLE_SHEET_URL) throw new Error('GOOGLE_SHEET_URL is not configured.');
    const response = await axios.get(GOOGLE_SHEET_URL, {
      params: { action: 'get', secret: GOOGLE_SHEET_SECRET }
    });

    if (!Array.isArray(response.data)) {
      throw new Error(`Google Sheets error: ${response.data?.message || 'invalid data'}`);
    }

    // Convert array from Google Sheet to the { slug: data } object format
    const users = {};
    response.data.forEach(u => {
      // Case-insensitive, trimmed header names
      const normalized = {};
      Object.keys(u).forEach(k => {
        normalized[k.trim().toLowerCase()] = u[k];
      });

      const slug = normalized['slug'];
      if (slug) {
        const sLower = slug.toString().toLowerCase();
        users[sLower] = {
          chatId: (normalized['chatid'] || '').toString().trim(),
          name: (normalized['name'] || '').toString(),
          adAccountId: (normalized['adaccountid'] || '').toString(),
          slug: sLower,
          lastMessageId: normalized['lastmessageid']
        };
      }
    });
    return users;
  },

  getUserBySlug: async (slug) => {
    const users = await db.getUsers();
    return users[slug.toLowerCase()];
  },

  getAccountsForChat: async (chatId) => {
    const users = await db.getUsers();
    const idStr = chatId.toString();
    return Object.values(users).filter(u => u.chatId === idStr);
  },

  registerUser: async (chatId, name, adAccountId, slug) => {
    const userSlug = (slug || name.toLowerCase().replace(/[^a-z0-9]/g, '')).toLowerCase();
    console.log(`Registering user "${name}" with slug "${userSlug}" to Google Sheets...`);
    await sheetPost({
      action: 'register',
      chatId: chatId.toString(),
      name,
      adAccountId,
      slug: userSlug
    });
  },

  removeUser: async (slug) => {
    await sheetPost({ action: 'remove', slug: slug.toLowerCase() });
  },

  updateLastMessageId: async (slug, messageId) => {
    await sheetPost({ action: 'updateMsgId', slug: slug.toLowerCase(), lastMessageId: messageId });
  }
};

module.exports = db;
