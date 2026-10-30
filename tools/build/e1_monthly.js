// E1 · ผู้ป่วยรวมรายเดือน (ชี้ดูค่าเฉลี่ยราย/สัปดาห์ในกล่องรายละเอียด) 4 กลุ่มโรค ปี 2569 ทั้งเขต — แยกแผงรายกลุ่ม (small multiples)
// ① กราฟแสดงยอดรวมผู้ป่วยทั้งเดือน · ค่าเฉลี่ยราย/สัปดาห์ (เทียบข้ามเดือนได้เมื่อเดือนมี 4 หรือ 5 สัปดาห์) อยู่ใน tooltip
// ก. 4 สัปดาห์ล่าสุดถือเป็นข้อมูลเบื้องต้น (รายงานล่าช้า) → เดือนที่มีสัปดาห์เหล่านี้แสดงลายเส้น ไม่ใช้สรุปแนวโน้ม
// ---------- สัปดาห์ระบาดวิทยา (กรมควบคุมโรค) ----------
// อาทิตย์–เสาร์ · สัปดาห์ที่ 1 = 1 ม.ค. ถึงวันเสาร์แรกของปี (อาจไม่ครบ 7 วัน) · สัปดาห์สุดท้ายสิ้นสุด 31 ธ.ค.
// ตรวจกับรายงาน WESR ปี 2569: สัปดาห์ที่ 9 = 22–28 ก.พ., สัปดาห์ที่ 17 = 19–25 เม.ย., สัปดาห์ที่ 1–10 = 1 ม.ค.–7 มี.ค.
function epiStart(y, wk) { const j = new Date(y, 0, 1), off = (7 - j.getDay()) % 7 || 7; return wk === 1 ? j : new Date(y, 0, 1 + off + (wk - 2) * 7); }
function epiEnd(y, wk) { const s = epiStart(y, wk), e = new Date(y, s.getMonth(), s.getDate() + 6 - s.getDay()); return e.getFullYear() > y ? new Date(y, 11, 31) : e; }
function epiMonth(y, wk) { const s = epiStart(y, wk), e = epiEnd(y, wk); return new Date((s.getTime() + e.getTime()) / 2).getMonth(); }   // เดือนที่มีวันอยู่มากกว่า
function epiWeekOf(d) { const y = d.getFullYear(), s2 = epiStart(y, 2); return d < s2 ? 1 : 2 + Math.floor(Math.round((d - s2) / 864e5) / 7); }
const epiRange = (y, w0, w1) => { const a = epiStart(y, w0), b = epiEnd(y, w1 ?? w0); return `${a.getDate()} ${TH_M[a.getMonth()]}–${b.getDate()} ${TH_M[b.getMonth()]}`; };
const DZ_PROV_WK = 4;
function monthlyWk(rows, key, upToWk, yearCE) {
  const sum = Array(12).fill(0), n = Array(12).fill(0), prov = Array(12).fill(false), wks = Array.from({ length: 12 }, () => []), shortD = Array(12).fill(0);
  for (const r of rows || []) {
    const wk = +r.wk; if (!wk || wk > upToWk) continue;
    const k = Object.keys(r).find(x => x.includes(key)); const v = +String(r[k] ?? "").replace(/,/g, "");
    if (!k || isNaN(v)) continue;
    const mo = epiMonth(yearCE, wk);
    sum[mo] += v; n[mo]++; wks[mo].push(wk); if (wk > upToWk - DZ_PROV_WK) prov[mo] = true;
    const nd = Math.round((epiEnd(yearCE, wk) - epiStart(yearCE, wk)) / 864e5) + 1; if (nd < 7) shortD[mo] = nd;   // สัปดาห์ไม่เต็ม 7 วัน
  }
  return sum.map((s, i) => n[i] ? { avg: s / n[i], sum: s, n: n[i], prov: prov[i], w0: Math.min(...wks[i]), w1: Math.max(...wks[i]), short: shortD[i] } : null);
}
// E1 กราฟเส้นรายเดือน: ค่า = ผู้ป่วยรวมทั้งเดือน · tooltip = ค่าเฉลี่ยราย/สัปดาห์ (ยอดรวม ÷ จำนวนสัปดาห์ระบาดวิทยา)
// ข้อควรระวัง: เดือนมี 4 หรือ 5 สัปดาห์ เดือน 5 สัปดาห์ยอดรวมจึงสูงขึ้นตามจำนวนสัปดาห์ → ระบุใน tooltip และวิธีอ่านกราฟ
// แต่ละกลุ่มโรคแผงของตัวเอง (small multiples) · แกนไม่เริ่มที่ 0 เพื่อเห็นการขึ้นลง (Cleveland 1993: กราฟเส้นไม่จำเป็นต้องเริ่มที่ 0)
const e1Nice = (v, up) => { if (v <= 0) return 0; const p = 10 ** Math.floor(Math.log10(v)), st = p / (v / p < 2 ? 4 : 2); return (up ? Math.ceil(v / st) : Math.floor(v / st)) * st; };
function dzMonthSvg(ser, last, W, pid) {
  const n = last + 1, wide = W > 800;
  const fs = wide ? 11.5 : 11, L = wide ? 52 : 38, R = wide ? 24 : 12, pw = W - L - R, slot = pw / n;
  const LH = 22, PH = wide ? 92 : 80, ML = fs + 8, GAP = 14;
  const H = ser.length * (LH + PH + ML + GAP) - GAP, X = i => L + i * slot + slot / 2;
  const provM = ser[0].m.map(o => o?.prov);
  let g = "";
  provM.forEach((p, i) => { if (p) g += `<rect x="${L + i * slot + 1}" y="0" width="${slot - 2}" height="${H - ML + fs}" rx="6" fill="#eef1f5"/>`; });
  ser.forEach((s, k) => {
    const top = k * (LH + PH + ML + GAP), y0 = top + LH + 8, base = top + LH + PH;
    const vals = s.m.map(o => o?.sum ?? null), ok = vals.filter(v => v != null);
    const mn = Math.min(...ok), mxv = Math.max(...ok), raw = Math.max((mxv - mn) / 2.5, mxv * .02), p10 = 10 ** Math.floor(Math.log10(raw)), f = raw / p10;
    const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p10;   // ช่วงเส้นกริดเป็นเลขกลม
    const lo = Math.max(0, Math.floor(mn * .97 / step) * step), hi = Math.ceil(mxv * 1.04 / step) * step;
    const Y = v => base - (v - lo) / (hi - lo) * (base - y0), ticks = []; for (let t = lo; t <= hi + 1e-9; t += step) ticks.push(t);
    g += `<circle cx="${L - 34 + (wide ? 0 : 6)}" cy="${top + 8}" r="5" fill="${s.d.c}"/><text x="${L - 24 + (wide ? 0 : 6)}" y="${top + 12}" font-size="${fs + 1.5}" font-weight="700" fill="#1f2a3d">${s.d.label}<tspan font-size="${fs - .5}" font-weight="600" fill="#6b7689"> · ราย/เดือน</tspan></text>`;
    ticks.forEach((t, j) => {
      g += `<line x1="${L}" x2="${W - R}" y1="${Y(t)}" y2="${Y(t)}" stroke="rgba(15,27,45,${j ? .08 : .2})"${j ? ` stroke-dasharray="2 4"` : ""}/>`
        + `<text x="${L - 6}" y="${Y(t) + 4}" text-anchor="end" font-size="${fs - 1}" fill="#6b7689">${fmt(Math.round(t))}</text>`;
    });
    for (let i = 0; i < n; i++) g += `<text x="${X(i)}" y="${base + fs + 5}" text-anchor="middle" font-size="${fs}" fill="#5f6c80">${TH_M[i]}${provM[i] ? "*" : ""}${s.m[i]?.short ? "†" : ""}</text>`;
    // เส้น: ช่วงข้อมูลครบเป็นเส้นทึบ · ต่อไปยังเดือนข้อมูลเบื้องต้นเป็นเส้นประ
    let solid = "", dash = "", prev = null;
    vals.forEach((v, i) => {
      if (v == null) { prev = null; return; }
      const pt = `${X(i).toFixed(1)} ${Y(v).toFixed(1)}`;
      if (s.m[i].prov) dash += prev ? `M${prev}L${pt}` : `M${pt}`;
      else solid += solid && prev ? `L${pt}` : `M${pt}`;
      prev = pt;
    });
    g += `<path d="${solid}" fill="none" stroke="${s.d.c}" stroke-width="${wide ? 3 : 2.6}" stroke-linejoin="round" stroke-linecap="round"/>`
      + `<path d="${dash}" fill="none" stroke="${s.d.c}" stroke-width="2.2" stroke-dasharray="5 4" opacity=".6"/>`;
    vals.forEach((v, i) => {
      if (v == null) return;
      const o = s.m[i], part = o.prov, x = X(i), y = Y(v);
      g += `<circle cx="${x}" cy="${y}" r="${wide ? 5 : 4}" fill="${part ? "#fff" : s.d.c}" stroke="${s.d.c}" stroke-width="${part ? 2.2 : 2}"${o.short && !part ? ` fill-opacity=".45"` : ""}/>`
        + `<text x="${x}" y="${y - (wide ? 10 : 8)}" text-anchor="middle" font-size="${fs}" font-weight="700" fill="${part ? "#8a96a8" : "#1f2a3d"}" stroke="#fff" stroke-width="3" paint-order="stroke">${fmt(Math.round(v))}</text>`
        + `<rect class="hb" x="${L + i * slot}" y="${top}" width="${slot}" height="${PH + LH}" fill="transparent" data-t="${TH_M[i]} 2569 · ${s.d.label}&#10;รวมทั้งเดือน ${fmt(o.sum)} ราย&#10;เฉลี่ย ${fmt(Math.round(o.avg))} ราย/สัปดาห์ (${o.n} สัปดาห์ระบาดวิทยา · สัปดาห์ที่ ${o.w0}–${o.w1} · ${epiRange(2026, o.w0, o.w1)})${o.n >= 5 ? `&#10;เดือนนี้มี ${o.n} สัปดาห์ ยอดรวมจึงสูงกว่าเดือนที่มี 4 สัปดาห์ · เทียบข้ามเดือนให้ดูค่าเฉลี่ยราย/สัปดาห์` : ""}${o.short ? `&#10;† รวมสัปดาห์ไม่เต็ม (สัปดาห์ที่ 1 มี ${o.short} วัน) ยอดรวมและค่าเฉลี่ยจึงต่ำกว่าจริงเล็กน้อย` : ""}${part ? "&#10;ข้อมูลเบื้องต้น รายงานยังไม่ครบ" : ""}"/>`;
    });
  });
  return `<svg class="bars ${wide ? "w-w" : "w-n"}" viewBox="0 0 ${W} ${H}" role="img" aria-label="ผู้ป่วยรวมรายเดือน 4 กลุ่มโรค ปี 2569 ทั้งเขตสุขภาพที่ 7 แยกแผงรายกลุ่ม">${g}</svg>`;
}
// E1 กินเต็มความกว้าง: จอกว้างใช้กราฟ 1100 · จอแคบใช้ 560 (สลับด้วย CSS)
function dzMonthAll(dz, wkMax) {
  const ser = DZ.map(d => ({ d, m: monthlyWk(dz[2026], d.key, wkMax, 2026) }));
  const last = Math.max(...ser.flatMap(s => s.m.map((v, i) => v != null ? i : -1)));
  const asOf = (() => { const p = String(dz.meta?.dataDate || "").split("/"); return p.length === 3 ? `${+p[0]} ${TH_M[+p[1] - 1]} ${+p[2] + 543}` : ""; })();
  return `<article class="card dz dz-all" style="--dsoft:#eef2f7;--dc:#5f6c80">
    <div class="dz-top"><div class="dz-icon" style="background:#e6ebf2;color:#33415c"><svg><use href="#i-chart"/></svg></div>
      <div><h3>ผู้ป่วย 4 กลุ่มโรค รายเดือน</h3><div class="icd">ทั้งเขตสุขภาพที่ 7 · ปี 2569 (${TH_M[0]}–${TH_M[last]}) · หน่วย: <b>ราย/เดือน</b> (ยอดรวมทั้งเดือน · ชี้ที่จุดเพื่อดูค่าเฉลี่ยราย/สัปดาห์) · ผู้ป่วยสัญชาติไทยทุกคนที่รับบริการในเขต รวมผู้อยู่นอกพื้นที่</div></div><button type="button" class="ds-jump" data-preset="weekly" style="margin-left:auto"><svg class="ico"><use href="#i-down"/></svg>ดาวน์โหลดข้อมูล</button></div>
    ${dzMonthSvg(ser, last, 1100, "dzPartW")}${dzMonthSvg(ser, last, 400, "dzPartN")}
    <details class="pv-guide pg-fold dz-fold"><summary class="pg-h"><svg class="ico"><use href="#i-chart"/></svg><b>วิธีอ่านกราฟ</b><span class="pg-more">กดเพื่อเปิด/ปิด</span></summary>
    <ul><li><b>จุดและตัวเลข</b> = ผู้ป่วยรวมทั้งเดือนนั้น · ชี้ที่จุดเพื่อดู<b>ค่าเฉลี่ยราย/สัปดาห์</b> (ยอดรวม ÷ จำนวนสัปดาห์ระบาดวิทยาในเดือน) · เดือนที่มี 5 สัปดาห์ยอดรวมจะสูงกว่าเดือนที่มี 4 สัปดาห์ ถ้าจะเทียบข้ามเดือนให้ดูค่าเฉลี่ยราย/สัปดาห์</li>
      <li>นับตาม<b>สัปดาห์ระบาดวิทยา</b> (อาทิตย์–เสาร์ · สัปดาห์ที่ 1 = 1 ม.ค. ถึงเสาร์แรกของปี) สัปดาห์ที่คร่อมสองเดือนนับเข้าเดือนที่มีวันมากกว่า</li>
      <li>แต่ละกลุ่มโรคมีแกนของตัวเอง และ<b>แกนไม่เริ่มที่ 0</b> เพื่อให้เห็นการขึ้นลงชัด · เทียบขนาดจริงจากตัวเลขบนจุด</li>
      <li><b>จุดกลวงต่อด้วยเส้นประ</b> และพื้นเทา (เดือนที่มี *) = มีข้อมูลเบื้องต้นรวมอยู่</li>
      <li><b>จุดจาง (เดือนที่มี †)</b> = มีสัปดาห์ไม่เต็ม 7 วันรวมอยู่ (สัปดาห์ที่ 1 = 1–3 ม.ค. 2569) ยอดรวมของเดือนนั้นจึงต่ำกว่าจริงเล็กน้อย</li></ul></details>
    <div class="dz-note"><b>หมายเหตุ</b> ข้อมูลจาก HDC${asOf ? ` ณ ${asOf}` : ""} อาจยังไม่สมบูรณ์ หน่วยบริการบางแห่งรายงานยังไม่ครบ <span class="nw">* ${DZ_PROV_WK} สัปดาห์ล่าสุด (สัปดาห์ที่ ${wkMax - DZ_PROV_WK + 1}–${wkMax} · ${epiRange(2026, wkMax - DZ_PROV_WK + 1, wkMax)}) เป็นข้อมูลเบื้องต้น แสดงเป็นจุดกลวงเส้นประ ตัวเลขมักเพิ่มขึ้นเมื่อรายงานครบ จึงไม่ใช้สรุปแนวโน้ม</span><span class="nw"><b>การอ่านผล</b> เปรียบเทียบเชิงสถานการณ์เพื่อเฝ้าระวัง ไม่ได้ทดสอบความสัมพันธ์เชิงสาเหตุกับฝุ่น</span></div>
    <div class="tip"></div></article>`;
}
