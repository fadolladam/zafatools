const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Configuration
const DB_PATH = process.env.VERCEL ? '/tmp/db.json' : path.join(__dirname, '..', 'db.json');
const GOOGLE_SHEET_URL = process.env.GOOGLE_SHEET_URL;

// Initial Hardcoded defaults
const DEFAULT_CUSTOMERS = {
  'babiya': {
    chatId: '-1002884568379',
    name: 'Babiya',
    slug: 'babiya',
    adAccountId: 'act_243431363942629',
  },
  'ema': {
    chatId: '-4870481368',
    name: 'Ema',
    slug: 'ema',
    adAccountId: 'act_2976599279147919'
  }
};

// --- Local File Helpers ---
function getLocalDb() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const data = fs.readFileSync(DB_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading Local DB:', error.message);
  }
  return { users: { ...DEFAULT_CUSTOMERS } };
}

function saveLocalDb(dbData) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(dbData, null, 2), 'utf8');
  } catch (error) {
    console.error('Error saving Local DB:', error.message);
  }
}

// --- Unified Database Interface (Async) ---
const db = {
  getUsers: async () => {
    if (GOOGLE_SHEET_URL) {
      try {
        const response = await axios.get(`${GOOGLE_SHEET_URL}?action=get`);
        // Convert array from Google Sheet back to the { slug: data } object format
        const users = {};
        response.data.forEach(u => {
          if (u.Slug) {
            users[u.Slug.toLowerCase()] = {
              chatId: u.ChatID.toString(),
              name: u.Name,
              adAccountId: u.AdAccountID,
              slug: u.Slug.toLowerCase()
            };
          }
        });
        return users;
      } catch (err) {
        console.error('Google Sheets GET error:', err.message);
      }
    }
    // Fallback to local
    const data = getLocalDb();
    return data.users;
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
    
    if (GOOGLE_SHEET_URL) {
      try {
        await axios.post(GOOGLE_SHEET_URL, {
          action: 'register',
          chatId: chatId.toString(),
          name,
          adAccountId,
          slug: userSlug
        });
        return;
      } catch (err) {
        console.error('Google Sheets POST error:', err.message);
      }
    }

    // Fallback to local
    const data = getLocalDb();
    data.users[userSlug] = { 
      chatId: chatId.toString(),
      name, 
      adAccountId, 
      slug: userSlug 
    };
    saveLocalDb(data);
  },

  removeUser: async (slug) => {
    const userSlug = slug.toLowerCase();
    
    if (GOOGLE_SHEET_URL) {
      try {
        await axios.post(GOOGLE_SHEET_URL, {
          action: 'remove',
          slug: userSlug
        });
        return;
      } catch (err) {
        console.error('Google Sheets REMOVE error:', err.message);
      }
    }

    // Fallback to local
    const data = getLocalDb();
    delete data.users[userSlug];
    saveLocalDb(data);
  }
};

module.exports = db;
