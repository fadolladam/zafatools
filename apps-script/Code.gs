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
  const headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  ['BalanceLimit', 'LastAlertDate', 'LastAlertAt', 'AlertClaim'].forEach(name => {
    if (headers.indexOf(name) === -1) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(name);
      headers.push(name);
    }
  });
  return sheet;
}

function columnIndex(sheet, name) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  return headers.indexOf(name) + 1;
}

function findSlugRow(sheet, slug) {
  const data = sheet.getDataRange().getValues();
  const slugColumn = columnIndex(sheet, 'Slug') - 1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][slugColumn] && data[i][slugColumn].toString().toLowerCase() === slug.toLowerCase()) return i + 1;
  }
  return -1;
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

    if (action === 'setBalanceLimit') {
      const limit = Number(body.balanceLimit);
      if (!body.slug || !Number.isFinite(limit) || limit < 0 || limit > 1000000000) {
        return jsonResponse({ status: 'Error', message: 'Invalid outstanding balance limit' });
      }
      const row = findSlugRow(sheet, body.slug.toString());
      if (row === -1) return jsonResponse({ status: 'Error', message: 'Account not found' });
      sheet.getRange(row, columnIndex(sheet, 'BalanceLimit')).setValue(limit);
      return jsonResponse({ status: 'OK' });
    }

    if (action === 'claimSpendAlert') {
      const lock = LockService.getScriptLock();
      lock.waitLock(10000);
      try {
        const row = findSlugRow(sheet, body.slug.toString());
        if (row === -1) return jsonResponse({ status: 'Error', message: 'Account not found' });
        const lastAlertDate = sheet.getRange(row, columnIndex(sheet, 'LastAlertDate')).getValue().toString();
        const lastAlertAtValue = sheet.getRange(row, columnIndex(sheet, 'LastAlertAt')).getValue();
        const lastAlertAt = lastAlertAtValue instanceof Date
          ? lastAlertAtValue.getTime()
          : (Date.parse(lastAlertAtValue) || 0);
        if (!lastAlertAt && body.alertDate && lastAlertDate === body.alertDate) {
          // Migrate a same-day alert from the old daily-only cooldown.
          sheet.getRange(row, columnIndex(sheet, 'LastAlertAt')).setValue(new Date());
          return jsonResponse({ status: 'OK', claimed: false });
        }
        const claimCell = sheet.getRange(row, columnIndex(sheet, 'AlertClaim'));
        const claim = claimCell.getValue().toString();
        const now = Date.now();
        const claimParts = claim.split('|');
        const cooldownMs = 15 * 60 * 1000;
        const claimIsActive = claimParts.length === 2 && now - Number(claimParts[1]) < 10 * 60 * 1000;
        if ((lastAlertAt > 0 && now - lastAlertAt < cooldownMs) || claimIsActive) {
          return jsonResponse({ status: 'OK', claimed: false });
        }
        const claimToken = Utilities.getUuid();
        claimCell.setValue(claimToken + '|' + now);
        return jsonResponse({ status: 'OK', claimed: true, claimToken });
      } finally {
        lock.releaseLock();
      }
    }

    if (action === 'finishSpendAlert') {
      const lock = LockService.getScriptLock();
      lock.waitLock(10000);
      try {
        const row = findSlugRow(sheet, body.slug.toString());
        if (row === -1) return jsonResponse({ status: 'Error', message: 'Account not found' });
        const claimCell = sheet.getRange(row, columnIndex(sheet, 'AlertClaim'));
        const claim = claimCell.getValue().toString().split('|')[0];
        if (claim === body.claimToken) {
          if (body.sent === true) sheet.getRange(row, columnIndex(sheet, 'LastAlertAt')).setValue(new Date());
          claimCell.clearContent();
        }
        return jsonResponse({ status: 'OK' });
      } finally {
        lock.releaseLock();
      }
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
