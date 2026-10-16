// ===== E2 มุมมอง "เทียบแนวโน้ม" — อัตราป่วย (หน่วยจริง) กับค่าฝุ่นเฉลี่ยรายสัปดาห์ ± SD =====
// อัตราป่วย = ต่อแสนประชากร Type area 1+3 (ค่าจริง ไม่แปลง) · ค่าฝุ่น = ค่าเฉลี่ยรายวันในสัปดาห์ระบาดวิทยา ± SD ของค่ารายวัน
// สองตัวแปรคนละหน่วย จึงมี 2 แบบให้เลือก:
//   "stack" แยกแผงซ้อนแนวตั้ง แกนเวลาร่วมกัน (แนะนำ — Cleveland 1993; Few 2008: เลี่ยงกราฟสองแกน)
//   "dual"  แกนคู่ในแผงเดียว (ตามที่ขอ) — ล็อกสเกลคงที่ เริ่มที่ 0 ทุกจังหวัด เพื่อลดการปรับสเกลให้ "ดูซ้อนกัน" (Isenberg et al. 2011)
window._e2xView = window._e2xView || "x";        // "x" = เทียบแนวโน้ม (ใหม่) · "b" = แท่งอัตราป่วย (เดิม)
window._e2xMode = "dual";   // เลือกแบบแกนคู่อย่างเดียว (Louis 16 ต.ค. 2569)
window._e2xK = window._e2xK || DZ[0].key;
const E2X_PMAX = 100;
const e2xDays = wk => Math.round((epiEnd(2026, wk) - epiStart(2026, wk)) / 864e5) + 1;   // จำนวนวันในสัปดาห์ระบาดวิทยา (สัปดาห์ที่ 1 อาจไม่ครบ 7)
function e2xNice(v) { const p = 10 ** Math.floor(Math.log10(v)), m = v / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p; }
function e2xPmWeek(PMD, pv, wk) {   // ค่าเฉลี่ยและ SD ของค่าฝุ่นรายวันในสัปดาห์ (ต้องมีค่าอย่างน้อย 4 วัน)
  const s = epiStart(2026, wk), nd = Math.round((epiEnd(2026, wk) - s) / 864e5) + 1, v = [];
  for (let i = 0; i < nd; i++) { const d = new Date(s.getTime() + i * 864e5), iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; const x = PMD[iso]?.[pv]; if (x != null && x > 0) v.push(x); }
  if (v.length < Math.min(4, nd)) return null;
  const m = v.reduce((a, b) => a + b, 0) / v.length, sd = v.length > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1)) : 0;
  return { m, sd, n: v.length, lo: Math.min(...v), hi: Math.max(...v) };
}
const e2xMS = a => { const v = a.filter(x => x != null); if (!v.length) return null; const m = v.reduce((s, x) => s + x, 0) / v.length; return { m, sd: v.length > 1 ? Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / (v.length - 1)) : 0, n: v.length }; };
function e2xData(wkMax) {
  const src = window.DZPV, n = wkMax, PMD = window.PMREAL || S.pm?.allData || {};
  return PROV.map(p => {
    const pop = src.pop[p.name], rows = src.rows.filter(r => r.pv === p.name && r.wk <= n);
    const pm = Array.from({ length: n }, (_, i) => e2xPmWeek(PMD, p.name, i + 1));
    const ser = DZ.map(d => { const k = DZPV_COL[d.key], c = Array(n).fill(null); rows.forEach(r => { c[r.wk - 1] = +r[k]; }); return { d, c, rate: c.map(x => x == null ? null : x / pop * 1e5) }; });
    return { p, pop, pm, ser };
  });
}
function e2xSvg(o, s, n, lastOk, W, mode, RMAX) {
  const fs = 11, dual = mode === "dual", L = 36, R = dual ? 40 : 12, pw = W - L - R, slot = pw / n;
  const X = i => L + i * slot + slot / 2;
  const P1 = { top: dual ? 20 : 26, h: dual ? 150 : 86 };                       // แผงค่าฝุ่น (หรือแผงเดียวเมื่อแกนคู่)
  const P2 = dual ? P1 : { top: P1.top + P1.h + 26, h: 86 };        // แผงอัตราป่วย
  const yAx = P2.top + P2.h, H = yAx + fs * 3.2;
  const YP = v => P1.top + P1.h - Math.min(v, E2X_PMAX) / E2X_PMAX * P1.h;
  const YR = v => P2.top + P2.h - Math.min(v, RMAX) / RMAX * P2.h;
  const wkT = i => { const a = epiStart(2026, i + 1), b = epiEnd(2026, i + 1), d = e2xDays(i + 1); return `สัปดาห์ที่ ${i + 1} (${dmy(a)}–${dmy(b)})${d < 7 ? ` · สัปดาห์ไม่เต็ม มี ${d} วัน อัตราจึงต่ำกว่าสัปดาห์ปกติ` : ""}`; };
  const short = i => e2xDays(i + 1) < 7;
  const pmC = PM_INK, rC = s.d.c;
  let g = "";
  // ช่วงข้อมูลเบื้องต้น + เส้นแนวนอน
  g += `<rect x="${L + lastOk * slot}" y="${P1.top}" width="${(n - lastOk) * slot}" height="${yAx - P1.top}" fill="#eef1f5"/>`;
  [0, 25, 50, 75, 100].forEach(t => { g += `<line x1="${L}" x2="${W - R}" y1="${YP(t)}" y2="${YP(t)}" stroke="rgba(15,27,45,${t ? .07 : .25})"/>`
    + `<text x="${L - 5}" y="${YP(t) + 3.5}" text-anchor="end" font-size="${fs - 1.5}" fill="${pmC}">${t}</text>`; });
  g += `<line x1="${L}" x2="${W - R}" y1="${YP(37.5)}" y2="${YP(37.5)}" stroke="#c2410c" stroke-dasharray="4 3" stroke-width="1.1"/>`
    + `<text x="${W - R - 2}" y="${YP(37.5) - 3}" text-anchor="end" font-size="${fs - 2}" font-weight="700" fill="#c2410c" stroke="#fff" stroke-width="3" paint-order="stroke">37.5 เกณฑ์ค่ามาตรฐาน 24 ชม.</text>`;
  const rt = [0, .25, .5, .75, 1].map(f => f * RMAX);
  if (!dual) {
    rt.forEach((t, i) => { g += `<line x1="${L}" x2="${W - R}" y1="${YR(t)}" y2="${YR(t)}" stroke="rgba(15,27,45,${i ? .07 : .25})"/>`
      + (i % 2 === 0 ? `<text x="${L - 5}" y="${YR(t) + 3.5}" text-anchor="end" font-size="${fs - 1.5}" font-weight="700" fill="${rC}">${t >= 10 ? Math.round(t) : f1(t)}</text>` : ""); });
    g += `<text x="${L}" y="${P1.top - 7}" font-size="${fs - .5}" font-weight="700" stroke="#fff" stroke-width="3" paint-order="stroke" fill="${pmC}">ค่าฝุ่น PM<tspan font-size="${fs * .72}" dy="3">2.5</tspan><tspan dy="-3"> เฉลี่ยรายสัปดาห์ ± SD (µg/m³)</tspan></text>`
      + `<text x="${L}" y="${P2.top - 7}" font-size="${fs - .5}" font-weight="700" stroke="#fff" stroke-width="3" paint-order="stroke" fill="${rC}">${s.d.label} · ต่อแสนประชากร/สัปดาห์</text>`;
  } else {
    rt.forEach((t, i) => { if (i % 2 === 0) g += `<text x="${W - R + 5}" y="${YR(t) + 3.5}" font-size="${fs - 1.5}" font-weight="700" fill="${rC}">${t >= 10 ? Math.round(t) : f1(t)}</text>`; });
    g += `<text x="${L - 5}" y="${P1.top - 7}" text-anchor="end" font-size="${fs - 1.5}" font-weight="700" fill="${pmC}">µg/m³</text>`
      + `<text x="${W - R + 5}" y="${P1.top - 7}" font-size="${fs - 1.5}" font-weight="700" fill="${rC}">ต่อแสน</text>`;
  }
  HOLI26.filter(h => h.wk <= n).forEach(h => { g += `<line x1="${X(h.wk - 1)}" x2="${X(h.wk - 1)}" y1="${P1.top}" y2="${yAx}" stroke="#8a96a8" stroke-dasharray="2 3"/><text x="${X(h.wk - 1) + 3}" y="${yAx + fs * 2.3}" font-size="${fs - 1.5}" fill="#6b7689">${h.t}</text>`; });
  // แถบ ± SD ค่าฝุ่น (เป็นช่วงต่อเนื่องเฉพาะสัปดาห์ที่มีค่า)
  let band = "", seg = [];
  const flush = () => { if (seg.length > 1) band += `<path d="M${seg.map(([i, q]) => `${X(i).toFixed(1)} ${YP(q.m + q.sd).toFixed(1)}`).join("L")}L${seg.slice().reverse().map(([i, q]) => `${X(i).toFixed(1)} ${YP(Math.max(0, q.m - q.sd)).toFixed(1)}`).join("L")}Z" fill="${pmC}" opacity=".13"/>`; seg = []; };
  o.pm.forEach((q, i) => { if (q) seg.push([i, q]); else flush(); }); flush();
  g += band;
  const line = (vals, Y) => { let d = "", on = false; vals.forEach((v, i) => { if (v == null) { on = false; return; } d += `${on ? "L" : "M"}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`; on = true; }); return d; };
  g += `<path d="${line(o.pm.map(q => q?.m ?? null), YP)}" fill="none" stroke="${pmC}" stroke-width="2" stroke-dasharray="${dual ? "5 3" : "none"}" stroke-linejoin="round"/>`;
  o.pm.forEach((q, i) => { if (q) g += `<circle cx="${X(i)}" cy="${YP(q.m)}" r="2.1" fill="${q.m > 37.5 ? "#c2410c" : pmC}"/>`; });
  // อัตราป่วย: ช่วงครบเป็นเส้นทึบ · 4 สัปดาห์ล่าสุด (เบื้องต้น) เป็นเส้นประจาง
  // ทึบ = สัปดาห์ครบและข้อมูลครบ · ประจาง = สัปดาห์ไม่เต็ม 7 วัน (ต้นปี) และ 4 สัปดาห์ล่าสุด (ข้อมูลเบื้องต้น)
  const full = i => !short(i) && i + 1 <= lastOk;
  const rOk = s.rate.map((v, i) => full(i) ? v : null);
  const rDash = s.rate.map((v, i) => (!full(i) || (i + 1 < n && !full(i + 1)) || (i > 0 && !full(i - 1))) ? v : null);
  g += `<path d="${line(rDash, YR)}" fill="none" stroke="${rC}" stroke-width="2" stroke-dasharray="3 3" opacity=".6"/>`
    + `<path d="${line(rOk, YR)}" fill="none" stroke="${rC}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>`;
  s.rate.forEach((v, i) => { if (v != null) g += short(i)
    ? `<circle cx="${X(i)}" cy="${YR(v)}" r="3" fill="#fff" stroke="${rC}" stroke-width="1.6" opacity=".7"/><text x="${X(i) + 5}" y="${YR(v) + 3.5}" font-size="${fs - 2}" font-weight="700" fill="${rC}" opacity=".85">${e2xDays(i + 1)} วัน</text>`
    : `<circle cx="${X(i)}" cy="${YR(v)}" r="2.2" fill="${rC}"${i + 1 > lastOk ? ` opacity=".45"` : ""}/>`; });
  let lm = -1; for (let i = 0; i < n; i++) { const m = epiMonth(2026, i + 1); if (m !== lm) { g += `<text x="${L + i * slot + 3}" y="${yAx + fs + 1}" font-size="${fs - 1.5}" fill="#5f6c80">${TH_M[m]}</text>`; lm = m; } }
  for (let i = 0; i < n; i++) {
    const q = o.pm[i], v = s.rate[i];
    const t = `${wkT(i)}${i + 1 > lastOk ? " · ข้อมูลเบื้องต้น" : ""}&#10;ค่าฝุ่นเฉลี่ย: ${q ? `${f1(q.m)} ± ${f1(q.sd)} µg/m³ (SD จาก ${q.n} วัน · ต่ำสุด ${f1(q.lo)} สูงสุด ${f1(q.hi)})` : "ไม่มีข้อมูลค่าฝุ่น"}&#10;${s.d.label}: ${v == null ? "–" : `${f1(v)} ต่อแสน (${fmt(s.c[i])} ราย)`}`;
    g += `<rect class="hb wkcol" x="${L + i * slot}" y="${P1.top}" width="${slot}" height="${yAx - P1.top}" data-t="${t}"/>`;
  }
  return `<svg class="bars ${W < 500 ? "pv-n" : "pv-w"}" viewBox="0 0 ${W} ${H}" role="img" aria-label="ค่าฝุ่นเฉลี่ยรายสัปดาห์และอัตรา${s.d.label} จังหวัด${o.p.name}">${g}</svg>`;
}
function e2xCard(o, s, n, lastOk, mode, RMAX) {
  // ค่าเฉลี่ย ± SD จาก "สัปดาห์เดียวกัน" ทั้งสองตัวแปร: มีค่าฝุ่นและอัตราป่วยครบ · สัปดาห์เต็ม 7 วัน · พ้นช่วงข้อมูลเบื้องต้น
  const cw = o.pm.map((q, i) => (q && s.rate[i] != null && e2xDays(i + 1) === 7 && i + 1 <= lastOk) ? i : null).filter(i => i != null);
  const pmS = e2xMS(cw.map(i => o.pm[i].m)), rS = e2xMS(cw.map(i => s.rate[i]));
  const cwT = cw.length ? `สัปดาห์ที่ ${cw[0] + 1}–${cw.at(-1) + 1}${cw.length < cw.at(-1) - cw[0] + 1 ? ` (เว้นสัปดาห์ที่ค่าฝุ่นไม่ครบ)` : ""} · ${cw.length} สัปดาห์` : "–";
  return `<article class="card dz dz-pv dzx" style="--dsoft:#f3f5f9;--dc:${o.p.color}">
    <div class="dz-top"><div class="dz-icon" style="background:color-mix(in srgb,${o.p.color} 12%,#fff);color:${o.p.color}"><svg><use href="#i-pin"/></svg></div>
      <div><h3>จ.${o.p.name}</h3><div class="icd">ประชากรกลางปี (Type 1+3) ${fmt(o.pop)} คน</div></div></div>
    ${e2xSvg(o, s, n, lastOk, 560, mode, RMAX)}${e2xSvg(o, s, n, lastOk, 380, mode, RMAX)}
    <div class="x-stat">
      <p class="x-sh">ค่าเฉลี่ย ± SD ช่วงเดียวกัน · ${cwT}</p>
      <div><span>ค่าฝุ่นเฉลี่ยรายสัปดาห์</span><b class="num">${pmS ? `${f1(pmS.m)} <small>± SD ${f1(pmS.sd)}</small>` : "–"}</b><em>µg/m³</em></div>
      <div><span>${s.d.label}</span><b class="num" style="color:${s.d.c}">${rS ? `${f1(rS.m)} <small>± SD ${f1(rS.sd)}</small>` : "–"}</b><em>ต่อแสนประชากร/สัปดาห์</em></div>
    </div>
    <div class="tip"></div></article>`;
}
function e2xAll(wkMax) {
  const src = window.DZPV; if (!src) return "";
  const n = wkMax, lastOk = wkMax - DZ_PROV_WK, data = e2xData(wkMax), k = DZ.findIndex(d => d.key === window._e2xK), mode = window._e2xMode;
  const RMAX = e2xNice(Math.max(...data.flatMap(o => o.ser[k].rate.filter(v => v != null))) * 1.05);   // สเกลเดียวกันทุกจังหวัด (ต่อกลุ่มโรค)
  const tabs = DZ.map((d, i) => `<button type="button" data-k="${d.key}" aria-pressed="${i === k}" style="--c:${d.c}"><i></i>${d.label}</button>`).join("");
  const firstPm = (() => { const PMD = window.PMREAL || S.pm?.allData || {}; const ds = Object.keys(PMD).filter(d => d >= "2026-01-01").sort(); if (!ds.length) return ""; const d = new Date(ds[0] + "T00:00:00"); return `${d.getDate()} ${TH_M[d.getMonth()]} ${d.getFullYear() + 543}`; })();
  const guide = `<details class="pv-guide pg-fold">
    <summary class="pg-h"><svg class="ico"><use href="#i-chart"/></svg><b>วิธีอ่านกราฟ</b><span class="pg-more">กดเพื่อเปิด/ปิด</span></summary>
    <ul><li><b>ช่วงข้อมูล</b> ปี 2569 สัปดาห์ระบาดวิทยาที่ 1–${n} (${epiRange(2026, 1, n)}) · ผู้ป่วยนับเฉพาะผู้อยู่อาศัยจริงในจังหวัด (Type area 1+3) · ค่าฝุ่นจากสถานีตรวจวัด Air4Thai</li>
      <li><b>แกนซ้าย · เส้นประเทาเข้ม</b> = ค่าฝุ่น PM<sub>2.5</sub> เฉลี่ยรายสัปดาห์ 0–100 µg/m³ (เฉลี่ยค่ารายวัน 24 ชม. ในสัปดาห์ระบาดวิทยา ต้องมีอย่างน้อย 4 วัน) · <b>แถบเทาจาง</b> = ± 1 SD ของค่ารายวันในสัปดาห์นั้น (กว้าง = ฝุ่นแกว่งมากระหว่างวัน) · <b>จุดส้ม</b> = สัปดาห์ที่ค่าเฉลี่ยเกิน 37.5 µg/m³ (เส้นประส้ม = เกณฑ์ค่ามาตรฐาน 24 ชม.)</li>
      <li><b>แกนขวา · เส้นทึบสีตามกลุ่มโรค</b> = อัตราผู้ป่วยต่อแสนประชากร Type area 1+3 รายสัปดาห์ · สเกลเดียวกันทั้ง 4 จังหวัด (เปลี่ยนตามกลุ่มโรคที่เลือก) · ${DZ_PROV_WK} สัปดาห์ล่าสุดเป็นเส้นประจาง = ข้อมูลเบื้องต้น</li>
      <li>ทั้งสองแกนล็อกสเกลคงที่และเริ่มที่ 0 · <u>ระยะห่างหรือการตัดกันของสองเส้นขึ้นกับการตั้งสเกล ไม่ได้บอกความสัมพันธ์</u> ให้ดูที่<b>จังหวะขึ้นลง</b>ว่าตรงกันหรือเหลื่อมกันกี่สัปดาห์</li>
      <li><b>กล่องตัวเลขใต้กราฟ</b> = ค่าเฉลี่ย ± SD ระหว่างสัปดาห์ของทั้งสองตัวแปร คำนวณจาก<b>สัปดาห์ชุดเดียวกัน</b> (มีค่าฝุ่นและอัตราป่วยครบ เป็นสัปดาห์เต็ม 7 วัน และพ้นช่วงข้อมูลเบื้องต้น) เพื่อให้เทียบกันได้ในช่วงเวลาเดียวกัน</li>
      <li><b>จุดกลวงต้นปี</b> = สัปดาห์ที่ 1 มีไม่ครบ 7 วัน (1–3 ม.ค. 2569 มี 3 วัน) อัตราผู้ป่วยจึงต่ำกว่าสัปดาห์ปกติ แสดงไว้เพื่อความครบถ้วน แต่ไม่นำมาคิดค่าเฉลี่ย</li>
      <li>เลือกกลุ่มโรคจากแถบด้านบน · ชี้หรือแตะที่สัปดาห์ใดก็ได้เพื่อดูค่าฝุ่น (เฉลี่ย ± SD, ต่ำสุด–สูงสุด) และอัตราป่วยของสัปดาห์นั้น</li>
      <li>ค่าฝุ่นสถานีมีตั้งแต่ <b>${firstPm || "–"}</b> · เส้นฝุ่นขาดช่วง = สัปดาห์ที่มีค่าไม่ถึง 4 วัน</li></ul>
    <p class="pg-ref">อ้างอิง: Bhaskaran K et al. Time series regression studies in environmental epidemiology. <i>Int J Epidemiol</i> 2013;42:1187–95 · Isenberg P et al. A study on dual-scale data charts. <i>IEEE TVCG</i> 2011;17:2469–78</p></details>
    <p class="pv-note"><b>หมายเหตุ</b> ข้อมูลนี้ใช้ติดตามแนวโน้ม ไม่ใช่หลักฐานว่าฝุ่นเป็นสาเหตุของการป่วย หากพบช่วงที่น่าสนใจ ควรวิเคราะห์ต่อด้วยวิธีอนุกรมเวลา</p>`;
  const lg = `<div class="lg pv-lg"><span><i class="ma" style="background:${DZ[k].c}"></i>อัตราผู้ป่วยต่อแสน</span><span>${mode === "dual" ? '<i class="ma dash"></i>' : `<i class="ma" style="background:${PM_INK}"></i>`}ค่าฝุ่นเฉลี่ยรายสัปดาห์</span><span><i class="sdb"></i>± SD ค่าฝุ่นรายวัน</span><span><i class="dot"></i>สัปดาห์ที่ฝุ่นเฉลี่ยเกิน 37.5</span><span><i class="hol"></i>สัปดาห์ไม่เต็ม 7 วัน</span><span><i class="pt"></i>สัปดาห์ที่ ${lastOk + 1}–${n} ข้อมูลเบื้องต้น</span><span><i class="hd"></i>วันหยุดยาว</span></div>`;
  return `<section class="pv-block e2x" aria-labelledby="pvH">
    <div class="pv-bh"><div class="dz-icon" style="background:#e6ebf2;color:#33415c"><svg><use href="#i-map"/></svg></div>
      <div><h3 id="pvH">ค่าฝุ่นกับผู้ป่วยรายสัปดาห์ แยกรายจังหวัด</h3>
      <div class="icd">ค่าฝุ่น PM<sub>2.5</sub> เฉลี่ยรายสัปดาห์ (µg/m³) · อัตราผู้ป่วยต่อแสนประชากร · ปี 2569</div></div>
</div>
    <div class="x-bar"><div class="x-tabs" role="group" aria-label="เลือกกลุ่มโรค">${tabs}</div></div>
    ${lg}
    <div class="pv-grid">${data.map(o => e2xCard(o, o.ser[k], n, lastOk, mode, RMAX)).join("")}</div>
    ${guide}</section>`;
}
function e2xViewTg() {
  const v = window._e2xView;
  return `<div class="seg x-view" role="group" aria-label="มุมมอง"><button type="button" data-v="x" aria-pressed="${v === "x"}">เทียบแนวโน้ม</button><button type="button" data-v="b" aria-pressed="${v === "b"}">แท่งอัตราป่วย (เดิม)</button></div>`;
}
function e2xBlock(wkMax) { return e2xAll(wkMax); }   // แทนแผงแท่งอัตราป่วยเดิม
// ปุ่มเลือกกลุ่มโรค / รูปแบบกราฟ / มุมมอง (event delegation — ผูกครั้งเดียว)
document.addEventListener("click", e => {
  const b = e.target.closest(".x-tabs button, .x-view button, .x-mode button"); if (!b) return;
  if (b.dataset.k) window._e2xK = b.dataset.k; else if (b.dataset.m) window._e2xMode = b.dataset.m; else window._e2xView = b.dataset.v;
  const y = document.getElementById("pvH")?.getBoundingClientRect().top;
  renderDisease();
  const y2 = document.getElementById("pvH")?.getBoundingClientRect().top; if (y != null && y2 != null) window.scrollBy(0, y2 - y);   // คงตำแหน่งหน้าจอ
});
