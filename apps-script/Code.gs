const ALLOWED_EVALUATORS = ['Luciana', 'Idejan', 'Laércio', 'Cláudia', 'Beto', 'Thierry'];
const REVIEW_HEADERS = [
  'Evaluator', 'UID', 'Section', 'Phase ID', 'Phase Number', 'Display Number',
  'Question ID', 'Image Files', 'Decision', 'Feedback', 'Updated At'
];
const PROGRESS_HEADERS = ['Evaluator', 'Last UID', 'Updated At'];

/**
 * Run this ONCE manually from a script bound to the destination Google Sheet.
 * It stores the spreadsheet ID and prepares the Reviews and Progress tabs.
 */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Open this script from the destination Google Sheet: Extensions > Apps Script.');
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
  ensureSheets_(ss);
  return `Ready: ${ss.getName()} (${ss.getId()})`;
}

function doGet(e) {
  try {
    const action = String((e && e.parameter && e.parameter.action) || 'health').toLowerCase();
    let result;
    if (action === 'health') {
      result = { ok: true, service: 'horse-rider-image-review-sheets' };
    } else if (action === 'state') {
      result = stateFor_(String(e.parameter.name || ''));
    } else {
      throw new Error('Unsupported action.');
    }
    return output_(result, e && e.parameter ? e.parameter.callback : '');
  } catch (err) {
    return output_({ ok: false, error: String(err && err.message ? err.message : err) }, e && e.parameter ? e.parameter.callback : '');
  }
}

function doPost(e) {
  try {
    const payload = parsePayload_(e);
    const action = String(payload.action || '').toLowerCase();
    const lock = LockService.getScriptLock();
    lock.waitLock(15000);
    try {
      const ss = spreadsheet_();
      ensureSheets_(ss);
      if (action === 'review') {
        saveReview_(ss, payload);
      } else if (action === 'progress') {
        saveProgress_(ss, payload);
      } else {
        throw new Error('Unsupported write action.');
      }
      SpreadsheetApp.flush();
    } finally {
      lock.releaseLock();
    }
    return output_({ ok: true });
  } catch (err) {
    return output_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function parsePayload_(e) {
  if (e && e.parameter && e.parameter.payload) {
    return JSON.parse(e.parameter.payload);
  }
  const raw = e && e.postData ? String(e.postData.contents || '') : '';
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (_) {
    const match = raw.match(/(?:^|&)payload=([^&]+)/);
    return match ? JSON.parse(decodeURIComponent(match[1].replace(/\+/g, ' '))) : {};
  }
}

function spreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('Backend is not initialized. Run setup() once from Apps Script.');
  return SpreadsheetApp.openById(id);
}

function ensureSheets_(ss) {
  const reviews = sheetWithHeaders_(ss, 'Reviews', REVIEW_HEADERS);
  const progress = sheetWithHeaders_(ss, 'Progress', PROGRESS_HEADERS);
  reviews.setFrozenRows(1);
  progress.setFrozenRows(1);
  reviews.getRange('A:K').setVerticalAlignment('top');
  reviews.setColumnWidth(1, 120);
  reviews.setColumnWidth(2, 260);
  reviews.setColumnWidth(7, 130);
  reviews.setColumnWidth(8, 330);
  reviews.setColumnWidth(10, 460);
  progress.setColumnWidth(1, 120);
  progress.setColumnWidth(2, 280);
}

function sheetWithHeaders_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  const current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  if (current.join('|') !== headers.join('|')) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#17324D')
      .setFontColor('#FFFFFF');
  }
  return sheet;
}

function canonicalEvaluator_(raw) {
  const value = String(raw || '').trim();
  const found = ALLOWED_EVALUATORS.find(name => name.toLocaleLowerCase() === value.toLocaleLowerCase());
  if (!found) throw new Error('Please select a valid evaluator.');
  return found;
}

function safeText_(value, maxLen) {
  let text = String(value == null ? '' : value).trim();
  if (maxLen && text.length > maxLen) text = text.slice(0, maxLen);
  if (/^[=+\-@]/.test(text)) text = "'" + text;
  return text;
}

function now_() {
  return new Date().toISOString();
}

function saveReview_(ss, payload) {
  const evaluator = canonicalEvaluator_(payload.name);
  const uid = safeText_(payload.uid, 500);
  const decision = safeText_(payload.decision, 20).toLowerCase();
  let feedback = safeText_(payload.feedback, 5000);
  if (!uid) throw new Error('Question UID is required.');
  if (!['agree', 'change', 'remove'].includes(decision)) throw new Error('Invalid review decision.');
  if (decision === 'change' && !feedback) throw new Error('Please describe what should be changed.');
  if (decision !== 'change') feedback = '';

  const row = [
    evaluator,
    uid,
    safeText_(payload.section, 80),
    safeText_(payload.phase_id, 160),
    Number(payload.phase_number || 0),
    safeText_(payload.display_number, 40),
    safeText_(payload.question_id, 120),
    safeText_(payload.image_files, 4000),
    decision,
    feedback,
    now_(),
  ];

  const sheet = ss.getSheetByName('Reviews');
  const values = sheet.getLastRow() > 1
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, REVIEW_HEADERS.length).getValues()
    : [];
  let targetRow = 0;
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]) === evaluator && String(values[i][1]) === uid) {
      targetRow = i + 2;
      break;
    }
  }
  if (targetRow) sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);
  else sheet.appendRow(row);

  upsertProgress_(ss, evaluator, uid);
}

function saveProgress_(ss, payload) {
  const evaluator = canonicalEvaluator_(payload.name);
  const uid = safeText_(payload.last_uid, 500);
  upsertProgress_(ss, evaluator, uid);
}

function upsertProgress_(ss, evaluator, uid) {
  const sheet = ss.getSheetByName('Progress');
  const values = sheet.getLastRow() > 1
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, PROGRESS_HEADERS.length).getValues()
    : [];
  const row = [evaluator, uid, now_()];
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]) === evaluator) {
      sheet.getRange(i + 2, 1, 1, row.length).setValues([row]);
      return;
    }
  }
  sheet.appendRow(row);
}

function stateFor_(rawName) {
  const evaluator = canonicalEvaluator_(rawName);
  const ss = spreadsheet_();
  ensureSheets_(ss);

  const reviewSheet = ss.getSheetByName('Reviews');
  const reviewValues = reviewSheet.getLastRow() > 1
    ? reviewSheet.getRange(2, 1, reviewSheet.getLastRow() - 1, REVIEW_HEADERS.length).getDisplayValues()
    : [];
  const reviews = {};
  const summary = { completed: 0, agree: 0, change: 0, remove: 0 };
  reviewValues.forEach(row => {
    if (row[0] !== evaluator) return;
    const uid = row[1];
    const decision = row[8];
    reviews[uid] = { decision, feedback: unescapeCell_(row[9]), updated_at: row[10] };
    summary.completed++;
    if (Object.prototype.hasOwnProperty.call(summary, decision)) summary[decision]++;
  });

  let lastUid = '';
  let progressUpdatedAt = '';
  const progressSheet = ss.getSheetByName('Progress');
  const progressValues = progressSheet.getLastRow() > 1
    ? progressSheet.getRange(2, 1, progressSheet.getLastRow() - 1, PROGRESS_HEADERS.length).getDisplayValues()
    : [];
  progressValues.forEach(row => {
    if (row[0] === evaluator) {
      lastUid = row[1] || '';
      progressUpdatedAt = row[2] || '';
    }
  });

  return {
    ok: true,
    evaluator: { name: evaluator },
    progress: { last_uid: lastUid || null, language: 'en', updated_at: progressUpdatedAt || null },
    reviews,
    summary,
  };
}

function unescapeCell_(value) {
  const text = String(value == null ? '' : value);
  return text.startsWith("'") ? text.slice(1) : text;
}

function output_(payload, callback) {
  const json = JSON.stringify(payload);
  const cb = String(callback || '');
  if (cb && /^[A-Za-z_$][0-9A-Za-z_$]*$/.test(cb)) {
    return ContentService.createTextOutput(`${cb}(${json});`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}
