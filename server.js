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

/* ── C5: ปัจจัยอากาศประกอบค่าคาดการณ์ 3 วัน ─────────────────────────────
   แบบจำลอง สคร.7 (ฤดูฝุ่น 68/69, n≈400 จังหวัด-วัน · OLS cluster-robust):
     log(PM) = 0.551·log(PM เมื่อวาน) − 0.232·log(การระบายอากาศ) − 0.0165·ความชื้น + …
   แนวโน้มของวัน D = ผลรวมของการเปลี่ยนการระบายอากาศ/ความชื้น เทียบวันก่อนหน้า
     ≥ +10% → 1 (เอื้อต่อการสะสม) · ≤ −10% → −1 (เอื้อต่อการเจือจาง) · อื่น ๆ → 0
   การระบายอากาศ (vr) = เฉลี่ย 24 ชม. (08:00 วันก่อน – 07:00 วัน D) ของ ความสูงชั้นผสม × ความเร็วลม 10 ม.
   แหล่ง: Open-Meteo (ไม่ใช้ key) · จุดความร้อน: GISTDA VIIRS 24 ชม. ล่าสุด รัศมี 200 กม. (เฉพาะในไทย)          */
const C5_COEF = { lvr: -0.2316, rh: -0.0165 };
const C5_CENT = { 'ขอนแก่น': [16.43, 102.83], 'มหาสารคาม': [16.18, 103.30], 'ร้อยเอ็ด': [16.05, 103.65], 'กาฬสินธุ์': [16.43, 103.51] };
const WD_TH = ['เหนือ', 'ตะวันออกเฉียงเหนือ', 'ตะวันออก', 'ตะวันออกเฉียงใต้', 'ใต้', 'ตะวันตกเฉียงใต้', 'ตะวันตก', 'ตะวันตกเฉียงเหนือ'];
const kmBetween = (a, b) => { const r = Math.PI / 180, dl = (b[0] - a[0]) * r, dn = (b[1] - a[1]) * r;
  return 2 * 6371 * Math.asin(Math.sqrt(Math.sin(dl / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dn / 2) ** 2)); };

// กันยิงซ้ำตอนโดน 429: พักแบบ exponential backoff + jitter (ฐาน 15 นาที เพดาน 60 นาที)
const c5Retry = { n: 0, until: 0 };
const jittered = ms => ms * (0.5 + Math.random() * 0.5);

/* เก็บข้อมูลดิบ Open-Meteo ลงไฟล์ — รีสตาร์ท/ดีพลอยแล้วยังมีปัจจัยอากาศใช้ได้ระหว่างรอ API (ไม่เกิน 24 ชม.) */
const C5_FILE = process.env.C5_LAST_FILE || path.join(__dirname, 'c5-wx-lastgood.json');
const C5_MAX_AGE = 24 * 3600e3;
let c5RawLast = null;
function saveC5Raw(raw) {
  c5RawLast = raw;
  try { fs.writeFileSync(C5_FILE, JSON.stringify({ savedAt: Date.now(), raw })); }
  catch (e) { console.warn('บันทึก c5-wx ลงไฟล์ไม่ได้:', e.message); }
}
function loadC5Raw() {
  try { const f = JSON.parse(fs.readFileSync(C5_FILE, 'utf8')); return Date.now() - f.savedAt <= C5_MAX_AGE ? f.raw : null; }
  catch { return null; }
}

async function c5Fetch() {   // ดึงข้อมูลดิบจาก Open-Meteo (ไม่มี cache)
  const names = Object.keys(C5_CENT);
  const q = new URLSearchParams({ latitude: names.map(n => C5_CENT[n][0]).join(','), longitude: names.map(n => C5_CENT[n][1]).join(','),
    hourly: 'boundary_layer_height,wind_speed_10m,wind_direction_10m,relative_humidity_2m,precipitation',
    wind_speed_unit: 'ms', timezone: 'Asia/Bangkok', past_days: '1', forecast_days: '5' });
  const r = await fetch('https://api.open-meteo.com/v1/forecast?' + q, { signal: AbortSignal.timeout(12000) });
  if (r.status === 429) {
    c5Retry.n++;
    const wait = Math.min(60 * 60e3, jittered(15 * 60e3 * 2 ** (c5Retry.n - 1)));
    c5Retry.until = Date.now() + wait;
    console.warn(`Open-Meteo 429 (ครั้งที่ ${c5Retry.n}) retry-after=${r.headers.get('retry-after') ?? '-'} พัก ${Math.round(wait / 60e3)} นาที`);
    throw new Error('Open-Meteo HTTP 429');
  }
  if (!r.ok) throw new Error('Open-Meteo HTTP ' + r.status);
  c5Retry.n = 0; c5Retry.until = 0;
  const j = await r.json();
  return Array.isArray(j) ? j : [j];
}

async function c5Weather() {
  const cached = getCached('c5-wx'); if (cached) return cached;
  let raw;
  try {
    if (Date.now() < c5Retry.until) throw new Error('Open-Meteo อยู่ในช่วงพัก (429 ก่อนหน้า)');
    raw = await c5Fetch();
    saveC5Raw(raw);
  } catch (e) {   // ดึงไม่ได้ → ใช้ค่าล่าสุดที่เก็บไว้ (หน่วยความจำ หรือไฟล์) ถ้ามี
    raw = c5RawLast ?? loadC5Raw();
    if (!raw) throw e;
    console.warn('C5 อากาศ: ใช้ค่าล่าสุดที่เก็บไว้ —', e.message);
  }
  const out = buildC5(raw);
  setCached('c5-wx', out, 65 * 60 * 1000);   // 65 นาที > รอบ warmer (60 ±5) เพื่อไม่ให้ cache หมดก่อนรอบถัดไป
  return out;
}

function buildC5(j) {
  const names = Object.keys(C5_CENT);
  const out = {};
  names.forEach((n, i) => {
    const h = j[i]?.hourly || {}, idx = {};
    (h.time || []).forEach((t, k) => idx[t] = k);   // 'YYYY-MM-DDTHH:00' เวลาไทย
    out[n] = d => {   // ปัจจัยของวัน d (หน้าต่าง 08:00 วันก่อน – 07:00 วัน d)
      const prev = addDaysIso(d, -1), ks = [];
      for (let x = 8; x <= 23; x++) ks.push(idx[`${prev}T${String(x).padStart(2, '0')}:00`]);
      for (let x = 0; x <= 7; x++) ks.push(idx[`${d}T${String(x).padStart(2, '0')}:00`]);
      const ok = ks.filter(k => k != null && h.boundary_layer_height?.[k] != null && h.wind_speed_10m?.[k] != null);
      if (ok.length < 18) return null;
      const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
      const vr = mean(ok.map(k => h.boundary_layer_height[k] * h.wind_speed_10m[k]));
      const rh = mean(ok.map(k => h.relative_humidity_2m?.[k]).filter(v => v != null));
      const rain = ok.map(k => h.precipitation?.[k] || 0).reduce((s, v) => s + v, 0);
      const u = mean(ok.map(k => -h.wind_speed_10m[k] * Math.sin(h.wind_direction_10m[k] * Math.PI / 180)));
      const v = mean(ok.map(k => -h.wind_speed_10m[k] * Math.cos(h.wind_direction_10m[k] * Math.PI / 180)));
      const from = (Math.atan2(-u, -v) * 180 / Math.PI + 360) % 360;
      return { vr: Math.round(vr), rh: Math.round(rh), rain: Math.round(rain * 10) / 10, wd: WD_TH[Math.round(from / 45) % 8] };
    };
  });
  return out;
}

async function c5Hotspots200() {
  const cached = getCached('c5-hs'); if (cached) return cached;
  const { api } = readConfig(); if (!api.gistda_key) throw new Error('ไม่มี GISTDA_KEY');
  const BASE = 'https://api-gateway.gistda.or.th/api/2.0/resources/features/viirs/1day';
  const pts = [];
  for (let off = 0, page = 0; page < 10; page++, off += 1000) {
    const r = await fetch(`${BASE}?api_key=${api.gistda_key}&limit=1000&offset=${off}`, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error('GISTDA HTTP ' + r.status);
    const f = (await r.json()).features || [];
    for (const x of f) { const c = x.geometry?.coordinates; if (c) pts.push([c[1], c[0]]); }
    if (f.length < 1000) break;
  }
  const out = {};
  for (const [n, c] of Object.entries(C5_CENT)) out[n] = pts.filter(p => kmBetween(c, p) <= 200).length;
  setCached('c5-hs', out, 60 * 60 * 1000);
  return out;
}

// เติม trend/fac ให้รายการจังหวัด (ถ้าดึงปัจจัยไม่ได้ ก็คืนค่าคาดการณ์ GISTDA ตามเดิม)
async function withC5(data) {
  const base = String(data.asOf || '').slice(0, 10) || bkkDate();
  const [wx, hs] = await Promise.allSettled([singleFlight('c5-wx', c5Weather), c5Hotspots200()]);
  if (wx.status !== 'fulfilled') { console.warn('C5 อากาศ:', wx.reason?.message); return data; }
  return { ...data, c5: { model: 'สคร.7 ฤดูฝุ่น 68/69', hsNote: 'จุดความร้อน 24 ชม. ล่าสุด รัศมี 200 กม. (เฉพาะในไทย)' }, items: data.items.map(it => {
    const fn = wx.value[it.name]; if (!fn) return it;
    const days = [0, 1, 2, 3].map(k => fn(addDaysIso(base, k)));   // วันนี้ + 3 วันที่คาดการณ์
    const trend = [1, 2, 3].map(k => {
      const a = days[k - 1], b = days[k]; if (!a || !b) return null;
      const dl = C5_COEF.lvr * Math.log(b.vr / Math.max(a.vr, 1)) + C5_COEF.rh * (b.rh - a.rh);
      const pct = Math.exp(dl) - 1; return pct >= 0.10 ? 1 : pct <= -0.10 ? -1 : 0;
    });
    const fac = [1, 2, 3].map((k, i) => days[k] ? { ...days[k], hs200: i === 0 && hs.status === 'fulfilled' ? hs.value[it.name] ?? null : null } : null);
    return { ...it, trend, fac };
  }) };
}

app.get('/api/pm25/provinces', async (req, res) => {
  try {
    const data = await gistdaPm25('getPm25byProvincePred3', 'gistda-pv');
    const pv = regionPv();
    res.json(await withC5({ ...data, items: data.items.filter(i => pv.has(i.code)) }));
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
  if (!csv) {
    const stale = _lastGood.get('sheet-pm25');   // ดึง Sheet ไม่ได้ชั่วคราว → ตอบชุดล่าสุดที่เคยได้ แทนที่จะให้กราฟว่าง
    if (stale) return res.json(stale);
    return res.status(403).json({
      ok: false,
      message: 'กรุณาเปิดการแชร์ Google Sheet: File → Share → Publish to web → CSV',
    });
  }
  try {
    const data = { ok: true, ...parseSheetData(csv, provinces) };
    setCached('sheet-pm25', data, 5 * 60 * 1000); // 5 นาที
    res.json(data);
  } catch (e) {
    const stale = _lastGood.get('sheet-pm25');
    if (stale) return res.json(stale);
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

  // ทั้ง MOPH (ไม่ครบจังหวัด) และชีตใช้ไม่ได้ แต่มีชุดเดิมที่ครบอยู่แล้ว → คงชุดเดิมไว้ ไม่เอาค่าว่างไปทับ
  if (!moph2569.length && !sheet2569.length && _lastGood.has('sheet-disease')) {
    throw new Error('MOPH ไม่ครบจังหวัด (' + (moph2569.missing || []).join(', ') + ') และอ่านชีตไม่ได้ — ใช้ข้อมูลชุดเดิม');
  }

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
      mophMissing: moph2569.missing || [],       // จังหวัดที่ดึงจาก MOPH ไม่ได้รอบนี้ (ว่าง = ครบ 4 จังหวัด)
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
   ผู้ป่วยรายจังหวัด (โซน E2) — s_pm25_2_in_week
   ตัวตั้ง = ผู้ป่วยที่อยู่อาศัยจริงในจังหวัด (TYPEAREA 1 และ 3) ตัดซ้ำรายคน/สัปดาห์ (w_NN_m)
   ตัวหาร = ประชากร Type 1+3 กลางปี (config.population) → คิดอัตราต่อแสนได้ถูกคู่
   แหล่งหลัก  = แท็บ "latest" ในชีต — ตัวเก็บภาพข้อมูล (moph_snapshot_to_sheet.gs ทุกวัน 07:00)
                ดึงจาก MOPH แล้วรวมเป็นจังหวัด × สัปดาห์ × กลุ่มโรค ไว้แล้ว (~600 แถว อ่านเร็ว)
   แหล่งสำรอง = MOPH ตรง — ตารางนี้ใหญ่มาก (ขอนแก่น ~12,000 แถว × 218 คอลัมน์ ≈ 37 MB)
                จาก Render ใช้เวลานานหลายนาที จึงใช้เฉพาะเมื่อชีตไม่ครบทุกจังหวัด
══════════════════════════════════════════ */
const PV_KEY = { 'ทางเดินหายใจ': 'resp', 'หัวใจ': 'heart', 'ตาอักเสบ': 'eye', 'ผิวหนัง': 'skin' };

// รวมเป็นแถว { wk, pv, resp, heart, eye, skin } — สัปดาห์ที่ไม่มีผู้ป่วยในกลุ่มนั้นใส่ 0 (ไม่ใช่ว่าง)
function pvRowsFrom(acc) {
  const rows = [];
  for (const [pv, wks] of Object.entries(acc)) {
    const maxWk = Math.max(0, ...Object.keys(wks).map(Number));
    for (let w = 1; w <= maxWk; w++) rows.push({ wk: w, pv, resp: 0, heart: 0, eye: 0, skin: 0, ...(wks[w] || {}) });
  }
  return rows;
}

async function diseasePvFromMoph(beYear) {
  const { provinces } = readConfig();
  const { got, missing } = await fetchMophAllProvinces(beYear, 's_pm25_2_in_week');
  if (!got) return { rows: [], missing };
  const acc = {}; let maxDateCom = '';
  for (const pv of provinces) {
    const agg = got.get(pv.pv_idn), a = acc[pv.name] = {};
    if (agg.dateCom > maxDateCom) maxDateCom = agg.dateCom;
    for (const [w, cats] of Object.entries(agg.wk))
      for (const [cat, v] of Object.entries(cats)) { const key = PV_KEY[cat]; if (key) (a[w] ||= {})[key] = (a[w][key] || 0) + v; }
  }
  return { rows: pvRowsFrom(acc), dateCom: maxDateCom, missing: [] };
}

// date_com จากชีต → YYYYMMDDHHMM · ชีตอาจแปลงข้อความเป็นวันที่แล้วส่งออกตามรูปแบบภาษา
// รับ: 202610090618 · 2026-10-09 06:18[:00] · 9/10/2026 6:18[:00] (ไทย: วัน/เดือน/ปี) · ปี พ.ศ.
function sheetDateCom(v) {
  const s = String(v || '').trim(), p2 = n => String(n).padStart(2, '0');
  let m;
  if ((m = s.match(/^(\d{12})/))) return m[1];
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/)) ||
      (m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/))) {
    let [y, mo, d] = s.includes('/') ? [+m[3], +m[2], +m[1]] : [+m[1], +m[2], +m[3]];
    if (y > 2400) y -= 543;
    return `${y}${p2(mo)}${p2(d)}${p2(m[4] || 0)}${p2(m[5] || 0)}`;
  }
  return '';
}

// แหล่งหลัก: แท็บ latest (snapshot_at, date_com, b_year, table, pv_code, pv_name, wk, group, m, ...)
async function diseasePvFromSheet(beYear) {
  const { api, provinces } = readConfig();
  const csv = await fetchCSV([`https://docs.google.com/spreadsheets/d/${api.sheet_id}/gviz/tq?tqx=out:csv&sheet=latest`]);
  if (!csv) return { rows: [] };
  const lines = csv.split('\n').filter(l => l.trim());
  const head  = csvLine(lines[0] || '').map(c => c.replace(/"/g, ''));
  const ix    = n => head.indexOf(n);
  const [iT, iY, iP, iW, iG, iM, iD] = ['table', 'b_year', 'pv_name', 'wk', 'group', 'm', 'date_com'].map(ix);
  if ([iT, iY, iP, iW, iG, iM].some(i => i < 0)) return { rows: [] };
  const names = new Set(provinces.map(p => p.name));
  const acc = {}, acc1 = {}; let maxDateCom = '';   // acc = s_pm25_2 (Type 1+3) · acc1 = s_pm25_1 (ทุกคนที่มารับบริการ · ใช้ในชุดดาวน์โหลด)
  for (const line of lines.slice(1)) {
    const c = csvLine(line).map(x => x.replace(/"/g, ''));
    const t1 = c[iT] === 's_pm25_1_in_week';
    if ((c[iT] !== 's_pm25_2_in_week' && !t1) || String(c[iY]) !== String(beYear) || !names.has(c[iP])) continue;
    const key = PV_KEY[c[iG]], w = Number(c[iW]), v = Number(String(c[iM]).replace(/,/g, ''));
    if (!key || !w || !(v >= 0)) continue;
    const a = (t1 ? acc1 : acc)[c[iP]] ||= {};
    (a[w] ||= {})[key] = (a[w][key] || 0) + v;
    const dc = sheetDateCom(c[iD]);
    if (dc > maxDateCom) maxDateCom = dc;
  }
  if (Object.keys(acc).length < provinces.length) return { rows: [] };   // ชีตต้องครบทุกจังหวัดเช่นกัน
  return { rows: pvRowsFrom(acc), rows1: Object.keys(acc1).length === provinces.length ? pvRowsFrom(acc1) : [], dateCom: maxDateCom };
}

async function buildDiseasePv() {
  const { population, api } = readConfig();
  const beYear = String(population?.year_be || 2569);
  let src = await diseasePvFromSheet(beYear).catch(e => (console.warn('อ่านแท็บ latest ไม่ได้:', e.message), { rows: [] }));
  let source = 'sheet', missing = [];
  if (!src.rows.length) {
    console.warn('แท็บ latest ไม่ครบทุกจังหวัด — ดึงจาก MOPH ตรง (อาจใช้เวลาหลายนาที)');
    src = await diseasePvFromMoph(beYear); source = 'moph'; missing = src.missing || [];
  }
  if (!src.rows.length) throw new Error('แท็บ latest ไม่ครบ และ MOPH ไม่ครบจังหวัด (' + missing.join(', ') + ')');

  const dataDate = dateComToDmy(src.dateCom || '');
  const staleDays = Number(api.disease_stale_days) || 10;
  const age = diseaseDataAge(dataDate ? [{ 'อัพเดท': dataDate }] : []);
  const data = {
    ok: true, mock: false,
    pop: population.midyear, popNote: population.label, popMethod: population.method,
    rows: src.rows, rows1: src.rows1 || [], dateCom: src.dateCom || '',
    meta: { source, mophMissing: missing, dataDate, ageDays: age.ageDays, staleDays,
            stale: age.ageDays !== null && age.ageDays > staleDays },
  };
  setCached('disease-pv', data, 60 * 60 * 1000);   // 1 ชม. — ชีตอัปเดตวันละครั้ง อ่านซ้ำได้ถูก ๆ
  return data;
}

app.get('/api/disease-pv', async (req, res) => {
  const cached = getCached('disease-pv');
  if (cached) return res.json(cached);
  const stale = _lastGood.get('disease-pv');          // มีชุดเดิม → ตอบทันที แล้วรีเฟรชเบื้องหลัง
  if (stale) {
    singleFlight('disease-pv', buildDiseasePv).catch(e => console.warn('รีเฟรชข้อมูลรายจังหวัดไม่สำเร็จ:', e.message));
    return res.json(stale);
  }
  try {
    res.json(await singleFlight('disease-pv', buildDiseasePv));
  } catch (e) {
    res.status(502).json({ ok: false, message: 'ดึงข้อมูลผู้ป่วยรายจังหวัดไม่สำเร็จ: ' + e.message });
  }
});

/* ══════════════════════════════════════════
   PHEOC — เกณฑ์เดียวกับ LINE (tools/line_report.gs)
   ค่าเฉลี่ย 24 ชม. ณ 07:00 น. (Air4Thai รายชั่วโมง) ถึงเกณฑ์ติดกัน N วัน
   ไม่ใช้ค่าในชีต PM25_History เพราะชีตเก็บค่ารอบบ่าย (≈15:00)
══════════════════════════════════════════ */
const A4T_HISTORY = 'https://air4thai.pcd.go.th/forweb/getHistoryData.php';
const bkkDate = (ms = Date.now()) => new Date(ms + 7 * 3600e3).toISOString().slice(0, 10);
const addDaysIso = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const hh = h => String(h).padStart(2, '0') + ':00:00';

// ค่าของวันที่ d ตามเกณฑ์ (avg24 = เฉลี่ย 24 ชม. สิ้นสุด hour:00 · hour = ค่ารายชั่วโมงเดียว)
function pheocValue(byHour, d, rule) {
  if (rule.value === 'hour') { const v = byHour[d + ' ' + hh(rule.hour)]; return { v: v ?? null, n: v == null ? 0 : 1 }; }
  const keys = [], prev = addDaysIso(d, -1);
  for (let h = rule.hour + 1; h <= 23; h++) keys.push(prev + ' ' + hh(h));
  for (let h = 0; h <= rule.hour; h++) keys.push(d + ' ' + hh(h));
  const v = keys.map(k => byHour[k]).filter(x => typeof x === 'number');
  if (v.length < (rule.min_hours || 18)) return { v: null, n: v.length };
  return { v: Math.round(v.reduce((a, b) => a + b, 0) / v.length * 10) / 10, n: v.length };
}

async function buildPheoc() {
  const { provinces, pheoc: rule0 } = readConfig();
  const rule = { threshold: 75.1, hour: 7, days: 2, value: 'avg24', min_hours: 18, ...(rule0 || {}) };
  const today = bkkDate();
  const dates = Array.from({ length: rule.days }, (_, i) => addDaysIso(today, i - rule.days + 1));
  const ids = provinces.map(p => p.air4thai_station).filter(Boolean);
  const url = `${A4T_HISTORY}?stationID=${ids.join(',')}&param=PM25&type=hr&sdate=${addDaysIso(dates[0], -1)}&edate=${today}&stime=00&etime=23`;
  const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error('Air4Thai HTTP ' + r.status);
  const j = await r.json();
  const byStation = {};
  for (const st of (j.stations || [])) {
    const m = {};
    for (const row of (st.data || [])) {
      const v = typeof row.PM25 === 'number' ? row.PM25 : parseFloat(row.PM25);
      const dt = String(row.DATETIMEDATA || '');
      if (!isNaN(v) && v >= 0 && /^\d{4}-\d{2}-\d{2} \d{2}/.test(dt)) m[dt.slice(0, 13) + ':00:00'] = v;
    }
    byStation[String(st.stationID).toLowerCase()] = m;
  }
  const list = provinces.map(p => {
    const m = byStation[String(p.air4thai_station || '').toLowerCase()] || {};
    const days = dates.map(d => ({ date: d, ...pheocValue(m, d, rule) }));
    const hit = days.every(x => x.v != null && x.v >= rule.threshold);
    return { name: p.name, station: p.air4thai_station, days, hit };
  });
  const todayReady = list.some(p => p.days.at(-1).v != null);
  return { ok: true, rule, dates, todayReady, anyHit: list.some(p => p.hit), hit: list.filter(p => p.hit).map(p => p.name), provinces: list, source: 'Air4Thai (getHistoryData รายชั่วโมง)', fetchedAt: new Date().toISOString() };
}

app.get('/api/pheoc', async (req, res) => {
  const cached = getCached('pheoc');
  if (cached) return res.json(cached);
  try {
    const data = await singleFlight('pheoc', buildPheoc);
    _lastGood.set('pheoc', data);
    setCached('pheoc', data, 30 * 60 * 1000);   // 30 นาที
    res.json(data);
  } catch (e) {
    const stale = _lastGood.get('pheoc');
    if (stale) return res.json({ ...stale, stale: true });
    res.status(502).json({ ok: false, message: 'ตรวจเกณฑ์ PHEOC ไม่สำเร็จ: ' + e.message });
  }
});

/* ══════════════════════════════════════════
   สถิติการเข้าชม — นับผู้เข้าชมไม่ซ้ำต่อวัน (หน้าเว็บส่ง POST วันละครั้งต่อเบราว์เซอร์)
   ไม่เก็บ IP / cookie / ข้อมูลส่วนบุคคล · กันยิงซ้ำด้วยแฮช IP ในหน่วยความจำ 10 นาที (ไม่บันทึกลงที่ใด)
   เก็บถาวรในชีต (แท็บ _visits) ผ่าน Apps Script tools/visits.gs — ตั้ง env VISIT_HOOK_URL + VISIT_TOKEN
   ไม่ได้ตั้ง env → นับในหน่วยความจำอย่างเดียว (หายเมื่อ deploy ใหม่)
══════════════════════════════════════════ */
const crypto = require('crypto');
const VISIT = { base: { total: 0, month: 0, today: 0, since: null, day: null }, pending: new Map(), loaded: false, recent: new Map() };
const VISIT_PERSIST = () => !!process.env.VISIT_HOOK_URL;
async function visitHook(body) {
  const url = process.env.VISIT_HOOK_URL; if (!url) return null;
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, redirect: 'follow',
    body: JSON.stringify({ token: process.env.VISIT_TOKEN || '', ...body }), signal: AbortSignal.timeout(15000) });
  const j = await r.json(); if (!j.ok) throw new Error(j.error || 'visit hook error'); return j;
}
function visitRoll() {   // ขึ้นวันใหม่/เดือนใหม่ (เวลาไทย)
  const d = bkkDate();
  if (VISIT.base.day && VISIT.base.day !== d) { VISIT.base.today = 0; if (VISIT.base.day.slice(0, 7) !== d.slice(0, 7)) VISIT.base.month = 0; }
  VISIT.base.day = d; if (!VISIT.base.since) VISIT.base.since = d;
}
async function visitLoad() {
  if (VISIT.loaded) return;
  try { const j = await visitHook({ action: 'get', date: bkkDate() }); if (j) Object.assign(VISIT.base, j.stats, { day: bkkDate() }); VISIT.loaded = true; }
  catch (e) { console.warn('โหลดสถิติการเข้าชมไม่สำเร็จ:', e.message); }
}
// ยอดที่ยังไม่ส่งเข้าชีต แยกตามวัน — ผู้เข้าชม 23:58 ที่ถูกส่งตอน 00:03 ต้องลงวันเดิม ไม่ใช่วันใหม่
const visitPendingSum = pred => { let t = 0; for (const [d, n] of VISIT.pending) if (!pred || pred(d)) t += n; return t; };
let visitFlushing = null;
function visitFlush() {
  if (!VISIT_PERSIST() || !VISIT.pending.size) return Promise.resolve();
  if (visitFlushing) return visitFlushing;                 // กันส่งซ้อน (timer ชนกับ SIGTERM)
  visitFlushing = (async () => {
    let sent = false;
    for (const [date, n] of [...VISIT.pending]) {
      VISIT.pending.delete(date);
      try { await visitHook({ action: 'add', date, n }); sent = true; }
      catch (e) { VISIT.pending.set(date, (VISIT.pending.get(date) || 0) + n); console.warn('บันทึกสถิติการเข้าชมไม่สำเร็จ:', e.message); break; }
    }
    if (sent) {   // รีเฟรชยอดรวมจากชีตเป็น "วันนี้" เสมอ (ไม่ใช่วันของแถวที่เพิ่งส่ง)
      try { const j = await visitHook({ action: 'get', date: bkkDate() }); if (j) Object.assign(VISIT.base, j.stats, { day: bkkDate() }); }
      catch (e) { console.warn('รีเฟรชสถิติการเข้าชมไม่สำเร็จ:', e.message); }
    }
  })().finally(() => { visitFlushing = null; });
  return visitFlushing;
}
setInterval(visitFlush, 5 * 60 * 1000).unref();
// Render ส่ง SIGTERM ก่อนปิดเครื่อง (deploy / restart / spin-down) → ส่งยอดค้างเข้าชีตก่อนดับ ไม่งั้นหายสูงสุด 5 นาทีทุกครั้ง
process.once('SIGTERM', async () => {
  try { await Promise.race([visitFlush(), sleep(8000)]); } catch {}
  process.exit(0);
});
if (!VISIT_PERSIST()) console.warn('⚠️ ไม่ได้ตั้ง VISIT_HOOK_URL — สถิติการเข้าชมนับในหน่วยความจำอย่างเดียว จะรีเซ็ตทุกครั้งที่ server restart/deploy');
const visitOut = () => {
  visitRoll(); const d = bkkDate(), m = d.slice(0, 7), persist = VISIT_PERSIST();
  const pt = persist ? visitPendingSum(x => x === d) : 0, pm = persist ? visitPendingSum(x => x.slice(0, 7) === m) : 0, pa = persist ? visitPendingSum() : 0;
  return { ok: true, today: VISIT.base.today + pt, month: VISIT.base.month + pm, total: VISIT.base.total + pa, since: VISIT.base.since, persistent: persist };
};

app.get('/api/visit', async (req, res) => { await visitLoad(); res.set('Cache-Control', 'no-store'); res.json(visitOut()); });
app.post('/api/visit', async (req, res) => {
  await visitLoad(); visitRoll();
  const ip = String(req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const k = crypto.createHash('sha256').update(ip + bkkDate()).digest('hex').slice(0, 16), now = Date.now();
  for (const [kk, t] of VISIT.recent) if (now - t > 10 * 60 * 1000) VISIT.recent.delete(kk);
  if (!VISIT.recent.has(k)) {
    VISIT.recent.set(k, now);
    if (VISIT_PERSIST()) VISIT.pending.set(bkkDate(), (VISIT.pending.get(bkkDate()) || 0) + 1); else { VISIT.base.today++; VISIT.base.month++; VISIT.base.total++; }
  }
  res.set('Cache-Control', 'no-store'); res.json(visitOut());
});

/* ── ค่าฝุ่น ณ 07:00 (แท็บ PM25_07 · ใช้ในชุดดาวน์โหลด) ── */
app.get('/api/pm25-07', async (req, res) => {
  const cached = getCached('pm25-07'); if (cached) return res.json(cached);
  const { api, provinces } = readConfig();
  const csv = await fetchCSV([`https://docs.google.com/spreadsheets/d/${api.sheet_id}/gviz/tq?tqx=out:csv&sheet=PM25_07`]);
  if (!csv) return res.status(502).json({ ok: false, message: 'อ่านแท็บ PM25_07 ไม่ได้' });
  try {
    const { allData } = parseSheetData(csv, provinces);
    const data = { ok: true, allData, note: 'ค่าเฉลี่ย 24 ชม. ณ 07:00 จาก Air4Thai (เกณฑ์ PHEOC)' };
    setCached('pm25-07', data, 30 * 60 * 1000); res.json(data);
  } catch (e) { res.status(500).json({ ok: false, message: 'CSV parse error: ' + e.message }); }
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
// หน้าละ 1,000 แถว: แถวหนึ่งมี ~220 คอลัมน์ → หน้าใหญ่ (5,000) + ตาราง s_pm25_2 ทำหน่วยความจำเกิน 256 MB
// บน Render (ต.ค. 2569 เซิร์ฟเวอร์ล่ม heap out of memory) → หน้าเล็กลง และย่อเป็นยอดรวมทันทีทีละหน้า
const MOPH_PAGE_SIZE = 1000;
const MOPH_MAX_PAGES = 200;            // กันลูปไม่รู้จบถ้า total ที่ MOPH ส่งมาเพี้ยน (เกินนี้ = ล้มทั้งจังหวัด ไม่ตัดเงียบ)
const MOPH_MAX_RETRY = 3;              // จำนวนครั้งที่ลองใหม่เมื่อโดน 429 / 5xx
const MOPH_GAP_MS    = 3000;           // เว้นจังหวะระหว่างคำขอ 3 วินาที ไม่ยิงรัวใส่ MOPH (เดิม 0.3 วิ → โดน 429 แทบทุกคำขอ)
const MOPH_BACKOFF_BASE_MS = 5000;     // โดน 429/5xx: รอ 5s → 10s → 20s (เพดาน 60s) + สุ่มเพิ่ม 0–1s กันยิงพร้อมกัน
const MOPH_BACKOFF_CAP_MS  = 60000;
const MOPH_429_LIMIT       = 2;        // โดน 429 ติดกันครบกี่ครั้งถึงหยุดทั้งรอบ (circuit breaker)
const MOPH_BREAKER_MS      = 60 * 60 * 1000;  // หยุดยิง MOPH นานเท่านี้ ระหว่างนั้นใช้ข้อมูลเดิม
const mophBreaker = { until: 0, streak429: 0 };
const mophPaused  = () => Date.now() < mophBreaker.until;

// ยิง 1 คำขอ พร้อมลองใหม่เมื่อโดน rate-limit (429) หรือปลายทางไม่พร้อม (5xx)
// • ถอยแบบ exponential backoff + jitter (RFC 6585 §4; Brooker, AWS Architecture Blog 2015)
// • circuit breaker: 429 ติดกัน MOPH_429_LIMIT ครั้ง → หยุดทั้งรอบ พัก MOPH_BREAKER_MS (Nygard, Release It! 2007)
//   ระหว่างพักไม่ยิงเลย → ผู้เรียกใช้ข้อมูลชุดเดิม (_lastGood / ชีต) แทน ลดโอกาสโดนบล็อก IP
async function mophPost(payload) {
  if (mophPaused()) {
    throw new Error(`MOPH พักการเรียก (โดน 429 ติดกัน) ถึง ${new Date(mophBreaker.until).toLocaleTimeString('th-TH')}`);
  }
  let last;
  for (let attempt = 0; attempt < MOPH_MAX_RETRY; attempt++) {
    try {
      last = await fetch(MOPH_DISEASE_API, {
        method:  'POST',
        headers: MOPH_HEADERS,
        body:    JSON.stringify(payload),
        signal:  AbortSignal.timeout(60000),   // ขอนแก่นข้อมูลใหญ่สุด (~1,100 แถว × 220 คอลัมน์)
      });
    } catch (e) {
      // เชื่อมต่อไม่ได้ / หมดเวลา → ลองใหม่ (เดิมหลุดออกไปทั้งจังหวัด แล้วถูกข้ามเงียบๆ)
      if (attempt === MOPH_MAX_RETRY - 1) throw e;
      console.warn(`MOPH เชื่อมต่อไม่สำเร็จ (${e.message}) — ลองใหม่`);
      await sleep(2000 * 2 ** attempt);
      continue;
    }

    if (last.status === 429) {
      if (++mophBreaker.streak429 >= MOPH_429_LIMIT) {
        mophBreaker.until     = Date.now() + MOPH_BREAKER_MS;
        mophBreaker.streak429 = 0;
        console.warn(`MOPH ตอบ 429 ติดกัน ${MOPH_429_LIMIT} ครั้ง — หยุดยิงรอบนี้ พัก ${MOPH_BREAKER_MS / 60000} นาที (ใช้ข้อมูลเดิมไปก่อน)`);
        throw new Error('MOPH ตอบ 429 ติดกัน — หยุดเพื่อไม่ให้โดนบล็อก');
      }
    } else {
      mophBreaker.streak429 = 0;
    }
    if (last.ok || (last.status !== 429 && last.status < 500)) return last;

    // เคารพ Retry-After ถ้า MOPH บอกมา ไม่งั้นถอยเป็นขั้น 5s → 10s → 20s (สูงสุด 60s) + jitter
    const hinted = Number(last.headers.get('retry-after'));
    const wait   = Math.min(hinted > 0 ? hinted * 1000 : MOPH_BACKOFF_BASE_MS * 2 ** attempt, MOPH_BACKOFF_CAP_MS)
                 + Math.floor(Math.random() * 1000);
    console.warn(`MOPH ตอบ ${last.status} — รอ ${(wait / 1000).toFixed(1)}s แล้วลองใหม่`);
    await sleep(wait);
  }
  return last;
}

// ย่อแถวดิบเป็นยอดรวมรายสัปดาห์ × กลุ่มโรค แล้วทิ้งแถวดิบทันที (ไม่เก็บทั้งก้อนไว้ในหน่วยความจำ)
//   agg.wk[w][หมวดโรค] = ผลรวม w_NN_m (_m = จำนวนที่เข้ารับบริการ ตัดซ้ำรายคน/สัปดาห์)
function mophAggRows(agg, rows) {
  for (const row of rows) {
    const cat = MOPH_DIAG_GROUP[row.diag_main];
    if (!cat) continue;
    if (row.date_com && String(row.date_com) > agg.dateCom) agg.dateCom = String(row.date_com);
    for (let w = 1; w <= 53; w++) {
      const v = row['w_' + String(w).padStart(2, '0') + '_m'];
      if (typeof v === 'number' && v > 0) {
        const o = agg.wk[w] || (agg.wk[w] = {});
        o[cat] = (o[cat] || 0) + v;
      }
    }
  }
}

// ดึงจังหวัดเดียวให้ครบทุกหน้า แล้วคืนเป็นยอดรวม { wk, dateCom, rows }
// รูปแบบตอบกลับ: { data: [...], total, limit, offset } — รองรับ array เปล่าๆ เผื่อ API เปลี่ยนกลับ
async function fetchMophAgg(beYear, pvIdn, table = 's_pm25_1_in_week') {
  const agg = { wk: {}, dateCom: '', rows: 0 };

  for (let page = 0; page < MOPH_MAX_PAGES; page++) {
    if (page > 0) await sleep(MOPH_GAP_MS);

    const r = await mophPost({
      tableName: table,
      year:      String(beYear),
      province:  String(pvIdn),
      type:      'json',
      limit:     MOPH_PAGE_SIZE,
      offset:    page * MOPH_PAGE_SIZE,
    });
    // MOPH ตอบ 201 เมื่อสำเร็จ · อย่างอื่น = ล้มทั้งจังหวัด (ห้ามคืนข้อมูลครึ่งๆ กลางๆ)
    if (!r.ok) throw new Error(`HTTP ${r.status} (จังหวัด ${pvIdn} หน้า ${page + 1})`);

    const body  = await r.json();
    const chunk = Array.isArray(body) ? body : (body?.data || []);
    const total = Array.isArray(body) ? chunk.length : Number(body?.total) || 0;
    mophAggRows(agg, chunk);
    agg.rows += chunk.length;
    if (chunk.length < MOPH_PAGE_SIZE || agg.rows >= total) return agg;
  }
  throw new Error(`ข้อมูลเกิน ${MOPH_MAX_PAGES} หน้า (จังหวัด ${pvIdn}) — ไม่ใช้ข้อมูลที่ไม่ครบ`);
}

// ดึงยอดรวมทุกจังหวัดในเขตจากตารางที่กำหนด — ต้องครบทุกจังหวัด ไม่งั้นคืน null (+ รายชื่อที่ขาด)
// ดึงทีละจังหวัด (sequential) เลี่ยงการยิงพร้อมกันจนโดน rate-limit ฝั่ง MOPH
// ต.ค. 2569 พบว่า จ.ขอนแก่น (จังหวัดแรก) ถูกข้ามเงียบๆ ยอดทั้งเขตบนเว็บจึงต่ำกว่าจริงราว 40%
// → จังหวัดที่พลาดให้ลองซ้ำอีกรอบ ถ้ายังไม่ได้ก็ไม่ใช้ข้อมูลรอบนี้
async function fetchMophAllProvinces(beYear, table) {
  const { provinces } = readConfig();
  const got = new Map(), errs = {};
  for (let round = 0; round < 2; round++) {
    for (const pv of provinces) {
      if (got.has(pv.pv_idn)) continue;
      if (mophPaused()) break;                       // circuit breaker เปิดอยู่ → ไม่ยิงต่อ
      if (got.size || Object.keys(errs).length) await sleep(round ? 3000 : MOPH_GAP_MS);
      try {
        const agg = await fetchMophAgg(beYear, pv.pv_idn, table);
        if (!agg.rows) throw new Error('ได้ 0 แถว');
        got.set(pv.pv_idn, agg);
        delete errs[pv.name];
      } catch (e) {
        errs[pv.name] = e.message;
      }
    }
    if (got.size === provinces.length || mophPaused()) break;
  }
  if (got.size < provinces.length) {
    const why = Object.entries(errs).map(([n, m]) => `${n}: ${m}`).join(' · ');
    console.warn(`MOPH ${table} ดึงได้ไม่ครบ ${got.size}/${provinces.length} จังหวัด (${why}) — ไม่ใช้ข้อมูลรอบนี้`);
    return { got: null, missing: provinces.filter(p => !got.has(p.pv_idn)).map(p => p.name) };
  }
  return { got, missing: [] };
}

// date_com = YYYYMMDDHHMM → D/M/YYYY (ค.ศ.) ให้ frontend +543 เอง
const dateComToDmy = dc => /^\d{12}/.test(dc) ? `${+dc.slice(6, 8)}/${+dc.slice(4, 6)}/${dc.slice(0, 4)}` : '';

// ดึง+รวมยอดผู้ป่วยรายสัปดาห์ทุกจังหวัดในเขต สำหรับปี พ.ศ. ที่กำหนด (s_pm25_1 = ทุกคนที่มารับบริการในเขต)
// คืนค่ารูปแบบเดียวกับ parseDiseaseData: [{ wk, <หมวดโรค>, อัพเดท }]
async function fetchMophDisease(beYear) {
  const acc  = {};   // acc[wk][cat] = ยอดรวม (w_NN_m)
  let maxDateCom = '';

  const { got, missing } = await fetchMophAllProvinces(beYear, 's_pm25_1_in_week');
  if (!got) {
    const out = [];
    out.missing = missing;
    return out;                        // ว่าง = ให้ buildDiseaseData ใช้ชีตหรือข้อมูลชุดเดิมที่ครบแทน
  }

  for (const agg of got.values()) {
    if (agg.dateCom > maxDateCom) maxDateCom = agg.dateCom;
    for (const [w, cats] of Object.entries(agg.wk)) {
      if (!acc[w]) acc[w] = {};
      for (const [cat, v] of Object.entries(cats)) acc[w][cat] = (acc[w][cat] || 0) + v;
    }
  }

  const upd = dateComToDmy(maxDateCom);

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

  // โซน F — อุ่น cache ไว้ก่อนผู้ใช้เข้ามา แล้วรีเฟรชทุก 6 ชม. (cache MOPH อยู่ได้ 6 ชม.)
  // เท่ากับยิง MOPH วันละ ~4 รอบ ไม่ว่าจะมีคนเปิดแดชบอร์ดกี่คน (เดิมทุก 3 ชม. = ~8 รอบ)
  warmDiseaseCache();
  setInterval(warmDiseaseCache, 6 * 60 * 60 * 1000);

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

  // อุ่น cache อากาศ (Open-Meteo) ทุก 60 ±5 นาที — สุ่มเวลาเริ่มและสุ่มรอบ เพื่อไม่ให้หลาย instance ยิงพร้อมกัน
  const warmC5 = async () => {
    try { await singleFlight('c5-wx', c5Weather); }
    catch (e) { console.warn('warm c5-wx:', e.message); }
    setTimeout(warmC5, (60 + (Math.random() * 10 - 5)) * 60e3);
  };
  setTimeout(warmC5, Math.random() * 60e3);
});

async function warmDiseaseCache() {
  try {
    const d = await singleFlight('sheet-disease', buildDiseaseData);
    console.log(`[${new Date().toLocaleTimeString('th-TH')}] ✅ ข้อมูลโรคอัพเดทแล้ว (${d.meta.source}, ${d.meta.dataDate || 'ไม่ทราบวันที่'})`);
  } catch (e) {
    console.warn('อุ่น cache ข้อมูลโรคไม่สำเร็จ:', e.message);
  }
  // รายจังหวัด (E2) ต่อท้าย ไม่ยิงพร้อมกัน — MOPH เห็นเราทีละคำขอเสมอ
  try {
    const d = await singleFlight('disease-pv', buildDiseasePv);
    console.log(`[${new Date().toLocaleTimeString('th-TH')}] ✅ ผู้ป่วยรายจังหวัดอัพเดทแล้ว (${d.meta.source}, ${d.meta.dataDate || 'ไม่ทราบวันที่'})`);
  } catch (e) {
    console.warn('อุ่น cache ผู้ป่วยรายจังหวัดไม่สำเร็จ:', e.message);
  }
}
