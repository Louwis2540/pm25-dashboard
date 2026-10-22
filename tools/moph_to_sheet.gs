/**
 * MOPH → Google Sheet collector (ตัวสำรอง)
 * ------------------------------------------------------------------
 * บทบาทปัจจุบัน — เปลี่ยนแล้ว 18/08/2026:
 *   เดิม MOPH opendata (Cloudflare) บล็อก IP ดาต้าเซ็นเตอร์ต่างประเทศ (Render = 403)
 *   จึงต้องมี "ตัวกลางในไทย" ดึงมาพักในชีต แล้วให้เว็บอ่านจากชีตแทน
 *
 *   ตอนนี้ MOPH เปิดให้เรียกตรงแล้ว และ Render ยิงผ่าน (ยืนยันจาก meta.source = 'moph')
 *   → ไฟล์นี้กลายเป็น "ตัวสำรอง" ไม่ใช่ทางหลักอีกต่อไป
 *     server.js อ่านชีตแท็บ 2026 เฉพาะตอนยิง MOPH ไม่ผ่านเท่านั้น
 *   ยังควรตั้ง trigger รันต่อไว้ เพราะถ้า MOPH บล็อกอีกรอบ ชีตคือสิ่งเดียว
 *   ที่ทำให้หน้าเว็บไม่ว่างเปล่า
 *
 * ผลลัพธ์: เขียนแท็บ "2026" ในรูปแบบที่ server.js (parseDiseaseData) + หน้าเว็บอ่านได้
 *   หัวตาราง:  wk | ทางเดินหายใจ | หัวใจ | ตาอักเสบ | ผิวหนัง | อัพเดท
 *   และเขียนแท็บ "_sync_status" บอกผลการรันล่าสุด (ไว้ตรวจย้อนหลังว่าค้างตั้งแต่เมื่อไร)
 *
 * วิธีใช้:
 *   1) เปิด Google Sheet ปลายทาง → Extensions → Apps Script
 *   2) วางโค้ดนี้ทั้งไฟล์ → กด Save
 *   3) เลือกฟังก์ชัน syncMophDisease แล้วกด Run (ครั้งแรกจะขอสิทธิ์ ให้อนุญาต)
 *      ⚠️ เวอร์ชันนี้เพิ่มการส่งอีเมลแจ้งเตือน → ต้อง "อนุญาตสิทธิ์ใหม่" อีกครั้ง
 *         (สิทธิ์ส่งเมล script.send_mail) ถึงจะแจ้งเตือนได้
 *   4) ดู Execution log:
 *        - ถ้าขึ้น "✅ เขียนแท็บ 2026 …" = ผ่าน → ตั้ง Trigger รายวันได้เลย
 *        - "• province 40 → 1085 แถว" = จำนวนแถวที่ดึงได้จริงรายจังหวัด ใช้เช็กว่าครบไหม
 *        - ถ้าขึ้น HTTP 403 ทุกจังหวัด = Cloudflare บล็อก IP ที่ยิงออกไป
 *        - ถ้าขึ้น HTTP 404 ทุกจังหวัด = MOPH ถอด/ย้าย endpoint /api/report_data
 *        - ถ้าขึ้น "รูปแบบข้อมูลไม่รู้จัก" = MOPH เปลี่ยนรูปแบบ response อีกแล้ว
 *          (เคยเกิด ส.ค. 2569: เปลี่ยนจาก array เป็น { data, total, limit, offset }
 *           ทำให้สคริปต์พังเงียบ 13 รอบติด — ดู fetchProvinceRows_ ที่รองรับทั้งสองแบบ)
 *   5) ตั้งอัตโนมัติ: Triggers (⏰) → Add Trigger → syncMophDisease → Time-driven → Day timer (เช่น 06:00–07:00)
 *   6) ทดสอบว่าอีเมลแจ้งเตือนถึงจริง: เลือกฟังก์ชัน testAlert แล้วกด Run
 *
 * หมายเหตุสำคัญเรื่อง "ค้างเงียบ" (silent staleness):
 *   ถ้าดึง MOPH ไม่สำเร็จ สคริปต์จะ "ไม่แตะชีตเดิม" โดยตั้งใจ (ข้อมูลเก่ายังอยู่ครบ ไม่หาย)
 *   ผลข้างเคียงคือ LINE/เว็บจะรายงานตัวเลขเดิมซ้ำไปเรื่อยๆ โดยไม่มีสัญญาณผิดปกติ
 *   เวอร์ชันนี้จึงเพิ่ม "ตัวเฝ้าระวัง" 2 ชั้น:
 *     ชั้นที่ 1  ดึงไม่สำเร็จเลยสักจังหวัด        → อีเมลแจ้งเตือนทันที
 *     ชั้นที่ 2  ดึงสำเร็จ แต่ date_com ไม่ขยับนาน → อีเมลแจ้งเตือนว่าต้นทางหยุดอัปเดต
 *   ทั้งสองชั้นมี cooldown กันอีเมลถล่มทุกวัน (ดู ALERT_COOLDOWN_HOURS)
 */

// ── ตั้งค่า ──────────────────────────────────────────────────────────
var SHEET_ID   = '1bBOvPusSvh7R0AXG5ej9CxagtRkJXLaaJo79I4s9PX8'; // Sheet ปลายทาง (จาก config.json)
var TAB_NAME   = '2026';        // แท็บที่ server.js อ่านสำหรับปี 2569
var BE_YEAR    = '2569';        // ปีงบ พ.ศ. ที่ดึงจาก MOPH
// ตั้งชื่อเฉพาะ (ไม่ใช้ PROVINCES) เพราะไฟล์อื่นในโปรเจกต์ Apps Script มี PROVINCES เป็น object
// ซึ่งทับตัวนี้ → PROVINCES.length = undefined → ลูปไม่ทำงานเลย → "ดึงไม่สำเร็จเลยสักจังหวัด"
var MOPH_PROVINCES = [40, 44, 45, 46];  // เขตสุขภาพ 7: ขอนแก่น มหาสารคาม ร้อยเอ็ด กาฬสินธุ์
var MOPH_URL   = 'https://opendata.moph.go.th/api/report_data';

// MOPH แบ่งหน้า: ถ้าไม่ส่ง limit จะได้แค่ 1000 แถวแรก (ขอนแก่นมี ~1,085 แถว/ปี → ตกหล่น)
var MOPH_PAGE_SIZE = 5000;
var MOPH_MAX_PAGES = 20;   // กันลูปไม่รู้จบถ้า total ที่ MOPH ส่งมาเพี้ยน

// ── ตั้งค่าการแจ้งเตือน ──────────────────────────────────────────────
var ALERT_EMAILS = [];   // เช่น ['someone@moph.go.th','admin@example.com']
                         // เว้นว่างไว้ = ส่งหาอีเมลเจ้าของสคริปต์เอง
var STALE_DAYS   = 10;   // ข้อมูล (date_com) เก่ากว่ากี่วัน ถือว่า "ค้าง" — ต้องตรงกับ api.disease_stale_days ใน config.json
var ALERT_COOLDOWN_HOURS = 24;  // เตือนเรื่องเดิมซ้ำได้ทุกกี่ชั่วโมง
var STATUS_TAB   = '_sync_status';  // แท็บบันทึกผลการรันล่าสุด

// diag_main (bitmask) → หมวดโรคในหน้าเว็บ (ต้องตรงกับ config.diseases[].key)
var DIAG_GROUP = {
  2: 'ทางเดินหายใจ', 4: 'ทางเดินหายใจ', 2048: 'ทางเดินหายใจ', // COPD(J44), Asthma, (J44.2)
  8: 'หัวใจ', 16: 'หัวใจ', 4096: 'หัวใจ',                       // Ischemic(I21), STEMI/NSTEMI(I22), (I24)
  32: 'ตาอักเสบ',                                              // Conjunctivitis(H10)
  64: 'ผิวหนัง', 128: 'ผิวหนัง'                                // Eczema(L30.9), Urticaria(L50)
};
var CATS = ['ทางเดินหายใจ', 'หัวใจ', 'ตาอักเสบ', 'ผิวหนัง'];

function syncMophDisease() {
  var started = new Date();
  var acc = {};          // acc[wk][cat] = ยอดรวม (w_NN_m)
  var maxDateCom = '';
  var okCount = 0;
  var errors  = [];      // เก็บสาเหตุรายจังหวัด ไว้ใส่ในอีเมลแจ้งเตือน

  for (var i = 0; i < MOPH_PROVINCES.length; i++) {
    var pv  = MOPH_PROVINCES[i];
    var res = fetchProvinceRows_(pv);
    if (res.error) {
      errors.push('จังหวัด ' + pv + ' → ' + res.error);
      Logger.log('❌ province ' + pv + ' → ' + res.error);
      continue;
    }
    var rows = res.rows;
    Logger.log('• province ' + pv + ' → ' + rows.length + ' แถว');
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

  // ── ชั้นที่ 1: ดึงไม่ได้เลยสักจังหวัด ──────────────────────────────
  // ตั้งใจ return ก่อนถึง clearContents() เพื่อไม่ให้ข้อมูลเดิมในชีตหาย
  if (okCount === 0) {
    var streak = bumpFailStreak_();
    var reason = errors.join('\n') || '(ไม่มีรายละเอียด)';
    writeStatus_(started, false, '', reason, streak);
    Logger.log('⛔ ดึง MOPH ไม่สำเร็จเลยสักจังหวัด — ข้อมูลเดิมในชีตยังอยู่ครบ (ไม่ถูกล้าง)');

    alertOnce_('sync_fail',
      '[PM2.5 สคร.7] ⛔ ดึงข้อมูลกลุ่มโรคจาก MOPH ไม่สำเร็จ',
      'ตัวเก็บข้อมูล syncMophDisease ดึงข้อมูลจาก MOPH ไม่สำเร็จเลยสักจังหวัด\n\n' +
      'เวลาที่รัน   : ' + fmtTime_(started) + '\n' +
      'ล้มต่อเนื่อง : ' + streak + ' ครั้ง\n' +
      'ปลายทาง     : ' + MOPH_URL + '\n\n' +
      'รายละเอียดรายจังหวัด:\n' + reason + '\n\n' +
      '── ผลกระทบ ──\n' +
      'ชีตแท็บ "' + TAB_NAME + '" ยังเก็บข้อมูลเดิมไว้ครบ (ไม่ถูกล้างทิ้ง)\n' +
      'แต่ LINE และหน้าเว็บจะรายงาน "ตัวเลขเดิม" ซ้ำจนกว่าจะดึงใหม่สำเร็จ\n\n' +
      '── แนวทางตรวจสอบ ──\n' +
      '• HTTP 403 = Cloudflare ของ MOPH บล็อก IP ที่ยิงออกไป\n' +
      '• HTTP 404 = MOPH ถอด/ย้าย endpoint แล้ว ต้องประสานผู้ดูแล MOPH Open Data\n' +
      '• HTTP 5xx / timeout = ต้นทางล่มชั่วคราว รอรอบถัดไปได้\n');
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

  // ── ชั้นที่ 1.5: ดึงได้ (HTTP 200) แต่ไม่มีข้อมูลรายสัปดาห์เลย ─────
  // out มีแต่หัวตาราง = ต้นทางส่งข้อมูลว่าง/รูปแบบเปลี่ยน → ห้ามล้างแท็บเดิม
  // (ของเดิม: นับว่า "สำเร็จ" แล้ว clearContents() เขียนทับด้วยหัวตารางอย่างเดียว)
  if (out.length < 2) {
    var streakEmpty = bumpFailStreak_();
    var reasonEmpty = 'MOPH ตอบสำเร็จ ' + okCount + '/' + MOPH_PROVINCES.length +
      ' จังหวัด แต่ไม่มีข้อมูลรายสัปดาห์ของปี ' + BE_YEAR + ' เลย';
    writeStatus_(started, false, '', reasonEmpty, streakEmpty);
    Logger.log('⛔ ' + reasonEmpty + ' — ข้อมูลเดิมในชีตยังอยู่ครบ (ไม่ถูกล้าง)');

    alertOnce_('sync_empty',
      '[PM2.5 สคร.7] ⛔ ข้อมูลกลุ่มโรคจาก MOPH ว่างเปล่า',
      'syncMophDisease ดึง MOPH ได้ แต่ไม่พบข้อมูลรายสัปดาห์เลย\n\n' +
      'เวลาที่รัน   : ' + fmtTime_(started) + '\n' +
      'ล้มต่อเนื่อง : ' + streakEmpty + ' ครั้ง\n' +
      'ปีที่ขอ      : ' + BE_YEAR + '\n\n' +
      '── ผลกระทบ ──\n' +
      'ชีตแท็บ "' + TAB_NAME + '" ยังเก็บข้อมูลเดิมไว้ครบ (ไม่ถูกล้างทิ้ง)\n' +
      'LINE และหน้าเว็บจะรายงานตัวเลขเดิมจนกว่าจะดึงใหม่สำเร็จ\n\n' +
      '── แนวทางตรวจสอบ ──\n' +
      '• ดู Execution log: "• province N → X แถว" ถ้า X = 0 แปลว่าต้นทางว่าง\n' +
      '• เช็กว่า MOPH เปลี่ยนค่าพารามิเตอร์ year / tableName หรือไม่\n');
    return;
  }

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sh = ss.getSheetByName(TAB_NAME) || ss.insertSheet(TAB_NAME);
  sh.clearContents();
  sh.getRange(1, 1, out.length, out[0].length).setValues(out);

  resetFailStreak_();
  var partial = errors.length ? errors.join('\n') : '';
  writeStatus_(started, true, upd, partial, 0);
  Logger.log('✅ เขียนแท็บ "' + TAB_NAME + '" ' + (out.length - 1) + ' สัปดาห์ (อัพเดท ' + upd + ') จาก ' + okCount + '/' + MOPH_PROVINCES.length + ' จังหวัด');

  // ── ชั้นที่ 2: ดึงได้ แต่ต้นทางหยุดอัปเดต ────────────────────────
  var age = dataAgeDays_(upd);
  if (age !== null && age > STALE_DAYS) {
    alertOnce_('stale',
      '[PM2.5 สคร.7] ⚠️ ข้อมูลกลุ่มโรคจาก MOPH ค้าง ' + age + ' วัน',
      'ดึงข้อมูลจาก MOPH สำเร็จ แต่ตัวข้อมูลเองไม่ถูกอัปเดตที่ต้นทาง\n\n' +
      'วันที่ข้อมูลล่าสุด (date_com) : ' + toBE_(upd) + '\n' +
      'อายุข้อมูล                   : ' + age + ' วัน (เกณฑ์เตือนที่ ' + STALE_DAYS + ' วัน)\n' +
      'เวลาที่รัน                   : ' + fmtTime_(started) + '\n\n' +
      'ยอดสะสมที่รายงานใน LINE และหน้าเว็บจึงต่ำกว่าสถานการณ์จริง\n' +
      'ควรประสานผู้ดูแลข้อมูล HDC/MOPH ว่าค้างที่ขั้นตอนใด\n');
  } else if (age !== null) {
    // ข้อมูลขยับแล้ว → ล้าง cooldown เพื่อให้รอบหน้าเตือนได้ทันทีถ้าค้างอีก
    PropertiesService.getScriptProperties().deleteProperty('alert_stale');
  }

  // บางจังหวัดพลาด แต่ไม่ทั้งหมด → ยอดรวมขาด ต้องรู้ด้วย
  if (okCount < MOPH_PROVINCES.length) {
    alertOnce_('partial',
      '[PM2.5 สคร.7] ⚠️ ดึงข้อมูลโรคได้ไม่ครบ ' + okCount + '/' + MOPH_PROVINCES.length + ' จังหวัด',
      'ยอดรวมรายสัปดาห์ที่เขียนลงชีตรอบนี้ "ขาดบางจังหวัด" จึงต่ำกว่าความจริง\n\n' +
      'เวลาที่รัน : ' + fmtTime_(started) + '\n\n' +
      'จังหวัดที่พลาด:\n' + errors.join('\n') + '\n');
  }
}

/**
 * ดึงข้อมูลดิบของจังหวัดเดียวให้ครบทุกหน้า
 *
 * MOPH ตอบเป็น { data: [...], total, limit, offset } ไม่ใช่ array ตรงๆ
 * โค้ดเดิมเช็ค Array.isArray() แล้วตีว่า "รูปแบบข้อมูลไม่ใช่ array" → พังทุกจังหวัด
 * (fail_streak 13 ครั้งติด) ตรงนี้จึงรองรับทั้งสองรูปแบบ เผื่อ API เปลี่ยนกลับอีก
 *
 * คืน { rows: [...] } ถ้าสำเร็จ หรือ { error: 'เหตุผล' } ถ้าพลาด
 */
function fetchProvinceRows_(pv) {
  var rows = [];

  for (var page = 0; page < MOPH_MAX_PAGES; page++) {
    var resp;
    try {
      resp = UrlFetchApp.fetch(MOPH_URL, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({
          tableName: 's_pm25_1_in_week',
          year: String(BE_YEAR),
          province: String(pv),
          type: 'json',
          limit: MOPH_PAGE_SIZE,
          offset: page * MOPH_PAGE_SIZE
        }),
        muteHttpExceptions: true
      });
    } catch (e) {
      return { error: 'เรียกไม่สำเร็จ: ' + e.message };
    }

    var code = resp.getResponseCode();
    if (code !== 200 && code !== 201) {
      var snippet = resp.getContentText().slice(0, 120).replace(/\s+/g, ' ');
      return { error: 'HTTP ' + code + ' | ' + snippet };
    }

    var body;
    try { body = JSON.parse(resp.getContentText()); } catch (e) {
      return { error: 'อ่าน JSON ไม่ได้' };
    }

    // รูปแบบปัจจุบัน { data: [...] } | รูปแบบเดิม [ ... ]
    var chunk = Array.isArray(body) ? body : (body ? body.data : null);
    if (!Array.isArray(chunk)) {
      return { error: 'รูปแบบข้อมูลไม่รู้จัก (ไม่มีทั้ง array และ .data)' };
    }

    rows = rows.concat(chunk);

    var total = Array.isArray(body) ? chunk.length : (Number(body.total) || 0);
    if (chunk.length < MOPH_PAGE_SIZE || rows.length >= total) break;
  }

  return { rows: rows };
}

/* ══════════════════════════════════════════
   ตัวช่วย — อายุข้อมูล / รูปแบบวันที่
══════════════════════════════════════════ */

/**
 * อายุข้อมูลเป็นจำนวนวัน จากค่าวันที่ในคอลัมน์ "อัพเดท"
 * รับได้ทั้ง:
 *   • สตริง 'D/M/YYYY' ทั้งแบบ ค.ศ. (2026) และ พ.ศ. (2569)
 *   • object Date — เพราะ getRange('F2').getValue() อาจคืน Date ถ้า Sheets
 *     ตีความข้อความ 24/7/2026 เป็นวันที่ตามภาษาของไฟล์ (ไม่ใช่ข้อความล้วน)
 * คืน null ถ้ารูปแบบไม่ถูก
 */
function dataAgeDays_(dateStr) {
  if (Object.prototype.toString.call(dateStr) === '[object Date]') {
    if (isNaN(dateStr.getTime())) return null;
    var d0 = new Date(dateStr.getFullYear(), dateStr.getMonth(), dateStr.getDate());
    return Math.floor((new Date().getTime() - d0.getTime()) / 86400000);
  }
  var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(dateStr || '').trim());
  if (!m) return null;
  var y = parseInt(m[3], 10);
  if (y > 2400) y -= 543;                       // เผื่อมีคนแก้ชีตเป็น พ.ศ. เอง
  var dt = new Date(y, parseInt(m[2], 10) - 1, parseInt(m[1], 10));
  if (isNaN(dt.getTime())) return null;
  return Math.floor((new Date().getTime() - dt.getTime()) / 86400000);
}

/** 'D/M/YYYY' (ค.ศ./พ.ศ.) หรือ object Date → 'D/M/พ.ศ.' สำหรับแสดงผล */
function toBE_(dateStr) {
  if (Object.prototype.toString.call(dateStr) === '[object Date]' && !isNaN(dateStr.getTime())) {
    return dateStr.getDate() + '/' + (dateStr.getMonth() + 1) + '/' + (dateStr.getFullYear() + 543);
  }
  var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(dateStr || '').trim());
  if (!m) return String(dateStr || '');
  var y = parseInt(m[3], 10);
  if (y < 2400) y += 543;
  return parseInt(m[1], 10) + '/' + parseInt(m[2], 10) + '/' + y;
}

function fmtTime_(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'd/M/yyyy HH:mm');
}

/**
 * ป้ายบอกอายุข้อมูลสำหรับข้อความ LINE  ← เรียกใช้จาก รหัส.gs
 *
 * วิธีใช้: ใน รหัส.gs ตรงที่ประกอบข้อความรายงาน ให้ต่อท้ายบล็อกยอดผู้ป่วยสะสม
 *     msg += diseaseAgeNote(updateDateStr);
 * โดย updateDateStr คือค่าวันที่ที่อ่านมาจากคอลัมน์ "อัพเดท" (F) ของแท็บ 2026
 * ถ้าข้อมูลยังสดอยู่ ฟังก์ชันจะคืนสตริงว่าง → ข้อความ LINE เหมือนเดิมทุกประการ
 */
function diseaseAgeNote(dateStr) {
  var age = dataAgeDays_(dateStr);
  if (age === null || age <= STALE_DAYS) return '';
  return '\n⚠️ ข้อมูลกลุ่มโรคยังไม่อัปเดตจาก HDC กระทรวงสาธารณสุข ' + age + ' วัน ' +
         '(ล่าสุด ' + toBE_(dateStr) + ')';
}

/* ══════════════════════════════════════════
   ตัวช่วย — แจ้งเตือน / บันทึกสถานะ
══════════════════════════════════════════ */

function alertRecipients_() {
  if (ALERT_EMAILS && ALERT_EMAILS.length) return ALERT_EMAILS.join(',');
  return Session.getEffectiveUser().getEmail() || '';
}

/**
 * ส่งอีเมลแจ้งเตือน โดยเตือนเรื่องเดิมซ้ำได้ไม่เกิน 1 ครั้งต่อ ALERT_COOLDOWN_HOURS
 * (trigger รันทุกวัน — ถ้าไม่คุม จะได้อีเมลเรื่องเดิมทุกวันจนคนเลิกอ่าน)
 */
function alertOnce_(key, subject, body) {
  var props = PropertiesService.getScriptProperties();
  var propKey = 'alert_' + key;
  var last = Number(props.getProperty(propKey) || 0);
  var now  = new Date().getTime();

  if (last && (now - last) < ALERT_COOLDOWN_HOURS * 3600 * 1000) {
    Logger.log('🔕 ข้ามการเตือน "' + key + '" (เพิ่งเตือนไปเมื่อ ' + fmtTime_(new Date(last)) + ')');
    return;
  }
  var to = alertRecipients_();
  if (!to) { Logger.log('⚠️ ไม่พบอีเมลผู้รับ — ตั้งค่า ALERT_EMAILS ด้วย'); return; }

  try {
    MailApp.sendEmail({ to: to, subject: subject, body: body });
    props.setProperty(propKey, String(now));
    Logger.log('📧 ส่งแจ้งเตือน "' + key + '" → ' + to);
  } catch (e) {
    Logger.log('❌ ส่งอีเมลไม่สำเร็จ: ' + e.message);
  }
}

function bumpFailStreak_() {
  var props = PropertiesService.getScriptProperties();
  var n = Number(props.getProperty('failStreak') || 0) + 1;
  props.setProperty('failStreak', String(n));
  return n;
}

function resetFailStreak_() {
  var props = PropertiesService.getScriptProperties();
  props.setProperty('failStreak', '0');
  props.deleteProperty('alert_sync_fail');   // สำเร็จแล้ว → ให้เตือนได้ทันทีถ้าล้มอีก
  props.deleteProperty('alert_partial');
  props.deleteProperty('alert_sync_empty');
}

/** เขียนผลการรันล่าสุดลงแท็บ _sync_status (ไว้ย้อนดูว่าค้างตั้งแต่เมื่อไร) */
function writeStatus_(started, ok, dataDate, note, failStreak) {
  try {
    var props = PropertiesService.getScriptProperties();
    if (ok) props.setProperty('lastSuccessAt', fmtTime_(started));

    var age = dataDate ? dataAgeDays_(dataDate) : null;
    var rows = [
      ['key', 'value'],
      ['last_run',      fmtTime_(started)],
      ['last_status',   ok ? 'OK' : 'FAIL'],
      ['last_success',  props.getProperty('lastSuccessAt') || '(ยังไม่เคยสำเร็จ)'],
      ['data_date',     dataDate ? toBE_(dataDate) : ''],
      ['data_age_days', age === null ? '' : String(age)],
      ['fail_streak',   String(failStreak)],
      ['note',          String(note || '').slice(0, 500)]
    ];

    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sh = ss.getSheetByName(STATUS_TAB) || ss.insertSheet(STATUS_TAB);
    sh.clearContents();
    // บังคับเป็น plain text ก่อนเขียน — ไม่งั้น Sheets แปลง '18/8/2026 9:50' เป็นวันที่จริง
    // แล้ว gviz จะเดาทั้งคอลัมน์เป็น datetime ทำให้เซลล์ข้อความ (OK / fail_streak / note)
    // หลุดเป็นค่าว่างตอนอ่านออกมาจากข้างนอก และ '17/8/2569' ถูกอ่านเป็น ค.ศ. 2569
    var rng = sh.getRange(1, 1, rows.length, 2);
    rng.setNumberFormat('@');
    rng.setValues(rows);
  } catch (e) {
    Logger.log('⚠️ เขียนแท็บ ' + STATUS_TAB + ' ไม่สำเร็จ: ' + e.message);
  }
}

/** ทดสอบว่าอีเมลแจ้งเตือนส่งถึงจริง — เลือกฟังก์ชันนี้แล้วกด Run */
function testAlert() {
  var to = alertRecipients_();
  Logger.log('ผู้รับที่จะใช้: ' + (to || '(ไม่พบ — ตั้ง ALERT_EMAILS ด้วย)'));
  MailApp.sendEmail({
    to: to,
    subject: '[PM2.5 สคร.7] ✅ ทดสอบระบบแจ้งเตือน',
    body: 'ถ้าได้รับอีเมลฉบับนี้ แปลว่าการแจ้งเตือนของ syncMophDisease ทำงานแล้ว\n\n' +
          'เวลาที่ทดสอบ: ' + fmtTime_(new Date()) + '\n' +
          'เกณฑ์เตือนข้อมูลค้าง: ' + STALE_DAYS + ' วัน\n'
  });
  Logger.log('📧 ส่งเมลทดสอบแล้ว');
}

/**
 * ทดสอบข้อความป้ายอายุข้อมูลที่จะต่อท้ายรายงาน LINE — เลือกฟังก์ชันนี้แล้วกด Run
 *
 * ⚠️ อย่าใช้ main() ทดสอบ เพราะ main() ยิง broadcast เข้า LINE OA จริง
 *    ผู้ติดตามทุกคนจะได้รับข้อความทดสอบไปด้วย ฟังก์ชันนี้แค่อ่านชีตแล้ว log เฉยๆ
 */
function testDiseaseNote() {
  var v = SpreadsheetApp.openById(SHEET_ID).getSheetByName(TAB_NAME).getRange('F2').getValue();
  Logger.log('ค่าที่อ่านได้จาก F2 : ' + v + '   (ชนิดข้อมูล: ' + (Object.prototype.toString.call(v)) + ')');
  Logger.log('อายุข้อมูล          : ' + dataAgeDays_(v) + ' วัน  (เกณฑ์เตือน ' + STALE_DAYS + ' วัน)');
  Logger.log('ข้อความที่จะต่อท้าย : ' + (diseaseAgeNote(v) || '(ว่าง — ข้อมูลยังสด ไม่ต้องเตือน)'));
}

/** ล้าง cooldown ทั้งหมด — ใช้ตอนอยากให้เตือนใหม่ทันทีโดยไม่ต้องรอ 24 ชม. */
function resetAlertCooldown() {
  var props = PropertiesService.getScriptProperties();
  ['alert_sync_fail', 'alert_stale', 'alert_partial', 'alert_sync_empty', 'alert_pvl_fail'].forEach(function (k) { props.deleteProperty(k); });
  Logger.log('🔄 ล้าง cooldown การแจ้งเตือนแล้ว');
}

/* ══════════════════════════════════════════════════════════════════
   แท็บ "latest" — ผู้ป่วยรายจังหวัด (โซน E2 ของแดชบอร์ด) · ตาราง s_pm25_2_in_week
   ─────────────────────────────────────────────────────────────────
   ทำไมต้องมี: แดชบอร์ด (Render) ถ้าไม่เจอแท็บนี้จะยิง MOPH ตรงทุกครั้งที่เซิร์ฟเวอร์เปิด/รีเฟรช
   (ตารางนี้ใหญ่ ต้องยิงหลายหน้า) → โดน 429 และเสี่ยงโดนบล็อก IP
   → ให้ Apps Script ดึงวันละครั้งตอนกลางคืนแล้วเขียนลงแท็บนี้ แดชบอร์ดอ่านจากชีตอย่างเดียว

   รูปแบบแท็บ (ตรงกับที่ diseasePvFromSheet ใน server.js อ่าน):
     snapshot_at | date_com | b_year | table | pv_code | pv_name | wk | group | m
   ตั้งชื่อตัวแปร/ฟังก์ชันขึ้นต้น PVL_ / syncMophProvinceLatest เพื่อไม่ชนไฟล์อื่นในโปรเจกต์
   (เคยเจอ PROVINCES ชนกันแล้ว — โปรเจกต์นี้ทุกไฟล์ใช้ global เดียวกัน)
══════════════════════════════════════════════════════════════════ */
var PVL_TAB       = 'latest';
var PVL_TABLE     = 's_pm25_2_in_week';
var PVL_PAGE_SIZE = 1000;            // ตารางนี้ ~218 คอลัมน์/แถว → หน้าเล็กกันเกินเพดาน 50 MB ของ UrlFetchApp
var PVL_MAX_PAGES = 60;              // ขอนแก่น ~12,000 แถว ≈ 12 หน้า
var PVL_GAP_MS    = 3000;            // เว้นจังหวะระหว่างคำขอ ไม่ยิงรัวใส่ MOPH
var PVL_BUDGET_MS = 5 * 60 * 1000;   // Apps Script จำกัด 6 นาที/ครั้ง → เกินนี้หยุดโดยไม่เขียนทับ
var PVL_NAMES     = { 40: 'ขอนแก่น', 44: 'มหาสารคาม', 45: 'ร้อยเอ็ด', 46: 'กาฬสินธุ์' };

/** ดึงตาราง s_pm25_2 ของจังหวัดเดียว แล้วย่อเป็น { wk: {หมวดโรค: ยอดรวม} } ทีละหน้า (ไม่เก็บแถวดิบ) */
function pvlFetchProvince_(pv, deadline) {
  var agg = { wk: {}, dateCom: '', rows: 0 };

  for (var page = 0; page < PVL_MAX_PAGES; page++) {
    if (new Date().getTime() > deadline) return { error: 'หมดเวลา (เกิน ' + (PVL_BUDGET_MS / 60000) + ' นาที) ที่หน้า ' + (page + 1) };
    if (page > 0) Utilities.sleep(PVL_GAP_MS);

    var resp = null, code = 0, tries = 0;
    while (tries < 3) {                       // 429/5xx → รอแล้วลองใหม่ (5s, 10s) ไม่ยิงถี่
      try {
        resp = UrlFetchApp.fetch(MOPH_URL, {
          method: 'post', contentType: 'application/json', muteHttpExceptions: true,
          payload: JSON.stringify({
            tableName: PVL_TABLE, year: String(BE_YEAR), province: String(pv),
            type: 'json', limit: PVL_PAGE_SIZE, offset: page * PVL_PAGE_SIZE
          })
        });
        code = resp.getResponseCode();
      } catch (e) { resp = null; code = 0; }
      if (code === 200 || code === 201) break;
      if (code !== 0 && code !== 429 && code < 500) break;   // 4xx อื่น ลองซ้ำไม่ช่วย
      tries++;
      if (tries < 3) Utilities.sleep(5000 * Math.pow(2, tries - 1));
    }
    if (code !== 200 && code !== 201) {
      return { error: 'HTTP ' + code + ' (หน้า ' + (page + 1) + ')' };
    }

    var body;
    try { body = JSON.parse(resp.getContentText()); } catch (e) { return { error: 'อ่าน JSON ไม่ได้ (หน้า ' + (page + 1) + ')' }; }
    var chunk = Array.isArray(body) ? body : (body ? body.data : null);
    if (!Array.isArray(chunk)) return { error: 'รูปแบบข้อมูลไม่รู้จัก' };

    for (var r = 0; r < chunk.length; r++) {
      var row = chunk[r];
      var cat = DIAG_GROUP[row.diag_main];
      if (!cat) continue;
      if (row.date_com && String(row.date_com) > agg.dateCom) agg.dateCom = String(row.date_com);
      for (var w = 1; w <= 53; w++) {
        var v = row['w_' + (w < 10 ? '0' + w : w) + '_m'];   // _m = จำนวนที่เข้ารับบริการ (ตัดซ้ำรายคน/สัปดาห์)
        if (typeof v === 'number' && v > 0) {
          if (!agg.wk[w]) agg.wk[w] = {};
          agg.wk[w][cat] = (agg.wk[w][cat] || 0) + v;
        }
      }
    }
    agg.rows += chunk.length;

    var total = Array.isArray(body) ? chunk.length : (Number(body.total) || 0);
    if (chunk.length < PVL_PAGE_SIZE || agg.rows >= total) return { agg: agg };
  }
  return { error: 'ข้อมูลเกิน ' + PVL_MAX_PAGES + ' หน้า — ไม่ใช้ข้อมูลที่ไม่ครบ' };
}

/**
 * ดึงผู้ป่วยรายจังหวัดจาก MOPH แล้วเขียนแท็บ "latest" — ตั้ง trigger วันละครั้งตอนกลางคืน (ดู installProvinceLatestTrigger)
 * Fail-safe: เขียนเมื่อได้ครบทุกจังหวัดเท่านั้น ไม่งั้นคงแท็บเดิมไว้ ไม่ล้าง
 */
function syncMophProvinceLatest() {
  var started  = new Date();
  var deadline = started.getTime() + PVL_BUDGET_MS;
  var out = [], errors = [], maxDateCom = '', got = 0;

  for (var i = 0; i < MOPH_PROVINCES.length; i++) {
    var pv = MOPH_PROVINCES[i];
    if (i > 0) Utilities.sleep(PVL_GAP_MS);
    var res = pvlFetchProvince_(pv, deadline);
    if (res.error) {
      errors.push('จังหวัด ' + pv + ' → ' + res.error);
      Logger.log('❌ latest province ' + pv + ' → ' + res.error);
      break;                                  // ไม่ครบอยู่แล้ว ไม่ต้องยิงจังหวัดที่เหลือต่อ
    }
    got++;
    Logger.log('• latest province ' + pv + ' → ' + res.agg.rows + ' แถว');
    if (res.agg.dateCom > maxDateCom) maxDateCom = res.agg.dateCom;

    var name = PVL_NAMES[pv] || String(pv);
    for (var w = 1; w <= 53; w++) {
      if (!res.agg.wk[w]) continue;
      for (var c = 0; c < CATS.length; c++) {
        out.push([maxDateCom, BE_YEAR, PVL_TABLE, pv, name, w, CATS[c], res.agg.wk[w][CATS[c]] || 0]);
      }
    }
  }

  if (got < MOPH_PROVINCES.length || out.length === 0) {
    var why = errors.join('\n') || 'ไม่มีข้อมูลรายสัปดาห์เลย';
    Logger.log('⛔ ไม่เขียนแท็บ "' + PVL_TAB + '" (ได้ ' + got + '/' + MOPH_PROVINCES.length + ' จังหวัด) — คงข้อมูลเดิมไว้');
    alertOnce_('pvl_fail',
      '[PM2.5 สคร.7] ⛔ ดึงผู้ป่วยรายจังหวัด (แท็บ latest) ไม่สำเร็จ',
      'syncMophProvinceLatest ดึงได้ ' + got + '/' + MOPH_PROVINCES.length + ' จังหวัด\n\n' +
      'เวลาที่รัน : ' + fmtTime_(started) + '\n' + 'สาเหตุ:\n' + why + '\n\n' +
      '── ผลกระทบ ──\nแท็บ "' + PVL_TAB + '" ยังเป็นข้อมูลเดิม (ไม่ถูกล้าง) แดชบอร์ดโซน E2 จะแสดงข้อมูลเดิมไปก่อน\n');
    return;
  }

  // date_com ของทุกจังหวัดใช้ค่าล่าสุดเดียวกัน (ทั้งเขตเป็นภาพข้อมูลชุดเดียว)
  for (var k = 0; k < out.length; k++) out[k][0] = maxDateCom;
  var stamp = Utilities.formatDate(started, 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
  var header = ['snapshot_at', 'date_com', 'b_year', 'table', 'pv_code', 'pv_name', 'wk', 'group', 'm'];
  var table  = [header];
  for (var n = 0; n < out.length; n++) table.push([stamp].concat(out[n]));

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sh = ss.getSheetByName(PVL_TAB) || ss.insertSheet(PVL_TAB);
  sh.clearContents();
  sh.getRange(1, 1, table.length, header.length).setNumberFormat('@');     // เก็บเป็นข้อความล้วน กัน Sheets แปลง date_com เป็นตัวเลข/วันที่
  sh.getRange(1, 1, table.length, header.length).setValues(table);
  Logger.log('✅ เขียนแท็บ "' + PVL_TAB + '" ' + out.length + ' แถว จาก ' + got + '/' + MOPH_PROVINCES.length + ' จังหวัด (date_com ' + maxDateCom + ')');
}

/** ตั้ง trigger ให้ syncMophProvinceLatest รันวันละครั้งตี 2 — กด Run ครั้งเดียว (รันซ้ำก็ไม่สร้างซ้อน) */
function installProvinceLatestTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'syncMophProvinceLatest') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('syncMophProvinceLatest').timeBased().everyDays(1).atHour(2).create();
  Logger.log('⏰ ตั้ง trigger syncMophProvinceLatest วันละครั้งช่วงตี 2 แล้ว');
}
