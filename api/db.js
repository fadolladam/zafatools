const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Configuration
const DB_PATH = process.env.VERCEL ? '/tmp/db.json' : path.join(__dirname, '..', 'db.json');
const GOOGLE_SHEET_URL = process.env.GOOGLE_SHEET_URL || "https://script.google.com/macros/s/AKfycbzy_z8eJZdm4DrACFetkF6PLOC_7jgtFrVDiV7QlOmKw6NDo15i0AzNo3FyjTtyQBY/exec";

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
        console.log(`Fetching users from Google Sheet: ${GOOGLE_SHEET_URL.substring(0, 30)}...`);
        const response = await axios.get(`${GOOGLE_SHEET_URL}?action=get`);
        
        if (!response.data || !Array.isArray(response.data)) {
          console.error('Google Sheets returned invalid data:', response.data);
          return getLocalDb().users;
        }

        console.log(`Successfully fetched ${response.data.length} users from Google Sheets.`);
        
        // Convert array from Google Sheet back to the { slug: data } object format
        const users = {};
        response.data.forEach(u => {
          // Robust Mapping: Create a case-insensitive, trimmed version of the user object
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
              slug: sLower
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

const dbInterface = { ...db, GOOGLE_SHEET_URL };
module.exports = dbInterface;
