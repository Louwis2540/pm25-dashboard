const express  = require('express');
const session  = require('express-session');
const bcrypt   = require('bcryptjs');
const cors     = require('cors');
const fs       = require('fs');
const path     = require('path');

const app      = express();
const PORT     = process.env.PORT || 3000;
const CFG_PATH = path.join(__dirname, 'config.json');

/* ── ถ้ามี ENV variables ให้ override config ── */
function applyEnvOverrides(cfg) {
  if (process.env.GISTDA_KEY)     cfg.api.gistda_key         = process.env.GISTDA_KEY;
  if (process.env.SHEET_ID)       cfg.api.sheet_id            = process.env.SHEET_ID;
  if (process.env.ADMIN_USERNAME) cfg.admin.username          = process.env.ADMIN_USERNAME;
  return cfg;
}

/* ── Middleware ── */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));           // serve HTML/CSS/JS files
app.use(session({
  secret: 'pm25-odpc7-secret-2025',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 }     // session 8 ชั่วโมง
}));

/* ── Helper ── */
function readConfig() {
  const cfg = JSON.parse(fs.readFileSync(CFG_PATH, 'utf8'));
  return applyEnvOverrides(cfg);
}
function writeConfig(data) { fs.writeFileSync(CFG_PATH, JSON.stringify(data, null, 2), 'utf8'); }
function isAuth(req, res, next) {
  if (req.session && req.session.admin) return next();
  res.status(401).json({ ok: false, message: 'กรุณาเข้าสู่ระบบก่อน' });
}

/* ════════════════════════════════════════════
   PUBLIC API — dashboard อ่านได้โดยไม่ต้อง login
════════════════════════════════════════════ */
app.get('/api/config', (req, res) => {
  const cfg = readConfig();
  // ซ่อน password hash และ admin credentials ก่อนส่งออก
  const { admin, api, ...pub } = cfg;
  pub.api = { sheet_id: cfg.api.sheet_id };   // ส่ง sheet_id แต่ไม่ส่ง gistda_key
  res.json(pub);
});

// GISTDA VIIRS proxy — api_key เป็น query parameter, endpoint = /viirs/1day
app.get('/api/hotspot', async (req, res) => {
  const cfg  = readConfig();
  const key  = cfg.api.gistda_key;
  const pvs  = cfg.provinces.map(p => p.pv_idn);
  const BASE = 'https://api-gateway.gistda.or.th/api/2.0/resources/features/viirs/1day';

  try {
    const results = await Promise.all(pvs.map(pv =>
      fetch(`${BASE}?api_key=${key}&pv_idn=${pv}&limit=500&offset=0`)
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    ));
    const features = results.flatMap(r => r.features || []);
    res.json({ ok: true, count: features.length, source: 'GISTDA VIIRS',
               geojson: { type: 'FeatureCollection', features } });
  } catch (e) {
    res.status(502).json({ ok: false, message: 'GISTDA API error: ' + e.message });
  }
});

/* ════════════════════════════════════════════
   ADMIN AUTH
════════════════════════════════════════════ */
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  const cfg = readConfig();
  if (username !== cfg.admin.username) {
    return res.status(401).json({ ok: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
  }
  const match = await bcrypt.compare(password, cfg.admin.password_hash);
  if (!match) {
    return res.status(401).json({ ok: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
  }
  req.session.admin = { username };
  res.json({ ok: true, message: 'เข้าสู่ระบบสำเร็จ' });
});

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

app.get('/api/admin/check', (req, res) => {
  res.json({ ok: !!(req.session && req.session.admin) });
});

/* ════════════════════════════════════════════
   ADMIN API — ต้อง login
════════════════════════════════════════════ */

// ดึง config ฉบับเต็ม (รวม API key)
app.get('/api/admin/config', isAuth, (req, res) => {
  const cfg = readConfig();
  const { admin, ...safe } = cfg;  // ซ่อน password hash
  res.json(safe);
});

// บันทึก config ทุก section
app.post('/api/admin/config', isAuth, (req, res) => {
  try {
    const cfg  = readConfig();
    const body = req.body;
    // อัปเดตแต่ละ section (ไม่แตะ admin credentials)
    ['site','api','map','provinces','aqi','recommendations','theme','layout','chart','diseases'].forEach(k => {
      if (body[k] !== undefined) cfg[k] = body[k];
    });
    writeConfig(cfg);
    res.json({ ok: true, message: 'บันทึกการตั้งค่าสำเร็จ' });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

// เปลี่ยนรหัสผ่าน admin
app.post('/api/admin/change-password', isAuth, async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!new_password || new_password.length < 6)
    return res.status(400).json({ ok: false, message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });
  const cfg   = readConfig();
  const match = await bcrypt.compare(current_password, cfg.admin.password_hash);
  if (!match) return res.status(401).json({ ok: false, message: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
  cfg.admin.password_hash = await bcrypt.hash(new_password, 10);
  writeConfig(cfg);
  res.json({ ok: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ' });
});

/* ════════════════════════════════════════════
   PROVINCE GeoJSON  (cached locally)
════════════════════════════════════════════ */
const GEOJSON_CACHE = path.join(__dirname, 'provinces.geojson');
const GEOJSON_URL   = 'https://raw.githubusercontent.com/apisit/thailand.json/master/thailand.json';

// English name → Thai name mapping (ตรงกับ apisit/thailand.json)
const EN_TO_PV = {
  'Khon Kaen':    'ขอนแก่น',
  'Kalasin':      'กาฬสินธุ์',
  'Maha Sarakham':'มหาสารคาม',
  'Roi Et':       'ร้อยเอ็ด',
};

app.get('/api/provinces-geojson', async (req, res) => {
  if (fs.existsSync(GEOJSON_CACHE)) {
    return res.json(JSON.parse(fs.readFileSync(GEOJSON_CACHE, 'utf8')));
  }
  try {
    const r = await fetch(GEOJSON_URL);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const all = await r.json();
    const cfg = readConfig();

    const filtered = {
      type: 'FeatureCollection',
      features: all.features
        .filter(f => EN_TO_PV[f.properties.name])
        .map(f => {
          const thName = EN_TO_PV[f.properties.name];
          const pv     = cfg.provinces.find(p => p.name === thName);
          f.properties.name_th = thName;
          f.properties.pv_idn  = pv?.pv_idn ?? 0;
          return f;
        })
    };
    fs.writeFileSync(GEOJSON_CACHE, JSON.stringify(filtered));
    res.json(filtered);
  } catch (e) {
    res.status(502).json({ ok: false, message: 'GeoJSON fetch error: ' + e.message });
  }
});

/* ── reset GeoJSON cache (Admin ใช้เมื่อต้องการดาวน์โหลดใหม่) ── */
app.post('/api/admin/reset-geojson', isAuth, (req, res) => {
  if (fs.existsSync(GEOJSON_CACHE)) fs.unlinkSync(GEOJSON_CACHE);
  res.json({ ok: true, message: 'GeoJSON cache cleared' });
});

/* ════════════════════════════════════════════
   GOOGLE SHEET DATA  (PM2.5 + Disease)
════════════════════════════════════════════ */
app.get('/api/sheet-pm25', async (req, res) => {
  const cfg = readConfig();
  const id  = cfg.api.sheet_id;

  // ลองดึงจาก sheet "2026" ก่อน ถ้าไม่ได้ลอง default
  // sheet "PM25_History" คือ tab ที่มีข้อมูลรายวัน: Date,ขอนแก่น,ร้อยเอ็ด,กาฬสินธุ์,มหาสารคาม
  const urls = [
    `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=PM25_History`,
    `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=pm25_history`,
    `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=0`,
    `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`,
  ];

  let csv = '';
  for (const url of urls) {
    try {
      const r = await fetch(url, { redirect: 'follow' });
      if (r.ok) {
        const t = await r.text();
        if (!t.toLowerCase().includes('sign in') && t.length > 100) { csv = t; break; }
      }
    } catch (_) { /* try next */ }
  }

  if (!csv) {
    return res.status(403).json({
      ok: false,
      message: 'กรุณาเปิดการแชร์ Google Sheet เป็นสาธารณะ: File → Share → Publish to web → CSV'
    });
  }

  try {
    const parsed = parseSheetData(csv, cfg.provinces);
    res.json({ ok: true, ...parsed });
  } catch (e) {
    res.status(500).json({ ok: false, message: 'CSV parse error: ' + e.message });
  }
});

/* ════════════════════════════════════════════
   AIR4THAI API  (real-time PM2.5 per station)
   region=5 = ภาคตะวันออกเฉียงเหนือ
════════════════════════════════════════════ */
const AIR4THAI_URLS = [
  'https://air4thai.pcd.go.th/services/getNewAQI_JSON.php?region=5',
  'http://air4thai.pcd.go.th/services/getNewAQI_JSON.php?region=5',
];
const PROXY_URL = 'https://api.allorigins.win/raw?url=';

app.get('/api/air4thai', async (req, res) => {
  const cfg = readConfig();
  let stations = [];

  // ลองดึงตรงก่อน ถ้าไม่ได้ใช้ proxy
  for (const url of AIR4THAI_URLS) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (r.ok) {
        const j = await r.json();
        if (j.stations?.length) { stations = j.stations; break; }
      }
    } catch (_) { /* try next */ }
  }

  if (!stations.length) {
    try {
      const proxyUrl = PROXY_URL + encodeURIComponent(AIR4THAI_URLS[1]);
      const r = await fetch(proxyUrl, { signal: AbortSignal.timeout(8000) });
      if (r.ok) { const j = await r.json(); stations = j.stations || []; }
    } catch (_) { /* ignore */ }
  }

  // แมปสถานีตามจังหวัด
  const result = cfg.provinces.map(pv => {
    // ดึงสถานีที่อยู่ในจังหวัดนี้ (ใช้ areaEN หรือ areaTH จาก Air4Thai)
    const pvStations = stations.filter(s => {
      const area = (s.areaTH || s.areaEN || '').toLowerCase();
      return area.includes(pv.name) || area.includes(pv.name.substring(0, 4));
    });

    if (!pvStations.length) return { name: pv.name, pm25: null, stations: [] };

    const stationList = pvStations.map(s => {
      const upd = s.LastUpdate || s.AQILast || {};
      const raw = upd?.PM25?.value;
      const val = (raw !== undefined && raw !== '-' && raw !== 'N/A' && raw !== '') ? parseFloat(raw) : null;
      return { id: s.stationID, name: s.nameTH || s.nameEN, pm25: val, time: upd.time || '' };
    }).filter(s => s.pm25 !== null);

    const avgPM25 = stationList.length
      ? stationList.reduce((a, b) => a + b.pm25, 0) / stationList.length
      : null;

    return { name: pv.name, pm25: avgPM25 ? +avgPM25.toFixed(1) : null, stations: stationList };
  });

  res.json({ ok: true, data: result, count: stations.length });
});

app.get('/api/sheet-disease', async (req, res) => {
  const cfg = readConfig();
  const id  = cfg.api.sheet_id;
  const results = {};

  for (const yr of ['2025', '2026']) {
    try {
      const url = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${yr}`;
      const r   = await fetch(url, { redirect: 'follow' });
      if (r.ok) {
        const t = await r.text();
        if (!t.toLowerCase().includes('sign in')) results[yr] = parseDiseaseData(t);
      }
    } catch (_) { results[yr] = []; }
  }
  res.json({ ok: true, ...results });
});

/* ── CSV helpers ── */
function csvLine(line) {
  const out = []; let cur = '', q = false;
  for (const c of line) {
    if (c === '"') { q = !q; }
    else if (c === ',' && !q) { out.push(cur.trim()); cur = ''; }
    else cur += c;
  }
  out.push(cur.trim());
  return out;
}

function isoDate(s) {
  // "19/2/2026 0:00:00" or "2026-04-29" → "2026-04-29"
  s = s.replace(/"/g, '').trim().split(',')[0].split(' ')[0];
  if (s.includes('/')) {
    const [d, m, y] = s.split('/');
    return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }
  return s;
}

function parseSheetData(csv, provinces) {
  const lines = csv.split('\n').map(l => l.trim()).filter(Boolean);

  // หา header row ของตาราง PM2.5 (แถวที่มี "date" ในคอลัมน์แรก)
  let headerIdx = -1, headers = [];
  for (let i = 0; i < lines.length; i++) {
    const cols = csvLine(lines[i]);
    if (cols[0].toLowerCase().replace(/"/g,'').includes('date')) {
      headerIdx = i;
      headers = cols.map(c => c.replace(/"/g,'').trim());
      break;
    }
  }
  if (headerIdx < 0) return { latest: {}, last7: [], allData: {} };

  // อ่านข้อมูลแต่ละแถว
  const byDate = {};
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = csvLine(lines[i]);
    if (!cols[0] || cols[0].replace(/"/g,'').trim() === '') break;
    const dateKey = isoDate(cols[0]);
    if (!dateKey.match(/\d{4}-\d{2}-\d{2}/)) break;
    const row = {};
    headers.slice(1).forEach((h, j) => {
      const v = parseFloat(cols[j + 1]);
      if (!isNaN(v)) row[h] = v;
    });
    byDate[dateKey] = row;  // ถ้าวันเดียวกันมีหลายแถว → ใช้แถวหลังสุด
  }

  const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  // ค่าล่าสุดต่อจังหวัด
  const latest = {}, latestDate = {};
  for (const pv of provinces) {
    const col = headers.find(h => h === pv.name);
    if (!col) continue;
    for (const d of sortedDates) {
      const v = byDate[d][col];
      if (v !== undefined && v > 0) { latest[pv.name] = v; latestDate[pv.name] = d; break; }
    }
  }

  // 7 วันล่าสุด (unique dates)
  const uniq = [...new Set(sortedDates)].slice(0, 7).reverse();
  const last7 = uniq.map(d => {
    const row = { date: d };
    provinces.forEach(pv => {
      const col = headers.find(h => h === pv.name);
      if (col && byDate[d]?.[col] !== undefined) row[pv.name] = byDate[d][col];
    });
    return row;
  });

  return { latest, latestDate, last7, allData: byDate, sortedDates };
}

function parseDiseaseData(csv) {
  const lines = csv.split('\n').map(l => l.trim()).filter(Boolean);
  const FIELDS = ['ทางเดินหายใจ', 'หัวใจ/หลอดเลือด', 'ตาอักเสบ', 'ผิวหนัง'];
  let headerIdx = -1, headers = [];

  for (let i = 0; i < lines.length; i++) {
    const cols = csvLine(lines[i]);
    if (cols[0].toLowerCase().replace(/"/g,'').includes('wk')) {
      headerIdx = i;
      headers = cols.map(c => c.replace(/"/g,'').trim());
      break;
    }
  }
  if (headerIdx < 0) return [];

  const rows = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = csvLine(lines[i]);
    const wk = parseInt(cols[0]);
    if (!wk) continue;
    const row = { wk };
    headers.slice(1).forEach((h, j) => {
      if (!h) return;
      const raw = String(cols[j + 1] || '').replace(/"/g,'').trim();
      const num = Number(raw.replace(/,/g,''));   // Number() คืน NaN สำหรับ "24/4/2026"
      if (!isNaN(num) && raw !== '') row[h] = num;
      else if (raw !== '')           row[h] = raw; // เก็บเป็น string เช่น "24/4/2026"
    });
    rows.push(row);
  }
  return rows;
}

/* ── Start ── */
app.listen(PORT, () => {
  console.log(`\n✅  PM2.5 Dashboard Server เริ่มทำงานแล้ว`);
  console.log(`   Dashboard : http://localhost:${PORT}/index.html`);
  console.log(`   Admin     : http://localhost:${PORT}/admin.html`);
  console.log(`   รหัสเริ่มต้น username: admin | password: password\n`);
});
