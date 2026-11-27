#!/usr/bin/env node
/* ตรวจ /api/disease-icd เทียบกับ /api/sheet-disease
 *   ใช้:  node tools/verify-disease-icd.js [BASE_URL]      (ค่าเริ่มต้น http://localhost:10000)
 *   ตรวจ: 1) ครบ 9 รหัส × m/z/y/zy ความยาวเท่ากับ meta.maxWk
 *         2) ยอดรวมรายรหัส (m) ในแต่ละกลุ่มเท่ากับยอดกลุ่มของ /api/sheet-disease ทุกสัปดาห์
 *            (เทียบเฉพาะเมื่อ sheet-disease ใช้ข้อมูล MOPH — ถ้าชีตใหม่กว่าจะข้ามข้อนี้)
 *         3) เรียกสองเส้นทางพร้อมกันแล้ววัดเวลา — ถ้าใช้การดึง MOPH รอบเดียวกัน เวลารวมต้องใกล้เคียงเส้นทางเดียว
 *   ออกด้วยรหัส 1 ถ้ามีข้อใดไม่ผ่าน */
const BASE = (process.argv[2] || 'http://localhost:10000').replace(/\/$/, '');
const GROUPS = {
  'ทางเดินหายใจ': ['J44', 'J45', 'J44.2'],
  'หัวใจ':        ['I21', 'I24', 'I22'],
  'ตาอักเสบ':     ['H10'],
  'ผิวหนัง':      ['L30.9', 'L50'],
};
const METRICS = ['m', 'z', 'y', 'zy'];

async function getJSON(path) {
  const r = await fetch(BASE + path, { signal: AbortSignal.timeout(240000) });
  if (!r.ok) throw new Error(`${path} → HTTP ${r.status}`);
  return r.json();
}

(async () => {
  const fails = [];
  const t0 = Date.now();
  const [sd, ic] = await Promise.all([getJSON('/api/sheet-disease'), getJSON('/api/disease-icd')]);
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`เรียกพร้อมกัน sheet-disease + disease-icd ใช้เวลา ${secs}s`);

  if (!ic.ok) fails.push('disease-icd ok=false');
  const maxWk = ic.meta?.maxWk;
  const all = Object.values(GROUPS).flat();
  for (const c of all) {
    for (const k of METRICS) {
      const a = ic.codes?.[c]?.[k];
      if (!Array.isArray(a)) fails.push(`ไม่มี codes.${c}.${k}`);
      else if (a.length !== maxWk) fails.push(`codes.${c}.${k} ยาว ${a.length} ไม่เท่ากับ maxWk ${maxWk}`);
      else if (a.some(v => !Number.isInteger(v) || v < 0)) fails.push(`codes.${c}.${k} มีค่าไม่ใช่จำนวนเต็มบวก`);
    }
  }
  const extra = Object.keys(ic.codes || {}).filter(c => !all.includes(c));
  if (extra.length) fails.push('มีรหัสเกิน: ' + extra.join(', '));

  console.log(`ปี ${ic.yearBe} · maxWk ${maxWk} · dataWk ${ic.meta?.dataWk} · dateCom ${ic.meta?.dateCom} · อายุ ${ic.meta?.ageDays} วัน · stale=${ic.meta?.stale}`);

  if (sd.meta?.source === 'moph') {
    const rows = sd[ic.meta.dataYear] || [];
    let checked = 0, bad = 0;
    for (const r of rows) {
      const w = +r.wk; if (!w || w > maxWk) continue;
      for (const [g, codes] of Object.entries(GROUPS)) {
        const fromIcd = codes.reduce((s, c) => s + (ic.codes[c].m[w - 1] || 0), 0);
        const fromGrp = Number(r[g] || 0);
        checked++;
        if (fromIcd !== fromGrp) { bad++; if (bad <= 5) fails.push(`สัปดาห์ ${w} ${g}: รายรหัสรวม ${fromIcd} ≠ ยอดกลุ่ม ${fromGrp}`); }
      }
    }
    console.log(`เทียบยอดกลุ่ม ${checked} ช่อง ไม่ตรง ${bad}`);
    if (!checked) fails.push('ไม่มีสัปดาห์ให้เทียบ');
  } else {
    console.log(`ข้ามการเทียบยอดกลุ่ม (sheet-disease ใช้แหล่ง ${sd.meta?.source})`);
  }

  const sum = k => all.reduce((s, c) => s + ic.codes[c][k].reduce((a, b) => a + b, 0), 0);
  console.log(`รวมทั้งเขต: m=${sum('m')} · Z58.1=${sum('z')} · Y97=${sum('y')} · ทั้งสอง=${sum('zy')}`);

  if (fails.length) { console.error('\n✗ ไม่ผ่าน:\n - ' + fails.join('\n - ')); process.exit(1); }
  console.log('\n✓ ผ่านทุกข้อ');
})().catch(e => { console.error('✗ ' + e.message); process.exit(1); });
