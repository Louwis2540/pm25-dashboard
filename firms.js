// NASA FIRMS (VIIRS NRT) — แหล่งสำรองจุดความร้อนเมื่อ GISTDA ค้าง
// ต้องมี FIRMS_KEY (MAP_KEY ฟรี: firms.modaps.eosdis.nasa.gov/api/map_key) · ไม่เปิดใช้จนกว่าจะตั้งค่า
const fs = require('fs'), path = require('path');
const FIRMS_SOURCES = ['VIIRS_NOAA20_NRT', 'VIIRS_NOAA21_NRT'];   // NOAA-20 / NOAA-21 (ชุดเดียวกับที่ GISTDA ใช้)
const FIRMS_CONF = { l: 'low', n: 'nominal', h: 'high' };          // confidence ของ VIIRS (ตัวอักษร) → ป้ายที่หน้าเว็บใช้
const PV_IDN = new Set(['40', '44', '45', '46']);                   // ขอนแก่น · มหาสารคาม · ร้อยเอ็ด · กาฬสินธุ์

// CSV ของ FIRMS → แถว object (ไม่รวมบรรทัดว่าง/หัวตาราง)
function parseFirmsCsv(text) {
  const lines = String(text || '').trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const head = lines[0].split(',');
  return lines.slice(1).filter(Boolean).map(l => {
    const cols = l.split(','), o = {}; head.forEach((h, i) => { o[h.trim()] = (cols[i] ?? '').trim(); }); return o;
  });
}

// เวลา UTC ของ FIRMS (acq_date=YYYY-MM-DD, acq_time=HHMM หรือ HMM) → วันที่/เวลาไทย (UTC+7)
function toThai(acqDate, acqTime) {
  const t = String(acqTime || '0').padStart(4, '0'), mins = (+t.slice(0, 2)) * 60 + (+t.slice(2));
  const tot = mins + 420, dayShift = Math.floor(tot / 1440), tm = tot % 1440;
  const d = new Date(Date.parse(acqDate + 'T00:00:00Z') + dayShift * 864e5).toISOString().slice(0, 10);
  return { date: d, hhmm: String(Math.floor(tm / 60)).padStart(2, '0') + String(tm % 60).padStart(2, '0') };
}

// จุดในพื้นที่ (ray casting) — รองรับ Polygon และ MultiPolygon
function inRing(x, y, ring) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function inGeom(x, y, g) {
  if (g.type === 'Polygon') return inRing(x, y, g.coordinates[0]);
  if (g.type === 'MultiPolygon') return g.coordinates.some(p => inRing(x, y, p[0]));
  return false;
}

// อำเภอ/จังหวัดของจุด จาก districts-r7.geojson (ค้นครั้งแรกแล้วแคช)
let _districts = null;
function districts() {
  if (_districts) return _districts;
  const f = path.join(__dirname, 'districts-r7.geojson');
  _districts = JSON.parse(fs.readFileSync(f, 'utf8')).features.map(x => ({ g: x.geometry, pv: String(x.properties.pv), pvName: x.properties.pv_name, name: x.properties.name }));
  return _districts;
}
function locate(lng, lat) {
  for (const d of districts()) if (inGeom(lng, lat, d.g)) return d;
  return null;
}

// แถว FIRMS → feature รูปแบบเดียวกับ GISTDA (ให้ hsRow / หน้าเว็บใช้ต่อได้)
function firmsFeatures(rows) {
  const out = [];
  for (const r of rows) {
    const lat = +r.latitude, lng = +r.longitude;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !r.acq_date) continue;
    const d = locate(lng, lat); if (!d || !PV_IDN.has(d.pv)) continue;
    const th = toThai(r.acq_date, r.acq_time);
    out.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: { acq_date: `${th.date}T00:00:00`, th_time: th.hhmm, changwat: d.pvName, ap_en: d.name, tb_en: '', lu_name: '',
        confidence: FIRMS_CONF[(r.confidence || '').toLowerCase()] || 'nominal', frp: r.frp === '' ? null : +r.frp,
        satellite: r.satellite || '', source: 'firms' } });
  }
  return out;
}

// ดึง NRT ของทั้งประเทศไทยย้อนหลัง days วัน (1–10) จากทั้งสองดาวเทียม
async function fetchFirms(key, days = 1) {
  const all = [];
  for (const src of FIRMS_SOURCES) {
    const url = `https://firms.modaps.eosdis.nasa.gov/api/country/csv/${encodeURIComponent(key)}/${src}/THA/${days}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error(`FIRMS ${src} HTTP ${r.status}`);
    all.push(...parseFirmsCsv(await r.text()));
  }
  return all;
}

module.exports = { parseFirmsCsv, toThai, locate, firmsFeatures, fetchFirms, FIRMS_CONF, PV_IDN };
