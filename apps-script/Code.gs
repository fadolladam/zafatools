// Google Apps Script: Database API for ZafaTools
//
// The shared secret lives in Script Properties, never in code:
//   Project Settings (gear) → Script Properties → SHEET_SECRET = <same as GOOGLE_SHEET_SECRET in Vercel>
// Every request must include it, so the public web app URL alone is useless.
const SHEET_NAME = 'Users';

function isAuthorized(secret) {
  const expected = PropertiesService.getScriptProperties().getProperty('SHEET_SECRET');
  return Boolean(expected) && secret === expected;
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['ChatID', 'Name', 'AdAccountID', 'Slug', 'CreatedAt', 'LastMessageID']);
  }
  return sheet;
}

function doGet(e) {
  if (!e || !e.parameter || !isAuthorized(e.parameter.secret)) {
    return jsonResponse({ status: 'Error', message: 'Unauthorized' });
  }

  const sheet = getSheet();
  const action = e.parameter.action;

  if (action === 'get') {
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    const users = data.map(row => {
      let obj = {};
      headers.forEach((h, i) => {
        if (h) obj[h.toString().trim()] = row[i];
      });
      return obj;
    });
    return jsonResponse(users);
  }

  return jsonResponse({ status: 'Error', message: 'Unknown action' });
}

function doPost(e) {
  try {
    if (!e || !e.postData) return jsonResponse({ status: 'Error', message: 'No POST data' });

    const body = JSON.parse(e.postData.contents);
    if (!isAuthorized(body.secret)) return jsonResponse({ status: 'Error', message: 'Unauthorized' });

    const action = body.action;
    const sheet = getSheet();

    if (action === 'register') {
      const data = sheet.getDataRange().getValues();
      const slug = (body.slug || '').toString().toLowerCase();

      let rowIndex = -1;
      for (let i = 1; i < data.length; i++) {
        if (data[i][3] && data[i][3].toString().toLowerCase() === slug) {
          rowIndex = i + 1;
          break;
        }
      }

      if (rowIndex === -1) {
        sheet.appendRow([body.chatId, body.name, body.adAccountId, slug, new Date()]);
      } else {
        sheet.getRange(rowIndex, 1, 1, 3).setValues([[body.chatId.toString(), body.name.toString(), body.adAccountId.toString()]]);
      }
      return jsonResponse({ status: 'OK' });
    }

    if (action === 'remove') {
      const data = sheet.getDataRange().getValues();
      const slug = (body.slug || '').toString().toLowerCase();
      for (let i = 1; i < data.length; i++) {
        if (data[i][3] && data[i][3].toString().toLowerCase() === slug) {
          sheet.deleteRow(i + 1);
          break;
        }
      }
      return jsonResponse({ status: 'OK' });
    }

    if (action === 'updateMsgId') {
      const data = sheet.getDataRange().getValues();
      const slug = (body.slug || '').toString().toLowerCase();
      const msgId = body.lastMessageId;

      for (let i = 1; i < data.length; i++) {
        if (data[i][3] && data[i][3].toString().toLowerCase() === slug) {
          sheet.getRange(i + 1, 6).setValue(msgId);
          break;
        }
      }
      return jsonResponse({ status: 'OK' });
    }

    return jsonResponse({ status: 'Error', message: 'Unknown action' });
  } catch (err) {
    return jsonResponse({ status: 'Error', message: err.toString() });
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
