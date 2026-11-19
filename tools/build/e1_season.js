// ===== ส่วน 8 · ผู้ป่วย 4 กลุ่มโรครายเดือน — เส้นเวลาเดียว ม.ค. 2569 → พ.ค. 2570 (Louis 16 พ.ย. 2569) =====
// ไม่เทียบปีแล้ว · แท่งเดี่ยวต่อเดือน = ผู้ป่วยรวมทั้งเดือน + เส้นเชื่อมยอดแท่ง · พื้นส้มอ่อน = ช่วงฤดูฝุ่น (พ.ย.–พ.ค.) เหมือนกราฟเดิม
// เดือนที่ยังไม่มีข้อมูลเว้นว่าง แล้วเติมเองทีละเดือน · ใช้ monthlyWk / dzCbEnd ชุดเดิม · ไม่มีเส้นค่าฝุ่น
// คำกำกับเทศกาลใต้ชื่อเดือน (ไม่ให้อ่านผิดว่าผู้ป่วยลดลงจริง) — เดือนที่มีสัปดาห์หยุดยาว: ม.ค. ปีใหม่ · เม.ย. สงกรานต์
//   หลักฐาน: ไฟล์ HDC ปี 2568 และ 2569 (19 พ.ย. 2569) สัปดาห์ที่มีวันหยุด เทียบสัปดาห์ข้างเคียงที่ไม่มีวันหยุด (ผันผวนปกติ ±5–6%)
//   หยุด 1 วันลดราว 6% (แยกจากความผันผวนไม่ออก) · 2 วันราว 14% · 3 วันราว 24% (สงกรานต์ 79%/73% · ปลาย ก.ค. 85%/76%) แล้วกลับมาเท่าเดิมสัปดาห์ถัดไป
// ประกาศ dzMonthAll ใหม่ (ประกาศหลังตัวเดิม → ตัวนี้ถูกใช้) · อินโฟกราฟิกไม่ได้ใช้ · กราฟรายสัปดาห์แยกจังหวัด (e2xBlock) คงเดิม
const E1P_FROM = { y: 2026, m: 0 }, E1P_TO = { y: 2027, m: 4 };   // ม.ค. 2569 → พ.ค. 2570
const E1P_HOL = { 0: { n: "ปีใหม่" }, 3: { n: "สงกรานต์" } };   // เดือน (0=ม.ค.) → คำกำกับใต้ชื่อเดือน
const e1pCols = () => { const o = []; for (let y = E1P_FROM.y, m = E1P_FROM.m; y < E1P_TO.y || (y === E1P_TO.y && m <= E1P_TO.m); m === 11 ? (y++, m = 0) : m++) o.push({ y, m }); return o; };
const e1pSeason = m => m >= 10 || m <= 4;                         // พ.ย.–พ.ค.
const e1pYY = y => String((y + 543) % 100);
const e1pChg = (a, b) => (a != null && b) ? (a - b) / b * 100 : null;
const e1pChgT = p => p == null ? "" : Math.abs(p) < .05 ? "เท่าเดิม" : `${p > 0 ? "▲ เพิ่มขึ้น" : "▼ ลดลง"} ${Math.abs(p).toFixed(1)}%`;
// หัวแผงแต่ละกลุ่มโรค: เดือนล่าสุด + เปลี่ยนแปลงจากเดือนก่อน (ใช้ทั้งใน SVG จอกว้าง และ HTML จอแคบ)
function e1pHead(s, cols) {
  const n = cols.length, li = (() => { for (let i = n - 1; i >= 0; i--) if (s.v[i]) return i; return -1; })();
  if (li < 0) return null;
  const pi = li > 0 && s.v[li - 1] ? li - 1 : -1, ch = pi >= 0 ? e1pChg(s.v[li].sum, s.v[pi].sum) : null, o = s.v[li];
  return { a: `เดือนล่าสุด ${TH_M[cols[li].m]} ${e1pYY(cols[li].y)}: `, bT: `${fmt(o.sum)} ราย`, c: ch == null ? "" : `${e1pChgT(ch)} จากเดือนก่อน`,
    why: o.prov ? " (ข้อมูลยังเข้าไม่ครบ)" : E1P_HOL[cols[li].m] ? ` (มีวันหยุด${E1P_HOL[cols[li].m].n})` : "",
    col: ch == null || Math.abs(ch) < .05 ? "#5f6c80" : ch > 0 ? "#b42318" : "#0f7b3f" };
}
function e1pSvg(ser, cols, W, lastI, noHead) {
  const wide = W > 800, fs = wide ? 11.5 : 10, n = cols.length;
  const L = wide ? 54 : 40, R = wide ? 16 : 10, pw = W - L - R, slot = pw / n, bw = Math.min(wide ? 34 : 20, slot * .6);
  const LH = noHead ? 6 : wide ? 46 : 58, PH = wide ? 120 : 104, PT = 20, ML = fs * 3 + 18, GAP = noHead ? 0 : 16, PB = LH + PH + ML + GAP;
  const H = ser.length * PB - GAP, X = i => L + i * slot + slot / 2;
  const F = `font-family="'IBM Plex Sans Thai',Anuphan,sans-serif"`;
  // ช่วงฤดูฝุ่นที่ติดกัน → แถบพื้นหลัง
  const bands = []; cols.forEach((c, i) => { if (!e1pSeason(c.m)) return; const b = bands[bands.length - 1]; if (b && b[1] === i - 1) b[1] = i; else bands.push([i, i]); });
  let g = "";
  ser.forEach((s, k) => {
    const top = k * PB, y0 = top + LH + PT, base = top + LH + PH;
    const mx = Math.max(0, ...s.v.map(o => o?.sum || 0)), bMax = e1Nice(mx * 1.08, true) || 1, Y = v => base - v / bMax * (base - y0);
    // หัวแผง + สรุปเดือนล่าสุด (จอแคบวาดเป็น HTML นอกกราฟ เพื่อไม่ให้ถูกตัดตอนเลื่อน)
    if (!noHead) {
      g += `<circle cx="${L - 34 + (wide ? 0 : 6)}" cy="${top + 8}" r="5" fill="${s.d.c}"/><text x="${L - 24 + (wide ? 0 : 6)}" y="${top + 12}" font-size="${fs + 1.5}" font-weight="700" fill="#1f2a3d" ${F}>${dzName(s.d)}<tspan font-size="${fs - .5}" font-weight="600" fill="#6b7689"> · ราย/เดือน</tspan></text>`;
      const h = e1pHead(s, cols);
      if (h) g += `<text x="${W - R}" y="${top + 12}" text-anchor="end" font-size="${fs}" fill="#5f6c80" ${F}>${h.a}<tspan font-weight="700" fill="#1f2a3d">${h.bT}</tspan><tspan font-weight="700" fill="${h.col}">${h.c ? " · " + h.c : ""}</tspan>${h.why}</text>`;
    }
    // พื้นส้มอ่อน = ช่วงฤดูฝุ่น
    bands.forEach(([a, b]) => { g += `<rect x="${(L + a * slot).toFixed(1)}" y="${top + LH}" width="${((b - a + 1) * slot).toFixed(1)}" height="${PH}" fill="rgba(232,89,12,.09)"/><text x="${(L + a * slot + 5).toFixed(1)}" y="${top + LH + 12}" font-size="${fs - 1.5}" font-weight="700" fill="#b4541a" ${F}>ฤดูฝุ่น</text>`; });
    [0, .5, 1].forEach(f => { const yy = base - f * (base - y0);
      g += `<line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" stroke="rgba(15,27,45,${f ? .08 : .25})"${f ? ` stroke-dasharray="2 4"` : ""}/><text x="${L - 6}" y="${yy + 4}" text-anchor="end" font-size="${fs - 1}" fill="${s.d.c}" font-weight="700" ${F}>${fmt(Math.round(bMax * f))}</text>`; });
    if (lastI < n - 1) { const xa = L + (lastI + 1) * slot, xb = W - R;   // เดือนที่ยังไม่มีข้อมูล
      g += `<text x="${((xa + xb) / 2).toFixed(1)}" y="${(base - (base - y0) * .45).toFixed(1)}" text-anchor="middle" font-size="${fs - .5}" font-weight="600" fill="#8a96a8" ${F}>ยังไม่มีข้อมูล${wide ? " · เพิ่มทีละเดือนเมื่อมีรายงาน" : ""}</text>`; }
    let lab = "", line = "";
    cols.forEach((c, i) => {
      const o = s.v[i], x = X(i), hol = E1P_HOL[c.m];
      if (o) { const y = Y(o.sum), dim = o.prov;
        g += `<rect x="${(x - bw / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${(base - y).toFixed(1)}" rx="3" fill="${s.d.c}" opacity="${dim ? .42 : .85}"${dim ? ` stroke="${s.d.c}" stroke-dasharray="3 2"` : ""}/>`;
        lab += `<text x="${x.toFixed(1)}" y="${(y - 5).toFixed(1)}" text-anchor="middle" font-size="${fs}" font-weight="700" fill="${dim ? "#8a96a8" : "#1f2a3d"}" stroke="#fff" stroke-width="3" paint-order="stroke" ${F}>${wide ? fmt(Math.round(o.sum)) : dzK(o.sum)}</text>`;
        const p = i > 0 ? s.v[i - 1] : null;
        if (p) line += `<line x1="${X(i - 1).toFixed(1)}" y1="${Y(p.sum).toFixed(1)}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#1f2a3d" stroke-width="1.6" opacity=".55"${dim ? ` stroke-dasharray="4 3"` : ""}/>`;
        line += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.6" fill="#fff" stroke="#1f2a3d" stroke-width="1.5"/>`;
      }
      // แกนเดือน: ชื่อเดือน (* ข้อมูลเบื้องต้น) · คำกำกับเทศกาลใต้ชื่อเดือน · ปี พ.ศ. ที่ ม.ค. และเดือนแรก
      const fut = i > lastI;
      g += `<text x="${x.toFixed(1)}" y="${base + fs + 5}" text-anchor="middle" font-size="${fs}" fill="${fut ? "#a8b2c0" : "#5f6c80"}" ${F}>${TH_M[c.m]}${o?.prov ? "*" : ""}</text>`;
      if (c.m === 0 || i === 0) g += `<text x="${x.toFixed(1)}" y="${base + fs * 3 + 12}" text-anchor="middle" font-size="${fs - .5}" font-weight="700" fill="#33415c" ${F}>${c.y + 543}</text>`;
      if (hol) g += `<text x="${x.toFixed(1)}" y="${base + fs * 2 + 8}" text-anchor="middle" font-size="${fs - 1.5}" font-weight="700" fill="#8a5a00" ${F}>${hol.n}</text>`;
      const p = i > 0 ? s.v[i - 1] : null, pc = o && p ? e1pChg(o.sum, p.sum) : null;
      const tip = o ? `&#10;ผู้ป่วยรวมทั้งเดือน ${fmt(o.sum)} ราย${pc != null ? `&#10;เทียบเดือนก่อน: ${e1pChgT(pc)} (${o.sum >= p.sum ? "เพิ่ม" : "ลด"} ${fmt(Math.abs(o.sum - p.sum))} ราย)` : ""}&#10;เฉลี่ยประมาณ ${fmt(Math.round(o.avg))} ราย/สัปดาห์ (${o.n} สัปดาห์)`
          + (hol ? `&#10;เดือนนี้มีวันหยุด${hol.n} สัปดาห์ที่หยุดหลายวันมักมีผู้มารับบริการน้อยลงชั่วคราว (ราว 6% / 14% / 24% เมื่อหยุด 1 / 2 / 3 วัน) ยอดทั้งเดือนอาจต่ำกว่าปกติเล็กน้อย` : "")
          + (o.prov ? "&#10;* ข้อมูลเดือนนี้ยังเข้าไม่ครบ ตัวเลขอาจเพิ่มขึ้นอีก" : "")
        : fut ? "&#10;ยังไม่มีข้อมูล จะแสดงเมื่อมีรายงานเข้ามา" : "&#10;ไม่มีข้อมูล";
      g += `<rect class="hb" x="${(x - slot / 2).toFixed(1)}" y="${top + LH}" width="${slot.toFixed(1)}" height="${PH}" fill="transparent" data-t="${TH_MF[c.m]} ${c.y + 543} · ${dzName(s.d)}${tip}"/>`;
    });
    g += line + lab;
  });
  return `<svg class="bars ${wide ? "w-w" : "w-n"}" viewBox="0 0 ${W} ${H}"${wide ? "" : ` width="${W}" height="${H}"`} role="img" aria-label="จำนวนผู้ป่วยรวมรายเดือน 4 กลุ่มโรค ทั้งเขตสุขภาพที่ 7 ตั้งแต่ ม.ค. 2569 ถึง พ.ค. 2570 แยกแผงรายกลุ่มโรค พื้นสีส้มอ่อนคือช่วงฤดูฝุ่น">${g}</svg>`;
}
// จอแคบ: กราฟกว้างกว่าจอ เลื่อนซ้าย-ขวาได้ · เปิดมาให้เห็นเดือนล่าสุดที่มีข้อมูล
new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(nd => {
  if (nd.nodeType !== 1) return; const els = nd.matches?.(".e1p-sc") ? [nd] : [...(nd.querySelectorAll?.(".e1p-sc") || [])];
  if (els.length) requestAnimationFrame(() => els.forEach(el => { el.scrollLeft = Math.max(0, +el.dataset.last - el.clientWidth + 70); }));
}))).observe(document.documentElement, { childList: true, subtree: true });
// เลื่อนแผงหนึ่ง แผงอื่นเลื่อนตาม ให้เดือนตรงกันทุกกลุ่มโรค
let e1pSync = false;
document.addEventListener("scroll", e => {
  const el = e.target; if (e1pSync || !el.classList?.contains("e1p-sc")) return;
  e1pSync = true; el.closest(".e1p-n")?.querySelectorAll(".e1p-sc").forEach(o => { if (o !== el) o.scrollLeft = el.scrollLeft; });
  requestAnimationFrame(() => { e1pSync = false; });
}, true);
function dzMonthAll(dz, wkMax) {
  const end = dzCbEnd(dz, wkMax); if (!end.w) return "";
  const lastM = epiMonth(end.y, end.w), memo = {};
  const mw = (d, y) => memo[y + d.key] ||= monthlyWk(dz[y] || [], d.key, y === end.y ? end.w : 99, y);
  const cell = (d, { y, m }) => (y > end.y || (y === end.y && m > lastM)) ? null : (mw(d, y)[m] || null);
  const cols = e1pCols(), ser = DZ.map(d => ({ d, v: cols.map(c => cell(d, c)) }));
  const lastI = (() => { for (let i = cols.length - 1; i >= 0; i--) if (ser.some(s => s.v[i])) return i; return -1; })();
  const hasProv = ser.some(s => s.v.some(o => o?.prov));
  const asOf = (() => { const p = String(dz.meta?.dataDate || "").split("/"); return p.length === 3 ? `${+p[0]} ${TH_M[+p[1] - 1]} ${+p[2] + 543}` : ""; })();
  const lastTxt = lastI < 0 ? "" : `${TH_M[cols[lastI].m]} ${cols[lastI].y + 543}`;
  const W2 = 640, slot2 = (W2 - 50) / cols.length, last2 = 40 + (lastI + 1) * slot2;   // จอแคบ: ตำแหน่งขวาสุดของเดือนล่าสุด (ใช้เลื่อนกราฟมาให้เห็นตอนเปิด)
  return `<article class="card dz dz-all" style="--dsoft:#eef2f7;--dc:#5f6c80">
    <div class="dz-top"><div class="dz-icon" style="background:#e6ebf2;color:#33415c"><svg><use href="#i-chart"/></svg></div>
      <div><h3>จำนวนผู้ป่วย 4 กลุ่มโรคที่เกี่ยวข้องกับฝุ่น ในแต่ละเดือน</h3><div class="icd">ทั้งเขตสุขภาพที่ 7 · ม.ค. 2569 – พ.ค. 2570${lastTxt ? ` (มีข้อมูลถึง ${lastTxt} เพิ่มทีละเดือน)` : ""} · <b>1 แท่ง = จำนวนผู้ป่วยรวมของเดือนนั้น</b> (หน่วย: ราย)</div></div><button type="button" class="ds-jump" data-preset="weekly" style="margin-left:auto"><svg class="ico"><use href="#i-down"/></svg>ดาวน์โหลดข้อมูล</button></div>
    <ul class="e1p-read" aria-label="วิธีอ่านกราฟแบบสั้น">
      <li><b>กราฟนี้บอกอะไร</b><span>จำนวนผู้ป่วยที่มารับบริการด้วยโรค 4 กลุ่มนี้ในแต่ละเดือน นับรวมทุกสาเหตุของการป่วย</span></li>
      <li><b>ดูแนวโน้มอย่างไร</b><span>เทียบความสูงของแท่งแต่ละเดือน เส้นที่ลากเชื่อมช่วยให้เห็นทิศทาง: ชี้ขึ้น = มีผู้มารับบริการมากขึ้น ชี้ลง = น้อยลง กราฟบอกจำนวน แต่ไม่ได้บอกสาเหตุ</span></li>
      <li><b>ข้อควรรู้</b><span>ตัวเลขนี้ไม่ได้แยกว่าใครป่วยเพราะฝุ่น ฝุ่น PM<sub>2.5</sub> อาจเป็นปัจจัยหนึ่งหรือไม่เกี่ยวเลยก็ได้ อากาศเย็น โรคติดเชื้อตามฤดูกาล วันหยุดยาว และความครบของการรายงาน ทำให้ตัวเลขขึ้นลงได้เช่นกัน จึงใช้ดูแนวโน้มเพื่อเฝ้าระวัง ไม่ใช่หลักฐานว่าฝุ่นเป็นสาเหตุ</span></li></ul>
    <div class="e1lg"><span><i class="ssn"></i><em>พื้นส้มอ่อน = ช่วงฤดูฝุ่น (พ.ย.–พ.ค.)</em></span><span><b class="e1p-mk">ปีใหม่</b><em>คำใต้ชื่อเดือน = เดือนที่มีวันหยุดยาว (ปีใหม่ · สงกรานต์) สัปดาห์ที่หยุดหลายวันผู้มารับบริการมักลดลงชั่วคราว ยอดเดือนนั้นอาจต่ำกว่าปกติเล็กน้อย ไม่ได้แปลว่าผู้ป่วยลดลงจริง</em></span>${hasProv ? `<span><i class="bar" style="opacity:.4;outline:1.5px dashed currentColor"></i><em>แท่งจางขอบประ (*) = ข้อมูลเดือนนั้นยังเข้าไม่ครบ</em></span>` : ""}<span class="e1p-swipe"><em>เลื่อนกราฟซ้าย-ขวาเพื่อดูเดือนอื่น</em></span></div>
    ${e1pSvg(ser, cols, 1100, lastI)}<div class="e1p-n">${ser.map(s => { const h = e1pHead(s, cols);
      return `<div class="e1p-gh"><b><i style="background:${s.d.c}"></i>${dzName(s.d)}<small> · ราย/เดือน</small></b>${h ? `<span>${h.a}<strong>${h.bT}</strong>${h.c ? ` · <strong style="color:${h.col}">${h.c}</strong>` : ""}${h.why}</span>` : ""}</div><div class="e1p-sc" data-last="${last2.toFixed(0)}">${e1pSvg([s], cols, W2, lastI, true)}</div>`; }).join("")}</div>
    <details class="pv-guide pg-fold dz-fold"><summary class="pg-h"><svg class="ico"><use href="#i-chart"/></svg><b>รายละเอียดเพิ่มเติม (สำหรับเจ้าหน้าที่)</b><span class="pg-more">กดเพื่อเปิด/ปิด</span></summary>
    <ul><li><b>ช่วงที่แสดง</b>: ม.ค. 2569 – พ.ค. 2570 ต่อเนื่องเป็นเส้นเวลาเดียว ไม่เทียบปี · พื้นส้มอ่อน = ช่วงฤดูฝุ่น 1 พ.ย.–31 พ.ค.</li>
      <li><b>ตัวเลขบนแท่ง</b> = ผลรวมรายสัปดาห์ของเดือนนั้น (แต่ละสัปดาห์นับคนไม่ซ้ำ คนเดียวกันที่มาต่างสัปดาห์จะถูกนับอีกครั้ง) · ชี้ที่แท่งเพื่อดูค่าเฉลี่ยราย/สัปดาห์ · เดือนที่มี 5 สัปดาห์ยอดรวมสูงกว่าเดือนที่มี 4 สัปดาห์ ถ้าจะเทียบข้ามเดือนอย่างละเอียดให้ดูค่าเฉลี่ยราย/สัปดาห์</li>
      <li><b>คำกำกับเทศกาล</b>: เทียบไฟล์ HDC ปี 2568 และ 2569 สัปดาห์ที่มีวันหยุดราชการ กับสัปดาห์ข้างเคียงที่ไม่มีวันหยุด (ความผันผวนปกติ ±5–6%) · หยุด 1 วันลดราว 6% (แยกจากความผันผวนปกติไม่ออก) · 2 วันราว 14% · 3 วันราว 24% (เช่น สงกรานต์ เหลือ 79% และ 73% ของสัปดาห์ข้างเคียงในปี 2568 และ 2569) แล้วกลับมาเท่าเดิมในสัปดาห์ถัดไป · ยอดทั้งเดือนจึงลดน้อยกว่านี้</li>
      <li><b>การแปลผล</b>: เป็นข้อมูลเฝ้าระวังเชิงพรรณนาระดับประชากร ใช้ดูแนวโน้มและสัญญาณผิดปกติ ไม่ใช้สรุปความสัมพันธ์เชิงสาเหตุ การประเมินผลของฝุ่นต่อการป่วยต้องใช้การวิเคราะห์อนุกรมเวลาที่ควบคุมปัจจัยกวน เช่น อุณหภูมิ ความชื้น ฤดูกาล วันหยุด และผลที่เกิดช้ากว่าวันที่ได้รับฝุ่น (lag)</li>
      <li>นับตาม<b>สัปดาห์ระบาดวิทยา</b> (อาทิตย์–เสาร์) สัปดาห์ที่คร่อมสองเดือนนับเข้าเดือนที่มีวันมากกว่า · แต่ละกลุ่มโรคมีแกนซ้ายของตัวเอง · ผู้ป่วยสัญชาติไทยทุกคนที่รับบริการในเขต รวมผู้อยู่นอกพื้นที่ · ที่มา: HDC กระทรวงสาธารณสุข</li></ul></details>
    <div class="dz-note"><b>หมายเหตุ</b> ข้อมูลจาก HDC${asOf ? ` ณ ${asOf}` : ""} อาจยังไม่สมบูรณ์ หน่วยบริการบางแห่งรายงานยังไม่ครบ${hasProv ? ` <span class="nw">* เดือนที่มีข้อมูล ${DZ_PROV_WK} สัปดาห์ล่าสุดรวมอยู่ ตัวเลขมักเพิ่มขึ้นเมื่อรายงานครบ จึงยังไม่ควรใช้สรุปแนวโน้ม</span>` : ""}</div>
    <div class="tip"></div></article>`;
}
