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
// E1 ฉบับ 12 เดือน (1 พ.ย. 2569): กราฟแท่ง = ผู้ป่วยรวมรายเดือน + เส้น = ค่าฝุ่นเฉลี่ยรายเดือน ย้อนหลัง 12 เดือน (เลื่อนตามข้อมูลล่าสุด) · แรเงาฤดูฝุ่น 1 พ.ย.–31 พ.ค.
// ค่า = ผู้ป่วยรวมทั้งเดือน · tooltip = ค่าเฉลี่ยราย/สัปดาห์ (ยอดรวม ÷ จำนวนสัปดาห์ระบาดวิทยา) + ค่าฝุ่นเฉลี่ยของเดือน
// ข้อควรระวัง: เดือนมี 4 หรือ 5 สัปดาห์ เดือน 5 สัปดาห์ยอดรวมจึงสูงขึ้นตามจำนวนสัปดาห์ → ระบุใน tooltip และวิธีอ่านกราฟ
// แต่ละกลุ่มโรคแผงของตัวเอง (small multiples) · แกนแท่งเริ่มที่ 0 (กราฟแท่ง) · แกนค่าฝุ่นเท่ากันทุกแผง
const e1Nice = (v, up) => { if (v <= 0) return 0; const p = 10 ** Math.floor(Math.log10(v)), st = p / (v / p < 2 ? 4 : 2); return (up ? Math.ceil(v / st) : Math.floor(v / st)) * st; };
const DZ_CB_N = 12;                              // จำนวนเดือนย้อนหลัง
const dzSeason = m => m >= 10 || m <= 4;         // ฤดูฝุ่น พ.ย.–พ.ค. (m = 0–11)
const DZ_NAME = { "ทางเดินหายใจ": "โรคระบบทางเดินหายใจ", "หัวใจ": "โรคระบบหัวใจและหลอดเลือด", "ตาอักเสบ": "โรคเยื่อบุตาอักเสบ", "ผิวหนัง": "โรคผิวหนังอักเสบ" };
const dzName = d => DZ_NAME[d.key] || d.label;
const PM25T = "PM" + "2.5";                       // ใช้ในข้อความ tooltip (กันตัวแทนที่ชื่อสารมลพิษ → HTML ตอน build)
// ปี + สัปดาห์ระบาดวิทยาล่าสุดที่นิ่งแล้วของกราฟย้อนหลัง: เซิร์ฟเวอร์ส่งมาใน meta (dataYear / dataWk) เพื่อให้เลื่อนข้ามปีเอง
// ไม่มี meta (เซิร์ฟเวอร์เก่า/เดโม่) → ใช้ปี 2569 กับสัปดาห์ล่าสุดของหน้า (wkMax)
function dzCbEnd(dz, wkMax) {
  const y = Number(dz.meta?.dataYear) || 2026, w = Number(dz.meta?.dataWk);
  return { y, w: w > 0 ? w : wkMax };
}
// n เดือนล่าสุดนับถึงเดือนของสัปดาห์ล่าสุดที่นิ่งแล้ว (เลื่อนตามข้อมูล)
function dzCbMonths(dz, wkMax, n = DZ_CB_N) {
  const e = dzCbEnd(dz, wkMax);
  if (!e.w) return [];
  let y = e.y, m = epiMonth(e.y, e.w); const a = [];
  for (let i = 0; i < n; i++) { a.unshift({ y, m }); if (m === 0) { y--; m = 11; } else m--; }
  return a;
}
// ค่าฝุ่นรายเดือนทั้งเขต = เฉลี่ยรายวันของ 4 จังหวัด แล้วเฉลี่ยทั้งเดือน (ไม่นับค่า 0 / ว่าง = สถานีไม่มีข้อมูล)
function dzPmMonth(months) {
  const all = S.pm?.allData || {}, acc = {};
  for (const [d, o] of Object.entries(all)) {
    const v = PROV.map(p => o?.[p.name]).filter(x => x != null && !isNaN(x) && x > 0); if (!v.length) continue;
    (acc[d.slice(0, 7)] ||= []).push(v.reduce((a, b) => a + b, 0) / v.length);
  }
  return months.map(({ y, m }) => { const a = acc[`${y}-${String(m + 1).padStart(2, "0")}`]; return a?.length ? { avg: a.reduce((x, z) => x + z, 0) / a.length, n: a.length } : null; });
}
const dzK = v => v >= 1000 ? `${+(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : String(Math.round(v));
function dzMonthSvg(ser, months, pm, pmMax, W, pid) {
  const n = months.length, wide = W > 800, fs = wide ? 11.5 : 10;
  const L = wide ? 54 : 38, R = wide ? 44 : 32, pw = W - L - R, slot = pw / n, bw = Math.min(46, slot * (wide ? .58 : .66));
  const LH = 24, PH = wide ? 116 : 92, PT = 16, ML = fs * 2 + 14, GAP = 14, PB = LH + PH + ML + GAP;
  const H = ser.length * PB - GAP, X = i => L + i * slot + slot / 2;
  const provM = months.map((_, i) => ser.some(s => s.bars[i]?.prov));
  const F = `font-family="'IBM Plex Sans Thai',Anuphan,sans-serif"`;
  let g = "";
  ser.forEach((s, k) => {
    const top = k * PB, y0 = top + LH + PT, base = top + LH + PH;
    const mx = Math.max(...s.bars.map(o => o?.sum || 0)), bMax = e1Nice(mx * 1.08, true) || 1;
    const Y = v => base - v / bMax * (base - y0), YP = v => base - Math.min(v, pmMax) / pmMax * (base - y0);
    g += `<circle cx="${L - 34 + (wide ? 0 : 6)}" cy="${top + 8}" r="5" fill="${s.d.c}"/><text x="${L - 24 + (wide ? 0 : 6)}" y="${top + 12}" font-size="${fs + 1.5}" font-weight="700" fill="#1f2a3d" ${F}>${dzName(s.d)}<tspan font-size="${fs - .5}" font-weight="600" fill="#6b7689"> · ราย/เดือน</tspan></text>`;
    months.forEach(({ m }, i) => {     // พื้นหลังฤดูฝุ่น / ข้อมูลเบื้องต้น
      if (dzSeason(m)) g += `<rect x="${(L + i * slot).toFixed(1)}" y="${top + LH}" width="${(slot + .4).toFixed(1)}" height="${PH}" fill="rgba(232,89,12,.09)"/>`;
      if (provM[i]) g += `<rect x="${L + i * slot + 1}" y="${top + LH}" width="${slot - 2}" height="${PH}" rx="6" fill="#e6eaf0" opacity=".75"/>`;
    });
    [0, .5, 1].forEach(f => { const yy = base - f * (base - y0);
      g += `<line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" stroke="rgba(15,27,45,${f ? .08 : .25})"${f ? ` stroke-dasharray="2 4"` : ""}/><text x="${L - 6}" y="${yy + 4}" text-anchor="end" font-size="${fs - 1}" fill="${s.d.c}" font-weight="700" ${F}>${fmt(Math.round(bMax * f))}</text>`; });
    g += `<text x="${W - R + 6}" y="${y0 + 4}" font-size="${fs - 1}" fill="#33415c" font-weight="700" ${F}>${pmMax}</text><text x="${W - R + 6}" y="${base + 4}" font-size="${fs - 1}" fill="#6b7689" ${F}>0</text>`;
    const y37 = YP(37.5);
    if (37.5 < pmMax) g += `<line x1="${L}" x2="${W - R}" y1="${y37}" y2="${y37}" stroke="#b84a00" stroke-dasharray="5 4" stroke-width="1.3"/><text x="${W - R + 6}" y="${y37 + 4}" font-size="${fs - 1}" fill="#b84a00" font-weight="700" ${F}>37.5</text>`;
    let lab = "";   // ตัวเลขบนแท่งวาดหลังเส้นค่าฝุ่น (มีขอบขาว) เพื่อไม่ให้เส้นพาดทับตัวเลข
    s.bars.forEach((o, i) => { if (!o) return; const y = Y(o.sum);
      g += `<rect x="${(X(i) - bw / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${(base - y).toFixed(1)}" rx="3" fill="${s.d.c}" opacity="${o.prov ? .4 : .88}"${o.prov ? ` stroke="${s.d.c}" stroke-dasharray="3 2"` : ""}/>`;
      lab += `<text x="${X(i).toFixed(1)}" y="${(y - 4).toFixed(1)}" text-anchor="middle" font-size="${fs}" font-weight="700" fill="${o.prov ? "#8a96a8" : "#1f2a3d"}" stroke="#fff" stroke-width="3" paint-order="stroke" ${F}>${wide ? fmt(Math.round(o.sum)) : dzK(o.sum)}</text>`; });
    let path = "", on = false; const pts = pm.map((o, i) => o ? [X(i), YP(o.avg)] : null);
    pts.forEach(pt => { if (!pt) { on = false; return; } path += `${on ? "L" : "M"}${pt[0].toFixed(1)},${pt[1].toFixed(1)}`; on = true; });
    g += `<path d="${path}" fill="none" stroke="#1f2a3d" stroke-width="${wide ? 2.6 : 2.2}" stroke-linejoin="round" stroke-linecap="round"/>` + pts.map(pt => pt ? `<circle cx="${pt[0].toFixed(1)}" cy="${pt[1].toFixed(1)}" r="${wide ? 3.4 : 2.8}" fill="#fff" stroke="#1f2a3d" stroke-width="1.8"/>` : "").join("") + lab;
    months.forEach(({ y, m }, i) => {
      const o = s.bars[i];
      g += `<text x="${X(i).toFixed(1)}" y="${base + fs + 4}" text-anchor="middle" font-size="${fs}" fill="#5f6c80" ${F}>${TH_M[m]}${provM[i] ? "*" : ""}${o?.short ? "†" : ""}</text>`;
      if (i === 0 || m === 0) g += `<text x="${(i === 0 ? L : X(i)).toFixed(1)}" y="${base + fs * 2 + 8}" text-anchor="${i === 0 ? "start" : "middle"}" font-size="${fs}" font-weight="700" fill="#33415c" ${F}>${y + 543}</text>`;
      const p = pm[i];
      g += `<rect class="hb" x="${(L + i * slot).toFixed(1)}" y="${top}" width="${slot.toFixed(1)}" height="${LH + PH}" fill="transparent" data-t="${TH_MF[m]} ${y + 543} · ${dzName(s.d)}${o ? `&#10;รวมทั้งเดือน ${fmt(o.sum)} ราย&#10;เฉลี่ย ${fmt(Math.round(o.avg))} ราย/สัปดาห์ (${o.n} สัปดาห์ระบาดวิทยา · สัปดาห์ที่ ${o.w0}–${o.w1} · ${epiRange(y, o.w0, o.w1)})${o.n >= 5 ? `&#10;เดือนนี้มี ${o.n} สัปดาห์ ยอดรวมจึงสูงกว่าเดือนที่มี 4 สัปดาห์ · เทียบข้ามเดือนให้ดูค่าเฉลี่ยราย/สัปดาห์` : ""}${o.short ? `&#10;† รวมสัปดาห์ไม่เต็ม 7 วัน (${o.short} วัน) ยอดรวมและค่าเฉลี่ยจึงต่ำกว่าจริงเล็กน้อย` : ""}${o.prov ? "&#10;ข้อมูลเบื้องต้น รายงานยังไม่ครบ" : ""}` : "&#10;ไม่มีข้อมูลผู้ป่วย"}&#10;${p ? `ค่า ${PM25T} เฉลี่ย ${f1(p.avg)} µg/m³ (${p.n} วัน)` : `ไม่มีข้อมูลค่า ${PM25T}`}${dzSeason(m) ? "&#10;ช่วงฤดูฝุ่น (พ.ย.–พ.ค.)" : ""}"/>`;
    });
  });
  return `<svg class="bars ${wide ? "w-w" : "w-n"}" viewBox="0 0 ${W} ${H}" role="img" aria-label="ผู้ป่วยรวมรายเดือน 4 กลุ่มโรค เทียบค่าฝุ่น ย้อนหลัง 12 เดือน ทั้งเขตสุขภาพที่ 7 แยกแผงรายกลุ่ม">${g}</svg>`;
}
// E1 กินเต็มความกว้าง: จอกว้างใช้กราฟ 1100 · จอแคบใช้ 400 (สลับด้วย CSS)
function dzMonthAll(dz, wkMax) {
  const months = dzCbMonths(dz, wkMax); if (!months.length) return "";
  const end = dzCbEnd(dz, wkMax), cy = end.y;
  const byY = {}; for (const y of new Set(months.map(o => o.y))) byY[y] = Object.fromEntries(DZ.map(d => [d.key, monthlyWk(dz[y] || [], d.key, y === cy ? end.w : 99, y)]));
  const ser = DZ.map(d => ({ d, bars: months.map(({ y, m }) => byY[y]?.[d.key]?.[m] || null) }));
  const pm = dzPmMonth(months), pmMax = Math.max(50, Math.ceil(Math.max(...pm.filter(Boolean).map(o => o.avg), 0) / 10) * 10);
  const f = months[0], l = months.at(-1), rng = `${TH_M[f.m]} ${f.y + 543} – ${TH_M[l.m]} ${l.y + 543}`;
  const provMonths = [...new Set(ser.flatMap(s => s.bars.map((o, i) => o?.prov ? TH_M[months[i].m] : "")).filter(Boolean))];
  const asOf = (() => { const p = String(dz.meta?.dataDate || "").split("/"); return p.length === 3 ? `${+p[0]} ${TH_M[+p[1] - 1]} ${+p[2] + 543}` : ""; })();
  return `<article class="card dz dz-all" style="--dsoft:#eef2f7;--dc:#5f6c80">
    <div class="dz-top"><div class="dz-icon" style="background:#e6ebf2;color:#33415c"><svg><use href="#i-chart"/></svg></div>
      <div><h3>ผู้ป่วย 4 กลุ่มโรค เทียบค่าฝุ่น PM2.5 รายเดือน</h3><div class="icd">ทั้งเขตสุขภาพที่ 7 · ย้อนหลัง ${months.length} เดือน (${rng}) · หน่วย: <b>ราย/เดือน</b> (ยอดรวมทั้งเดือน · ชี้ที่แท่งเพื่อดูค่าเฉลี่ยราย/สัปดาห์และค่าฝุ่นของเดือน) · ผู้ป่วยสัญชาติไทยทุกคนที่รับบริการในเขต รวมผู้อยู่นอกพื้นที่</div></div><button type="button" class="ds-jump" data-preset="weekly" style="margin-left:auto"><svg class="ico"><use href="#i-down"/></svg>ดาวน์โหลดข้อมูล</button></div>
    <div class="e1lg"><span><i class="bar"></i><em>แท่ง = ผู้ป่วยรวมรายเดือน (ราย · แกนซ้ายของแต่ละกลุ่มโรค)</em></span><span><i class="ln"></i><em>เส้น = ค่าฝุ่น PM2.5 เฉลี่ยรายเดือน (µg/m³ · แกนขวา เท่ากันทุกกลุ่ม)</em></span><span><i class="dsh"></i><em>37.5 = ค่ามาตรฐาน</em></span><span><i class="ssn"></i><em>ช่วงฤดูฝุ่น 1 พ.ย.–31 พ.ค.</em></span></div>
    ${dzMonthSvg(ser, months, pm, pmMax, 1100, "dzPartW")}${dzMonthSvg(ser, months, pm, pmMax, 400, "dzPartN")}
    <details class="pv-guide pg-fold dz-fold"><summary class="pg-h"><svg class="ico"><use href="#i-chart"/></svg><b>วิธีอ่านกราฟ</b><span class="pg-more">กดเพื่อเปิด/ปิด</span></summary>
    <ul><li><b>แท่งและตัวเลข</b> = ผู้ป่วยรวมทั้งเดือนนั้น · ชี้ที่แท่งเพื่อดู<b>ค่าเฉลี่ยราย/สัปดาห์</b> (ยอดรวม ÷ จำนวนสัปดาห์ระบาดวิทยาในเดือน) · เดือนที่มี 5 สัปดาห์ยอดรวมจะสูงกว่าเดือนที่มี 4 สัปดาห์ ถ้าจะเทียบข้ามเดือนให้ดูค่าเฉลี่ยราย/สัปดาห์</li>
      <li><b>เส้นสีเข้ม</b> = ค่า PM2.5 เฉลี่ยของเดือน (เฉลี่ย 4 จังหวัด · ค่าเฉลี่ย 24 ชม. ณ 07.00 น. จากสถานี Air4Thai ร่วมกับดาวเทียม GISTDA) แกนขวาเท่ากันทุกกลุ่มโรค · <b>เส้นประส้ม 37.5</b> = ค่ามาตรฐาน</li>
      <li><b>พื้นแรเงาส้ม</b> = ช่วงฤดูฝุ่น (1 พ.ย.–31 พ.ค.) · ใช้ดูว่าผู้ป่วยกับฝุ่นขึ้นลงในช่วงเวลาเดียวกันหรือไม่ ไม่ได้ยืนยันว่าฝุ่นเป็นสาเหตุโดยตรง</li>
      <li>นับตาม<b>สัปดาห์ระบาดวิทยา</b> (อาทิตย์–เสาร์ · สัปดาห์ที่ 1 = 1 ม.ค. ถึงเสาร์แรกของปี) สัปดาห์ที่คร่อมสองเดือนนับเข้าเดือนที่มีวันมากกว่า · แต่ละกลุ่มโรคมีแกนซ้ายของตัวเอง เทียบขนาดจริงจากตัวเลขบนแท่ง</li>
      <li><b>แท่งจางขอบประ และพื้นเทา</b> (เดือนที่มี *) = มีข้อมูลเบื้องต้นรวมอยู่ · <b>เดือนที่มี †</b> = มีสัปดาห์ไม่เต็ม 7 วันรวมอยู่ (สัปดาห์ที่ 1 และสัปดาห์สุดท้ายของปี) ยอดรวมต่ำกว่าจริงเล็กน้อย</li></ul></details>
    <div class="dz-note"><b>หมายเหตุ</b> ข้อมูลจาก HDC${asOf ? ` ณ ${asOf}` : ""}${provMonths.length ? ` <span class="nw">* ${provMonths.join(" ")} = ข้อมูลยังไม่ครบ</span>` : ""}<span class="nw"><b>การอ่านผล</b> เปรียบเทียบเชิงสถานการณ์เพื่อเฝ้าระวัง ไม่ได้ทดสอบความสัมพันธ์เชิงสาเหตุกับฝุ่น</span></div>
    <div class="tip"></div></article>`;
}
