/**
 * HDC (MOPH Open Data) → Google Sheet : เก็บภาพข้อมูลผู้ป่วย PM2.5 รายจังหวัด รายสัปดาห์ระบาดวิทยา
 * (สำเนาจาก Apps Script — ไฟล์ที่เขียนแท็บ snapshot / latest / _log · เก็บเข้า repo 12/11/2026)
 * ------------------------------------------------------------------
 * ทำไมต้องเก็บภาพ (snapshot)
 *   HDC แสดงเฉพาะค่าล่าสุด และเติมข้อมูลย้อนหลังเรื่อยๆ (สัปดาห์ล่าสุดยังไม่ครบ) ถ้าไม่เก็บไว้
 *   จะย้อนดูไม่ได้ว่าตัวเลขที่เคยรายงาน/ส่ง LINE ไปตอนนั้นเป็นเท่าไร และคำนวณซ้ำให้ได้ผลเดิมไม่ได้
 *   สคริปต์นี้จึงบันทึกทั้งชุดทุกครั้งที่ HDC ประมวลผลใหม่ (date_com เปลี่ยน) — ไม่ลบของเก่า
 *
 * ตารางที่เก็บ (ทั้งคู่ตามแบบรายงาน HDC "โรคที่เกี่ยวข้องกับ PM2.5 รายสัปดาห์")
 *   s_pm25_1_in_week = ผู้ป่วยสัญชาติไทย ทุก TYPEAREA ตามหน่วยบริการในจังหวัด (ภาระงาน)
 *   s_pm25_2_in_week = ผู้ป่วยที่อยู่จริงตามเขตรับผิดชอบ TYPEAREA 1 และ 3 (ใช้คู่กับประชากร Type 1+3 คิดอัตรา)
 *   นับรายคน ตัดซ้ำรายสัปดาห์ · สัปดาห์ระบาดวิทยา อาทิตย์–เสาร์ (สัปดาห์ที่ 1 เริ่ม 1 ม.ค.)
 *
 * ผลลัพธ์ (Google Sheet ที่ผูกสคริปต์นี้)
 *   แท็บ "snapshot" — ต่อท้ายเรื่อยๆ ไม่ลบ (ข้อมูลแบบ tidy: 1 แถว = ตาราง × จังหวัด × สัปดาห์ × กลุ่มโรค × รอบประมวลผล)
 *     snapshot_at, date_com, b_year, table, pv_code, pv_name, wk, group, m, z, y, zy
 *     m  = ทุกการวินิจฉัย · z = ร่วมกับ Z58.1 · y = ร่วมกับ Y97 · zy = ร่วมกับทั้ง Z58.1 และ Y97
 *   แท็บ "latest"   — เฉพาะรอบล่าสุดของแต่ละตาราง×จังหวัด (เขียนทับทุกครั้ง ใช้ง่าย)
 *                     ← server.js (diseasePvFromSheet) อ่านแท็บนี้เป็น "แหล่งหลัก" ของข้อมูลรายจังหวัดบนหน้าเว็บ
 *   แท็บ "_log"     — บันทึกการรันแต่ละครั้ง
 *
 * วิธีติดตั้ง
 *   1) สร้าง Google Sheet ใหม่ ชื่อ "PM25_ผู้ป่วย" → Extensions → Apps Script → วางโค้ดนี้ → Save
 *   2) Run → setup()     (ขอสิทธิ์ครั้งแรก ให้อนุญาต) — ตั้ง trigger วันละ 3 รอบ (RUN_HOURS) และเก็บรอบแรกทันที
 *   3) ดูแท็บ "_log" ว่าขึ้น ✅ ครบ 8 ชุด (2 ตาราง × 4 จังหวัด)
 *
 * แก้ 12/11/2026 — แท็บ latest ค้างที่ date_com 21/10/2569 ทั้งที่ HDC ประมวลผลใหม่แล้ว 10/11/2569:
 *   ต้นเหตุ: latest เขียนเฉพาะรอบที่ครบ 8 ชุด แต่รอบ 10–12/11 พลาดทุกรอบ (HTTP 429 / ได้ 0 แถว)
 *            เพราะยิง 8 ชุดติดกันไม่พัก ลองซ้ำแค่ 3 ครั้ง (รอ 3/6 วินาที) และรันวันละรอบเดียว
 *   แก้:  • พักระหว่างชุด SET_PAUSE_MS และระหว่างหน้า PAGE_PAUSE_MS
 *         • ลองซ้ำเมื่อ 429/5xx/เรียกไม่สำเร็จ 4 ครั้ง รอ 5/15/45 วินาที หรือตาม Retry-After
 *         • ชุดที่พลาด (รวม "ได้ 0 แถว") ลองใหม่อีกรอบหลังรอ SECOND_PASS_MS
 *         • เพดานเวลา TIME_BUDGET_MS กันชนเพดาน 6 นาทีของ Apps Script (ยังทันเขียน _log และส่งอีเมล)
 *         • setup() ตั้ง trigger วันละ 3 รอบ (RUN_HOURS) — พลาดรอบเช้า ยังมีรอบสาย/บ่าย
 *   คงเดิม: latest ยังเขียนเฉพาะรอบที่ครบ 8 ชุด (ให้ทุกจังหวัดเป็นรอบประมวลผลเดียวกัน)
 *           snapshot ยังต่อท้ายเฉพาะชุดที่ date_com เปลี่ยน → รันหลายรอบต่อวันไม่ทำให้ซ้ำ
 */

// ── ตั้งค่า ──────────────────────────────────────────────────────────
var PROVINCES = { 40: 'ขอนแก่น', 44: 'มหาสารคาม', 45: 'ร้อยเอ็ด', 46: 'กาฬสินธุ์' };
var TABLES    = ['s_pm25_1_in_week', 's_pm25_2_in_week'];
var MOPH_URL  = 'https://opendata.moph.go.th/api/report_data';
var PAGE      = 5000;
var ALERT_EMAILS = [];                   // เว้นว่าง = ส่งหาเจ้าของสคริปต์
// diag_main (bitmask ของ HDC) → กลุ่มโรค (ตรงกับหน้าเว็บ)
var GROUP = { 2: 'ทางเดินหายใจ', 4: 'ทางเดินหายใจ', 2048: 'ทางเดินหายใจ',
              8: 'หัวใจ', 16: 'หัวใจ', 4096: 'หัวใจ', 32: 'ตาอักเสบ', 64: 'ผิวหนัง', 128: 'ผิวหนัง' };
var HEADER = ['snapshot_at', 'date_com', 'b_year', 'table', 'pv_code', 'pv_name', 'wk', 'group', 'm', 'z', 'y', 'zy'];

// ── กันโดน HTTP 429 (MOPH จำกัดจำนวนการเรียก) — เพิ่ม 12/11/2026 ─────────────
var RETRY_MAX      = 4;                     // ลองสูงสุดกี่ครั้งต่อคำขอ (รวมครั้งแรก)
var RETRY_WAIT_MS  = [5000, 15000, 45000];  // รอก่อนลองครั้งถัดไป (ใช้ Retry-After แทนถ้า MOPH ส่งมา ไม่เกิน RETRY_CAP_MS)
var RETRY_CAP_MS   = 60000;
var SET_PAUSE_MS   = 8000;                  // พักระหว่างชุด (ตาราง × จังหวัด)
var PAGE_PAUSE_MS  = 2000;                  // พักระหว่างหน้า (เดิม 0.3 วินาที)
var SECOND_PASS_MS = 30000;                 // ชุดที่พลาด → รอแล้วลองอีก 1 รอบ
var TIME_BUDGET_MS = 300000;                // เพดานเวลาดึงข้อมูลต่อการรัน (Apps Script ตัดที่ 6 นาที)
var RUN_HOURS      = [7, 11, 15];           // ชั่วโมงที่ setup() ตั้ง trigger (เวลาไทย)
var T0 = 0;                                 // เวลาเริ่มรัน (ms) — ตั้งใน snapshotJob()

function setup() {
  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === 'snapshotJob'; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
  RUN_HOURS.forEach(function (h) {
    ScriptApp.newTrigger('snapshotJob').timeBased().everyDays(1).atHour(h).inTimezone('Asia/Bangkok').create();
  });
  Logger.log('✅ ตั้ง trigger snapshotJob วันละ ' + RUN_HOURS.length + ' รอบ ที่ชั่วโมง ' + RUN_HOURS.join(', ') + ' (เวลาไทย)');
  snapshotJob();
}

function snapshotJob() {
  T0 = Date.now();
  var ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('sheet_id'));
  var props = PropertiesService.getScriptProperties();
  var year = String(Number(Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy')) + 543);
  var now = Utilities.formatDate(new Date(), 'Asia/Bangkok', "yyyy-MM-dd'T'HH:mm:ssXXX");
  var added = 0, skipped = 0, latest = {};

  var jobs = [];
  TABLES.forEach(function (tb) { for (var pv in PROVINCES) jobs.push([tb, pv]); });

  var failed = {};   // 'ตาราง|จังหวัด' → ข้อความสาเหตุ (ชุดที่ยังพลาดอยู่)
  for (var pass = 1; pass <= 2; pass++) {
    var todo = pass === 1 ? jobs : jobs.filter(function (j) { return failed[j[0] + '|' + j[1]]; });
    if (!todo.length) break;
    if (pass === 2) {
      if (Date.now() - T0 + SECOND_PASS_MS + 60000 > TIME_BUDGET_MS) { Logger.log('⏱ ข้ามรอบที่ 2: ใกล้ครบเพดานเวลา'); break; }
      Logger.log('↻ รอบที่ 2: ลองใหม่ ' + todo.length + ' ชุดที่พลาด หลังรอ ' + (SECOND_PASS_MS / 1000) + ' วินาที');
      Utilities.sleep(SECOND_PASS_MS);
    }
    for (var i = 0; i < todo.length; i++) {
      var tb = todo[i][0], pv = todo[i][1], k = tb + '|' + pv;
      if (Date.now() - T0 > TIME_BUDGET_MS) { failed[k] = tb + ' จ.' + PROVINCES[pv] + ': ข้าม (ใกล้ครบเพดานเวลา)'; continue; }
      if (i > 0) Utilities.sleep(SET_PAUSE_MS);   // พักระหว่างชุด ลดโอกาสโดน 429
      try {
        var rows = fetchAll_(tb, year, pv);
        if (!rows.length) throw new Error('ได้ 0 แถว');
        var dc = rows.reduce(function (m, r) { return String(r.date_com) > m ? String(r.date_com) : m; }, '');
        var out = aggregate_(rows, now, dc, year, tb, pv);
        latest[k] = out;
        delete failed[k];
        var key = 'dc_' + tb + '_' + pv;
        if (props.getProperty(key) === dc) { skipped++; continue; }   // HDC ยังไม่ประมวลผลใหม่
        append_(ss, 'snapshot', out);
        props.setProperty(key, dc);
        added++;
      } catch (e) {
        failed[k] = tb + ' จ.' + PROVINCES[pv] + ': ' + e.message;
        Logger.log('❌ ' + failed[k] + ' (รอบ ' + pass + ')');
      }
    }
  }
  var errors = Object.keys(failed).map(function (k) { return failed[k]; });

  // แท็บ latest = ภาพล่าสุดที่ดึงได้ครบ (ดึงไม่ครบ → ไม่แตะ ของเดิมยังอยู่)
  if (!errors.length) {
    var all = [];
    Object.keys(latest).sort().forEach(function (k) { all = all.concat(latest[k]); });
    var sh = ss.getSheetByName('latest') || ss.insertSheet('latest');
    sh.clearContents();
    sh.getRange(1, 1, all.length + 1, HEADER.length).setValues([HEADER].concat(all));
  }
  log_(ss, now, added, skipped, errors);
  if (errors.length) alert_('[PM2.5 สคร.7] ⚠️ เก็บภาพข้อมูลผู้ป่วย HDC ไม่ครบ',
    'เวลา: ' + now + '\nสำเร็จ ' + (added + skipped) + '/' + TABLES.length * 4 + ' ชุด (ลองซ้ำแล้ว)\n\n' + errors.join('\n') +
    '\n\nชุดที่สำเร็จบันทึกแล้ว แท็บ latest ยังเป็นชุดเดิม จนกว่ารอบถัดไปจะดึงได้ครบ (วันละ ' + RUN_HOURS.length + ' รอบ)');
}

// รวมยอดจากรายหน่วยบริการ → จังหวัด × สัปดาห์ × กลุ่มโรค
function aggregate_(rows, now, dc, year, tb, pv) {
  var acc = {};
  rows.forEach(function (r) {
    var g = GROUP[r.diag_main]; if (!g) return;
    for (var w = 1; w <= 53; w++) {
      var p = 'w_' + (w < 10 ? '0' + w : w) + '_', m = r[p + 'm'];
      if (m == null && r[p + 'z'] == null) continue;
      var k = w + '|' + g, a = acc[k] || (acc[k] = [0, 0, 0, 0]);
      a[0] += +m || 0; a[1] += +r[p + 'z'] || 0; a[2] += +r[p + 'y'] || 0; a[3] += +r[p + 'zy'] || 0;
    }
  });
  var dcIso = /^\d{12}/.test(dc) ? dc.slice(0, 4) + '-' + dc.slice(4, 6) + '-' + dc.slice(6, 8) + ' ' + dc.slice(8, 10) + ':' + dc.slice(10, 12) : dc;
  return Object.keys(acc).sort(function (a, b) { return +a.split('|')[0] - +b.split('|')[0] || a.localeCompare(b); })
    .map(function (k) { var p = k.split('|'), a = acc[k];
      return [now, dcIso, year, tb, pv, PROVINCES[pv], +p[0], p[1], a[0], a[1], a[2], a[3]]; });
}

function fetchAll_(tb, year, pv) {
  var rows = [];
  for (var page = 0; page < 20; page++) {
    if (page) Utilities.sleep(PAGE_PAUSE_MS);
    var r = fetchWithRetry_({ method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      payload: JSON.stringify({ tableName: tb, year: year, province: String(pv), type: 'json', limit: PAGE, offset: page * PAGE }) });
    var code = r.getResponseCode();
    if (code !== 200 && code !== 201) throw new Error('HTTP ' + code);
    var body = JSON.parse(r.getContentText());
    var chunk = Array.isArray(body) ? body : (body && body.data);
    if (!Array.isArray(chunk)) throw new Error('รูปแบบข้อมูลไม่รู้จัก');
    rows = rows.concat(chunk);
    var total = Array.isArray(body) ? chunk.length : Number(body.total) || 0;
    if (chunk.length < PAGE || rows.length >= total) break;
  }
  return rows;
}

/**
 * ยิง MOPH 1 คำขอ ลองซ้ำเมื่อ HTTP 429 / 5xx / เรียกไม่สำเร็จ (รอ 5/15/45 วินาที หรือตาม Retry-After)
 * คืน response เมื่อได้คำตอบที่ไม่ใช่ 429/5xx (403/404 ฯลฯ คืนให้ผู้เรียกจัดการ — ลองซ้ำก็ไม่หาย)
 * ลองครบแล้วยังพลาด หรือใกล้ครบเพดานเวลา → throw
 */
function fetchWithRetry_(options) {
  var last = '';
  for (var attempt = 1; attempt <= RETRY_MAX; attempt++) {
    var wait = RETRY_WAIT_MS[Math.min(attempt - 1, RETRY_WAIT_MS.length - 1)];
    try {
      var r = UrlFetchApp.fetch(MOPH_URL, options), c = r.getResponseCode();
      if (c !== 429 && c < 500) return r;
      last = 'HTTP ' + c;
      var ra = retryAfterMs_(r);
      if (ra !== null) wait = Math.min(ra, RETRY_CAP_MS);
    } catch (e) {
      last = e.message;
    }
    if (attempt < RETRY_MAX) {
      if (Date.now() - T0 + wait > TIME_BUDGET_MS) throw new Error(last + ' (หยุดลองซ้ำ: ใกล้ครบเพดานเวลา)');
      Logger.log('⏳ ' + last + ' — ลองใหม่ครั้งที่ ' + (attempt + 1) + '/' + RETRY_MAX + ' หลังรอ ' + (wait / 1000) + ' วินาที');
      Utilities.sleep(wait);
    }
  }
  throw new Error(last + ' (ลองครบ ' + RETRY_MAX + ' ครั้ง)');
}

/** หัว Retry-After (วินาที) → มิลลิวินาที · ไม่มี/อ่านไม่ได้ = null */
function retryAfterMs_(r) {
  try {
    var h = r.getHeaders() || {};
    for (var k in h) if (String(k).toLowerCase() === 'retry-after') {
      var s = parseInt(h[k], 10);
      return isNaN(s) || s < 0 ? null : s * 1000;
    }
  } catch (e) {}
  return null;
}

function append_(ss, name, rows) {
  var sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(HEADER); sh.setFrozenRows(1); }
  if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, HEADER.length).setValues(rows);
}
function log_(ss, now, added, skipped, errors) {
  var sh = ss.getSheetByName('_log');
  if (!sh) { sh = ss.insertSheet('_log'); sh.appendRow(['run_at', 'status', 'new_snapshots', 'unchanged', 'errors']); }
  sh.appendRow([now, errors.length ? '⚠️ ไม่ครบ' : '✅ ครบ', added, skipped, errors.join(' | ')]);
}
function alert_(subject, body) {
  var props = PropertiesService.getScriptProperties(), last = Number(props.getProperty('alert_at') || 0);
  if (Date.now() - last < 24 * 3600e3) return;
  MailApp.sendEmail(ALERT_EMAILS.length ? ALERT_EMAILS.join(',') : Session.getEffectiveUser().getEmail(), subject, body);
  props.setProperty('alert_at', String(Date.now()));
}
