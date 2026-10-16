/**
 * pm25_backfill.gs — เติมค่าฝุ่น PM2.5 รายวันที่ขาดในแท็บ PM25_History (รันมือ ครั้งเดียว)
 *
 * แหล่งข้อมูล: Air4Thai ข้อมูลรายชั่วโมงย้อนหลัง (getHistoryData.php) — สถานีเดียวกับที่ line_report.gs ใช้
 * ไม่ใช้ค่าดาวเทียม GISTDA มาเติม เพราะเป็นคนละแหล่ง (ค่าประมาณ ≠ ค่าวัดสถานี) ต่อกันแล้วเทียบกันไม่ได้
 *
 * ขั้นตอน
 *   1) รัน backfillValidate()  — ไม่เขียนอะไรลงชีต
 *      ดึงค่ารายชั่วโมงช่วงที่ชีตมีข้อมูลอยู่แล้ว แล้วคำนวณค่ารายวัน 3 วิธี
 *      เทียบกับค่าในชีต เพื่อหาวิธีที่ตรงกับค่าที่บันทึกไว้เดิมมากที่สุด (ดูใน Execution log)
 *   2) ใส่ชื่อวิธีที่ตรงที่สุดใน BACKFILL_METHOD แล้วรัน backfillWrite()
 *      - สำรองแท็บเดิมเป็น PM25_History_backup_yyyyMMdd ก่อนเขียน
 *      - เติมเฉพาะวันที่ไม่มีแถว และช่องที่ว่าง — ไม่เขียนทับค่าที่มีอยู่
 *      - วันที่สถานีมีข้อมูลไม่ถึง MIN_HOURS ชั่วโมง → เว้นว่าง ไม่เดาค่า
 *      - บันทึกทุกค่าที่เติมไว้ในแท็บ _backfill_log (วันที่ · จังหวัด · ค่า · วิธี · จำนวนชั่วโมง)
 *
 * วิธีคำนวณค่ารายวัน (ชั่วโมงในข้อมูล Air4Thai = เวลาที่บันทึก)
 *   cal  = เฉลี่ยชั่วโมง 00:00–23:00 ของวันนั้น
 *   r07  = เฉลี่ย 24 ชม. ที่สิ้นสุด 07:00 ของวันนั้น (08:00 เมื่อวาน – 07:00 วันนี้)
 *   r15  = เฉลี่ย 24 ชม. ที่สิ้นสุด 15:00 ของวันนั้น
 */

const BF_SPREADSHEET_ID = '1bBOvPusSvh7R0AXG5ej9CxagtRkJXLaaJo79I4s9PX8';
const BF_SHEET = 'PM25_History';
const BF_HISTORY_URL = 'https://air4thai.pcd.go.th/forweb/getHistoryData.php';
const BF_STATIONS = [
  { name: 'ขอนแก่น', id: '46t' },
  { name: 'ร้อยเอ็ด', id: '113t' },
  { name: 'กาฬสินธุ์', id: '107t' },
  { name: 'มหาสารคาม', id: '114t' }
];

const BF_FROM = '2026-01-01';          // เติมตั้งแต่วันที่ (สัปดาห์ระบาดวิทยาที่ 1 ปี 2569)
const BF_TO = '';                      // ว่าง = ถึงเมื่อวาน
const BF_VALIDATE_FROM = '2026-02-19'; // ช่วงที่ชีตมีค่าอยู่แล้ว ใช้เทียบวิธีคำนวณ
const BF_VALIDATE_TO = '2026-04-30';
const MIN_HOURS = 18;                  // ต้องมีค่าอย่างน้อย 18 จาก 24 ชั่วโมง (75%) จึงนับเป็นค่ารายวัน
const CHUNK_DAYS = 15;                 // ขอข้อมูลครั้งละไม่เกิน 15 วัน

// ใส่หลังรัน backfillValidate() แล้ว: 'cal' | 'r07' | 'r15'  — ว่างไว้ = backfillWrite() จะไม่ทำงาน
const BACKFILL_METHOD = '';

// ───────────────────────────────────────────────────────────────

function backfillValidate() {
  const sheetVals = bfReadSheet_().byDate;
  const hourly = bfFetchHourly_(bfAddDays_(BF_VALIDATE_FROM, -1), BF_VALIDATE_TO);
  const methods = ['cal', 'r07', 'r15'];
  const stat = {};
  methods.forEach(m => stat[m] = { n: 0, abs: 0, bias: 0, within1: 0 });

  for (let d = BF_VALIDATE_FROM; d <= BF_VALIDATE_TO; d = bfAddDays_(d, 1)) {
    const row = sheetVals[d];
    if (!row) continue;
    BF_STATIONS.forEach(st => {
      const ref = row[st.name];
      if (typeof ref !== 'number') return;
      methods.forEach(m => {
        const c = bfDaily_(hourly[st.id.toLowerCase()] || {}, d, m);
        if (c.v == null) return;
        const diff = c.v - ref, s = stat[m];
        s.n++; s.abs += Math.abs(diff); s.bias += diff; if (Math.abs(diff) <= 1) s.within1++;
      });
    });
  }

  console.log('เทียบค่ารายวันจาก Air4Thai กับค่าในชีต ' + BF_VALIDATE_FROM + ' ถึง ' + BF_VALIDATE_TO);
  let best = null;
  methods.forEach(m => {
    const s = stat[m];
    if (!s.n) { console.log('  ' + m + ': ไม่มีข้อมูลให้เทียบ'); return; }
    const mae = s.abs / s.n;
    console.log('  ' + m + ': n=' + s.n + ' · คลาดเฉลี่ย (MAE) ' + mae.toFixed(2) + ' µg/m³ · ลำเอียง ' + (s.bias / s.n).toFixed(2) +
                ' · ต่างไม่เกิน 1 µg/m³ ' + Math.round(s.within1 / s.n * 100) + '%');
    if (!best || mae < best.mae) best = { m: m, mae: mae };
  });
  if (best && best.mae > 2) console.log('⚠️ ไม่มีวิธีไหนตรงกับชีตดีพอ (คลาดเฉลี่ยเกิน 2 µg/m³) — ยังไม่ควรเติม ส่ง log นี้ให้ตรวจก่อน');
  else if (best) console.log('→ วิธีที่ตรงกับชีตมากที่สุด: ' + best.m + ' (ใส่ใน BACKFILL_METHOD แล้วรัน backfillWrite)');
  else console.log('→ ดึงข้อมูลย้อนหลังไม่ได้ ตรวจ log ด้านบน');
}

function backfillWrite() {
  if (!/^(cal|r07|r15)$/.test(BACKFILL_METHOD)) throw new Error('ยังไม่ได้เลือกวิธี — รัน backfillValidate() แล้วใส่ BACKFILL_METHOD ก่อน');
  const to = BF_TO || bfAddDays_(bfToday_(), -1);
  const ss = SpreadsheetApp.openById(BF_SPREADSHEET_ID);
  const sh = ss.getSheetByName(BF_SHEET);
  if (!sh) throw new Error('ไม่พบแท็บ ' + BF_SHEET);
  const { byDate, rowOf, colOf } = bfReadSheet_();

  // วันที่ต้องเติม: ไม่มีแถว หรือมีแถวแต่บางจังหวัดว่าง
  const need = [];
  for (let d = BF_FROM; d <= to; d = bfAddDays_(d, 1)) {
    const row = byDate[d];
    const miss = BF_STATIONS.filter(st => !row || typeof row[st.name] !== 'number');
    if (miss.length) need.push({ d: d, miss: miss });
  }
  if (!need.length) { console.log('ไม่มีวันที่ขาด'); return; }
  console.log('วันที่ต้องเติม ' + need.length + ' วัน: ' + need[0].d + ' … ' + need[need.length - 1].d);

  const hourly = bfFetchHourly_(bfAddDays_(need[0].d, -1), need[need.length - 1].d);

  // สำรองก่อนเขียน
  const bk = BF_SHEET + '_backup_' + Utilities.formatDate(new Date(), 'GMT+7', 'yyyyMMdd_HHmm');
  sh.copyTo(ss).setName(bk);
  console.log('สำรองแท็บเดิมไว้ที่ ' + bk);

  const log = ss.getSheetByName('_backfill_log') || ss.insertSheet('_backfill_log');
  if (log.getLastRow() === 0) log.appendRow(['เวลาที่เติม', 'วันที่', 'จังหวัด', 'ค่า (µg/m³)', 'วิธี', 'จำนวนชั่วโมงที่มีค่า', 'สถานี']);
  const stamp = Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd HH:mm');
  const logRows = [], newRows = [];
  let filled = 0, skipped = 0;

  need.forEach(({ d, miss }) => {
    const vals = {};
    miss.forEach(st => {
      const c = bfDaily_(hourly[st.id.toLowerCase()] || {}, d, BACKFILL_METHOD);
      if (c.v == null) { skipped++; return; }
      vals[st.name] = c.v; filled++;
      logRows.push([stamp, d, st.name, c.v, BACKFILL_METHOD, c.n, st.id]);
    });
    if (!Object.keys(vals).length) return;
    if (rowOf[d]) {   // มีแถวอยู่แล้ว → เติมเฉพาะช่องว่าง
      Object.keys(vals).forEach(name => sh.getRange(rowOf[d], colOf[name]).setValue(vals[name]));
    } else {
      const r = new Array(sh.getLastColumn()).fill('');
      r[0] = d;
      Object.keys(vals).forEach(name => r[colOf[name] - 1] = vals[name]);
      newRows.push(r);
    }
  });

  if (newRows.length) sh.getRange(sh.getLastRow() + 1, 1, newRows.length, newRows[0].length).setValues(newRows);
  if (logRows.length) log.getRange(log.getLastRow() + 1, 1, logRows.length, logRows[0].length).setValues(logRows);
  console.log('เติมแล้ว ' + filled + ' ค่า (แถวใหม่ ' + newRows.length + ' วัน) · เว้นว่าง ' + skipped + ' ค่า เพราะสถานีมีข้อมูลไม่ถึง ' + MIN_HOURS + ' ชม.');
  console.log('หน้าเว็บจะเห็นค่าใหม่ภายใน 5 นาที (server อ่านชีตทุก 5 นาที)');
}

// ───────────────────────────────────────────────────────────────

/** ค่ารายวันของวันที่ d ตามวิธี m → { v: ค่าทศนิยม 1 ตำแหน่ง หรือ null, n: จำนวนชั่วโมงที่มีค่า } */
function bfDaily_(byHour, d, m) {
  const keys = [];
  const prev = bfAddDays_(d, -1);
  const hh = h => ('0' + h).slice(-2) + ':00:00';
  if (m === 'cal') for (let h = 0; h <= 23; h++) keys.push(d + ' ' + hh(h));
  else {
    const end = m === 'r07' ? 7 : 15;
    for (let h = end + 1; h <= 23; h++) keys.push(prev + ' ' + hh(h));
    for (let h = 0; h <= end; h++) keys.push(d + ' ' + hh(h));
  }
  const v = keys.map(k => byHour[k]).filter(x => typeof x === 'number');
  if (v.length < MIN_HOURS) return { v: null, n: v.length };
  return { v: Math.round(v.reduce((a, b) => a + b, 0) / v.length * 10) / 10, n: v.length };
}

/** ดึงค่ารายชั่วโมงทุกสถานี → { '46t': { 'yyyy-MM-dd HH:mm:ss': ค่า } } */
function bfFetchHourly_(from, to) {
  const out = {};
  BF_STATIONS.forEach(st => out[st.id.toLowerCase()] = {});
  for (let s = from; s <= to; s = bfAddDays_(s, CHUNK_DAYS)) {
    let e = bfAddDays_(s, CHUNK_DAYS - 1); if (e > to) e = to;
    const url = BF_HISTORY_URL + '?stationID=' + BF_STATIONS.map(x => x.id).join(',') +
      '&param=PM25&type=hr&sdate=' + s + '&edate=' + e + '&stime=00&etime=23';
    let json = null;
    for (let i = 0; i < 3 && !json; i++) {
      try {
        const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
        if (res.getResponseCode() === 200) json = JSON.parse(res.getContentText());
        else console.log('  ' + s + '–' + e + ': HTTP ' + res.getResponseCode());
      } catch (err) { console.log('  ' + s + '–' + e + ': ' + err.message); }
      if (!json) Utilities.sleep(2000);
    }
    if (!json) { console.log('❌ ดึง ' + s + '–' + e + ' ไม่สำเร็จ'); continue; }
    let n = 0;
    bfStationList_(json).forEach(st => {
      const tgt = out[String(st.stationID || st.StationID || '').trim().toLowerCase()]; if (!tgt) return;
      (st.data || st.Data || []).forEach(r => {
        const v = bfNum_(r.PM25 !== undefined ? r.PM25 : r.pm25);
        const dt = bfDt_(r.DATETIMEDATA || r.datetimedata || r.DATETIME);
        if (v != null && dt) { tgt[dt] = v; n++; }
      });
    });
    console.log('  ดึง ' + s + '–' + e + ': ' + n + ' ค่ารายชั่วโมง');
    if (!n && !bfWarned_) { bfWarned_ = true; console.log('  ⚠️ ไม่มีค่าในคำตอบ — ตัวอย่างคำตอบ: ' + JSON.stringify(json).slice(0, 400)); }
    Utilities.sleep(500);
  }
  return out;
}

let bfWarned_ = false;
function bfStationList_(json) {   // รูปแบบคำตอบอาจเป็น { stations: [...] } หรือ array ตรง ๆ
  if (Array.isArray(json)) return json;
  return json.stations || json.Stations || json.data || [];
}
function bfNum_(v) {   // ค่าอาจมาเป็นตัวเลขหรือข้อความ เช่น "12.3" · "-", "N/A", null = ไม่มีค่า
  if (v === null || v === undefined || v === '') return null;
  const x = typeof v === 'number' ? v : parseFloat(String(v).replace(',', ''));
  return isNaN(x) || x < 0 || x > 1000 ? null : x;
}
function bfDt_(v) {   // ทำวันเวลาให้เป็น 'yyyy-MM-dd HH:00:00'
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2})/.exec(String(v || '').trim());
  return m ? m[1] + '-' + m[2] + '-' + m[3] + ' ' + ('0' + m[4]).slice(-2) + ':00:00' : '';
}

/**
 * ตรวจการเชื่อมต่อ: ขอข้อมูลสถานีขอนแก่น 1 วัน แล้วพิมพ์คำตอบดิบ (รันเมื่อ backfillValidate ดึงได้ 0 ค่า)
 */
function backfillDebug() {
  const day = bfAddDays_(bfToday_(), -2);
  [day, '2026-01-10'].forEach(d => {
    ['46t', '46t,113t'].forEach(ids => {
      const url = BF_HISTORY_URL + '?stationID=' + ids + '&param=PM25&type=hr&sdate=' + d + '&edate=' + d + '&stime=00&etime=23';
      try {
        const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
        const t = res.getContentText();
        console.log(d + ' [' + ids + '] HTTP ' + res.getResponseCode() + ' · ยาว ' + t.length + ' ตัวอักษร\n' + t.slice(0, 600));
      } catch (e) { console.log(d + ' [' + ids + '] error: ' + e.message); }
    });
  });
}

/**
 * หาว่า Air4Thai เก็บข้อมูลรายชั่วโมงย้อนหลังได้ถึงวันไหน (ค้นแบบแบ่งครึ่ง) + ลองขอแบบรายวัน (type=day)
 */
function backfillProbe() {
  const has = (d, type) => {
    const url = BF_HISTORY_URL + '?stationID=46t&param=PM25&type=' + type + '&sdate=' + d + '&edate=' + d + '&stime=00&etime=23';
    try {
      const j = JSON.parse(UrlFetchApp.fetch(url, { muteHttpExceptions: true }).getContentText());
      const st = bfStationList_(j)[0] || {};
      return (st.data || []).filter(r => bfNum_(r.PM25) != null).length;
    } catch (e) { return -1; }
  };
  let lo = '2025-01-01', hi = bfAddDays_(bfToday_(), -2);
  console.log('มีค่ารายชั่วโมง: ' + hi + ' = ' + has(hi, 'hr') + ' ชม. · ' + lo + ' = ' + has(lo, 'hr') + ' ชม.');
  if (has(lo, 'hr') > 0) { console.log('→ ย้อนได้ถึง ' + lo + ' หรือก่อนนั้น'); }
  else {
    while (bfAddDays_(lo, 1) < hi) {
      const days = Math.round((Date.parse(hi) - Date.parse(lo)) / 864e5), mid = bfAddDays_(lo, Math.floor(days / 2));
      if (has(mid, 'hr') > 0) hi = mid; else lo = mid;
      Utilities.sleep(300);
    }
    console.log('→ ข้อมูลรายชั่วโมงวันแรกที่มี: ' + hi);
  }
  ['day', 'dy', 'daily'].forEach(t => console.log('ลองแบบรายวัน type=' + t + ' วันที่ 2026-01-10: ' + has('2026-01-10', t) + ' ค่า'));
}

/** อ่านแท็บ PM25_History → ค่ารายวัน, แถวของแต่ละวัน, คอลัมน์ของแต่ละจังหวัด */
function bfReadSheet_() {
  const sh = SpreadsheetApp.openById(BF_SPREADSHEET_ID).getSheetByName(BF_SHEET);
  const v = sh.getDataRange().getValues();
  const head = v[0].map(x => String(x).trim());
  const colOf = {};
  BF_STATIONS.forEach(st => {
    const c = head.indexOf(st.name);
    if (c < 0) throw new Error('ไม่พบคอลัมน์ ' + st.name + ' ในแท็บ ' + BF_SHEET);
    colOf[st.name] = c + 1;
  });
  const byDate = {}, rowOf = {};
  for (let i = 1; i < v.length; i++) {
    const d = bfNormDate_(v[i][0]);
    if (!d || byDate[d]) continue;   // เอาแถวแรกของแต่ละวัน (เหมือน server)
    rowOf[d] = i + 1;
    const row = {};
    BF_STATIONS.forEach(st => { const x = v[i][colOf[st.name] - 1]; if (x !== '' && !isNaN(+x)) row[st.name] = +x; });
    byDate[d] = row;
  }
  return { byDate, rowOf, colOf };
}

function bfNormDate_(x) {
  if (Object.prototype.toString.call(x) === '[object Date]' && !isNaN(x.getTime())) return Utilities.formatDate(x, 'GMT+7', 'yyyy-MM-dd');
  const s = String(x || '').trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); if (m) return m[0];
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (m) { let y = +m[3]; if (y > 2400) y -= 543; return y + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2); }
  return '';
}
function bfAddDays_(iso, n) { return new Date(Date.parse(iso + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10); }
function bfToday_() { return Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd'); }
