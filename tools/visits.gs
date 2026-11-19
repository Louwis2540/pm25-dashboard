/**
 * visits.gs — เก็บสถิติการเข้าชมแดชบอร์ด PM2.5 ลงชีต (แท็บ _visits) + สำรองจุดความร้อนรายวัน (แท็บ _hotspots)
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
 * อัปเดต 19 พ.ย. 2569: เพิ่ม action hs_add — server ส่งจุดความร้อนใหม่ (ทุก 15 นาที) มาเก็บในแท็บ _hotspots ตัดซ้ำด้วยคอลัมน์ key
 *   ทุกครั้งที่รับข้อมูลจะบันทึกลงแท็บ log.hotspot (เวลา · รับ/เพิ่ม/ซ้ำ กี่แถว · รวมในชีต · ใช้เวลา) ไว้ตรวจว่าสำรองต่อเนื่องไหม
 *   ไม่ต้องตั้งค่าใน Render เพิ่ม · ใช้ VISIT_HOOK_URL / VISIT_TOKEN เดิม · แต่ต้อง "วางโค้ดไฟล์นี้ใหม่ทั้งไฟล์ แล้ว Deploy → Manage deployments → Edit → New version" (URL เดิมใช้ต่อได้)
 *   ถ้ายังไม่ Deploy เวอร์ชันใหม่ server จะแจ้งเตือนใน log และดาวน์โหลดได้เฉพาะข้อมูลในเครื่อง (หายเมื่อรีสตาร์ต)
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
    if (body.action === 'hs_add') {
      const t0 = Date.now(), n = Array.isArray(body.rows) ? body.rows.length : 0;
      try {
        const r = hsAdd_(body.rows);
        hsLog_({ status: 'ok', received: r.received, added: r.added, duplicates: r.received - r.added, total: r.total, newest: r.newest, ms: Date.now() - t0, note: n > 500 ? 'รับเกิน 500 แถว ตัดเหลือ 500' : '' });
        return out_({ ok: true, hs: true, added: r.added, received: r.received, total: r.total });
      } catch (err) {
        hsLog_({ status: 'error', received: n, added: 0, duplicates: 0, total: '', newest: '', ms: Date.now() - t0, note: String(err && err.message || err) });
        throw err;   // ให้ catch ด้านนอกตอบ ok:false (server จะเก็บแถวไว้ส่งใหม่)
      }
    }
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

// ── สำรองจุดความร้อน (แท็บ _hotspots) — 1 แถว = 1 จุดที่ดาวเทียมตรวจพบ · key = วันที่|เวลา|ละติจูด|ลองจิจูด (ตัดซ้ำ) ──
// เก็บเฉพาะข้อมูลสาธารณะของ GISTDA VIIRS (ตำแหน่งจุดความร้อน) ไม่มีข้อมูลบุคคล
const HS_TAB = '_hotspots';
const HS_HEAD = ['key', 'acq_date', 'th_time', 'province', 'ap_en', 'tb_en', 'lu_name', 'confidence', 'frp', 'lat', 'lng', 'saved_at'];
function hsSheet_() {
  const ss = SpreadsheetApp.openById(VISIT_SHEET_ID);
  let sh = ss.getSheetByName(HS_TAB);
  if (!sh) {
    sh = ss.insertSheet(HS_TAB); sh.appendRow(HS_HEAD); sh.setFrozenRows(1);
    sh.getRange('A:D').setNumberFormat('@'); sh.getRange('L:L').setNumberFormat('@');   // เก็บเป็นข้อความ: กันชีตแปลงวันที่/เวลา 0138 เป็นตัวเลข
  }
  return sh;
}
function hsAdd_(rows) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sh = hsSheet_(), last = sh.getLastRow();
    const have = new Set(last > 1 ? sh.getRange(2, 1, last - 1, 1).getValues().map(r => String(r[0])) : []);
    const add = [], got = (rows || []).slice(0, 500);
    let newest = '';
    got.forEach(r => {
      const k = String((r && r.key) || ''); if (!k) return;
      const t = String(r.acq_date || '') + ' ' + String(r.th_time || ''); if (t > newest) newest = t;
      if (have.has(k)) return;
      have.add(k); add.push(HS_HEAD.map(h => r[h] == null ? '' : r[h]));
    });
    if (add.length) sh.getRange(last + 1, 1, add.length, HS_HEAD.length).setValues(add);
    return { added: add.length, received: got.length, total: Math.max(0, last - 1) + add.length, newest: newest.trim() };
  } finally { lock.releaseLock(); }
}

// ── บันทึกการทำงาน: แท็บ log.hotspot — 1 แถว = 1 ครั้งที่ server ส่งจุดความร้อนมา (เวลาไทย · รับกี่แถว · เพิ่มใหม่กี่แถว · ซ้ำกี่แถว · รวมในชีต · เวลาตรวจพบล่าสุด · ใช้เวลากี่ ms) ──
// ใช้ไล่ดูว่าการสำรองข้อมูลทำงานต่อเนื่องไหม (ไม่มีแถวใหม่นาน ๆ = ไม่มีจุดใหม่ หรือ server ส่งไม่ถึง) · เก็บล่าสุดราว 4,000 แถว เกิน 5,000 ลบเก่าสุด 1,000
const HS_LOG_TAB = 'log.hotspot';
const HS_LOG_HEAD = ['time_bkk', 'status', 'received', 'added', 'duplicates', 'total_rows', 'newest_detection', 'ms', 'note'];
function hsLog_(o) {
  try {
    const ss = SpreadsheetApp.openById(VISIT_SHEET_ID);
    let sh = ss.getSheetByName(HS_LOG_TAB);
    if (!sh) { sh = ss.insertSheet(HS_LOG_TAB); sh.appendRow(HS_LOG_HEAD); sh.setFrozenRows(1); sh.getRange('A:A').setNumberFormat('@'); sh.getRange('G:G').setNumberFormat('@'); }
    sh.appendRow([Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd HH:mm:ss'), o.status, o.received, o.added, o.duplicates, o.total, o.newest || '', o.ms, o.note || '']);
    if (sh.getLastRow() > 5000) sh.deleteRows(2, 1000);
  } catch (err) { /* บันทึกล้มเหลวต้องไม่ทำให้การสำรองข้อมูลล้มตาม */ }
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

/** ทดสอบในตัวแก้ไข: รันแล้วแท็บ _hotspots และ log.hotspot ถูกสร้าง (ไม่เพิ่มแถวจุดความร้อน มีแถว log 1 แถวสถานะ test) */
function testHotspots() {
  const t0 = Date.now(), n = hsSheet_().getLastRow();
  hsLog_({ status: 'test', received: 0, added: 0, duplicates: 0, total: Math.max(0, n - 1), newest: '', ms: Date.now() - t0, note: 'รันทดสอบจากตัวแก้ไข' });
  console.log('แท็บ _hotspots พร้อมใช้ · แถวจุดความร้อน', Math.max(0, n - 1), '· ดูบันทึกที่แท็บ log.hotspot');
}
