const fs = require('fs');
const path = require('path');

// NOTE: In a production environment like Vercel, a real database (Supabase, MongoDB, etc.) is required.
// This local file approach is for demonstration and local testing purposes.
// To use Supabase, replace this logic with the @supabase/supabase-js client.

const DB_PATH = process.env.VERCEL ? '/tmp/db.json' : path.join(process.cwd(), 'db.json');

// Hardcoded defaults for backward compatibility
const DEFAULT_CUSTOMERS = {
  '-1002884568379': {
    name: 'Babiya',
    slug: 'babiya',
    adAccountId: 'act_243431363942629',
  },
  '-4870481368': {
    name: 'Ema',
    slug: 'ema',
    adAccountId: 'act_2976599279147919'
  }
};

function getDb() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const data = fs.readFileSync(DB_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading DB:', error.message);
  }
  return { users: { ...DEFAULT_CUSTOMERS } };
}

function saveDb(db) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
  } catch (error) {
    console.error('Error saving DB:', error.message);
  }
}

const db = {
  getUser: (chatId) => {
    const data = getDb();
    return data.users[chatId.toString()];
  },
  getUserBySlug: (slug) => {
    const data = getDb();
    const slugLower = slug.toLowerCase();
    return Object.values(data.users).find(u => u.slug && u.slug.toLowerCase() === slugLower);
  },
  registerUser: (chatId, name, adAccountId, slug) => {
    const data = getDb();
    data.users[chatId.toString()] = { 
      name, 
      adAccountId, 
      slug: slug || name.toLowerCase().replace(/[^a-z0-9]/g, '') 
    };
    saveDb(data);
  },
  getUsers: () => {
    const data = getDb();
    return data.users;
  }
};

module.exports = db;
