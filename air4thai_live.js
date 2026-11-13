/* ค่าฝุ่น PM2.5 ล่าสุดรายชั่วโมงจาก Air4Thai — ใช้กับแผนที่รวม (/api/air4thai-live)
   ต่างจาก /api/air4thai ที่ตั้งใจใช้เฉพาะรอบ 07:00 น. เท่านั้น (ค่าเฉลี่ย 24 ชม. ณ 07.00 น. = ค่าของรายงาน/LINE/การ์ดจังหวัด)
   ฟังก์ชันนี้เป็นฟังก์ชันล้วน (ไม่ดึงเครือข่าย) เพื่อทดสอบได้ — server.js เป็นคนดึงข้อมูลแล้วส่งเข้ามา
   Air4Thai ส่ง PM25.value เป็นค่าเฉลี่ย 24 ชม. ณ เวลานั้น (อัปเดตทุกชั่วโมง) */
const STALE_MIN = 6 * 60;   // ข้อมูลเก่ากว่า 6 ชม. = ถือว่าค้าง (stale) หน้าเว็บจะเตือน

function num(raw) {
  if (raw === undefined || raw === null || raw === '' || raw === '-' || raw === 'N/A') return null;
  const v = parseFloat(raw);
  return Number.isFinite(v) && v >= 0 ? v : null;
}

/* stations: อาร์เรย์ของ Air4Thai (getNewAQI_JSON) · provinces: config.provinces · now: Date (ทดสอบได้) */
function buildLive(stations, provinces, now = new Date()) {
  return provinces.map(pv => {
    const mine = (stations || []).filter(s => {
      const area = (s.areaTH || s.areaEN || '').toLowerCase();
      return area.includes(pv.name) || area.includes(pv.name.substring(0, 4));
    });
    const rows = mine.map(s => {
      const u = s.LastUpdate || s.AQILast || {};
      const v = num(u?.PM25?.value);
      const date = String(u.date || '').slice(0, 10), time = String(u.time || '').slice(0, 5);
      return v === null || !date || !time ? null : { id: s.stationID, name: s.nameTH || s.nameEN, pm25: v, date, time, slot: `${date} ${time}` };
    }).filter(Boolean);
    if (!rows.length) return { name: pv.name, pm25: null, date: null, time: null, n: 0, stations: [], stale: true };
    const slot = rows.map(r => r.slot).sort().at(-1);            // รอบล่าสุดที่มีข้อมูล
    const cur = rows.filter(r => r.slot === slot);               // เฉลี่ยเฉพาะสถานีที่รายงานรอบนั้น (ไม่ผสมรอบเก่า)
    const avg = cur.reduce((a, r) => a + r.pm25, 0) / cur.length;
    const t = new Date(`${slot.replace(' ', 'T')}:00+07:00`);    // เวลาไทย
    const ageMin = Number.isNaN(t.getTime()) ? null : Math.round((now - t) / 60000);
    return { name: pv.name, pm25: +avg.toFixed(1), date: cur[0].date, time: cur[0].time, n: cur.length,
             stations: cur.map(({ id, name, pm25, time }) => ({ id, name, pm25, time })), stale: ageMin === null ? true : ageMin > STALE_MIN };
  });
}
module.exports = { buildLive, STALE_MIN };
