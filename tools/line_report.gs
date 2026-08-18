/**
 * LINE OA broadcast — รายงานสถานการณ์ PM2.5 เขตสุขภาพที่ 7
 * (ไฟล์นี้คือ "รหัส.gs" ใน Apps Script project — เก็บเข้า repo ไว้กันหาย)
 * ------------------------------------------------------------------
 * ⚠️ ความลับทั้งหมดย้ายไป Script Properties แล้ว ห้ามฮาร์ดโค้ดกลับเข้ามา
 *    ไฟล์นี้อยู่ใน repo สาธารณะ — อะไรที่เขียนตรงนี้คนทั้งโลกอ่านได้
 *
 *    ตั้งค่าครั้งเดียว: Project Settings → Script Properties → Add script property
 *      LINE_ACCESS_TOKEN = <channel access token ของ LINE OA>
 *      GISTDA_KEY        = <api key ของ GISTDA>
 *
 * สรุปสิ่งที่แก้จากเวอร์ชันเดิม (18/08/2026):
 *   1. ย้าย LINE token + GISTDA key ออกจากโค้ด → Script Properties
 *   2. ยอดสะสมโรคใช้ "สัปดาห์รองสุดท้าย" ให้ตรงกับหน้าเว็บ
 *   3. ต่อป้ายเตือน diseaseAgeNote() เมื่อข้อมูล HDC ค้าง
 *   4. ไม่บันทึก 0 เมื่อสถานีไม่มีข้อมูล (เดิม `|| 0`)
 *   5. PHEOC ใช้ค่า 07:00 จาก Air4Thai history ถึง 75.1 ติดกัน 2 วัน
 *      (เดิมเทียบแถวสุดท้ายในชีต = ค่า ณ เวลาที่รัน ซึ่งเป็นบ่าย ไม่ใช่เช้า)
 *   6. เขียนทับแถวของวันนี้แทนการ appendRow ซ้ำทุกรอบ
 */

// ── ค่าที่ไม่เป็นความลับ ───────────────────────────────────────────────
const SPREADSHEET_ID = '1bBOvPusSvh7R0AXG5ej9CxagtRkJXLaaJo79I4s9PX8';

const TARGET_STATIONS = [
  { name: "ขอนแก่น", id: "46t" },
  { name: "ร้อยเอ็ด", id: "113t" },
  { name: "กาฬสินธุ์", id: "107t" },
  { name: "มหาสารคาม", id: "114t" }
];

// ── เกณฑ์เปิด PHEOC ──────────────────────────────────────────────────
// ใช้ค่า PM2.5 "เวลา 07:00 น." เท่านั้น ถึงเกณฑ์ติดกัน 2 วัน = เข้าเกณฑ์
// ค่า 07:00 ดึงจาก Air4Thai history API ไม่ใช่ค่า ณ เวลาที่สคริปต์รัน
// (main รันบ่าย 3 — LastUpdate จะเป็นค่าบ่าย ใช้ตัดสิน PHEOC ไม่ได้)
const PHEOC_THRESHOLD = 75.1;   // µg/m³ — "ถึง 75.1 ขึ้นไป" = แถบสีแดงตามเกณฑ์ไทย
const PHEOC_HOUR      = '07';   // ชั่วโมงที่ใช้ตัดสิน (24 ชม.)
const AIR4THAI_HISTORY = 'https://air4thai.pcd.go.th/forweb/getHistoryData.php';

/**
 * อ่านค่าลับจาก Script Properties — โยน error ถ้ายังไม่ตั้ง จะได้รู้ทันที ไม่ใช่เงียบ
 *
 * ⚠️ รับ "ชื่อ" ของ property เท่านั้น เช่น secret_('LINE_ACCESS_TOKEN')
 *    ห้ามเอาค่า token มาใส่ในวงเล็บ — ค่าจริงอยู่ที่
 *    Project Settings → Script Properties เท่านั้น ไม่อยู่ในโค้ด
 */
function secret_(key) {
  // ดักความผิดพลาดที่เกิดจริงมาแล้ว: เอา "ค่า token" มาใส่แทน "ชื่อ property"
  // ตรงนี้ตั้งใจไม่ echo ค่า key ออก log ด้วย ไม่งั้น token จะไปโผล่ใน
  // Execution log ซึ่งเป็นอีกทางที่ทำให้ความลับหลุด
  if (String(key).length > 40 || /[\/+=]/.test(String(key))) {
    throw new Error(
      'secret_() ต้องรับ "ชื่อ" ของ Script Property ไม่ใช่ค่า token\n' +
      '  ที่ถูกคือ  secret_(\'LINE_ACCESS_TOKEN\')\n' +
      '  แล้วเอาค่า token ไปใส่ที่ Project Settings → Script Properties'
    );
  }
  const v = PropertiesService.getScriptProperties().getProperty(key);
  if (!v) {
    throw new Error(
      'ยังไม่ได้ตั้ง Script Property "' + key + '"\n' +
      '  ไปที่ Project Settings (⚙️) → เลื่อนลงล่างสุด → Script Properties\n' +
      '  → Add script property → Property = ' + key + ' , Value = <ค่าจริง>'
    );
  }
  return v;
}

// ==========================================================
// 🚀 ฟังก์ชันหลัก
// ==========================================================
function main() {
  console.log("🚀 เริ่มต้นระบบดึงข้อมูลและสร้างรายงาน...");

  const airData     = getAirDataStrict();
  const healthData  = getHealthFromSeparateSheets();
  const pheocStatus = recordHistoryAndCheckPHEOC(airData);

  let validPMs = airData.map(d => d.pm25).filter(v => v !== null && v >= 0);
  let avgPM = validPMs.length > 0 ? (validPMs.reduce((a,b) => a+b, 0) / validPMs.length) : null;

  let today = new Date();
  let currentHour = today.getHours();
  let roundText = "";if (currentHour < 11) {roundText = "รอบเช้า";} else if (currentHour < 15) { roundText = "รอบเที่ยง";} else { roundText = "รอบเย็น";}
  let timeStr = Utilities.formatDate(today, "GMT+7", "HH.mm น.");
  let thaiYear = parseInt(Utilities.formatDate(today, "GMT+7", "yyyy")) + 543;
  let fullDate = `${Utilities.formatDate(today, "GMT+7", "d")} ${getThaiMonth(today.getMonth())} ${thaiYear}`;

  let textMessage = buildTextMessage(airData, healthData, pheocStatus, avgPM, fullDate, timeStr, roundText);
  let flexMessage = buildFlexMessage(airData, healthData, pheocStatus, avgPM, currentHour, timeStr);

  sendLineBroadcast([flexMessage, textMessage]);
}

// ==========================================================
// 🛠️ ส่งข้อความ (Broadcast)
// ==========================================================
function sendLineBroadcast(messagesArray) {
  var options = {
    'method': 'post',
    'headers': {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + secret_('LINE_ACCESS_TOKEN')
    },
    'payload': JSON.stringify({ 'messages': messagesArray }),
    'muteHttpExceptions': true
  };
  var response = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/broadcast', options);

  let code = response.getResponseCode();
  if (code !== 200) {
    console.log("❌ เกิดข้อผิดพลาดในการส่ง LINE API: " + response.getContentText());
  } else {
    console.log("✅ ส่งข้อความสำเร็จ!");
  }
}

// ==========================================================
// 🎨 Text Message
// ==========================================================
function buildTextMessage(airData, healthData, pheocStatus, avgPM, fullDate, timeStr, roundText) {
  let overallLevel = getPMLevelInfoForText(avgPM);
  let overallStatusText = avgPM !== null
    ? `${overallLevel.icon} สภาพอากาศภาพรวม 4 จังหวัด: ${overallLevel.text} (ค่าเฉลี่ย ${avgPM.toFixed(1)} ไมโครกรัม/ลูกบาศก์เมตร)\n(ระดับค่าฝุ่นตามเกณฑ์มาตรฐาน ไม่เกิน 37.5 ไมโครกรัม/ลูกบาศก์เมตร)`
    : "🤔 สภาพอากาศภาพรวม 4 จังหวัด: ระบบขัดข้อง/ไม่มีข้อมูล";

  let pmListText = airData.map(p => {
    if (p.pm25 !== null && p.pm25 >= 0) {
      let lv = getPMLevelInfoForText(p.pm25);
      return `${lv.icon} จังหวัด${p.name} มีค่า ${p.pm25.toFixed(1)} ไมโครกรัม/ลูกบาศก์เมตร (${lv.text})`;
    }
    return `⚪ จังหวัด${p.name} มีค่า - ไมโครกรัม/ลูกบาศก์เมตร (ไม่มีข้อมูล)`;
  }).join('\n');

  let pheocText = pheocStatus.provinces.length > 0
    ? `🚨🔴 เขตสุขภาพที่ 7 ในพื้นที่ 4 จังหวัด มีจังหวัดเข้าเกณฑ์เปิด PHEOC ได้แก่: ${pheocStatus.provinces.join(', ')}`
    : `🟢🛡️ เขตสุขภาพที่ 7 ในพื้นที่ 4 จังหวัด ยังไม่มีจังหวัดเข้าเกณฑ์การเปิด PHEOC`;

  let healthText = "💪 สถานการณ์โรคที่ต้องเฝ้าระวังผลกระทบ จากฝุ่น PM2.5\n(ไม่พบข้อมูลอัปเดตจากระบบ)";
  if (healthData) {
    let yrCurr = healthData.year;
    healthText = `💪 สถานการณ์โรคที่ต้องเฝ้าระวังผลกระทบ จากฝุ่น PM2.5\n` +
                 `👥 ยอดผู้ป่วยสะสม ปี ${yrCurr} ตั้งแต่สัปดาห์ที่ 1 - วันที่อัพเดทข้อมูล (วันที่: ${healthData.dateStr})\n` +
                 `📈 ยอดสะสม ปี ${yrCurr} (ณ สัปดาห์ที่ ${healthData.wk}) \n` +
                 `😷 ระบบทางเดินหายใจ : ${formatNum(healthData.curr[0])} ราย\n` +
                 `❤️ ระบบหัวใจ/หลอดเลือด : ${formatNum(healthData.curr[1])} ราย\n` +
                 `👁️ ตาอักเสบ : ${formatNum(healthData.curr[2])} ราย\n` +
                 `🧴 ผิวหนัง : ${formatNum(healthData.curr[3])} ราย` +
                 healthData.ageNote;      // ⚠️ ต่อท้ายเมื่อข้อมูลค้างเกินเกณฑ์ (ปกติเป็นสตริงว่าง)
  }

  let textReport = `เรียน  ท่านผู้บริหาร และผู้เกี่ยวข้อง\n\n` +
       `       สคร. 7 ขอนแก่น ขอรายงานสถานการณ์ฝุ่นละออง PM2.5 (เฉลี่ย 24 ชม.) พื้นที่เขตสุขภาพที่ 7 ประจำวันที่ ${fullDate} เวลา ${timeStr} (${roundText})\n\n` +
       `${overallStatusText}\n\n` +
       `🌪 ค่าฝุ่น PM2.5 รายจังหวัด\n${pmListText}\n\n` +
       `${pheocText}\n\n` +
       `${healthText}\n\n` +
       `ข้อเสนอแนะการปฏิบัติตน :\n${buildAdviceSectionForText(airData)}\n` +
       `ท่านสามารถดูค่าฝุ่นแบบเรียลไทม์ในแผนที่ กดลิงก์เพื่อดู: https://apps-odpc7.ddc.moph.go.th/pm25/\n\n` +
       `       จึงเรียนมาเพื่อโปรดทราบ  ขอบพระคุณครับ\n\n` +
       `(แหล่งข้อมูล: Air4thai, GISTDA PM2.5 Monitoring System, กระทรวงสาธารณสุข HDC)`;

  return { "type": "text", "text": textReport };
}

// ==========================================================
// 🎨 Flex Message
// ==========================================================
function buildFlexMessage(airData, healthData, pheocStatus, avgPM, currentHour, timeStr) {
  let headerColor = "#9E9E9E";
  let overallStatusFlexText = "ระบบขัดข้อง/ไม่มีข้อมูล";
  let avgText = "-";

  if (avgPM !== null) {
    avgText = avgPM.toFixed(1);
    let levelInfo = getPMLevelInfoForFlex(avgPM);
    headerColor = levelInfo.color;
    overallStatusFlexText = `${levelInfo.text} (เฉลี่ย ${avgText} มคก./ลบ.ม.)`;
  }

  // สร้าง List รายจังหวัด
  let pmFlexRows = airData.map(p => {
    let pm = p.pm25;
    let pmText = pm !== null ? pm.toFixed(1) : "-";
    let colorText = pm !== null ? getPMLevelInfoForFlex(pm).color : "#9E9E9E";

    let dotEmoji = "⚪";
    if (pm !== null) {
      if (pm <= 15.0) dotEmoji = "🔵";
      else if (pm <= 25.0) dotEmoji = "🟢";
      else if (pm <= 37.5) dotEmoji = "🟡";
      else if (pm <= 75.0) dotEmoji = "🟠";
      else dotEmoji = "🔴";
    }

    return {
      "type": "box", "layout": "horizontal", "margin": "md", "alignItems": "center",
      "contents": [
        { "type": "text", "text": dotEmoji, "size": "sm", "flex": 1, "align": "center" },
        { "type": "text", "text": `จังหวัด${p.name}`, "size": "sm", "color": "#424242", "weight": "bold", "flex": 4 },
        { "type": "text", "text": pmText, "size": "md", "weight": "bold", "color": colorText, "align": "end", "flex": 3 },
        { "type": "text", "text": "มคก./ลบ.ม.", "size": "xxs", "color": "#9E9E9E", "align": "end", "flex": 3 }
      ]
    }
  });

  // สถานะ PHEOC
  let pheocBoxColor = pheocStatus.provinces.length > 0 ? "#FFEBEE" : "#F1F8E9";
  let pheocBorderColor = pheocStatus.provinces.length > 0 ? "#E57373" : "#AED581";
  let pheocTextColor = pheocStatus.provinces.length > 0 ? "#C62828" : "#2E7D32";
  let pheocFlexText = pheocStatus.provinces.length > 0
    ? `🔴 แจ้งเตือน: เข้าเกณฑ์เปิด PHEOC ได้แก่ ${pheocStatus.provinces.join(', ')}`
    : "🟢 ปกติ: ยังไม่มีจังหวัดเข้าเกณฑ์การเปิด PHEOC";

  // สถานการณ์โรค
  let healthBox = [{ "type": "text", "text": "ไม่มีข้อมูลสุขภาพ", "size": "sm" }];
  if (healthData) {
    healthBox = [
      { "type": "box", "layout": "horizontal", "contents": [
          { "type": "text", "text": "📊 สถานการณ์โรคที่ต้องเ...", "weight": "bold", "size": "sm", "color": "#1A237E" },
          { "type": "text", "text": `ปี ${healthData.year}`, "size": "sm", "color": "#7986CB", "align": "end", "weight": "bold" }
        ]
      },
      { "type": "text", "text": `(อัปเดต ณ สัปดาห์ที่ ${healthData.wk} : ${healthData.dateStr})`, "size": "xs", "color": "#9E9E9E", "margin": "xs" },
      { "type": "separator", "margin": "md" },
      createHealthRow("😷 ระบบทางเดินหายใจ", healthData.curr[0]),
      createHealthRow("❤️ ระบบหัวใจ/หลอดเลือด", healthData.curr[1]),
      createHealthRow("👁️ ตาอักเสบ", healthData.curr[2]),
      createHealthRow("🧴 ผิวหนัง", healthData.curr[3])
    ];
    // ⚠️ ป้ายเตือนข้อมูลค้าง — ขึ้นเฉพาะตอนต้นทางหยุดอัปเดตเกินเกณฑ์
    if (healthData.ageNote) {
      healthBox.push({
        "type": "text", "text": healthData.ageNote.trim(), "size": "xs",
        "color": "#C62828", "wrap": true, "margin": "md", "weight": "bold"
      });
    }
  }

  let timeIcon = ""; if (currentHour < 11) {timeIcon = "🌤️ Morning Report";} else if (currentHour < 15) { timeIcon = "☀️ Midday Report";} else { timeIcon = "☁️ Evening Report";}

  return {
    "type": "flex", "altText": "รายงานสถานการณ์ฝุ่น PM2.5",
    "contents": {
      "type": "bubble", "size": "giga",
      "header": { "type": "box", "layout": "vertical", "backgroundColor": headerColor, "paddingAll": "xl",
        "contents": [
          { "type": "box", "layout": "horizontal", "contents": [
              { "type": "text", "text": timeIcon, "color": "#FFFFFF", "size": "sm", "weight": "bold" },
              { "type": "text", "text": `${timeStr}`, "color": "#FFFFFF", "size": "sm", "align": "end" }
            ]
          },
          { "type": "text", "text": "สถานการณ์ฝุ่น PM2.5", "weight": "bold", "size": "xxl", "color": "#FFFFFF", "margin": "md" },
          { "type": "text", "text": "สำนักงานป้องกันควบคุมโรคที่ 7 จ.ขอนแก่น", "size": "sm", "color": "#EEEEEE" },
          { "type": "box", "layout": "vertical", "margin": "lg", "backgroundColor": "#FFFFFF4D", "paddingAll": "md", "cornerRadius": "md",
            "contents": [
              { "type": "text", "text": "สภาพอากาศภาพรวม", "color": "#EEEEEE", "size": "xs" },
              { "type": "text", "text": overallStatusFlexText, "size": "md", "color": "#FFFFFF", "weight": "bold", "wrap": true }
            ]
          }
        ]
      },
      "body": { "type": "box", "layout": "vertical", "spacing": "md", "paddingAll": "xl",
        "contents": [
          { "type": "text", "text": "ค่าฝุ่นเฉลี่ย 24 ชม. (รายจังหวัด)", "weight": "bold", "size": "md", "color": "#424242", "margin": "sm" },
          { "type": "box", "layout": "vertical", "contents": pmFlexRows, "margin": "md" },
          { "type": "box", "layout": "vertical", "backgroundColor": pheocBoxColor, "borderColor": pheocBorderColor, "borderWidth": "1px", "paddingAll": "md", "cornerRadius": "md", "margin": "xl",
            "contents": [{ "type": "text", "text": pheocFlexText, "size": "sm", "color": pheocTextColor, "wrap": true, "weight": "bold" }]
          },
          { "type": "separator", "margin": "lg" },
          { "type": "box", "layout": "vertical", "backgroundColor": "#F5F5F5", "paddingAll": "md", "cornerRadius": "md", "margin": "lg", "contents": healthBox },
          { "type": "separator", "margin": "lg" },
          { "type": "text", "text": "💡 ข้อเสนอแนะด้านสุขภาพ (Health Alert)", "weight": "bold", "size": "sm", "color": "#E65100", "margin": "md" },
          { "type": "box", "layout": "vertical", "margin": "sm", "contents": buildAdviceSectionForFlex(airData) }
        ]
      },
      "footer": { "type": "box", "layout": "vertical", "spacing": "sm",
        "contents": [
          { "type": "button", "style": "primary", "color": "#1976D2", "height": "sm", "action": { "type": "uri", "label": "📍 ดูแผนที่ฝุ่นแบบเรียลไทม์", "uri": "https://apps-odpc7.ddc.moph.go.th/pm25/" } },
          { "type": "text", "text": "ข้อมูล: Air4thai, HDC สธ., GISTDA", "size": "xxs", "align": "center", "color": "#BDBDBD", "wrap": true, "margin": "md" }
        ]
      }
    }
  };
}

// ==========================================================
// 🧪 ฟังก์ชันทดสอบ — ไม่ยิง broadcast ใช้ได้อย่างปลอดภัย
// ==========================================================

/**
 * เช็คว่า LINE_ACCESS_TOKEN ที่ตั้งไว้ใช้ได้จริงไหม — ไม่ส่งข้อความหาใคร
 * ยิง GET /v2/bot/info ซึ่งแค่ถามข้อมูล bot ไม่กระทบผู้ติดตาม
 * ใช้ตรวจหลังหมุน token ใหม่ทุกครั้ง
 */
function testLineToken() {
  const res = UrlFetchApp.fetch('https://api.line.me/v2/bot/info', {
    method: 'get',
    headers: { 'Authorization': 'Bearer ' + secret_('LINE_ACCESS_TOKEN') },
    muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  if (code === 200) {
    const info = JSON.parse(res.getContentText());
    Logger.log('✅ token ใช้ได้ — OA: ' + info.displayName + ' (basicId ' + info.basicId + ')');
  } else {
    Logger.log('❌ token ใช้ไม่ได้ — HTTP ' + code + ' : ' + res.getContentText());
    Logger.log('   401 = token ผิด/ถูก revoke แล้ว · 403 = แผนบัญชีไม่รองรับ');
  }
}

/**
 * ประกอบรายงานทั้งหมดแล้ว log ออกมาดู — ไม่ broadcast และไม่เขียนชีต
 * ใช้ตรวจว่าตัวเลข/ข้อความถูกต้องก่อนปล่อยของจริง
 *
 * ⚠️ อย่ากด Run main() เพื่อทดสอบ — main() ยิง broadcast จริง
 *    ผู้ติดตาม LINE OA ทุกคนจะได้ข้อความทดสอบ
 */
function testReportDryRun() {
  const airData    = getAirDataStrict();
  const healthData = getHealthFromSeparateSheets();

  // เช็ค PHEOC ได้จริงใน dry run — ตอนนี้มันแค่อ่าน API ไม่เขียนชีต
  // ส่วน recordHistory ยังข้ามอยู่ เพราะอันนั้นเขียนข้อมูลจริง
  Logger.log('── เกณฑ์ PHEOC (ค่า 07:00 ถึง ' + PHEOC_THRESHOLD + ' ติดกัน 2 วัน) ──');
  const pheocStatus = { provinces: checkPheoc07_() };
  Logger.log('  สรุป : ' + (pheocStatus.provinces.length
    ? '⚠️ เข้าเกณฑ์ ' + pheocStatus.provinces.join(', ')
    : '🟢 ไม่มีจังหวัดเข้าเกณฑ์'));

  let validPMs = airData.map(d => d.pm25).filter(v => v !== null && v >= 0);
  let avgPM = validPMs.length > 0 ? (validPMs.reduce((a, b) => a + b, 0) / validPMs.length) : null;

  Logger.log('── ค่าฝุ่นที่ดึงได้ ──');
  airData.forEach(p => Logger.log('  ' + p.name + ' : ' + (p.pm25 === null ? '(ไม่มีข้อมูล)' : p.pm25) + '  เวลา ' + p.time));
  Logger.log('  เฉลี่ย 4 จังหวัด : ' + (avgPM === null ? '(คำนวณไม่ได้)' : avgPM.toFixed(1)));

  Logger.log('── ข้อมูลกลุ่มโรค ──');
  if (!healthData) {
    Logger.log('  ❌ อ่านไม่ได้');
  } else {
    Logger.log('  สัปดาห์ที่รายงาน : ' + healthData.wk + '  (ต้องตรงกับหน้าเว็บ)');
    Logger.log('  ยอดสะสม : ' + healthData.curr.map(n => n.toLocaleString()).join(' | '));
    Logger.log('  วันที่ : ' + healthData.dateStr);
    Logger.log('  ป้ายเตือนข้อมูลค้าง : ' + (healthData.ageNote ? healthData.ageNote.trim() : '(ไม่มี — ข้อมูลยังสด)'));
  }

  const today = new Date();
  const hour  = today.getHours();
  const roundText = hour < 11 ? 'รอบเช้า' : (hour < 15 ? 'รอบเที่ยง' : 'รอบเย็น');
  const timeStr   = Utilities.formatDate(today, "GMT+7", "HH.mm น.");
  const thaiYear  = parseInt(Utilities.formatDate(today, "GMT+7", "yyyy")) + 543;
  const fullDate  = Utilities.formatDate(today, "GMT+7", "d") + ' ' + getThaiMonth(today.getMonth()) + ' ' + thaiYear;

  const msg = buildTextMessage(airData, healthData, pheocStatus, avgPM, fullDate, timeStr, roundText);
  Logger.log('── ข้อความที่จะส่ง (ตัวอย่าง) ──\n' + msg.text);
  Logger.log('ℹ️ dry run — ไม่ได้ broadcast และไม่ได้เขียนชีต (PHEOC เช็คจริงจาก API)');
}

// ==========================================================
// 🛠️ ตรรกะและข้อมูลเสริม
// ==========================================================
function getPMLevelInfoForText(pm) {
  if (pm === null || pm === undefined) return { icon: "⚪", text: "ไม่มีข้อมูล" };
  if (pm <= 15.0) return { icon: "🔵", text: "ระดับดีมาก" };
  if (pm <= 25.0) return { icon: "🟢", text: "ระดับดี" };
  if (pm <= 37.5) return { icon: "🟡", text: "ระดับปานกลาง" };
  if (pm <= 75.0) return { icon: "🟠", text: "ระดับที่เริ่มมีผลต่อสุขภาพ" };
  return { icon: "🔴", text: "ระดับที่มีผลต่อสุขภาพ" };
}

function getPMLevelInfoForFlex(pm) {
  if (pm <= 15.0) return { color: "#0288D1", text: "คุณภาพอากาศดีมาก" };
  if (pm <= 25.0) return { color: "#2E7D32", text: "คุณภาพอากาศดี" };
  if (pm <= 37.5) return { color: "#F9A825", text: "คุณภาพอากาศปานกลาง" };
  if (pm <= 75.0) return { color: "#E65100", text: "เริ่มมีผลกระทบต่อสุขภาพ" };
  return { color: "#C62828", text: "มีผลกระทบต่อสุขภาพ" };
}

function buildAdviceSectionForText(airData) {
  let levels = { lv1: [], lv2: [], lv3: [], lv4: [], lv5: [] };
  airData.forEach(p => {
    let pm = p.pm25;
    if (pm === null) return;
    if (pm <= 15.0) levels.lv1.push(p.name);
    else if (pm <= 25.0) levels.lv2.push(p.name);
    else if (pm <= 37.5) levels.lv3.push(p.name);
    else if (pm <= 75.0) levels.lv4.push(p.name);
    else levels.lv5.push(p.name);
  });

  let adviceBlock = [];
  if (levels.lv1.length > 0) adviceBlock.push(`🔵 พื้นที่จังหวัด ${levels.lv1.join(', ')} (ระดับดีมาก)\nประชาชนทั่วไป : สามารถทำกิจกรรมกลางแจ้งและท่องเที่ยวได้ตามปกติ\nกลุ่มเสี่ยง : สามารถทำกิจกรรมกลางแจ้งและท่องเที่ยวได้ตามปกติ\n`);
  if (levels.lv2.length > 0) adviceBlock.push(`🟢 พื้นที่จังหวัด ${levels.lv2.join(', ')} (ระดับดี)\nประชาชนทั่วไป : ทำกิจกรรมกลางแจ้งและท่องเที่ยวได้ตามปกติ\nกลุ่มเสี่ยง : ควรเฝ้าระวังสุขภาพ ถ้ามีอาการเบื้องต้นควรลดระยะเวลาการทำกิจกรรมกลางแจ้ง\n`);
  if (levels.lv3.length > 0) adviceBlock.push(`🟡 พื้นที่จังหวัด ${levels.lv3.join(', ')} (ระดับปานกลาง)\nประชาชนทั่วไป : เลี่ยงออกกำลังกายกลางแจ้ง/การทำงานที่ใช้แรงมาก หากมีอาการผิดปกติให้รีบไปพบแพทย์\nกลุ่มเสี่ยง : ลดระยะเวลาออกกำลังกายกลางแจ้ง/การทำงานที่ใช้แรงมาก สวม mask ทุกครั้งเมื่ออยู่กลางแจ้ง หากมีอาการผิดปกติให้รีบไปพบแพทย์\n`);
  if (levels.lv4.length > 0) adviceBlock.push(`🟠 พื้นที่จังหวัด ${levels.lv4.join(', ')} (ระดับที่เริ่มมีผลต่อสุขภาพ)\nประชาชนทั่วไป : ลดระยะเวลาออกกำลังกายกลางแจ้ง/การทำงานที่ใช้แรงมาก สวม mask ทุกครั้งเมื่ออยู่กลางแจ้ง หากมีอาการผิดปกติให้รีบไปพบแพทย์\nกลุ่มเสี่ยง : จำกัดระยะเวลาออกกำลังกายกลางแจ้ง/การทำงานที่ใช้แรงมาก สวม mask ทุกครั้งเมื่ออยู่กลางแจ้ง ควรอยู่ในห้องปลอดฝุ่น ลดกิจกรรมที่ก่อให้เกิดฝุ่นละอองภายในบ้าน หากมีอาการผิดปกติให้รีบไปพบแพทย์\n`);
  if (levels.lv5.length > 0) adviceBlock.push(`🔴 พื้นที่จังหวัด ${levels.lv5.join(', ')} (ระดับที่มีผลต่อสุขภาพ)\nประชาชนทั่วไป : งดออกกำลังกายกลางแจ้ง/การทำงานที่ใช้แรงมาก สวม mask ทุกครั้งเมื่ออยู่กลางแจ้ง หากมีอาการผิดปกติให้รีบไปพบแพทย์\nกลุ่มเสี่ยง : งดออกกำลังกายกลางแจ้ง/การทำงานที่ใช้แรงมาก สวม mask ทุกครั้งเมื่ออยู่กลางแจ้ง ควรอยู่ในห้องปลอดฝุ่น ลดกิจกรรมที่ก่อให้เกิดฝุ่นละอองภายในบ้าน หากมีอาการผิดปกติให้รีบไปพบแพทย์\n`);

  return adviceBlock.length > 0 ? adviceBlock.join("\n") : "-";
}

function buildAdviceSectionForFlex(airData) {
  let levels = { lv1: [], lv2: [], lv3: [], lv4: [], lv5: [] };
  airData.forEach(p => {
    let pm = p.pm25;
    if (pm === null) return;
    if (pm <= 15.0) levels.lv1.push(p.name);
    else if (pm <= 25.0) levels.lv2.push(p.name);
    else if (pm <= 37.5) levels.lv3.push(p.name);
    else if (pm <= 75.0) levels.lv4.push(p.name);
    else levels.lv5.push(p.name);
  });

  let contents = [];
  let makeBlock = (icon, provs, msg) => {
    return { "type": "text", "text": `${icon} ${provs.join(', ')}:\n${msg}`, "size": "sm", "color": "#616161", "wrap": true, "margin": "sm" };
  };

  if (levels.lv1.length > 0) contents.push(makeBlock("🔵", levels.lv1, "ทำกิจกรรมกลางแจ้งและท่องเที่ยวได้ตามปกติ"));
  if (levels.lv2.length > 0) contents.push(makeBlock("🟢", levels.lv2, "ทั่วไปทำกิจกรรมได้ปกติ กลุ่มเสี่ยงเฝ้าระวังสุขภาพ"));
  if (levels.lv3.length > 0) contents.push(makeBlock("🟡", levels.lv3, "ลดระยะเวลาทำกิจกรรมกลางแจ้ง สวมหน้ากาก"));
  if (levels.lv4.length > 0) contents.push(makeBlock("🟠", levels.lv4, "สวมหน้ากากอนามัยเมื่ออยู่กลางแจ้ง กลุ่มเสี่ยงหลีกเลี่ยงกิจกรรมนอกบ้าน"));
  if (levels.lv5.length > 0) contents.push(makeBlock("🔴", levels.lv5, "งดกิจกรรมกลางแจ้งเด็ดขาด และสวมหน้ากาก N95"));

  return contents.length > 0 ? contents : [{ "type": "text", "text": "ไม่มีข้อมูลคำแนะนำ", "size": "sm" }];
}

function createHealthRow(label, currVal) {
  return { "type": "box", "layout": "horizontal", "margin": "md", "contents": [
      { "type": "text", "text": label, "size": "sm", "color": "#424242", "flex": 6, "wrap": true, "weight": "bold" },
      { "type": "text", "text": `${formatNum(currVal)} ราย`, "size": "sm", "weight": "bold", "color": "#1A237E", "align": "end", "flex": 4 }
    ]
  };
}

// ==========================================================
// 📡 ดึง Air4Thai
// ==========================================================
function getAirDataStrict() {
  let stationsData = [];

  const apiUrls = [
    'https://air4thai.pcd.go.th/services/getNewAQI_JSON.php?region=5',
    'http://air4thai.pcd.go.th/services/getNewAQI_JSON.php?region=5'
  ];

  for (let url of apiUrls) {
    if (stationsData.length > 0) break;
    try {
      let res = UrlFetchApp.fetch(url, { 'muteHttpExceptions': true, 'followRedirects': true });
      if (res.getResponseCode() === 200) {
        let json = JSON.parse(res.getContentText());
        if (json.stations && json.stations.length > 0) {
          stationsData = json.stations;
          console.log("✅ ดึงข้อมูลสำเร็จจาก " + url);
        }
      }
    } catch (e) { }
  }

  if (stationsData.length === 0) {
    console.log("🔄 เซิร์ฟเวอร์โดนบล็อก กำลังเชื่อมต่อผ่าน Proxy...");
    try {
      let proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent('http://air4thai.pcd.go.th/services/getNewAQI_JSON.php?region=5');
      let res = UrlFetchApp.fetch(proxyUrl, { 'muteHttpExceptions': true, 'followRedirects': true });
      if (res.getResponseCode() === 200) {
        let json = JSON.parse(res.getContentText());
        if (json.stations && json.stations.length > 0) {
          stationsData = json.stations;
          console.log("✅ ดึงข้อมูลสำเร็จผ่านระบบ Proxy");
        }
      }
    } catch (e) { console.log("❌ ระบบ Proxy ทำงานล้มเหลว: " + e.message); }
  }

  return TARGET_STATIONS.map(target => {
    const station = stationsData.find(s => String(s.stationID).trim().toLowerCase() === String(target.id).trim().toLowerCase());
    let pmValue = null, timeStr = "07.00";

    if (station) {
      let updateData = station.LastUpdate || station.AQILast;
      if (updateData && updateData.PM25 && updateData.PM25.value !== undefined) {
        let rawVal = updateData.PM25.value;
        if (rawVal !== "-" && rawVal !== "N/A" && rawVal !== "") {
          pmValue = parseFloat(rawVal);
        }
        if (updateData.time) {
          timeStr = updateData.time;
        }
      }
    }
    return { name: target.name, pm25: pmValue, time: timeStr };
  });
}

// ==========================================================
// 🛠️ ดึงข้อมูลสุขภาพจากแท็บ 2026
// ==========================================================
function getHealthFromSeparateSheets() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheetCurr = ss.getSheetByName("2026") || ss.getSheetByName("2569");
    if (!sheetCurr) return null;

    const dataCurr = sheetCurr.getDataRange().getValues();

    // เก็บทุกสัปดาห์ที่มีข้อมูลไว้ก่อน ยังไม่รวมยอด
    let weeks = [];
    for (let i = 1; i < dataCurr.length; i++) {
      let wk = parseInt(dataCurr[i][0]);
      if (isNaN(wk)) continue;
      if (dataCurr[i][1] === null || String(dataCurr[i][1]) === "") continue;
      weeks.push({
        wk: wk,
        vals: [0, 1, 2, 3].map(c => parseFloat(dataCurr[i][c + 1]) || 0)
      });
    }
    if (weeks.length === 0) return null;

    // ── ตัดสัปดาห์ล่าสุดทิ้ง ──────────────────────────────────────────
    // HDC เพิ่งเริ่มรายงานสัปดาห์ล่าสุด ยัง query ไม่ครบ (เช่น wk34 มี 3 ราย
    // เทียบ wk33 ที่มี 1,472) ถ้านับเข้าไปด้วย ยอดสะสมจะต่ำกว่าจริง และเลข
    // สัปดาห์จะไม่ตรงกับหน้าเว็บ ซึ่งใช้ "สัปดาห์รองสุดท้าย" เหมือนกัน
    weeks.sort((a, b) => a.wk - b.wk);
    if (weeks.length > 1) weeks.pop();

    let maxWeek = weeks[weeks.length - 1].wk;
    let currentSum = [0, 0, 0, 0];
    weeks.forEach(w => { for (let c = 0; c < 4; c++) currentSum[c] += w.vals[c]; });

    // คอลัมน์ F = "อัพเดท" (A=wk, B-E=หมวดโรค, F=อัพเดท)
    let dateVal = sheetCurr.getRange("F2").getValue();
    let finalDateStr = "ไม่ระบุวันที่";

    if (dateVal) {
      if (dateVal instanceof Date) {
        let d = Utilities.formatDate(dateVal, "GMT+7", "dd");
        let m = Utilities.formatDate(dateVal, "GMT+7", "MM");
        let y = parseInt(Utilities.formatDate(dateVal, "GMT+7", "yyyy"));
        if (y < 2500) y += 543;
        finalDateStr = `${d}/${m}/${y}`;
      } else {
        // แปลง ค.ศ. → พ.ศ. จากเลขปีจริง ไม่ใช่ replace('2026','2569')
        // ของเดิมผูกกับปี 2026 ตายตัว พอขึ้นปีใหม่จะแสดงเป็น ค.ศ. เงียบๆ
        let m2 = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(dateVal).trim());
        if (m2) {
          let y2 = parseInt(m2[3], 10);
          if (y2 < 2500) y2 += 543;
          finalDateStr = `${parseInt(m2[1], 10)}/${parseInt(m2[2], 10)}/${y2}`;
        } else {
          finalDateStr = String(dateVal);
        }
      }
    }

    return {
      year: 2569,
      wk: maxWeek || "-",
      curr: currentSum,
      dateStr: finalDateStr,
      // ป้ายเตือน "ข้อมูลค้าง N วัน" — ฟังก์ชันอยู่ใน moph_to_sheet.gs
      // ปกติคืนสตริงว่าง ข้อความจึงเหมือนเดิมทุกประการ
      ageNote: (typeof diseaseAgeNote === 'function') ? diseaseAgeNote(dateVal) : ''
    };
  } catch (e) {
    console.log("❌ Error ดึงข้อมูลสุขภาพ: " + e.message);
    return null;
  }
}

// ==========================================================
// 🛠️ บันทึกประวัติ PM2.5 + เช็ค PHEOC
// ==========================================================
function recordHistoryAndCheckPHEOC(airData) {
  let pheocProvinces = [];
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName("PM25_History");
    if (!sheet) {
      sheet = ss.insertSheet("PM25_History");
      sheet.appendRow(["time", "ขอนแก่น", "ร้อยเอ็ด", "กาฬสินธุ์", "มหาสารคาม"]);
    }

    const todayDateStr = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd");

    // เว้นว่างเมื่อไม่มีข้อมูล — ของเดิมใช้ `|| 0` ทำให้ "สถานีล่ม" ถูกบันทึกเป็น
    // 0 µg/m³ แล้วหน้าเว็บ (Zone B/D) เอาไปแสดงเป็นค่าจริง
    const vals = airData.map(p => (p.pm25 === null || isNaN(p.pm25)) ? "" : p.pm25);

    const lastRow = sheet.getLastRow();
    const all = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 5).getValues() : [];

    // ── PHEOC: ตัดสินจากค่า 07:00 ของ 2 วันติดกัน ────────────────────
    // ย้ายไปใช้ Air4Thai history API แทนการเทียบแถวในชีต เพราะแถวในชีตเก็บ
    // ค่า ณ เวลาที่สคริปต์รัน (บ่าย 3) ไม่ใช่ค่าเช้า
    pheocProvinces = checkPheoc07_();

    // ── เขียนทับแถวของวันนี้ถ้ามีอยู่แล้ว ────────────────────────────
    // ของเดิม appendRow ทุกรอบ → ในชีตมีวันซ้ำ 106 วัน (บางวัน 5 แถว)
    let todayRowIdx = -1;
    for (let i = all.length - 1; i >= 0; i--) {
      if (normDate_(all[i][0]) === todayDateStr) { todayRowIdx = i + 2; break; }
    }
    const rowData = [todayDateStr].concat(vals);
    if (todayRowIdx > 0) sheet.getRange(todayRowIdx, 1, 1, 5).setValues([rowData]);
    else                 sheet.appendRow(rowData);

  } catch (e) {
    // ของเดิมกลืน error เงียบๆ — อย่างน้อยต้องเห็นใน Execution log
    console.log("❌ บันทึกประวัติ/เช็ค PHEOC ไม่สำเร็จ: " + e.message);
  }
  return { provinces: pheocProvinces };
}

/**
 * ดึงค่า PM2.5 เวลา 07:00 ของทุกสถานีเป้าหมาย ย้อนหลัง (days) วันนับรวมวันนี้
 *
 * ขอทุกสถานีในคำขอเดียว (stationID คั่นด้วยจุลภาค) — ยิงครั้งเดียวพอ
 * ⚠️ stime/etime ของ API นี้ "ไม่ได้" กรองเฉพาะชั่วโมงที่ระบุ แต่คืนทุกชั่วโมง
 *    ตั้งแต่ sdate เวลา stime ถึง edate เวลา etime จึงต้องกรอง 07:00:00 เอง
 * ⚠️ ค่าที่คืนมามี null ปนได้ (ชั่วโมงที่สถานีไม่ส่งข้อมูล)
 *
 * คืน { '46t': { '2026-08-17': 14.8, '2026-08-18': 11.5 }, ... }
 */
function fetch07Values_(days) {
  const out = {};
  const today = new Date();
  const from  = new Date(today.getTime() - (days - 1) * 86400000);
  const fmt   = d => Utilities.formatDate(d, 'GMT+7', 'yyyy-MM-dd');

  const url = AIR4THAI_HISTORY +
    '?stationID=' + TARGET_STATIONS.map(s => s.id).join(',') +
    '&param=PM25&type=hr' +
    '&sdate=' + fmt(from) + '&edate=' + fmt(today) +
    '&stime=00&etime=23';

  let res;
  try {
    res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
  } catch (e) {
    console.log('❌ ดึงประวัติ Air4Thai ไม่สำเร็จ: ' + e.message);
    return out;
  }
  if (res.getResponseCode() !== 200) {
    console.log('❌ ประวัติ Air4Thai ตอบ HTTP ' + res.getResponseCode());
    return out;
  }

  let json;
  try { json = JSON.parse(res.getContentText()); } catch (e) {
    console.log('❌ ประวัติ Air4Thai: อ่าน JSON ไม่ได้');
    return out;
  }

  (json.stations || []).forEach(st => {
    const byDate = {};
    (st.data || []).forEach(row => {
      const dt = String(row.DATETIMEDATA || '');          // 'yyyy-MM-dd HH:mm:ss'
      const hh = dt.slice(11, 13);
      if (hh !== PHEOC_HOUR) return;
      const v = row.PM25;
      if (typeof v === 'number' && !isNaN(v)) byDate[dt.slice(0, 10)] = v;
    });
    out[st.stationID] = byDate;
  });

  return out;
}

/**
 * เข้าเกณฑ์เปิด PHEOC ไหม — ค่า 07:00 ถึง PHEOC_THRESHOLD ติดกัน 2 วัน
 * คืน array ชื่อจังหวัดที่เข้าเกณฑ์ (ว่าง = ไม่มี)
 *
 * วันไหนไม่มีค่า 07:00 ถือว่า "ไม่เข้าเกณฑ์" โดยตั้งใจ — ไม่เดาแทนข้อมูลที่ขาด
 * เพราะการประกาศเปิด PHEOC ผิดพลาดมีต้นทุนสูงกว่าการไม่ประกาศ
 */
function checkPheoc07_() {
  const hist = fetch07Values_(2);
  const today = new Date();
  const d1 = Utilities.formatDate(today, 'GMT+7', 'yyyy-MM-dd');                        // วันนี้
  const d0 = Utilities.formatDate(new Date(today.getTime() - 86400000), 'GMT+7', 'yyyy-MM-dd'); // เมื่อวาน

  const hit = [];
  TARGET_STATIONS.forEach(st => {
    const byDate = hist[st.id] || {};
    const y = byDate[d0], t = byDate[d1];
    const ok = typeof y === 'number' && typeof t === 'number' &&
               y >= PHEOC_THRESHOLD && t >= PHEOC_THRESHOLD;
    console.log('  PHEOC ' + st.name + ' 07:00 → ' + d0 + ': ' + fmtVal_(y) +
                ' , ' + d1 + ': ' + fmtVal_(t) + (ok ? '  ⚠️ เข้าเกณฑ์' : ''));
    if (ok) hit.push(st.name);
  });
  return hit;
}

function fmtVal_(v) { return (typeof v === 'number') ? String(v) : '(ไม่มีข้อมูล)'; }

/** ค่าในคอลัมน์ A อาจเป็น Date หรือข้อความ — ทำให้เป็น 'yyyy-MM-dd' เหมือนกันหมด */
function normDate_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime())) {
    return Utilities.formatDate(v, "GMT+7", "yyyy-MM-dd");
  }
  const s = String(v || '').trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return iso[0];
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (dmy) {
    let y = parseInt(dmy[3], 10);
    if (y > 2400) y -= 543;
    return y + '-' + ('0' + dmy[2]).slice(-2) + '-' + ('0' + dmy[1]).slice(-2);
  }
  return '';
}

function getThaiMonth(m) { return ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"][m]; }
function formatNum(n) { return n ? n.toLocaleString() : "0"; }

/**
 * ดึงข้อมูล GISTDA — เรียกจาก doGet() ใน doget.gs (main() ไม่ได้ใช้)
 *
 * ⚠️ ชื่อฟังก์ชันชวนเข้าใจผิด: endpoint ที่ยิงคือ burnt-area-latest =
 *    "พื้นที่เผาไหม้" ไม่ใช่จุดความร้อน จุดความร้อนที่แดชบอร์ดใช้มาจาก
 *    server.js → /api/hotspot ซึ่งยิง features/viirs/1day คนละชุดข้อมูลกัน
 */
function getGistdaHotspotsRegion7() {
  const BASE_URL = 'https://api-gateway.gistda.or.th/api/2.0/resources/gi-service/v1.2/disasters/burnt-area-latest';
  const provinceCodes = ['40', '44', '45', '46'];
  let allHotspots = [];

  for (let i = 0; i < provinceCodes.length; i++) {
    let pv_code = provinceCodes[i];
    let fetchUrl = `${BASE_URL}?pv_idn=${pv_code}`;
    let options = {
      'method': 'get',
      'headers': { 'Authorization': 'Bearer ' + secret_('GISTDA_KEY') },
      'muteHttpExceptions': true
    };

    try {
      console.log(`📡 กำลังดึงข้อมูลจุดความร้อนจังหวัดรหัส: ${pv_code}...`);
      let response = UrlFetchApp.fetch(fetchUrl, options);

      if (response.getResponseCode() === 200) {
        let jsonData = JSON.parse(response.getContentText());
        if (jsonData && jsonData.features && jsonData.features.length > 0) {
          allHotspots = allHotspots.concat(jsonData.features);
          console.log(`✅ ได้ข้อมูล ${jsonData.features.length} จุด`);
        } else if (Array.isArray(jsonData) && jsonData.length > 0) {
           allHotspots = allHotspots.concat(jsonData);
           console.log(`✅ ได้ข้อมูล ${jsonData.length} จุด`);
        } else {
           console.log(`⚪ ไม่มีจุดความร้อนในพื้นที่นี้`);
        }
      } else {
        console.log(`❌ Error API: ${response.getContentText()}`);
      }
    } catch (error) {
      console.log(`❌ Request ล้มเหลว: ${error.message}`);
    }
  }

  console.log(`🔥 รวมจุดความร้อนทั้งหมดในเขต 7: ${allHotspots.length} จุด`);
  return allHotspots;
}
