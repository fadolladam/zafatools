/**
 * ZafaTools customer database — Google Apps Script web app.
 *
 * The shared secret lives in Script Properties, never in code:
 *   Apps Script editor → Project Settings (gear) → Script Properties → Add
 *   Property: SHEET_SECRET   Value: <same value as GOOGLE_SHEET_SECRET in Vercel>
 *
 * Deploy: Deploy → New deployment → Web app → Execute as: Me, Who has access: Anyone.
 * Every request must include the secret, so the public URL alone is useless.
 *
 * Sheet layout (first row = headers): slug | chatId | name | adAccountId | lastMessageId
 */

const SHEET_NAME = 'Users';
const HEADERS = ['slug', 'chatId', 'name', 'adAccountId', 'lastMessageId'];

function isAuthorized_(secret) {
  const expected = PropertiesService.getScriptProperties().getProperty('SHEET_SECRET');
  return Boolean(expected) && secret === expected;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
  }
  return sheet;
}

function readRows_() {
  const values = getSheet_().getDataRange().getValues();
  const headers = values.shift().map(h => String(h).trim());
  return values.map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function findRowIndex_(slug) {
  const values = getSheet_().getDataRange().getValues();
  const col = values[0].map(h => String(h).trim().toLowerCase()).indexOf('slug');
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][col]).toLowerCase() === slug) return i + 1; // 1-based sheet row
  }
  return -1;
}

function columnIndex_(name) {
  const headers = getSheet_().getRange(1, 1, 1, getSheet_().getLastColumn()).getValues()[0];
  return headers.map(h => String(h).trim().toLowerCase()).indexOf(name.toLowerCase()) + 1;
}

function doGet(e) {
  if (!isAuthorized_(e.parameter.secret)) return json_({ status: 'Error', message: 'Unauthorized' });
  if (e.parameter.action === 'get') return json_(readRows_());
  return json_({ status: 'Error', message: 'Unknown action' });
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ status: 'Error', message: 'Invalid JSON' });
  }
  if (!isAuthorized_(body.secret)) return json_({ status: 'Error', message: 'Unauthorized' });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSheet_();
    const slug = String(body.slug || '').toLowerCase();
    if (!slug) return json_({ status: 'Error', message: 'slug is required' });
    const row = findRowIndex_(slug);

    if (body.action === 'register') {
      // Keys are lowercase so they match headers regardless of their capitalisation.
      const record = { slug, chatid: String(body.chatId), name: body.name, adaccountid: body.adAccountId, lastmessageid: '' };
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim().toLowerCase());
      const values = headers.map(h => record[h] !== undefined ? record[h] : '');
      if (row > 0) sheet.getRange(row, 1, 1, values.length).setValues([values]);
      else sheet.appendRow(values);
      return json_({ status: 'OK' });
    }

    if (body.action === 'remove') {
      if (row > 0) sheet.deleteRow(row);
      return json_({ status: 'OK' });
    }

    if (body.action === 'updateMsgId') {
      const col = columnIndex_('lastMessageId');
      if (row > 0 && col > 0) sheet.getRange(row, col).setValue(body.lastMessageId);
      return json_({ status: 'OK' });
    }

    return json_({ status: 'Error', message: 'Unknown action' });
  } finally {
    lock.releaseLock();
  }
}
