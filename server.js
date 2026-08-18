const express  = require('express');
const session  = require('express-session');
const bcrypt   = require('bcryptjs');
const cors     = require('cors');
const fs       = require('fs');
const path     = require('path');
const Database = require('better-sqlite3');

const app        = express();
const PORT       = process.env.PORT || 3000;
const CFG_PATH   = path.join(__dirname, 'config.json');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

/* ── SQLite — Hotspot History ── */
const db = new Database(path.join(__dirname, 'hotspot_history.db'));
db.exec(`
  CREATE TABLE IF NOT EXISTS hotspot_log (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_at  TEXT NOT NULL,
    snapshot_date TEXT NOT NULL,
    lat          REAL,
    lng          REAL,
    confidence   TEXT,
    frp          REAL,
    acq_date     TEXT,
    acq_time     TEXT,
    th_time      TEXT,
    province     TEXT,
    ap_en        TEXT,
    tb_en        TEXT,
    lu_name      TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_snap_date ON hotspot_log(snapshot_date);
`);
const _insertHotspot = db.prepare(`
  INSERT INTO hotspot_log
    (snapshot_at, snapshot_date, lat, lng, confidence, frp, acq_date, acq_time, th_time, province, ap_en, tb_en, lu_name)
  VALUES
    (@snapshot_at, @snapshot_date, @lat, @lng, @confidence, @frp, @acq_date, @acq_time, @th_time, @province, @ap_en, @tb_en, @lu_name)
`);
const _saveSnapshot = db.transaction((features, snapshotAt) => {
  const snapshotDate = snapshotAt.slice(0, 10);
  for (const f of features) {
    const p = f.properties || {};
    const [lng, lat] = f.geometry.coordinates;
    _insertHotspot.run({
      snapshot_at:   snapshotAt,
      snapshot_date: snapshotDate,
      lat, lng,
      confidence: p.confidence || null,
      frp:        p.frp        ?? null,
      acq_date:   p.acq_date   || null,
      acq_time:   p.acq_time   || null,
      th_time:    p.th_time    || null,
      province:   p.changwat   || p.pv_en  || null,
      ap_en:      p.ap_en      || null,
      tb_en:      p.tb_en      || null,
      lu_name:    p.lu_hp_name || p.lu_name || null,
    });
  }
});

/* ── Config cache (invalidated on every write) ── */
let _cfgCache = null;

/* ── API response cache (TTL-based) ── */
const _cache     = new Map();
const _updatedAt = new Map(); // บันทึกเวลาที่ข้อมูลอัพเดทจริงๆ

// สำเนาข้อมูลล่าสุดที่ดึงสำเร็จ — ไม่มีวันหมดอายุ ใช้ตอบทันทีระหว่างรีเฟรชเบื้องหลัง
const _lastGood = new Map();

function getCached(key) {
  const e = _cache.get(key);
  if (!e || Date.now() > e.exp) { _cache.delete(key); return null; }
  return e.data;
}
function setCached(key, data, ttlMs) {
  _cache.set(key, { data, exp: Date.now() + ttlMs });
  _updatedAt.set(key, Date.now());
  _lastGood.set(key, data);
}

/* ── Single-flight: ถ้ามีคนกำลังดึง key เดียวกันอยู่ ให้รอผลก้อนเดียวกัน ──
   กันกรณี cache หมดอายุแล้วมีคนเปิดแดชบอร์ดพร้อมกัน 10 คน → ยิง MOPH 40 ครั้งรวด */
const _inflight = new Map();

function singleFlight(key, fn) {
  const running = _inflight.get(key);
  if (running) return running;
  const p = Promise.resolve().then(fn).finally(() => _inflight.delete(key));
  _inflight.set(key, p);
  return p;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

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

// บอกเวลาอัพเดทล่าสุดของแต่ละ data source
app.get('/api/data-status', (req, res) => {
  res.json({
    sheet_pm25:  _updatedAt.get('sheet-pm25')  || null,
    hotspot:     _updatedAt.get('hotspot')      || null,
    now:         Date.now(),
  });
});

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

    // บันทึกลง SQLite
    try { _saveSnapshot(features, new Date().toISOString()); } catch (_) {}

    res.json(data);
  } catch (e) {
    res.status(502).json({ ok: false, message: 'GISTDA API error: ' + e.message });
  }
});

// ดูสถิติ hotspot รายวันจาก DB
app.get('/api/hotspot-history', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT snapshot_date, COUNT(*) AS total,
        SUM(CASE WHEN confidence='high'    THEN 1 ELSE 0 END) AS high,
        SUM(CASE WHEN confidence='nominal' THEN 1 ELSE 0 END) AS nominal,
        SUM(CASE WHEN confidence='low'     THEN 1 ELSE 0 END) AS low
      FROM hotspot_log
      GROUP BY snapshot_date
      ORDER BY snapshot_date DESC
      LIMIT 90
    `).all();
    res.json({ ok: true, rows });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
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
    setCached('sheet-pm25', data, 5 * 60 * 1000); // 5 นาที
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

    // ใช้เฉพาะข้อมูลเวลา 07:00 น. เท่านั้น — ไม่ fallback real-time
    const list07 = list.filter(s => s.time.replace(':', '').startsWith('07'));
    if (!list07.length) return { name: pv.name, pm25: null, stations: [], timeSlot: null };

    const avg = list07.reduce((a, b) => a + b.pm25, 0) / list07.length;
    return { name: pv.name, pm25: +avg.toFixed(1), stations: list07, timeSlot: '07:00' };
  });

  const data = { ok: true, data: result, count: stations.length };
  setCached('air4thai', data, 30 * 60 * 1000); // 30 นาที
  res.json(data);
});

// โซน F — โรคเฝ้าระวัง (Hybrid):
//   • ปี 2568 (key '2025', แท่ง) ← Google Sheet เดิม (ข้อมูลย้อนหลังที่นิ่งแล้ว)
//   • ปี 2569 (key '2026', เส้น) ← MOPH Open Data API (opendata.moph.go.th เปิดให้เรียกแล้ว
//        ตั้งแต่ 18/08/2026 — ยืนยันด้วยการยิงจริงครบทั้ง 4 จังหวัด)
//        ถ้าเรียกไม่ผ่าน → fallback ไปชีต 2026 ที่ตัวเก็บข้อมูลฝั่งไทย (Apps Script) เติมไว้
//        เช็กว่าใช้ทางไหนอยู่ได้จาก meta.source ใน response ('moph' | 'sheet')
app.get('/api/sheet-disease', async (req, res) => {
  const cached = getCached('sheet-disease');
  if (cached) return res.json(cached);

  // cache หมดอายุแต่ยังมีข้อมูลเก่าอยู่ → ตอบของเก่าทันทีแล้วรีเฟรชเบื้องหลัง
  // ผู้ใช้ไม่ต้องรอ ~4 วินาที และ MOPH โดนยิงแค่ครั้งเดียวต่อรอบ (ผ่าน singleFlight)
  // ถ้าของเก่าเก่าเกินเกณฑ์ แบนเนอร์ "⚠️ ยังไม่อัปเดต N วัน" จะเตือนเองอยู่แล้ว
  const stale = _lastGood.get('sheet-disease');
  if (stale) {
    singleFlight('sheet-disease', buildDiseaseData)
      .catch(e => console.warn('รีเฟรชข้อมูลโรคเบื้องหลังไม่สำเร็จ:', e.message));
    return res.json(stale);
  }

  try {
    res.json(await singleFlight('sheet-disease', buildDiseaseData));
  } catch (e) {
    res.status(502).json({ ok: false, message: 'ดึงข้อมูลโรคไม่สำเร็จ: ' + e.message });
  }
});

// ประกอบข้อมูลโซน F หนึ่งรอบ (2568 จากชีต + 2569 จาก MOPH) แล้วเก็บลง cache
async function buildDiseaseData() {
  const { api } = readConfig();
  const id      = api.sheet_id;

  const [csv2025, moph2569] = await Promise.all([
    fetchCSV([`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=2025`]),
    fetchMophDisease('2569'),
  ]);

  // ถ้า MOPH ว่าง (พลาดชั่วขณะ) → fallback ไปชีต 2026 เดิม แล้ว cache สั้นๆ เพื่อ retry
  let year2026 = moph2569;
  let source   = 'moph';
  let ttl      = 6 * 60 * 60 * 1000;   // ได้ข้อมูลจริง → 6 ชม. (HDC อัปเดตวันละครั้ง)
  if (!year2026.length) {
    const csv2026 = await fetchCSV([`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=2026`]);
    year2026 = csv2026 ? parseDiseaseData(csv2026) : [];
    source   = 'sheet';
    ttl      = 15 * 60 * 1000;         // MOPH ยิงไม่ผ่าน → ใช้ชีต, cache สั้นๆ เพื่อรีบลองใหม่
  }

  // อายุข้อมูล — คำนวณจาก date_com ของ MOPH เอง ไม่ใช่เวลาที่ sync
  // จึงจับได้ทั้งกรณี "ตัวเก็บข้อมูลล่ม" และ "ต้นทางหยุดอัปเดต"
  const staleDays = Number(api.disease_stale_days) || 10;
  const age       = diseaseDataAge(year2026);

  const data = {
    ok:   true,
    2025: csv2025 ? parseDiseaseData(csv2025) : [],
    2026: year2026,
    meta: {
      source,                                    // 'moph' = ดึงสดได้ | 'sheet' = อ่าน cache จากชีต
      dataDate: age.dataDate,                    // D/M/YYYY (ค.ศ.) ตามที่อยู่ในคอลัมน์ "อัพเดท"
      ageDays:  age.ageDays,                     // null = ไม่มีวันที่ให้คำนวณ
      staleDays,
      stale:    age.ageDays !== null && age.ageDays > staleDays,
    },
  };
  setCached('sheet-disease', data, ttl);
  return data;
}

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
  const header = findHeaderRow(lines, 'date') || findHeaderRow(lines, 'time');
  if (!header) return { latest: {}, last7: [], allData: {} };

  const { idx: headerIdx, headers } = header;

  const byDate = {};

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols    = csvLine(lines[i]);
    const dateKey = isoDate(cols[0]);
    if (!dateKey.match(/\d{4}-\d{2}-\d{2}/)) break;

    // ถ้าวันนี้มีข้อมูลแล้ว ให้ข้ามแถวที่เหลือ (เอาแถวแรกของแต่ละวัน)
    if (byDate[dateKey]) continue;

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

/* ══════════════════════════════════════════
   MOPH OPEN DATA — โรคเฝ้าระวังผลกระทบ PM2.5
   ตาราง s_pm25_1_in_week : ผู้ป่วยรายสัปดาห์ ตามรหัสโรค (ICD-10)
══════════════════════════════════════════ */
const MOPH_DISEASE_API = 'https://opendata.moph.go.th/api/report_data';

// เลียนแบบ browser จริง ให้ผ่าน Cloudflare ของ MOPH (บล็อก UA ที่เป็น bot)
const MOPH_HEADERS = {
  'Content-Type':    'application/json',
  'Accept':          'application/json, text/plain, */*',
  'Accept-Language': 'th-TH,th;q=0.9,en;q=0.8',
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Origin':          'https://opendata.moph.go.th',
  'Referer':         'https://opendata.moph.go.th/',
};

// diag_main (bitmask) → หมวดโรคใน dashboard (ตรงกับ config.diseases[].key)
const MOPH_DIAG_GROUP = {
  2:    'ทางเดินหายใจ', // Chronic obstructive pulmonary disease (J44)
  4:    'ทางเดินหายใจ', // Acute asthma
  2048: 'ทางเดินหายใจ', // Acute asthma (J44.2)
  8:    'หัวใจ',        // Acute ischemic heart diseases (I21)
  16:   'หัวใจ',        // STEMI/NSTEMI (I22)
  4096: 'หัวใจ',        // Acute ischemic heart diseases (I24)
  32:   'ตาอักเสบ',     // Conjunctivitis (H10)
  64:   'ผิวหนัง',      // Eczema (L30.9)
  128:  'ผิวหนัง',      // Urticaria (L50)
};
const MOPH_CATS = ['ทางเดินหายใจ', 'หัวใจ', 'ตาอักเสบ', 'ผิวหนัง'];

// MOPH แบ่งหน้า: ไม่ส่ง limit จะได้แค่ 1000 แถวแรก (ขอนแก่นมี ~1,085 แถว/ปี → ตกหล่น)
const MOPH_PAGE_SIZE = 5000;
const MOPH_MAX_PAGES = 20;             // กันลูปไม่รู้จบถ้า total ที่ MOPH ส่งมาเพี้ยน
const MOPH_MAX_RETRY = 3;              // จำนวนครั้งที่ลองใหม่เมื่อโดน 429 / 5xx
const MOPH_GAP_MS    = 300;            // เว้นจังหวะระหว่างคำขอ ไม่ยิงรัวใส่ MOPH

// ยิง 1 คำขอ พร้อมลองใหม่เมื่อโดน rate-limit (429) หรือปลายทางไม่พร้อม (5xx)
async function mophPost(payload) {
  let last;
  for (let attempt = 0; attempt < MOPH_MAX_RETRY; attempt++) {
    last = await fetch(MOPH_DISEASE_API, {
      method:  'POST',
      headers: MOPH_HEADERS,
      body:    JSON.stringify(payload),
      signal:  AbortSignal.timeout(30000),
    });
    if (last.ok || (last.status !== 429 && last.status < 500)) return last;

    // เคารพ Retry-After ถ้า MOPH บอกมา ไม่งั้นถอยเป็นขั้น 2s → 4s → 8s (สูงสุด 30s)
    const hinted = Number(last.headers.get('retry-after'));
    const wait   = Math.min(hinted > 0 ? hinted * 1000 : 2000 * 2 ** attempt, 30000);
    console.warn(`MOPH ตอบ ${last.status} — รอ ${wait / 1000}s แล้วลองใหม่`);
    await sleep(wait);
  }
  return last;
}

// ดึงข้อมูลดิบของจังหวัดเดียวให้ครบทุกหน้า
// รูปแบบตอบกลับ: { data: [...], total, limit, offset } — รองรับ array เปล่าๆ เผื่อ API เปลี่ยนกลับ
async function fetchMophRows(beYear, pvIdn) {
  const rows = [];

  for (let page = 0; page < MOPH_MAX_PAGES; page++) {
    if (page > 0) await sleep(MOPH_GAP_MS);

    const r = await mophPost({
      tableName: 's_pm25_1_in_week',
      year:      String(beYear),
      province:  String(pvIdn),
      type:      'json',
      limit:     MOPH_PAGE_SIZE,
      offset:    page * MOPH_PAGE_SIZE,
    });
    if (!r.ok) break;                  // MOPH ตอบ 201 เมื่อสำเร็จ; อื่นๆ เอาเท่าที่ได้มา

    const body  = await r.json();
    const chunk = Array.isArray(body) ? body : (body?.data || []);
    rows.push(...chunk);

    const total = Array.isArray(body) ? chunk.length : Number(body?.total) || 0;
    if (chunk.length < MOPH_PAGE_SIZE || rows.length >= total) break;
  }

  return rows;
}

// ดึง+รวมยอดผู้ป่วยรายสัปดาห์ทุกจังหวัดในเขต สำหรับปี พ.ศ. ที่กำหนด
// คืนค่ารูปแบบเดียวกับ parseDiseaseData: [{ wk, <หมวดโรค>, อัพเดท }]
async function fetchMophDisease(beYear) {
  const { provinces } = readConfig();
  const acc  = {};   // acc[wk][cat] = ยอดรวม (w_NN_m)
  let maxDateCom = '';

  // ดึงทีละจังหวัด (sequential) เลี่ยงการยิงพร้อมกันจนโดน rate-limit ฝั่ง MOPH
  for (const [i, pv] of provinces.entries()) {
    if (i > 0) await sleep(MOPH_GAP_MS);

    let rows;
    try {
      rows = await fetchMophRows(beYear, pv.pv_idn);
    } catch (_) { continue; }          // จังหวัดใดพลาด ข้ามไป ไม่ทำให้ทั้งเขตล่ม

    for (const row of rows) {
      const cat = MOPH_DIAG_GROUP[row.diag_main];
      if (!cat) continue;
      if (row.date_com && String(row.date_com) > maxDateCom) maxDateCom = String(row.date_com);
      for (let w = 1; w <= 53; w++) {
        const v = row['w_' + String(w).padStart(2, '0') + '_m']; // _m = จำนวนที่เข้ารับบริการ
        if (typeof v === 'number' && v > 0) {
          if (!acc[w]) acc[w] = {};
          acc[w][cat] = (acc[w][cat] || 0) + v;
        }
      }
    }
  }

  // date_com = YYYYMMDDHHMM → DD/MM/YYYY (ค.ศ.) ให้ frontend +543 เอง
  const upd = /^\d{12}/.test(maxDateCom)
    ? `${+maxDateCom.slice(6, 8)}/${+maxDateCom.slice(4, 6)}/${maxDateCom.slice(0, 4)}`
    : '';

  const out = [];
  for (let w = 1; w <= 53; w++) {
    if (!acc[w]) continue;             // ข้ามสัปดาห์ที่ยังไม่มีข้อมูล
    const rec = { wk: w };
    for (const c of MOPH_CATS) rec[c] = acc[w][c] || 0;
    if (upd) rec['อัพเดท'] = upd;
    out.push(rec);
  }
  return out;
}

// อ่านค่าคอลัมน์ "อัพเดท" (= date_com ของ MOPH) แล้วคำนวณว่าข้อมูลเก่ากี่วัน
// รับได้ทั้ง ค.ศ. (2026 — รูปแบบที่ตัวเก็บข้อมูลเขียนลงชีต) และ พ.ศ. (2569 — เผื่อมีคนแก้ชีตเอง)
function diseaseDataAge(rows) {
  for (const row of rows || []) {
    const key = Object.keys(row).find(k =>
      k.includes('อัพเดท') || k.includes('อัปเดท') || k.toLowerCase().includes('update')
    );
    const raw = key ? String(row[key] || '').trim() : '';
    const m   = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) continue;

    let y = +m[3];
    if (y > 2400) y -= 543;
    const dt = new Date(Date.UTC(y, +m[2] - 1, +m[1]));
    if (isNaN(dt.getTime())) continue;

    const today = new Date();
    const utcToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    return { dataDate: raw, ageDays: Math.floor((utcToday - dt.getTime()) / 86400000) };
  }
  return { dataDate: '', ageDays: null };
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

/* ── Auto-refresh: ดึงข้อมูลจาก Sheet ทุก 5 นาทีในฝั่ง Server ── */
async function warmSheetCache() {
  try {
    const { api, provinces } = readConfig();
    const id  = api.sheet_id;
    const csv = await fetchCSV([
      `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=PM25_History`,
      `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=pm25_history`,
      `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=0`,
      `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`,
    ]);
    if (csv) {
      const data = { ok: true, ...parseSheetData(csv, provinces) };
      setCached('sheet-pm25', data, 5 * 60 * 1000);
      console.log(`[${new Date().toLocaleTimeString('th-TH')}] ✅ Sheet PM2.5 อัพเดทแล้ว`);
    }
  } catch (e) {
    console.warn('Auto-refresh sheet error:', e.message);
  }
}

/* ── Start ── */
app.listen(PORT, () => {
  console.log(`\n✅  PM2.5 Dashboard พร้อมใช้งาน`);
  console.log(`   Dashboard : http://localhost:${PORT}/index.html`);
  console.log(`   Admin     : http://localhost:${PORT}/admin.html\n`);

  // ดึงข้อมูลครั้งแรกทันที แล้ว loop ทุก 5 นาที
  warmSheetCache();
  setInterval(warmSheetCache, 5 * 60 * 1000);

  // โซน F — อุ่น cache ไว้ก่อนผู้ใช้เข้ามา แล้วรีเฟรชทุก 3 ชม. (cache อยู่ได้ 6 ชม.)
  // เท่ากับยิง MOPH วันละ ~8 รอบ (32 คำขอ) ไม่ว่าจะมีคนเปิดแดชบอร์ดกี่คน
  warmDiseaseCache();
  setInterval(warmDiseaseCache, 3 * 60 * 60 * 1000);
});

async function warmDiseaseCache() {
  try {
    const d = await singleFlight('sheet-disease', buildDiseaseData);
    console.log(`[${new Date().toLocaleTimeString('th-TH')}] ✅ ข้อมูลโรคอัพเดทแล้ว (${d.meta.source}, ${d.meta.dataDate || 'ไม่ทราบวันที่'})`);
  } catch (e) {
    console.warn('อุ่น cache ข้อมูลโรคไม่สำเร็จ:', e.message);
  }
}
