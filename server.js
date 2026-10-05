const express  = require('express');
const cors     = require('cors');
const fs       = require('fs');
const path     = require('path');
const Database = require('better-sqlite3');

/* ── โหลด .env เอง — start-server.bat เรียก `node server.js` ตรงๆ ไม่ผ่าน npm start
   ค่าที่ตั้งไว้ใน environment แล้ว (เช่นบน Render) จะไม่ถูกทับ ── */
const ENV_PATH = path.join(__dirname, '.env');
if (fs.existsSync(ENV_PATH)) process.loadEnvFile(ENV_PATH);

const app        = express();
const PORT       = process.env.PORT || 3000;
const CFG_PATH   = path.join(__dirname, 'config.json');

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

/* ── Config cache — config.json อ่านอย่างเดียว (ไม่มีหน้า Admin แล้ว) ── */
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
  _cfgCache = cfg;
  return cfg;
}
/* ── GeoJSON memory cache ── */
let _geojsonCache = null;

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
app.use(express.static(__dirname));

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

/* ── PM2.5 รายจังหวัด/อำเภอ/ตำบล + คาดการณ์ 3 วัน จาก GISTDA ──────────
   แหล่ง: pm25.gistda.or.th/rest (สาธารณะ ไม่ใช้ key) — ค่าประมาณจากดาวเทียม
   ไม่ใช่ค่าสถานี Air4Thai จึงไม่ตรงกับชีต PM25_History ต้องระบุแหล่งที่หน้าเว็บ
   pm25 = ค่ารายชั่วโมงล่าสุด · avg24 = เฉลี่ย 24 ชม. · pred = คาดการณ์ 3 วันถัดไป */
const GISTDA_PM25 = 'https://pm25.gistda.or.th/rest';
const GISTDA_PM25_TTL = 30 * 60 * 1000;   // GISTDA อัปเดตรายชั่วโมง 30 นาทีพอ

async function gistdaPm25(path, cacheKey) {
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const r = await fetch(`${GISTDA_PM25}/${path}`);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  if (j.status !== 200 || !Array.isArray(j.data)) throw new Error(j.errMsg || 'รูปแบบข้อมูลไม่ถูกต้อง');
  const r1 = round1;
  const items = j.data.map(d => ({
    code:  String(d.tb_idn ?? d.ap_idn ?? d.pv_idn),
    name:  d.tb_tn ?? d.ap_tn ?? d.pv_tn,
    pm25:  r1(d.pm25),
    avg24: r1(d.pm25Avg24hr),
    pred:  [r1(d.pred1), r1(d.pred2), r1(d.pred3)],
  }));
  const data = {
    ok: true, source: 'GISTDA (ค่าประมาณจากดาวเทียม)',
    asOf: gistdaTime(j.data[0]?.dt), asOfThai: j.datetimeThai ? `${j.datetimeThai.dateThai} ${j.datetimeThai.timeThai}` : null,
    items,
  };
  setCached(cacheKey, data, GISTDA_PM25_TTL);
  return data;
}
// "2026-10-05T14:00:00.000Z" ของ GISTDA เป็นเวลาไทยที่ติด Z มา — ตัดเป็นข้อความตรงๆ ไม่แปลงเขตเวลา
const gistdaTime = s => (typeof s === 'string' ? s.slice(0, 16).replace('T', ' ') : null);
const round1 = v => (typeof v === 'number' && isFinite(v)) ? Math.round(v * 10) / 10 : null;

/* ── ค่ารายวันย้อนหลังจาก GISTDA (CSV) ──────────────────────────────
   getPM25by1m{Amphoe|Tambon}AsCSV?dt1=D&id=X → ค่าเฉลี่ยรายวันวันที่ D-30..D
   ของทุกอำเภอ (id=รหัสจังหวัด) หรือทุกตำบล (id=รหัสอำเภอ) · มีข้อมูลตั้งแต่ 2024-01-01
   CSV ไม่มีรหัสพื้นที่ มีแต่ชื่อ → จับคู่กับ Pred3 ด้วยชื่อ (มาจาก GISTDA เหมือนกัน) */
const addDays   = (s, n) => new Date(Date.parse(s + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const thaiToday = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);   // Render รันเป็น UTC

async function gistdaDaily(level, id, dt1, ttl) {
  const key = `gistda-1m-${level}-${id}-${dt1}`;
  const cached = getCached(key);
  if (cached) return cached;
  const r = await fetch(`${GISTDA_PM25}/getPM25by1m${level}AsCSV?dt1=${dt1}&id=${id}`);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  // Amphoe: จังหวัด,อำเภอ,PM2.5,วันที่ · Tambon: จังหวัด,อำเภอ,ตำบล,PM2.5,วันที่ → อ่านจากท้ายแถว
  const rows = (await r.text()).replace(/^﻿/, '').trim().split(/\r?\n/).slice(1).map(l => {
    const c = l.split(',');
    return { name: (c[c.length - 3] || '').trim(), v: +c[c.length - 2], date: (c[c.length - 1] || '').trim() };
  }).filter(x => x.name && isFinite(x.v) && /^\d{4}-\d{2}-\d{2}$/.test(x.date));
  setCached(key, rows, ttl);
  return rows;
}

// ฤดูฝุ่น พ.ย.–พ.ค. — อยู่ในฤดู = ตั้งแต่ 1 พ.ย. ถึงวันนี้ · มิ.ย.–ต.ค. = ฤดูที่เพิ่งจบ
function dustSeason(today) {
  const y = +today.slice(0, 4), m = +today.slice(5, 7), off = m >= 6 && m <= 10;
  const sy = m >= 11 ? y : y - 1;
  return { start: `${sy}-11-01`, end: off ? `${y}-05-31` : today, ongoing: !off,
           label: `พ.ย. ${sy + 543} – พ.ค. ${sy + 544}` };
}

// ค่ารายวันสูงสุดของฤดู ต่อพื้นที่ — ดึงทีละช่วง 31 วันจนครบฤดู (~7 คำขอ)
async function seasonMax(level, id) {
  const s = dustSeason(thaiToday());
  const ends = [];
  for (let d = addDays(s.start, 30); d < s.end; d = addDays(d, 31)) ends.push(d);
  ends.push(s.end);
  const ttl = s.ongoing ? 3 * 3600e3 : 24 * 3600e3;   // ฤดูที่จบแล้วค่าไม่เปลี่ยน
  const sets = await Promise.all(ends.map(d => gistdaDaily(level, id, d, ttl)));
  const max = new Map();
  for (const rows of sets) for (const x of rows) {
    if (x.date < s.start || x.date > s.end) continue;
    const m = max.get(x.name);
    if (!m || x.v > m.v) max.set(x.name, { v: round1(x.v), date: x.date });
  }
  return { season: { start: s.start, end: s.end, label: s.label, ongoing: s.ongoing }, max };
}

// ค่าเฉลี่ยรายวัน 3 วันก่อนหน้า (ไม่รวมวันนี้ซึ่งยังไม่ครบวัน)
async function recent3(level, id) {
  const today = thaiToday(), days = [3, 2, 1].map(n => addDays(today, -n));
  const rows = await gistdaDaily(level, id, today, GISTDA_PM25_TTL);
  const by = new Map();
  for (const x of rows) if (days.includes(x.date)) {
    if (!by.has(x.name)) by.set(x.name, {});
    by.get(x.name)[x.date] = round1(x.v);
  }
  return { days, by };
}

// รวม: ค่าปัจจุบัน + คาดการณ์ (Pred3) + ย้อนหลัง 3 วัน + สูงสุดของฤดู
// ประวัติดึงไม่ได้ก็ยังตอบค่าปัจจุบัน — ไม่ให้ทั้งแผงล่มเพราะ CSV ตัวเดียว
async function areaDetail(predPath, predKey, level, id) {
  const [base, rec, sea] = await Promise.all([
    gistdaPm25(predPath, predKey),
    recent3(level, id).catch(e => { console.warn('GISTDA recent3:', e.message); return null; }),
    seasonMax(level, id).catch(e => { console.warn('GISTDA seasonMax:', e.message); return null; }),
  ]);
  return {
    ...base,
    days: rec?.days ?? [],
    season: sea?.season ?? null,
    items: base.items.map(it => ({
      ...it,
      past: rec ? rec.days.map(d => rec.by.get(it.name)?.[d] ?? null) : [],
      max:  sea?.max.get(it.name) ?? null,
    })),
  };
}

// เฉพาะจังหวัดในเขต (config.provinces) — กันใช้ endpoint นี้เป็น proxy ทั้งประเทศ
const regionPv = () => new Set(readConfig().provinces.map(p => String(p.pv_idn)));

app.get('/api/pm25/provinces', async (req, res) => {
  try {
    const data = await gistdaPm25('getPm25byProvincePred3', 'gistda-pv');
    const pv = regionPv();
    res.json({ ...data, items: data.items.filter(i => pv.has(i.code)) });
  } catch (e) {
    res.status(502).json({ ok: false, message: 'GISTDA PM2.5 error: ' + e.message });
  }
});

app.get('/api/pm25/districts', async (req, res) => {
  const pv = String(req.query.pv || '');
  if (!regionPv().has(pv)) return res.status(400).json({ ok: false, message: 'pv ต้องเป็นรหัสจังหวัดในเขต' });
  try {
    res.json(await areaDetail(`getPm25byAmphoePred3?pv_idn=${pv}`, 'gistda-ap-' + pv, 'Amphoe', pv));
  } catch (e) {
    res.status(502).json({ ok: false, message: 'GISTDA PM2.5 error: ' + e.message });
  }
});

app.get('/api/pm25/subdistricts', async (req, res) => {
  const amp = String(req.query.amp || '');
  if (!/^\d{4}$/.test(amp) || !regionPv().has(amp.slice(0, 2)))
    return res.status(400).json({ ok: false, message: 'amp ต้องเป็นรหัสอำเภอ 4 หลักในเขต' });
  try {
    res.json(await areaDetail(`getPm25byTambonPred3?ap_idn=${amp}`, 'gistda-tb-' + amp, 'Tambon', amp));
  } catch (e) {
    res.status(502).json({ ok: false, message: 'GISTDA PM2.5 error: ' + e.message });
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
//        + ชีต 2026 ที่ตัวเก็บข้อมูลฝั่งไทย (Apps Script) เติมไว้ — ดึงทั้งคู่แล้วใช้ตัวที่ "อัพเดท" ใหม่กว่า
//        (ต.ค. 2569: ตาราง MOPH ค้างที่ 25/8 แต่ชีตยังอัปเดตทุกวัน → ถ้าใช้ MOPH อย่างเดียวจะค้างไปด้วย)
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

  const [csv2025, moph2569, csv2026, csvStatus] = await Promise.all([
    fetchCSV([`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=2025`]),
    fetchMophDisease('2569'),
    fetchCSV([`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=2026`]),
    fetchCSV([`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=_sync_status`]),
  ]);
  const sheet2569 = csv2026 ? parseDiseaseData(csv2026) : [];

  // สัปดาห์ที่ LINE OA รายงาน (trimToStableWeeks_ ใน Apps Script เขียนไว้ที่ _sync_status.report_week)
  // ใช้จุดตัดเดียวกันทั้ง LINE และหน้าเว็บ — ไม่มี/อ่านไม่ได้ → หน้าเว็บถอยไปใช้ "สัปดาห์รองสุดท้าย" เหมือนเดิม
  let reportWeek = null;
  for (const line of (csvStatus || '').split('\n')) {
    const [k, v] = csvLine(line).map(s => s.replace(/"/g, ''));
    if (k === 'report_week' && /^\d{1,2}$/.test(v)) reportWeek = Number(v);
  }

  // ใช้แหล่งที่อัพเดทใหม่กว่า (ageDays น้อยกว่า) — เท่ากันหรือเทียบไม่ได้ให้ MOPH ชนะ
  const mophAge  = diseaseDataAge(moph2569).ageDays;
  const sheetAge = diseaseDataAge(sheet2569).ageDays;
  const useSheet = !moph2569.length ||
    (sheet2569.length && sheetAge !== null && (mophAge === null || sheetAge < mophAge));

  let year2026 = useSheet ? sheet2569 : moph2569;
  let source   = useSheet ? 'sheet' : 'moph';
  let ttl      = useSheet ? 60 * 60 * 1000       // ชีตใหม่กว่า → 1 ชม. (Apps Script เติมวันละครั้ง)
                          : 6 * 60 * 60 * 1000;  // MOPH → 6 ชม. (HDC อัปเดตวันละครั้ง)
  if (!moph2569.length) ttl = 15 * 60 * 1000;    // MOPH ยิงไม่ผ่าน → cache สั้นๆ เพื่อรีบลองใหม่

  // อายุข้อมูล — คำนวณจาก date_com ของ MOPH เอง ไม่ใช่เวลาที่ sync
  // จึงจับได้ทั้งกรณี "ตัวเก็บข้อมูลล่ม" และ "ต้นทางหยุดอัปเดต"
  const staleDays = Number(api.disease_stale_days) || 10;
  const age       = diseaseDataAge(year2026);

  const data = {
    ok:   true,
    2025: csv2025 ? parseDiseaseData(csv2025) : [],
    2026: year2026,
    meta: {
      source,                                    // 'moph' | 'sheet' = แหล่งที่อัพเดทใหม่กว่า
      // จุดตัดของ LINE คำนวณจากข้อมูลชีต → ใช้ได้เฉพาะตอนแสดงข้อมูลชีต
      reportWeek: useSheet ? reportWeek : null,
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
  console.log(`   Dashboard : http://localhost:${PORT}/\n`);

  // ดึงข้อมูลครั้งแรกทันที แล้ว loop ทุก 5 นาที
  warmSheetCache();
  setInterval(warmSheetCache, 5 * 60 * 1000);

  // โซน F — อุ่น cache ไว้ก่อนผู้ใช้เข้ามา แล้วรีเฟรชทุก 3 ชม. (cache อยู่ได้ 6 ชม.)
  // เท่ากับยิง MOPH วันละ ~8 รอบ (32 คำขอ) ไม่ว่าจะมีคนเปิดแดชบอร์ดกี่คน
  warmDiseaseCache();
  setInterval(warmDiseaseCache, 3 * 60 * 60 * 1000);

  // เจาะลึกรายอำเภอ — สถิติทั้งฤดูต้องดึง CSV ~8 ไฟล์/จังหวัด (ครั้งแรก ~10 วินาที)
  // อุ่นไว้ทีละจังหวัดตอนเปิด server และทุก 3 ชม. คนกดดูจะได้ไม่ต้องรอ
  const warmDistricts = async () => {
    for (const p of readConfig().provinces) {
      const pv = String(p.pv_idn);
      try { await areaDetail(`getPm25byAmphoePred3?pv_idn=${pv}`, 'gistda-ap-' + pv, 'Amphoe', pv); }
      catch (e) { console.warn('warm districts', pv, e.message); }
    }
  };
  setTimeout(warmDistricts, 15 * 1000);
  setInterval(warmDistricts, 3 * 60 * 60 * 1000);
});

async function warmDiseaseCache() {
  try {
    const d = await singleFlight('sheet-disease', buildDiseaseData);
    console.log(`[${new Date().toLocaleTimeString('th-TH')}] ✅ ข้อมูลโรคอัพเดทแล้ว (${d.meta.source}, ${d.meta.dataDate || 'ไม่ทราบวันที่'})`);
  } catch (e) {
    console.warn('อุ่น cache ข้อมูลโรคไม่สำเร็จ:', e.message);
  }
}
