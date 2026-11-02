// E2–E5 · การ์ดรายจังหวัด: แถบค่าฝุ่นเฉลี่ยรายสัปดาห์ + อัตราผู้ป่วยต่อแสนประชากร 4 กลุ่มโรค (แกนเวลาเดียวกัน)
// หลักการ: ไม่ใช้กราฟ 2 แกน · อัตราต่อแสน (เทียบข้ามจังหวัดได้) · สเกลเดียวกันทุกจังหวัดต่อกลุ่มโรค
//          เส้นเฉลี่ยเคลื่อนที่ 4 สัปดาห์ (ลดการแกว่งจากจำนวนน้อย) หยุดก่อนช่วงข้อมูลเบื้องต้น · ระบุวันหยุดยาวบนแกนเวลา
const HOLI26 = [{ wk: 1, t: "ปีใหม่" }, { wk: epiWeekOf(new Date(2026, 3, 13)), t: "สงกรานต์" }];   // สัปดาห์ระบาดวิทยาที่มีวันหยุด
const wkStart = wk => epiStart(2026, wk);
const dmy = d => `${d.getDate()} ${TH_M[d.getMonth()]}`;
function pvWeekPM(pv, wk) {
  const all = S.pm?.allData || {}, s = wkStart(wk), nd = Math.round((epiEnd(2026, wk) - s) / 864e5) + 1, v = [];
  for (let i = 0; i < nd; i++) {
    const d = new Date(s.getTime() + i * 864e5), iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const x = all[iso]?.[pv]; if (x != null && x > 0) v.push(x);
  }
  return v.length >= Math.min(4, nd) ? v.reduce((a, b) => a + b, 0) / v.length : null;   // ต้องมีค่าอย่างน้อย 4 วัน/สัปดาห์ (สัปดาห์ไม่เต็มใช้ทุกวันที่มี)
}
function dzPvAll(wkMax) {
  const src = window.DZPV; if (!src) return "";
  const n = wkMax, lastOk = wkMax - DZ_PROV_WK;                               // สัปดาห์สุดท้ายที่ข้อมูลครบ
  const data = PROV.map(p => {
    const pop = src.pop[p.name], rows = src.rows.filter(r => r.pv === p.name && r.wk <= n).sort((a, b) => a.wk - b.wk);
    const ser = DZ.map(d => {
      const k = DZPV_COL[d.key], c = Array(n).fill(null);
      rows.forEach(r => { c[r.wk - 1] = +r[k]; });
      const rate = c.map(x => x == null ? null : x / pop * 1e5);
      const ma = rate.map((_, i) => i + 1 > lastOk || i < 3 || rate.slice(i - 3, i + 1).some(x => x == null) ? null : rate.slice(i - 3, i + 1).reduce((a, b) => a + b, 0) / 4);
      return { d, c, rate, ma };
    });
    return { p, pop, ser, pm: Array.from({ length: n }, (_, i) => pvWeekPM(p.name, i + 1)) };
  });
  // สเกลเดียวกันทุกจังหวัด (ต่อกลุ่มโรค) · แกนค่าฝุ่นล็อก 0–100 µg/m³ ทุกจังหวัด (ไม่ปรับตามข้อมูล)
  const mx = DZ.map((_, k) => Math.max(...data.flatMap(o => o.ser[k].rate.filter(x => x != null))) * 1.08);
  const guide = `<div class="pv-guide">
    <div class="pg-h"><svg class="ico"><use href="#i-chart"/></svg><b>วิธีอ่านกราฟและข้อควรระวัง</b></div>
    <ul><li>นับตาม<b>สัปดาห์ระบาดวิทยา</b> (อาทิตย์–เสาร์) ทั้งค่าฝุ่นและผู้ป่วย</li>
      <li><b>แท่งสี</b> = ผู้ป่วยต่อประชากรแสนคน รายสัปดาห์ (แกนซ้าย) · สเกลเดียวกันทุกจังหวัด เทียบข้ามจังหวัดได้</li>
      <li><b>เส้นและจุดสีเทาเข้ม</b> = ค่าฝุ่น PM<sub>2.5</sub> เฉลี่ยรายสัปดาห์ของจังหวัด (แกนขวา คงที่ 0–100 µg/m³ ทุกจังหวัด) · 1 จุด = 1 สัปดาห์ ตรงกับแท่งด้านล่าง</li>
      <li>ชี้หรือแตะที่สัปดาห์ใดก็ได้ จะเห็นค่าฝุ่นและอัตราป่วยทั้ง 4 กลุ่มของสัปดาห์นั้นพร้อมกัน</li>
      <li><b>ผู้ป่วย (ตัวตั้ง)</b> = ผู้ป่วยนอกและผู้ป่วยในที่<b>อยู่อาศัยจริงในจังหวัด</b> (Type area 1 และ 3) นับเป็นรายคน ตัดซ้ำในแต่ละสัปดาห์ · รหัสโรคตามประกาศกระทรวงสาธารณสุขฯ (HDC รายงาน PM<sub>2.5</sub> รายสัปดาห์ ชุดที่ 2)</li>
      <li><b>ประชากร (ตัวหาร)</b> = ประชากร Type area 1+3 (อยู่จริงในพื้นที่ ตัดซ้ำแล้ว) จาก HDC ประมาณ ณ 1 ก.ค. 2569 จากยอดสิ้นปีงบประมาณ 2568 และ 2569 · ตัวตั้งและตัวหารเป็นประชากรกลุ่มเดียวกัน</li>
      <li>ยอดผู้ป่วยรายจังหวัดในแผงนี้จึง<b>น้อยกว่า</b>ยอดรวมเขตด้านบน ซึ่งนับผู้ป่วยทุกคนที่มารับบริการ (รวมผู้ที่อยู่นอกพื้นที่)</li></ul>
    <p class="pg-w"><b>ข้อควรระวัง</b> กราฟนี้ใช้ดูว่าค่าฝุ่นกับผู้ป่วยขึ้นลงในช่วงเดียวกันหรือไม่ <u>ไม่ได้แสดงว่าฝุ่นเป็นสาเหตุ</u> จำนวนผู้ป่วยยังขึ้นกับฤดูกาล วันหยุดยาว (ปีใหม่ สงกรานต์ ทำให้ตัวเลขลดลง) และความครบถ้วนของการรายงาน · อัตรานี้ใช้ตัวหารคนละชุดกับรายงานกรมควบคุมโรค (ประชากรกลางปีกระทรวงมหาดไทย) จึงเทียบตัวเลขกันตรงๆ ไม่ได้</p></div>`;
  const lg = `<div class="lg pv-lg"><span><i style="background:#8a96a8"></i>แท่ง = ผู้ป่วยต่อแสน/สัปดาห์ (แกนซ้าย)</span><span><i class="ma" style="background:${PM_INK}"></i>ค่าฝุ่นรายสัปดาห์ µg/m³ (แกนขวา 0–100)</span><span><i class="dot"></i>สัปดาห์ที่ฝุ่นเกิน 37.5</span><span><i class="pt"></i>สัปดาห์ที่ ${lastOk + 1}–${n} ข้อมูลเบื้องต้น</span><span><i class="hd"></i>วันหยุดยาว</span></div>`;
  return `<section class="pv-block" aria-labelledby="pvH">
    <div class="pv-bh"><div class="dz-icon" style="background:#e6ebf2;color:#33415c"><svg><use href="#i-map"/></svg></div>
      <div><h3 id="pvH">ค่าฝุ่นกับผู้ป่วยรายสัปดาห์ แยกรายจังหวัด${window.DZPV?.mock ? ` <span class="mock-b">ข้อมูลจำลอง</span>` : ""}</h3>
      <div class="icd">อัตราผู้ป่วยต่อแสนประชากร Type area 1+3 (HDC กลางปี 2569) 4 กลุ่มโรค เทียบค่าฝุ่น PM<sub>2.5</sub> เฉลี่ยรายสัปดาห์ของจังหวัด · ปี 2569 สัปดาห์ระบาดวิทยาที่ 1–${n} (${epiRange(2026, 1, n)})</div></div><button type="button" class="ds-jump" data-preset="analysis" style="margin-left:auto"><svg class="ico"><use href="#i-down"/></svg>ดาวน์โหลดชุดวิเคราะห์</button></div>
    ${lg}
    <div class="pv-grid">${data.map((o, pi) => dzPvCard(o, n, lastOk, mx, pi, "b")).join("")}</div>
    ${guide}</section>`;
}
function pvVar(v) {
  const el = document.getElementById("dz"); el.dataset.pv = v;
  el.querySelectorAll(".pv-tg button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === v)));
}
const DZPV_COL = { "ทางเดินหายใจ": "resp", "หัวใจ": "heart", "ตาอักเสบ": "eye", "ผิวหนัง": "skin" };
const PM_AX = 100, PM_INK = "#2b2f3a";
function pmPath(pm, X, slot, Y) {
  let d = "", on = false;
  pm.forEach((v, i) => { if (v == null) { on = false; return; } d += `${on ? "L" : "M"}${(X(i) + slot / 2).toFixed(1)} ${Y(Math.min(v, PM_AX)).toFixed(1)}`; on = true; });
  return d;
}
function dzPvSvg(o, n, lastOk, mx, pi, W, v) {
  const B_ = v === "b", fs = 11, L = B_ ? 30 : 4, R = B_ ? 30 : (W < 500 ? 40 : 46), pw = W - L - R, slot = pw / n, bw = Math.max(2, slot - 2);
  const X = i => L + i * slot;
  const LH = 17, PMP = B_ ? 0 : 64, PH = B_ ? 54 : 40, ML = fs + 3, GAP = 9, B = fs * 1.8;   // ML = แถวชื่อเดือนใต้ทุกแถวโรค
  const dz0 = B_ ? 0 : LH + PMP + GAP + 4;
  const H = dz0 + DZ.length * (LH + PH + ML + GAP) - GAP + B, yAx = H - B;
  const pid = `pvPart${pi}_${W}_${v}`;
  const wkT = i => { const w0 = wkStart(i + 1), w1 = epiEnd(2026, i + 1); return `สัปดาห์ที่ ${i + 1} (${dmy(w0)}–${dmy(w1)})`; };
  let g = `<defs><pattern id="${pid}" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="#fff" stroke-width="2" opacity=".8"/></pattern></defs>`;
  g += `<rect x="${X(lastOk)}" y="${dz0}" width="${(n - lastOk) * slot}" height="${yAx - dz0}" fill="#eef1f5"/>`;
  if (!B_) {
    // ── แบบ ก: กราฟเส้นค่าฝุ่นแยกด้านบน พื้นหลังตามเกณฑ์ ──
    const top = LH, base = LH + PMP, Y = x => base - x / PM_AX * PMP;
    g += `<text x="${L}" y="${fs + 1}" font-size="${fs}" font-weight="700" fill="#1f2a3d">ค่าฝุ่น PM<tspan font-size="${fs * .72}" dy="3">2.5</tspan><tspan dy="-3"> เฉลี่ยรายสัปดาห์ (µg/m³)</tspan></text>`;
    let lo = 0;
    LV.forEach(l => { const hi = Math.min(l.max ?? PM_AX, PM_AX); if (hi > lo) g += `<rect x="${L}" y="${Y(hi)}" width="${pw}" height="${Y(lo) - Y(hi)}" fill="${l.soft}" opacity=".85"/>`; lo = hi; });
    g += `<line x1="${L}" x2="${W - R}" y1="${Y(37.5)}" y2="${Y(37.5)}" stroke="#c2410c" stroke-dasharray="4 3" stroke-width="1.2"/>`;
    [0, 37.5, 75].forEach(t => { g += `<text x="${W - R + 5}" y="${Y(t) + fs * .35}" font-size="${fs - 1.5}" fill="${t === 37.5 ? "#c2410c" : "#6b7689"}" font-weight="${t === 37.5 ? 700 : 500}">${t}</text>`; });
    o.pm.forEach((x, i) => { g += `<rect class="hb" x="${X(i)}" y="${top}" width="${slot}" height="${PMP}" fill="transparent" data-t="${wkT(i)}: ${x == null ? "ไม่มีข้อมูลค่าฝุ่น" : `ค่าฝุ่นเฉลี่ย ${f1(x)} µg/m³ · ${LV[lvOf(x)].name}`}"/>`; });
    g += `<path d="${pmPath(o.pm, X, slot, Y)}" fill="none" stroke="${PM_INK}" stroke-width="2.2" stroke-linejoin="round" pointer-events="none"/>`;
  }
  HOLI26.filter(h => h.wk <= n).forEach(h => { const x = X(h.wk - 1) + slot / 2; g += `<line x1="${x}" x2="${x}" y1="${B_ ? 0 : LH}" y2="${yAx}" stroke="#8a96a8" stroke-dasharray="2 3"/>`; });
  o.ser.forEach((s, k) => {
    const top = dz0 + k * (LH + PH + ML + GAP), base = top + LH + PH, Y = x => base - x / mx[k] * PH, YP = x => base - Math.min(x, PM_AX) / PM_AX * PH;
    g += `<circle cx="${L + 4.5}" cy="${top + 7}" r="4.5" fill="${s.d.c}"/><text x="${L + 13}" y="${top + 11}" font-size="${fs}" font-weight="700" fill="#1f2a3d">${s.d.label}</text>`;
    g += `<line x1="${L}" x2="${W - R}" y1="${base}" y2="${base}" stroke="rgba(15,27,45,.16)"/>`;
    if (B_) {
      const tTop = mx[k] / 1.08;
      g += `<text x="${L - 4}" y="${Y(tTop) + fs * .35}" text-anchor="end" font-size="${fs - 1.5}" font-weight="700" fill="${s.d.c}">${tTop >= 10 ? Math.round(tTop) : f1(tTop)}</text><text x="${L - 4}" y="${base}" text-anchor="end" font-size="${fs - 1.5}" fill="${s.d.c}">0</text>`;
      g += `<line x1="${L}" x2="${W - R}" y1="${Y(tTop)}" y2="${Y(tTop)}" stroke="rgba(15,27,45,.07)"/>`;
      [0, 50, 100].forEach(t => { g += `<text x="${W - R + 4}" y="${YP(t) + (t === 100 ? fs * .7 : t === 0 ? 0 : fs * .35)}" font-size="${fs - 1.5}" fill="#6b7689">${t}</text>`; });
    }
    s.rate.forEach((x, i) => {
      if (x == null) return;
      const part = i + 1 > lastOk;
      g += `<rect class="hb" x="${X(i) + 1}" y="${Y(x)}" width="${bw}" height="${base - Y(x)}" fill="${s.d.c}" opacity="${B_ ? (part ? .4 : .55) : .3}" data-t="${wkT(i)} · ${s.d.label}: ${f1(x)} ต่อแสน (${fmt(s.c[i])} ราย)${!B_ && s.ma[i] != null ? ` · เฉลี่ย 4 สัปดาห์ ${f1(s.ma[i])}` : ""}${part ? " · ข้อมูลเบื้องต้น" : ""}${o.pm[i] != null ? ` · ฝุ่น ${f1(o.pm[i])} µg/m³` : ""}"/>`;
      if (part) g += `<rect x="${X(i) + 1}" y="${Y(x)}" width="${bw}" height="${base - Y(x)}" fill="url(#${pid})" pointer-events="none"/>`;
    });
    if (B_) {
      g += `<path d="${pmPath(o.pm, X, slot, YP)}" fill="none" stroke="${PM_INK}" stroke-width="1.6" stroke-linejoin="round" pointer-events="none"/>`
        + o.pm.map((x, i) => x == null ? "" : `<circle cx="${X(i) + slot / 2}" cy="${YP(x)}" r="${W < 500 ? 1.9 : 2.3}" fill="${x > 37.5 ? "#c2410c" : PM_INK}" pointer-events="none"/>`).join("");
    } else {
      let path = "", on = false;
      s.ma.forEach((x, i) => { if (x == null) { on = false; return; } path += `${on ? "L" : "M"}${(X(i) + slot / 2).toFixed(1)} ${Y(x).toFixed(1)}`; on = true; });
      g += `<path d="${path}" fill="none" stroke="${s.d.c}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`;
      const li = s.ma.findLastIndex(x => x != null);
      if (li >= 0) g += `<circle cx="${X(li) + slot / 2}" cy="${Y(s.ma[li])}" r="3" fill="${s.d.c}"/><text x="${W - R + 5}" y="${Y(s.ma[li]) + fs * .35}" font-size="${fs}" font-weight="700" fill="${s.d.c}">${f1(s.ma[li])}</text>`;
    }
  });
  if (B_) for (let i = 0; i < n; i++) {
    const part = i + 1 > lastOk, h = HOLI26.find(x => x.wk === i + 1);
    const t = `${wkT(i)}${h ? ` · ช่วง${h.t}` : ""}${part ? " · ข้อมูลเบื้องต้น" : ""}&#10;ค่าฝุ่นเฉลี่ย: ${o.pm[i] == null ? "ไม่มีข้อมูล" : `${f1(o.pm[i])} µg/m³ (${LV[lvOf(o.pm[i])].name})`}`
      + o.ser.map(s => `&#10;${s.d.label}: ${s.rate[i] == null ? "–" : `${f1(s.rate[i])} ต่อแสน (${fmt(s.c[i])} ราย)`}`).join("");
    g += `<rect class="hb wkcol" x="${X(i)}" y="0" width="${slot}" height="${yAx}" data-t="${t}"/>`;
  }
  // ชื่อเดือนใต้ทุกแถวโรค (ที่สัปดาห์แรกของแต่ละเดือน)
  for (let k = 0; k < DZ.length; k++) {
    const base = dz0 + k * (LH + PH + ML + GAP) + LH + PH; let lm = -1;
    for (let i = 0; i < n; i++) { const m = epiMonth(2026, i + 1); if (m !== lm) { g += `<text x="${X(i) + 4}" y="${base + fs}" font-size="${fs - 1.5}" fill="#5f6c80">${TH_M[m]}</text>`; lm = m; } }
  }
  HOLI26.filter(h => h.wk <= n).forEach(h => { g += `<text x="${X(h.wk - 1) + slot / 2 + 3}" y="${yAx + fs + 1}" font-size="${fs - 1.5}" fill="#6b7689">${h.t}</text>`; });
  return `<svg class="bars ${W < 500 ? "pv-n" : "pv-w"}" viewBox="0 0 ${W} ${H}" role="img" aria-label="ค่าฝุ่นรายสัปดาห์และอัตราผู้ป่วย 4 กลุ่มโรค จังหวัด${o.p.name}">${g}</svg>`;
}
function dzPvCard(o, n, lastOk, mx, pi, v) {
  const pmLast = [...o.pm].reverse().find(x => x != null);
  const lvl = pmLast != null ? LV[lvOf(pmLast)] : null;
  const lg = v === "b"
    ? `<span><i style="background:#8a96a8"></i>แท่ง = ผู้ป่วยต่อแสน/สัปดาห์ (แกนซ้าย)</span><span><i class="ma" style="background:${PM_INK}"></i>ค่าฝุ่นรายสัปดาห์ µg/m³ (แกนขวา 0–100)</span><span><i class="dot"></i>จุดส้ม = สัปดาห์ที่ฝุ่นเกิน 37.5</span>`
    : `<span><i class="ma" style="background:${PM_INK}"></i>เส้นเทาเข้ม = ค่าฝุ่น</span><span><i class="ma"></i>เส้นสี = ผู้ป่วยเฉลี่ย 4 สัปดาห์ (ตัวเลขขวา = ค่าล่าสุดที่ข้อมูลครบ)</span>`;
  return `<article class="card dz dz-pv v-${v}" style="--dsoft:#f3f5f9;--dc:${o.p.color}">
    <div class="dz-top"><div class="dz-icon" style="background:color-mix(in srgb,${o.p.color} 12%,#fff);color:${o.p.color}"><svg><use href="#i-pin"/></svg></div>
      <div><h3>จ.${o.p.name}</h3><div class="icd">ประชากรกลางปี (Type 1+3) ${fmt(o.pop)} คน</div></div>
      ${lvl ? `<div class="pv-pm" style="background:${lvl.soft};color:${lvl.ink}"><span>ฝุ่นสัปดาห์ล่าสุด</span><b class="num">${f1(pmLast)}</b><small>µg/m³ · ${lvl.name}</small></div>` : ""}</div>
    ${dzPvSvg(o, n, lastOk, mx, pi, 560, v)}${dzPvSvg(o, n, lastOk, mx, pi, 380, v)}
    <div class="tip"></div></article>`;
}
