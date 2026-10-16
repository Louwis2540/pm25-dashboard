/**
 * visits.gs — เก็บสถิติการเข้าชมแดชบอร์ด PM2.5 ลงชีต (แท็บ _visits)
 * ------------------------------------------------------------------
 * ⚠️ วางไฟล์นี้ใน Apps Script "โปรเจกต์ใหม่แยกต่างหาก" (ไม่ใช่โปรเจกต์ pm.2.5 เดิม)
 *    เพราะโปรเจกต์เดิมมี doGet อยู่แล้วใน doget.gs — หนึ่งโปรเจกต์มี doPost/doGet ได้ชุดเดียว
 *
 * ตั้งค่าครั้งเดียว
 *   1) script.google.com → โปรเจกต์ใหม่ ชื่อ pm25-visits → วางโค้ดนี้
 *   2) Project Settings → Script Properties → VISIT_TOKEN = ข้อความสุ่มยาว ๆ (ห้ามส่งในแชต)
 *   3) Deploy → New deployment → Web app · Execute as: Me · Who has access: Anyone → คัดลอก URL
 *   4) Render → Environment: VISIT_HOOK_URL = URL ข้อ 3 · VISIT_TOKEN = ค่าเดียวกับข้อ 2
 *
 * เก็บอะไร: วันที่ + จำนวนผู้เข้าชมไม่ซ้ำของวันนั้นเท่านั้น — ไม่มี IP, cookie หรือข้อมูลส่วนบุคคล
 * server ส่งยอดรวมมาทุก 5 นาที (ไม่ใช่ทุกครั้งที่มีคนเปิด) จึงไม่เปลืองโควตา Apps Script
 */
const VISIT_SHEET_ID = '1bBOvPusSvh7R0AXG5ej9CxagtRkJXLaaJo79I4s9PX8';
const VISIT_TAB = '_visits';

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const want = PropertiesService.getScriptProperties().getProperty('VISIT_TOKEN');
    if (!want || body.token !== want) return out_({ ok: false, error: 'unauthorized' });
    const date = /^\d{4}-\d{2}-\d{2}$/.test(body.date || '') ? body.date : Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd');
    const sh = sheet_();
    if (body.action === 'add') {
      const n = Math.max(0, Math.min(100000, parseInt(body.n, 10) || 0));
      const lock = LockService.getScriptLock(); lock.waitLock(10000);
      try {
        const rows = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues() : [];
        const i = rows.findIndex(r => norm_(r[0]) === date);
        if (i >= 0) sh.getRange(i + 2, 2).setValue((+rows[i][1] || 0) + n);
        else sh.appendRow([date, n]);
      } finally { lock.releaseLock(); }
    }
    return out_({ ok: true, stats: stats_(sh, date) });
  } catch (err) {
    return out_({ ok: false, error: String(err && err.message || err) });
  }
}

function stats_(sh, date) {
  const rows = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues() : [];
  let total = 0, month = 0, today = 0, since = null;
  rows.forEach(r => {
    const d = norm_(r[0]), n = +r[1] || 0; if (!d) return;
    total += n;
    if (d.slice(0, 7) === date.slice(0, 7)) month += n;
    if (d === date) today += n;
    if (!since || d < since) since = d;
  });
  return { total, month, today, since };
}

function sheet_() {
  const ss = SpreadsheetApp.openById(VISIT_SHEET_ID);
  let sh = ss.getSheetByName(VISIT_TAB);
  if (!sh) { sh = ss.insertSheet(VISIT_TAB); sh.appendRow(['date', 'visitors']); sh.getRange('A:A').setNumberFormat('@'); }
  return sh;
}
function norm_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') return Utilities.formatDate(v, 'GMT+7', 'yyyy-MM-dd');
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(v || '')); return m ? m[1] : '';
}
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/** ทดสอบในตัวแก้ไข: รันแล้วดู log ว่าเขียนแท็บ _visits ได้ */
function testVisits() {
  const sh = sheet_();
  console.log(JSON.stringify(stats_(sh, Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd'))));
}
