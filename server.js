const express  = require('express');
const session  = require('express-session');
const bcrypt   = require('bcryptjs');
const cors     = require('cors');
const fs       = require('fs');
const path     = require('path');

const app        = express();
const PORT       = process.env.PORT || 3000;
const CFG_PATH   = path.join(__dirname, 'config.json');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

/* ── Config cache (invalidated on every write) ── */
let _cfgCache = null;

/* ── API response cache (TTL-based) ── */
const _cache = new Map();
function getCached(key) {
  const e = _cache.get(key);
  if (!e || Date.now() > e.exp) { _cache.delete(key); return null; }
  return e.data;
}
function setCached(key, data, ttlMs) {
  _cache.set(key, { data, exp: Date.now() + ttlMs });
}

function readConfig() {
  if (_cfgCache) return _cfgCache;
  const cfg = JSON.parse(fs.readFileSync(CFG_PATH, 'utf8'));
  if (process.env.GISTDA_KEY)          cfg.api.gistda_key        = process.env.GISTDA_KEY;
  if (process.env.SHEET_ID)            cfg.api.sheet_id          = process.env.SHEET_ID;
  if (process.env.ADMIN_USERNAME)      cfg.admin.username        = process.env.ADMIN_USERNAME;
  if (process.env.ADMIN_PASSWORD_HASH) cfg.admin.password_hash   = process.env.ADMIN_PASSWORD_HASH;
  _cfgCache = cfg;
  return cfg;
}
function writeConfig(data) {
  fs.writeFileSync(CFG_PATH, JSON.stringify(data, null, 2), 'utf8');
  _cfgCache = null;
}

/* ── GeoJSON memory cache ── */
let _geojsonCache = null;

/* ── Auth guard ── */
function isAuth(req, res, next) {
  if (req.session?.admin) return next();
  res.status(401).json({ ok: false, message: 'กรุณาเข้าสู่ระบบก่อน' });
}

/* ── Fetch CSV with fallback URLs ── */
async function fetchCSV(urls) {
  for (const url of urls) {
    try {
      const r = await fetch(url, { redirect: 'follow' });
      if (!r.ok) continue;
      const t = await r.text();
      if (!t.toLowerCase().includes('sign in') && t.length > 100) return t;
    } catch (_) { /* try next */ }
  }
  return null;
}

/* ── Middleware ── */
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(__dirname));
app.use('/uploads', express.static(UPLOAD_DIR));
app.use(session({
  secret: process.env.SESSION_SECRET || 'pm25-odpc7-secret-2025',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 },
}));

/* ══════════════════════════════════════════
   PUBLIC API
══════════════════════════════════════════ */
app.get('/api/config', (req, res) => {
  const { admin, api, ...pub } = readConfig();
  pub.api = { sheet_id: api.sheet_id };
  res.json(pub);
});

app.get('/api/hotspot', async (req, res) => {
  const cached = getCached('hotspot');
  if (cached) return res.json(cached);

  const { api, provinces } = readConfig();
  const BASE = 'https://api-gateway.gistda.or.th/api/2.0/resources/features/viirs/1day';
  try {
    const results  = await Promise.all(
      provinces.map(p =>
        fetch(`${BASE}?api_key=${api.gistda_key}&pv_idn=${p.pv_idn}&limit=500&offset=0`)
          .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      )
    );
    const features = results.flatMap(r => r.features || []);
    const data = { ok: true, count: features.length, source: 'GISTDA VIIRS',
                   geojson: { type: 'FeatureCollection', features } };
    setCached('hotspot', data, 60 * 60 * 1000); // 60 นาที
    res.json(data);
  } catch (e) {
    res.status(502).json({ ok: false, message: 'GISTDA API error: ' + e.message });
  }
});

app.get('/api/sheet-pm25', async (req, res) => {
  const cached = getCached('sheet-pm25');
  if (cached) return res.json(cached);

  const { api, provinces } = readConfig();
  const id  = api.sheet_id;
  const csv = await fetchCSV([
    `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=PM25_History`,
    `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=pm25_history`,
    `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=0`,
    `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`,
  ]);
  if (!csv) return res.status(403).json({
    ok: false,
    message: 'กรุณาเปิดการแชร์ Google Sheet: File → Share → Publish to web → CSV',
  });
  try {
    const data = { ok: true, ...parseSheetData(csv, provinces) };
    setCached('sheet-pm25', data, 30 * 60 * 1000); // 30 นาที
    res.json(data);
  } catch (e) {
    res.status(500).json({ ok: false, message: 'CSV parse error: ' + e.message });
  }
});

app.get('/api/air4thai', async (req, res) => {
  const cached = getCached('air4thai');
  if (cached) return res.json(cached);

  const { provinces } = readConfig();
  let stations = [];

  const AIR4THAI = [
    'https://air4thai.pcd.go.th/services/getNewAQI_JSON.php?region=5',
    'http://air4thai.pcd.go.th/services/getNewAQI_JSON.php?region=5',
  ];

  for (const url of AIR4THAI) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (r.ok) { const j = await r.json(); if (j.stations?.length) { stations = j.stations; break; } }
    } catch (_) { /* try next */ }
  }

  if (!stations.length) {
    try {
      const proxy = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(AIR4THAI[1]);
      const r     = await fetch(proxy, { signal: AbortSignal.timeout(8000) });
      if (r.ok) { const j = await r.json(); stations = j.stations || []; }
    } catch (_) { /* ignore */ }
  }

  const result = provinces.map(pv => {
    const pvStations = stations.filter(s => {
      const area = (s.areaTH || s.areaEN || '').toLowerCase();
      return area.includes(pv.name) || area.includes(pv.name.substring(0, 4));
    });
    if (!pvStations.length) return { name: pv.name, pm25: null, stations: [] };

    const list = pvStations.map(s => {
      const upd = s.LastUpdate || s.AQILast || {};
      const raw = upd?.PM25?.value;
      const val = (raw !== undefined && raw !== '-' && raw !== 'N/A' && raw !== '') ? parseFloat(raw) : null;
      return { id: s.stationID, name: s.nameTH || s.nameEN, pm25: val, time: upd.time || '' };
    }).filter(s => s.pm25 !== null);

    // ใช้ข้อมูลเวลา 07:00 น. เป็นหลัก — ถ้าไม่มีให้ใช้ข้อมูลล่าสุด
    const list07 = list.filter(s => s.time.replace(':', '').startsWith('07'));
    const finalList = list07.length > 0 ? list07 : list;
    const timeSlot  = list07.length > 0 ? '07:00' : null;

    const avg = finalList.length ? finalList.reduce((a, b) => a + b.pm25, 0) / finalList.length : null;
    return { name: pv.name, pm25: avg ? +avg.toFixed(1) : null, stations: finalList, timeSlot };
  });

  const data = { ok: true, data: result, count: stations.length };
  setCached('air4thai', data, 30 * 60 * 1000); // 30 นาที
  res.json(data);
});

app.get('/api/sheet-disease', async (req, res) => {
  const cached = getCached('sheet-disease');
  if (cached) return res.json(cached);

  const { api } = readConfig();
  const id      = api.sheet_id;

  const [csv2025, csv2026] = await Promise.all(
    ['2025', '2026'].map(yr =>
      fetchCSV([`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${yr}`])
    )
  );

  const data = {
    ok:   true,
    2025: csv2025 ? parseDiseaseData(csv2025) : [],
    2026: csv2026 ? parseDiseaseData(csv2026) : [],
  };
  setCached('sheet-disease', data, 60 * 60 * 1000); // 60 นาที
  res.json(data);
});

/* ══════════════════════════════════════════
   PROVINCE GeoJSON
══════════════════════════════════════════ */
const GEOJSON_URL = 'https://raw.githubusercontent.com/apisit/thailand.json/master/thailand.json';
const GEOJSON_PATH = path.join(__dirname, 'provinces.geojson');
const EN_TO_PV = {
  'Khon Kaen': 'ขอนแก่น', 'Kalasin': 'กาฬสินธุ์',
  'Maha Sarakham': 'มหาสารคาม', 'Roi Et': 'ร้อยเอ็ด',
};

app.get('/api/provinces-geojson', async (req, res) => {
  if (_geojsonCache) return res.json(_geojsonCache);
  try {
    const raw = fs.readFileSync(GEOJSON_PATH, 'utf8');
    _geojsonCache = JSON.parse(raw);
    return res.json(_geojsonCache);
  } catch (_) { /* cache miss — fetch from upstream */ }

  try {
    const r   = await fetch(GEOJSON_URL);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const all = await r.json();
    const { provinces } = readConfig();

    // รองรับทั้ง apisit (name) และ geoBoundaries (shapeName)
    const getName = f => f.properties.shapeName || f.properties.name || '';
    const filtered = {
      type: 'FeatureCollection',
      features: all.features
        .filter(f => EN_TO_PV[getName(f)])
        .map(f => {
          const thName = EN_TO_PV[getName(f)];
          const pv     = provinces.find(p => p.name === thName);
          f.properties.name_th = thName;
          f.properties.pv_idn  = pv?.pv_idn ?? 0;
          return f;
        }),
    };
    fs.writeFileSync(GEOJSON_PATH, JSON.stringify(filtered));
    _geojsonCache = filtered;
    res.json(filtered);
  } catch (e) {
    res.status(502).json({ ok: false, message: 'GeoJSON fetch error: ' + e.message });
  }
});

app.post('/api/admin/upload-header', isAuth, (req, res) => {
  const { data } = req.body;
  if (!data) return res.status(400).json({ ok: false, message: 'ไม่มีข้อมูลรูปภาพ' });
  try {
    const buf = Buffer.from(data.replace(/^data:[^;]+;base64,/, ''), 'base64');
    fs.writeFileSync(path.join(__dirname, 'header.png'), buf);
    res.json({ ok: true, message: 'อัปโหลด Header สำเร็จ' });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

app.post('/api/admin/upload-logo', isAuth, (req, res) => {
  const { data } = req.body;
  if (!data) return res.status(400).json({ ok: false, message: 'ไม่มีข้อมูลรูปภาพ' });
  try {
    const buf = Buffer.from(data.replace(/^data:[^;]+;base64,/, ''), 'base64');
    fs.writeFileSync(path.join(__dirname, 'logo.png'), buf);
    res.json({ ok: true, message: 'อัปโหลดโลโก้สำเร็จ' });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

app.post('/api/admin/reset-geojson', isAuth, (req, res) => {
  try { fs.unlinkSync(GEOJSON_PATH); } catch (_) { /* already gone */ }
  _geojsonCache = null;
  res.json({ ok: true, message: 'GeoJSON cache cleared' });
});

/* ══════════════════════════════════════════
   ADMIN AUTH
══════════════════════════════════════════ */
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  const cfg = readConfig();
  if (username !== cfg.admin.username)
    return res.status(401).json({ ok: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
  const match = await bcrypt.compare(password, cfg.admin.password_hash);
  if (!match)
    return res.status(401).json({ ok: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
  req.session.admin = { username };
  res.json({ ok: true, message: 'เข้าสู่ระบบสำเร็จ' });
});

app.post('/api/admin/logout', (req, res) => { req.session.destroy(); res.json({ ok: true }); });
app.get('/api/admin/check',   (req, res) => { res.json({ ok: !!req.session?.admin }); });

/* ══════════════════════════════════════════
   ADMIN CONFIG
══════════════════════════════════════════ */
app.get('/api/admin/config', isAuth, (req, res) => {
  const { admin, ...safe } = readConfig();
  res.json(safe);
});

app.post('/api/admin/config', isAuth, (req, res) => {
  try {
    const cfg  = readConfig();
    const KEYS = ['site','api','map','map_export','provinces','aqi','recommendations','theme','layout','chart','diseases','typography','zone_styles','zone_titles'];
    KEYS.forEach(k => {
      if (req.body[k] === undefined) return;
      const v = req.body[k];
      // deep-merge plain objects; replace arrays and primitives
      if (v !== null && typeof v === 'object' && !Array.isArray(v) &&
          cfg[k] !== null && typeof cfg[k] === 'object' && !Array.isArray(cfg[k])) {
        cfg[k] = { ...cfg[k], ...v };
      } else {
        cfg[k] = v;
      }
    });
    writeConfig(cfg);
    res.json({ ok: true, message: 'บันทึกการตั้งค่าสำเร็จ' });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

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

/* ══════════════════════════════════════════
   CSV HELPERS
══════════════════════════════════════════ */
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

function findHeaderRow(lines, keyword) {
  for (let i = 0; i < lines.length; i++) {
    const cols = csvLine(lines[i]);
    if (cols[0].toLowerCase().replace(/"/g, '').includes(keyword))
      return { idx: i, headers: cols.map(c => c.replace(/"/g, '').trim()) };
  }
  return null;
}

function isoDate(s) {
  s = s.replace(/"/g, '').trim().split(',')[0].split(' ')[0];
  if (!s.includes('/')) return s;
  const [d, m, y] = s.split('/');
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function parseSheetData(csv, provinces) {
  const lines  = csv.split('\n').map(l => l.trim()).filter(Boolean);
  const header = findHeaderRow(lines, 'date');
  if (!header) return { latest: {}, last7: [], allData: {} };

  const { idx: headerIdx, headers } = header;
  const byDate = {};

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols    = csvLine(lines[i]);
    const dateKey = isoDate(cols[0]);
    if (!dateKey.match(/\d{4}-\d{2}-\d{2}/)) break;
    const row = {};
    headers.slice(1).forEach((h, j) => {
      const v = parseFloat(cols[j + 1]);
      if (!isNaN(v)) row[h] = v;
    });
    byDate[dateKey] = row;
  }

  const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));
  const latest = {}, latestDate = {};

  for (const pv of provinces) {
    const col = headers.find(h => h === pv.name);
    if (!col) continue;
    for (const d of sortedDates) {
      const v = byDate[d][col];
      if (v !== undefined && v > 0) { latest[pv.name] = v; latestDate[pv.name] = d; break; }
    }
  }

  const last7 = sortedDates.slice(0, 7).reverse().map(d => {
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
  const lines  = csv.split('\n').map(l => l.trim()).filter(Boolean);
  const header = findHeaderRow(lines, 'wk');
  if (!header) return [];

  const { idx: headerIdx, headers } = header;
  const rows = [];

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = csvLine(lines[i]);
    const wk   = parseInt(cols[0]);
    if (!wk) continue;
    const row  = { wk };
    headers.slice(1).forEach((h, j) => {
      if (!h) return;
      const raw = String(cols[j + 1] || '').replace(/"/g, '').trim();
      const num = Number(raw.replace(/,/g, ''));
      if (!isNaN(num) && raw !== '') row[h] = num;
      else if (raw !== '')           row[h] = raw;
    });
    rows.push(row);
  }
  return rows;
}

/* ── Start ── */
app.listen(PORT, () => {
  console.log(`\n✅  PM2.5 Dashboard พร้อมใช้งาน`);
  console.log(`   Dashboard : http://localhost:${PORT}/index.html`);
  console.log(`   Admin     : http://localhost:${PORT}/admin.html\n`);
});
