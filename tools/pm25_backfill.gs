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

const BF_FROM = '2026-08-01';          // Air4Thai API ให้ข้อมูลรายชั่วโมงย้อนหลังได้ถึง 1 ส.ค. 2569 เท่านั้น (ตรวจด้วย backfillProbe 16 ต.ค. 2569)
const BF_TO = '';                      // ว่าง = ถึงเมื่อวาน
const BF_VALIDATE_FROM = '2026-08-01'; // ช่วงที่ชีตมีค่าอยู่แล้วและ Air4Thai ยังมีข้อมูล ใช้เทียบวิธีคำนวณ
const BF_VALIDATE_TO = '2026-10-12';
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

/**
 * เติมแท็บ PM25_07 (ค่าเฉลี่ย 24 ชม. ณ 07:00 — ค่าที่ใช้ตัดสิน PHEOC) ตั้งแต่ BF_FROM ถึงวันนี้
 * เติมเฉพาะวัน/ช่องที่ว่าง · หัวตารางเหมือนที่ line_report.gs สร้าง (time · 4 จังหวัด · หมายเหตุ)
 */
function backfill07() {
  const SHEET_07 = 'PM25_07';
  const ss = SpreadsheetApp.openById(BF_SPREADSHEET_ID);
  let sh = ss.getSheetByName(SHEET_07);
  if (!sh) { sh = ss.insertSheet(SHEET_07); sh.appendRow(['time'].concat(BF_STATIONS.map(s => s.name)).concat(['หมายเหตุ'])); }
  const v = sh.getDataRange().getValues();
  const head = v[0].map(x => String(x).trim());
  const colOf = {}; BF_STATIONS.forEach(st => colOf[st.name] = head.indexOf(st.name) + 1);
  const rowOf = {}, have = {};
  for (let i = 1; i < v.length; i++) {
    const d = bfNormDate_(v[i][0]); if (!d || rowOf[d]) continue;
    rowOf[d] = i + 1; have[d] = {};
    BF_STATIONS.forEach(st => { const x = v[i][colOf[st.name] - 1]; if (x !== '' && !isNaN(+x)) have[d][st.name] = true; });
  }
  const to = bfToday_();
  const hourly = bfFetchHourly_(bfAddDays_(BF_FROM, -1), to);
  const note = 'เฉลี่ย 24 ชม. สิ้นสุด 07:00 · Air4Thai (เติมย้อนหลัง)';
  const newRows = []; let filled = 0, skipped = 0;
  for (let d = BF_FROM; d <= to; d = bfAddDays_(d, 1)) {
    const vals = {};
    BF_STATIONS.forEach(st => {
      if (have[d] && have[d][st.name]) return;
      const c = bfDaily_(hourly[st.id.toLowerCase()] || {}, d, 'r07');
      if (c.v == null) { skipped++; return; }
      vals[st.name] = c.v; filled++;
    });
    if (!Object.keys(vals).length) continue;
    if (rowOf[d]) Object.keys(vals).forEach(n => sh.getRange(rowOf[d], colOf[n]).setValue(vals[n]));
    else newRows.push([d].concat(BF_STATIONS.map(st => vals[st.name] !== undefined ? vals[st.name] : '')).concat([note]));
  }
  if (newRows.length) sh.getRange(sh.getLastRow() + 1, 1, newRows.length, newRows[0].length).setValues(newRows);
  console.log(SHEET_07 + ': เติมแล้ว ' + filled + ' ค่า (แถวใหม่ ' + newRows.length + ' วัน) · เว้นว่าง ' + skipped + ' ค่า (ข้อมูลไม่ถึง ' + MIN_HOURS + ' ชม.)');
}

/**
 * เติมค่าประมาณจากดาวเทียม GISTDA (ค่าเฉลี่ยรายวันรายจังหวัด จาก pm25.gistda.or.th/download แบบ "รายวัน (1 เดือน)")
 *   1–27 ม.ค. 2569 = ไฟล์ PM25_Province_1m_2026-01-27 (เพิ่ม 16 ต.ค. 2569 · กรมควบคุมมลพิษยังไม่เผยแพร่ค่ารายวันปี 2569)
 *   28 ม.ค.–28 ก.พ. 2569 = ไฟล์ PM25_Province_1m_2026-02-28.csv
 * ลงแท็บ PM25_History ตรง ๆ — Louis ตัดสินใจ 16 ต.ค. 2569 (ไม่มีค่าสถานี Air4Thai ช่วงนี้)
 *   - เติมเฉพาะวันที่ไม่มีแถว / ช่องว่าง / ช่องที่เป็น 0 (0 = สถานีไม่มีข้อมูล จากโค้ดเวอร์ชันเก่า)
 *   - ไม่เขียนทับค่าสถานีที่มีอยู่
 *   - บันทึกทุกค่าใน _backfill_log วิธี = 'gistda' เพื่อให้ย้อนตรวจได้ว่าค่าไหนเป็นค่าดาวเทียม
 *   - เทียบกับค่าสถานี 19–28 ก.พ.: MAE 6.9 µg/m³ · r 0.66 · ลำเอียง +1.2
 *   - ช่องที่เป็น 0 แต่ไม่มีค่า GISTDA ให้เติม (30 มี.ค. 2569) → เปลี่ยนเป็นช่องว่าง (CLEAR_ZEROS)
 */
const GISTDA_FILL = {"2026-01-01":{"ขอนแก่น":50.1,"ร้อยเอ็ด":48.6,"กาฬสินธุ์":52.7,"มหาสารคาม":56.9},"2026-01-02":{"ขอนแก่น":25.2,"ร้อยเอ็ด":22.2,"กาฬสินธุ์":22.0,"มหาสารคาม":23.6},"2026-01-03":{"ขอนแก่น":18.9,"ร้อยเอ็ด":20.5,"กาฬสินธุ์":18.2,"มหาสารคาม":18.8},"2026-01-04":{"ขอนแก่น":21.1,"ร้อยเอ็ด":22.6,"กาฬสินธุ์":21.7,"มหาสารคาม":22.1},"2026-01-05":{"ขอนแก่น":29.2,"ร้อยเอ็ด":26.0,"กาฬสินธุ์":28.1,"มหาสารคาม":30.9},"2026-01-06":{"ขอนแก่น":21.7,"ร้อยเอ็ด":21.4,"กาฬสินธุ์":21.9,"มหาสารคาม":21.7},"2026-01-07":{"ขอนแก่น":20.7,"ร้อยเอ็ด":19.2,"กาฬสินธุ์":20.1,"มหาสารคาม":20.0},"2026-01-08":{"ขอนแก่น":28.5,"ร้อยเอ็ด":31.3,"กาฬสินธุ์":31.1,"มหาสารคาม":30.0},"2026-01-09":{"ขอนแก่น":35.4,"ร้อยเอ็ด":36.5,"กาฬสินธุ์":38.0,"มหาสารคาม":37.3},"2026-01-10":{"ขอนแก่น":36.9,"ร้อยเอ็ด":30.6,"กาฬสินธุ์":38.3,"มหาสารคาม":36.7},"2026-01-11":{"ขอนแก่น":34.5,"ร้อยเอ็ด":27.3,"กาฬสินธุ์":34.6,"มหาสารคาม":34.6},"2026-01-12":{"ขอนแก่น":40.8,"ร้อยเอ็ด":40.7,"กาฬสินธุ์":44.8,"มหาสารคาม":43.4},"2026-01-13":{"ขอนแก่น":51.1,"ร้อยเอ็ด":49.4,"กาฬสินธุ์":52.8,"มหาสารคาม":53.5},"2026-01-14":{"ขอนแก่น":55.7,"ร้อยเอ็ด":48.5,"กาฬสินธุ์":52.6,"มหาสารคาม":55.3},"2026-01-15":{"ขอนแก่น":63.3,"ร้อยเอ็ด":61.7,"กาฬสินธุ์":63.8,"มหาสารคาม":65.2},"2026-01-16":{"ขอนแก่น":55.0,"ร้อยเอ็ด":54.6,"กาฬสินธุ์":58.4,"มหาสารคาม":58.4},"2026-01-17":{"ขอนแก่น":55.4,"ร้อยเอ็ด":60.0,"กาฬสินธุ์":59.1,"มหาสารคาม":60.4},"2026-01-18":{"ขอนแก่น":52.8,"ร้อยเอ็ด":54.9,"กาฬสินธุ์":57.1,"มหาสารคาม":59.6},"2026-01-19":{"ขอนแก่น":51.5,"ร้อยเอ็ด":53.3,"กาฬสินธุ์":55.4,"มหาสารคาม":58.2},"2026-01-20":{"ขอนแก่น":43.7,"ร้อยเอ็ด":49.6,"กาฬสินธุ์":50.3,"มหาสารคาม":49.1},"2026-01-21":{"ขอนแก่น":38.2,"ร้อยเอ็ด":31.1,"กาฬสินธุ์":33.6,"มหาสารคาม":37.2},"2026-01-22":{"ขอนแก่น":30.0,"ร้อยเอ็ด":23.2,"กาฬสินธุ์":26.3,"มหาสารคาม":26.9},"2026-01-23":{"ขอนแก่น":22.1,"ร้อยเอ็ด":15.0,"กาฬสินธุ์":17.8,"มหาสารคาม":18.8},"2026-01-24":{"ขอนแก่น":26.6,"ร้อยเอ็ด":20.5,"กาฬสินธุ์":22.8,"มหาสารคาม":22.3},"2026-01-25":{"ขอนแก่น":35.9,"ร้อยเอ็ด":33.5,"กาฬสินธุ์":34.2,"มหาสารคาม":36.6},"2026-01-26":{"ขอนแก่น":47.3,"ร้อยเอ็ด":45.7,"กาฬสินธุ์":45.5,"มหาสารคาม":46.8},"2026-01-27":{"ขอนแก่น":38.6,"ร้อยเอ็ด":27.6,"กาฬสินธุ์":29.9,"มหาสารคาม":32.9},"2026-01-28":{"ขอนแก่น":36.8,"ร้อยเอ็ด":22.8,"กาฬสินธุ์":26.4,"มหาสารคาม":31.0},"2026-01-29":{"ขอนแก่น":36.9,"ร้อยเอ็ด":31.6,"กาฬสินธุ์":34.3,"มหาสารคาม":36.2},"2026-01-30":{"ขอนแก่น":49.3,"ร้อยเอ็ด":52.1,"กาฬสินธุ์":50.6,"มหาสารคาม":51.8},"2026-01-31":{"ขอนแก่น":48.8,"ร้อยเอ็ด":41.3,"กาฬสินธุ์":44.8,"มหาสารคาม":48.2},"2026-02-01":{"ขอนแก่น":32.9,"ร้อยเอ็ด":25.2,"กาฬสินธุ์":29.2,"มหาสารคาม":30.0},"2026-02-02":{"ขอนแก่น":23.8,"ร้อยเอ็ด":17.0,"กาฬสินธุ์":20.4,"มหาสารคาม":20.6},"2026-02-03":{"ขอนแก่น":18.6,"ร้อยเอ็ด":13.9,"กาฬสินธุ์":20.7,"มหาสารคาม":17.4},"2026-02-04":{"ขอนแก่น":28.3,"ร้อยเอ็ด":21.1,"กาฬสินธุ์":27.5,"มหาสารคาม":26.7},"2026-02-05":{"ขอนแก่น":38.1,"ร้อยเอ็ด":35.9,"กาฬสินธุ์":42.4,"มหาสารคาม":37.8},"2026-02-06":{"ขอนแก่น":39.9,"ร้อยเอ็ด":42.1,"กาฬสินธุ์":44.5,"มหาสารคาม":42.1},"2026-02-07":{"ขอนแก่น":37.7,"ร้อยเอ็ด":40.2,"กาฬสินธุ์":40.6,"มหาสารคาม":40.7},"2026-02-08":{"ขอนแก่น":29.1,"ร้อยเอ็ด":21.6,"กาฬสินธุ์":27.1,"มหาสารคาม":28.0},"2026-02-09":{"ขอนแก่น":23.3,"ร้อยเอ็ด":18.7,"กาฬสินธุ์":22.2,"มหาสารคาม":21.9},"2026-02-10":{"ขอนแก่น":30.8,"ร้อยเอ็ด":23.6,"กาฬสินธุ์":29.1,"มหาสารคาม":28.9},"2026-02-11":{"ขอนแก่น":37.8,"ร้อยเอ็ด":31.0,"กาฬสินธุ์":34.1,"มหาสารคาม":35.1},"2026-02-12":{"ขอนแก่น":35.8,"ร้อยเอ็ด":32.1,"กาฬสินธุ์":32.9,"มหาสารคาม":33.5},"2026-02-13":{"ขอนแก่น":34.9,"ร้อยเอ็ด":37.7,"กาฬสินธุ์":40.5,"มหาสารคาม":38.6},"2026-02-14":{"ขอนแก่น":35.4,"ร้อยเอ็ด":34.3,"กาฬสินธุ์":38.6,"มหาสารคาม":37.3},"2026-02-15":{"ขอนแก่น":39.2,"ร้อยเอ็ด":38.2,"กาฬสินธุ์":42.2,"มหาสารคาม":40.3},"2026-02-16":{"ขอนแก่น":45.6,"ร้อยเอ็ด":43.0,"กาฬสินธุ์":45.0,"มหาสารคาม":46.8},"2026-02-17":{"ขอนแก่น":34.7,"ร้อยเอ็ด":21.4,"กาฬสินธุ์":27.0,"มหาสารคาม":28.4},"2026-02-18":{"ขอนแก่น":23.2,"ร้อยเอ็ด":14.5,"กาฬสินธุ์":19.3,"มหาสารคาม":18.5},"2026-02-19":{"ขอนแก่น":23.3,"ร้อยเอ็ด":17.5,"กาฬสินธุ์":20.3,"มหาสารคาม":20.3},"2026-02-20":{"ขอนแก่น":26.1,"ร้อยเอ็ด":18.6,"กาฬสินธุ์":22.0,"มหาสารคาม":22.3},"2026-02-21":{"ขอนแก่น":31.9,"ร้อยเอ็ด":24.9,"กาฬสินธุ์":27.2,"มหาสารคาม":27.8},"2026-02-22":{"ขอนแก่น":37.5,"ร้อยเอ็ด":39.3,"กาฬสินธุ์":40.0,"มหาสารคาม":38.0},"2026-02-23":{"ขอนแก่น":37.8,"ร้อยเอ็ด":41.5,"กาฬสินธุ์":39.5,"มหาสารคาม":40.3},"2026-02-24":{"ขอนแก่น":36.0,"ร้อยเอ็ด":43.6,"กาฬสินธุ์":38.0,"มหาสารคาม":40.1},"2026-02-25":{"ขอนแก่น":25.5,"ร้อยเอ็ด":21.7,"กาฬสินธุ์":20.3,"มหาสารคาม":23.3},"2026-02-26":{"ขอนแก่น":32.1,"ร้อยเอ็ด":34.5,"กาฬสินธุ์":32.6,"มหาสารคาม":34.4},"2026-02-27":{"ขอนแก่น":28.2,"ร้อยเอ็ด":28.9,"กาฬสินธุ์":28.8,"มหาสารคาม":29.0},"2026-02-28":{"ขอนแก่น":22.4,"ร้อยเอ็ด":21.3,"กาฬสินธุ์":22.8,"มหาสารคาม":21.8}};
const CLEAR_ZEROS = false;   // ล้างค่า 0 ไปแล้วรอบแรก (16 ต.ค. 2569)

function backfillGistda() {
  const ss = SpreadsheetApp.openById(BF_SPREADSHEET_ID);
  const sh = ss.getSheetByName(BF_SHEET);
  const { byDate, rowOf, colOf } = bfReadSheet_();
  const raw = sh.getDataRange().getValues();
  const isZero = (d, name) => rowOf[d] && raw[rowOf[d] - 1][colOf[name] - 1] !== '' && +raw[rowOf[d] - 1][colOf[name] - 1] === 0;

  const bk = BF_SHEET + '_backup_' + Utilities.formatDate(new Date(), 'GMT+7', 'yyyyMMdd_HHmm');
  sh.copyTo(ss).setName(bk);
  console.log('สำรองแท็บเดิมไว้ที่ ' + bk);

  const log = ss.getSheetByName('_backfill_log') || ss.insertSheet('_backfill_log');
  if (log.getLastRow() === 0) log.appendRow(['เวลาที่เติม', 'วันที่', 'จังหวัด', 'ค่า (µg/m³)', 'วิธี', 'จำนวนชั่วโมงที่มีค่า', 'สถานี']);
  const stamp = Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd HH:mm');
  const logRows = [], newRows = [];
  let filled = 0, cleared = 0;

  Object.keys(GISTDA_FILL).sort().forEach(d => {
    const vals = {};
    BF_STATIONS.forEach(st => {
      const have = byDate[d] && typeof byDate[d][st.name] === 'number' && byDate[d][st.name] > 0;
      const v = GISTDA_FILL[d][st.name];
      if (have || typeof v !== 'number') return;
      vals[st.name] = v; filled++;
      logRows.push([stamp, d, st.name, v, 'gistda', '', 'GISTDA ดาวเทียม (PM25_Province_1m_' + (d < '2026-01-28' ? '2026-01-27' : '2026-02-28') + ')']);
    });
    if (!Object.keys(vals).length) return;
    if (rowOf[d]) Object.keys(vals).forEach(n => sh.getRange(rowOf[d], colOf[n]).setValue(vals[n]));
    else {
      const r = new Array(sh.getLastColumn()).fill('');
      r[0] = d; Object.keys(vals).forEach(n => r[colOf[n] - 1] = vals[n]);
      newRows.push(r);
    }
  });
  if (CLEAR_ZEROS) Object.keys(rowOf).forEach(d => BF_STATIONS.forEach(st => {
    if (GISTDA_FILL[d] && typeof GISTDA_FILL[d][st.name] === 'number') return;   // เติมไปแล้วข้างบน
    if (isZero(d, st.name)) { sh.getRange(rowOf[d], colOf[st.name]).setValue(''); cleared++; logRows.push([stamp, d, st.name, '', 'clear-zero', '', 'ค่า 0 = สถานีไม่มีข้อมูล → ช่องว่าง']); }
  }));
  if (newRows.length) sh.getRange(sh.getLastRow() + 1, 1, newRows.length, newRows[0].length).setValues(newRows);
  if (logRows.length) log.getRange(log.getLastRow() + 1, 1, logRows.length, logRows[0].length).setValues(logRows);
  console.log('เติมค่า GISTDA ' + filled + ' ค่า (แถวใหม่ ' + newRows.length + ' วัน) · ล้างค่า 0 เป็นช่องว่าง ' + cleared + ' ช่อง');
}

/**
 * เปลี่ยนค่าใน PM25_History ให้เป็นค่าเฉลี่ย 24 ชม. ณ 07:00 (Louis 16 ต.ค. 2569: แดชบอร์ดแสดงเฉพาะค่า 07.00 น.)
 * คัดลอกจากแท็บ PM25_07 (รัน backfill07 ก่อน) ตั้งแต่ 2 ส.ค. 2569 — ก่อนนั้น Air4Thai ไม่มีค่ารายชั่วโมงย้อนหลัง จึงคงค่ารอบบ่ายไว้
 *   - เขียนทับค่ารอบบ่ายเดิม (ตั้งใจ) · สำรองแท็บก่อน · บันทึกค่าเดิม→ค่าใหม่ใน _backfill_log วิธี = 'to07'
 *   - ช่องที่ PM25_07 ไม่มีค่า → คงค่าเดิมไว้ ไม่ลบ
 */
function historyTo07() {
  const FROM = '2026-08-02';
  const ss = SpreadsheetApp.openById(BF_SPREADSHEET_ID);
  const sh = ss.getSheetByName(BF_SHEET), s7 = ss.getSheetByName('PM25_07');
  if (!s7) throw new Error('ไม่พบแท็บ PM25_07 — รัน backfill07() ก่อน');
  const v7 = s7.getDataRange().getValues(), h7 = v7[0].map(x => String(x).trim()), by7 = {};
  for (let i = 1; i < v7.length; i++) {
    const d = bfNormDate_(v7[i][0]); if (!d || d < FROM) continue;
    by7[d] = {}; BF_STATIONS.forEach(st => { const x = v7[i][h7.indexOf(st.name)]; if (x !== '' && !isNaN(+x) && +x > 0) by7[d][st.name] = +x; });
  }
  const { byDate, rowOf, colOf } = bfReadSheet_();
  const bk = BF_SHEET + '_backup_' + Utilities.formatDate(new Date(), 'GMT+7', 'yyyyMMdd_HHmm');
  sh.copyTo(ss).setName(bk); console.log('สำรองแท็บเดิมไว้ที่ ' + bk);
  const log = ss.getSheetByName('_backfill_log') || ss.insertSheet('_backfill_log');
  if (log.getLastRow() === 0) log.appendRow(['เวลาที่เติม', 'วันที่', 'จังหวัด', 'ค่า (µg/m³)', 'วิธี', 'จำนวนชั่วโมงที่มีค่า', 'สถานี']);
  const stamp = Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd HH:mm');
  const logRows = [], newRows = []; let changed = 0, same = 0;
  Object.keys(by7).sort().forEach(d => {
    const vals = by7[d], cur = byDate[d] || {};
    Object.keys(vals).forEach(n => {
      if (cur[n] === vals[n]) { same++; return; }
      if (rowOf[d]) sh.getRange(rowOf[d], colOf[n]).setValue(vals[n]);
      logRows.push([stamp, d, n, vals[n], 'to07', '', 'เดิม ' + (cur[n] ?? 'ว่าง') + ' (รอบบ่าย) → ค่า 07:00 จาก PM25_07']); changed++;
    });
    if (!rowOf[d] && Object.keys(vals).length) {
      const r = new Array(sh.getLastColumn()).fill(''); r[0] = d;
      Object.keys(vals).forEach(n => r[colOf[n] - 1] = vals[n]); newRows.push(r);
    }
  });
  if (newRows.length) sh.getRange(sh.getLastRow() + 1, 1, newRows.length, newRows[0].length).setValues(newRows);
  if (logRows.length) log.getRange(log.getLastRow() + 1, 1, logRows.length, logRows[0].length).setValues(logRows);
  console.log('เปลี่ยนเป็นค่า 07:00 แล้ว ' + changed + ' ช่อง (แถวใหม่ ' + newRows.length + ' วัน) · ค่าเท่าเดิม ' + same + ' ช่อง · ตั้งแต่ ' + FROM);
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
