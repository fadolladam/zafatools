// Server-side Facebook Graph API access. The access token never leaves the server.
const axios = require('axios');
const { facebookAccessToken } = require('./config');

const GRAPH = 'https://graph.facebook.com/v19.0';

async function graphGet(path, params = {}) {
  if (!facebookAccessToken) {
    throw new Error('Facebook Access Token is not configured.');
  }
  try {
    const response = await axios.get(`${GRAPH}/${path}`, {
      params: { ...params, access_token: facebookAccessToken }
    });
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.error?.message || error.message;
    console.error('Facebook API Error:', errorMessage);
    throw new Error(
      'Failed to fetch details from Facebook. The token might be invalid or expired.'
    );
  }
}

function fetchAccountDetails(adAccountId) {
  console.log(`Attempting to fetch Facebook account details for: ${adAccountId}`);
  return graphGet(adAccountId, { fields: 'name,balance,currency' });
}

module.exports = { graphGet, fetchAccountDetails };
