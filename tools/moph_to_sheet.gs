/**
 * MOPH → Google Sheet collector (ฝั่งไทย)
 * ------------------------------------------------------------------
 * ทำไมต้องมีไฟล์นี้:
 *   MOPH opendata (Cloudflare) บล็อก IP ดาต้าเซ็นเตอร์ต่างประเทศ (Render/US = 403)
 *   จึงต้องให้ "ตัวกลางในไทย" ดึงข้อมูลมาพักไว้ในชีต แล้วให้เว็บอ่านจากชีตแทน
 *   Apps Script รันบนเซิร์ฟเวอร์ Google — ถ้า egress ของ Google ไม่โดนบล็อก ก็ทำงานได้อัตโนมัติ
 *
 * ผลลัพธ์: เขียนแท็บ "2026" ในรูปแบบที่ server.js (parseDiseaseData) + หน้าเว็บอ่านได้
 *   หัวตาราง:  wk | ทางเดินหายใจ | หัวใจ | ตาอักเสบ | ผิวหนัง | อัพเดท
 *
 * วิธีใช้:
 *   1) เปิด Google Sheet ปลายทาง → Extensions → Apps Script
 *   2) วางโค้ดนี้ทั้งไฟล์ → กด Save
 *   3) เลือกฟังก์ชัน syncMophDisease แล้วกด Run (ครั้งแรกจะขอสิทธิ์ ให้อนุญาต)
 *   4) ดู Execution log:
 *        - ถ้าขึ้น "✅ เขียนแท็บ 2026 …" = Google egress ผ่าน MOPH → ตั้ง Trigger รายวันได้เลย
 *        - ถ้าขึ้น HTTP 403 ทุกจังหวัด = Google ก็โดนบล็อกเหมือนกัน → ต้องรันจากเครื่อง/โฮสต์ในไทยแทน
 *   5) ตั้งอัตโนมัติ: Triggers (⏰) → Add Trigger → syncMophDisease → Time-driven → Day timer (เช่น 06:00–07:00)
 */

// ── ตั้งค่า ──────────────────────────────────────────────────────────
var SHEET_ID   = '1bBOvPusSvh7R0AXG5ej9CxagtRkJXLaaJo79I4s9PX8'; // Sheet ปลายทาง (จาก config.json)
var TAB_NAME   = '2026';        // แท็บที่ server.js อ่านสำหรับปี 2569
var BE_YEAR    = '2569';        // ปีงบ พ.ศ. ที่ดึงจาก MOPH
var PROVINCES  = [40, 44, 45, 46];  // เขตสุขภาพ 7: ขอนแก่น มหาสารคาม ร้อยเอ็ด กาฬสินธุ์
var MOPH_URL   = 'https://opendata.moph.go.th/api/report_data';

// diag_main (bitmask) → หมวดโรคในหน้าเว็บ (ต้องตรงกับ config.diseases[].key)
var DIAG_GROUP = {
  2: 'ทางเดินหายใจ', 4: 'ทางเดินหายใจ', 2048: 'ทางเดินหายใจ', // COPD(J44), Asthma, (J44.2)
  8: 'หัวใจ', 16: 'หัวใจ', 4096: 'หัวใจ',                       // Ischemic(I21), STEMI/NSTEMI(I22), (I24)
  32: 'ตาอักเสบ',                                              // Conjunctivitis(H10)
  64: 'ผิวหนัง', 128: 'ผิวหนัง'                                // Eczema(L30.9), Urticaria(L50)
};
var CATS = ['ทางเดินหายใจ', 'หัวใจ', 'ตาอักเสบ', 'ผิวหนัง'];

function syncMophDisease() {
  var acc = {};          // acc[wk][cat] = ยอดรวม (w_NN_m)
  var maxDateCom = '';
  var okCount = 0;

  for (var i = 0; i < PROVINCES.length; i++) {
    var pv = PROVINCES[i];
    var resp = UrlFetchApp.fetch(MOPH_URL, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        tableName: 's_pm25_1_in_week',
        year: String(BE_YEAR),
        province: String(pv),
        type: 'json'
      }),
      muteHttpExceptions: true
    });
    var code = resp.getResponseCode();
    if (code !== 200 && code !== 201) {
      Logger.log('❌ province ' + pv + ' → HTTP ' + code + ' (โดนบล็อก?) ' + resp.getContentText().slice(0, 120));
      continue;
    }
    var rows;
    try { rows = JSON.parse(resp.getContentText()); } catch (e) { Logger.log('❌ province ' + pv + ' parse error'); continue; }
    if (!Array.isArray(rows)) { Logger.log('❌ province ' + pv + ' ไม่ใช่ array'); continue; }
    okCount++;

    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      var cat = DIAG_GROUP[row.diag_main];
      if (!cat) continue;
      if (row.date_com && String(row.date_com) > maxDateCom) maxDateCom = String(row.date_com);
      for (var w = 1; w <= 53; w++) {
        var key = 'w_' + (w < 10 ? '0' + w : w) + '_m'; // _m = จำนวนที่เข้ารับบริการ
        var v = row[key];
        if (typeof v === 'number' && v > 0) {
          if (!acc[w]) acc[w] = {};
          acc[w][cat] = (acc[w][cat] || 0) + v;
        }
      }
    }
  }

  if (okCount === 0) {
    Logger.log('⛔ ดึง MOPH ไม่สำเร็จเลยสักจังหวัด — Google egress น่าจะโดนบล็อก ให้รันจากเครื่อง/โฮสต์ในไทยแทน');
    return;
  }

  // date_com = YYYYMMDDHHMM → DD/MM/YYYY (ค.ศ.) ให้หน้าเว็บ +543 เป็น พ.ศ. เอง
  var upd = /^\d{12}/.test(maxDateCom)
    ? (parseInt(maxDateCom.slice(6, 8), 10) + '/' + parseInt(maxDateCom.slice(4, 6), 10) + '/' + maxDateCom.slice(0, 4))
    : '';

  // สร้างตาราง 2 มิติ: header + แถวรายสัปดาห์ (เฉพาะสัปดาห์ที่มีข้อมูล)
  var out = [['wk'].concat(CATS).concat(['อัพเดท'])];
  for (var wk = 1; wk <= 53; wk++) {
    if (!acc[wk]) continue;
    var line = [wk];
    for (var c = 0; c < CATS.length; c++) line.push(acc[wk][CATS[c]] || 0);
    line.push(upd);
    out.push(line);
  }

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sh = ss.getSheetByName(TAB_NAME) || ss.insertSheet(TAB_NAME);
  sh.clearContents();
  sh.getRange(1, 1, out.length, out[0].length).setValues(out);

  Logger.log('✅ เขียนแท็บ "' + TAB_NAME + '" ' + (out.length - 1) + ' สัปดาห์ (อัพเดท ' + upd + ') จาก ' + okCount + '/' + PROVINCES.length + ' จังหวัด');
}
