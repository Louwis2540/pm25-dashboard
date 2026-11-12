// ===== ส่วน 8 · กราฟแท่งผู้ป่วย 4 กลุ่มโรครายเดือน — ช่วงฤดูฝุ่น (พ.ย.–พ.ค.) เทียบฤดูปัจจุบันกับฤดูก่อน · ไม่มีเส้นค่าฝุ่น =====
// แกน X คงที่ 7 เดือน (พ.ย. → พ.ค.) ไม่ว่าเก็บข้อมูลไปกี่ปี · แท่งคู่ต่อเดือน: ซ้าย = ฤดูก่อน (สีจาง) · ขวา = ฤดูปัจจุบัน (สีทึบ)
// ฤดูปัจจุบัน = ฤดูล่าสุดที่มีข้อมูล (หาจากเดือนล่าสุดของข้อมูล เปลี่ยนเองเมื่อขึ้นฤดูใหม่) · ใช้ monthlyWk / dzCbEnd ชุดเดิม
// ประกาศ dzMonthAll ใหม่ (ประกาศหลังตัวเดิม → ตัวนี้ถูกใช้) · อินโฟกราฟิกไม่ได้ใช้ · กราฟรายสัปดาห์แยกจังหวัด (e2xBlock) คงเดิม
const e1sLbl = s => `${(s + 543) % 100}/${(s + 544) % 100}`;   // ฤดูเริ่ม พ.ย. ปี s (ค.ศ.) → "68/69"
const e1sSeasonMonths = s => [[s, 10], [s, 11], [s + 1, 0], [s + 1, 1], [s + 1, 2], [s + 1, 3], [s + 1, 4]].map(([y, m]) => ({ y, m }));
const e1sPct = (a, b) => (a != null && b) ? (a - b) / b * 100 : null;
const e1sPctT = p => p == null ? "" : `${p >= 0 ? "▲" : "▼"} ${Math.abs(p).toFixed(1)}%`;
function e1sSvg(ser, months, W, curL, prevL) {
  const n = months.length, wide = W > 800, fs = wide ? 11.5 : 10;
  const L = wide ? 54 : 38, R = wide ? 16 : 10, pw = W - L - R, slot = pw / n, bw = Math.min(wide ? 34 : 20, slot * (wide ? .3 : .36)), gap = 2;
  const LH = 24, PH = wide ? 116 : 92, PT = 16, ML = fs * 2 + 14, GAP = 14, PB = LH + PH + ML + GAP;
  const H = ser.length * PB - GAP, X = i => L + i * slot + slot / 2;
  const provM = months.map((_, i) => ser.some(s => s.cur[i]?.prov));
  const F = `font-family="'IBM Plex Sans Thai',Anuphan,sans-serif"`;
  let g = "";
  ser.forEach((s, k) => {
    const top = k * PB, y0 = top + LH + PT, base = top + LH + PH;
    const mx = Math.max(...s.cur.map(o => o?.sum || 0), ...s.prev.map(o => o?.sum || 0)), bMax = e1Nice(mx * 1.08, true) || 1;
    const Y = v => base - v / bMax * (base - y0);
    g += `<circle cx="${L - 34 + (wide ? 0 : 6)}" cy="${top + 8}" r="5" fill="${s.d.c}"/><text x="${L - 24 + (wide ? 0 : 6)}" y="${top + 12}" font-size="${fs + 1.5}" font-weight="700" fill="#1f2a3d" ${F}>${dzName(s.d)}<tspan font-size="${fs - .5}" font-weight="600" fill="#6b7689"> · ราย/เดือน</tspan></text>`;
    months.forEach((_, i) => { if (provM[i]) g += `<rect x="${L + i * slot + 1}" y="${top + LH}" width="${slot - 2}" height="${PH}" rx="6" fill="#e6eaf0" opacity=".75"/>`; });
    [0, .5, 1].forEach(f => { const yy = base - f * (base - y0);
      g += `<line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" stroke="rgba(15,27,45,${f ? .08 : .25})"${f ? ` stroke-dasharray="2 4"` : ""}/><text x="${L - 6}" y="${yy + 4}" text-anchor="end" font-size="${fs - 1}" fill="${s.d.c}" font-weight="700" ${F}>${fmt(Math.round(bMax * f))}</text>`; });
    let lab = "";
    months.forEach((_, i) => {
      const p = s.prev[i], c = s.cur[i], xp = X(i) - bw - gap / 2, xc = X(i) + gap / 2;
      if (p) { const y = Y(p.sum);   // ฤดูก่อน: แท่งสีจาง
        g += `<rect x="${xp.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${(base - y).toFixed(1)}" rx="3" fill="${s.d.c}" opacity=".32"/>`;
        if (wide) lab += `<text x="${(xp + bw / 2).toFixed(1)}" y="${(y - 4).toFixed(1)}" text-anchor="middle" font-size="${fs - 1}" font-weight="600" fill="#8a96a8" stroke="#fff" stroke-width="3" paint-order="stroke" ${F}>${fmt(Math.round(p.sum))}</text>`; }
      if (c) { const y = Y(c.sum);   // ฤดูปัจจุบัน: แท่งทึบ (ข้อมูลเบื้องต้น = จางขอบประ)
        g += `<rect x="${xc.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${(base - y).toFixed(1)}" rx="3" fill="${s.d.c}" opacity="${c.prov ? .5 : .9}"${c.prov ? ` stroke="${s.d.c}" stroke-dasharray="3 2"` : ""}/>`;
        lab += `<text x="${(xc + bw / 2).toFixed(1)}" y="${(y - 4).toFixed(1)}" text-anchor="middle" font-size="${fs}" font-weight="700" fill="${c.prov ? "#8a96a8" : "#1f2a3d"}" stroke="#fff" stroke-width="3" paint-order="stroke" ${F}>${wide ? fmt(Math.round(c.sum)) : dzK(c.sum)}</text>`; }
    });
    g += lab;
    months.forEach(({ y, m }, i) => {
      const c = s.cur[i], p = s.prev[i], pct = e1sPct(c?.avg, p?.avg);
      g += `<text x="${X(i).toFixed(1)}" y="${base + fs + 4}" text-anchor="middle" font-size="${fs}" fill="#5f6c80" ${F}>${TH_M[m]}${provM[i] ? "*" : ""}${c?.short ? "†" : ""}</text>`;
      if (i === 0 || m === 0) g += `<text x="${(i === 0 ? L : X(i)).toFixed(1)}" y="${base + fs * 2 + 8}" text-anchor="${i === 0 ? "start" : "middle"}" font-size="${fs}" font-weight="700" fill="#33415c" ${F}>${y + 543}</text>`;
      const row = (lbl, o, yy) => o ? `&#10;ฤดู ${lbl}: รวมทั้งเดือน ${fmt(o.sum)} ราย · เฉลี่ย ${fmt(Math.round(o.avg))} ราย/สัปดาห์ (${o.n} สัปดาห์ระบาดวิทยา · สัปดาห์ที่ ${o.w0}–${o.w1} · ${epiRange(yy, o.w0, o.w1)})${o.short ? ` † รวมสัปดาห์ไม่เต็ม 7 วัน (${o.short} วัน) ยอดต่ำกว่าจริงเล็กน้อย` : ""}${o.prov ? " · ข้อมูลเบื้องต้น รายงานยังไม่ครบ" : ""}` : `&#10;ฤดู ${lbl}: ไม่มีข้อมูล`;
      g += `<rect class="hb" x="${(L + i * slot).toFixed(1)}" y="${top}" width="${slot.toFixed(1)}" height="${LH + PH}" fill="transparent" data-t="${TH_MF[m]} · ${dzName(s.d)}${row(curL, c, y)}${row(prevL, p, y - 1)}${pct != null ? `&#10;ค่าเฉลี่ยราย/สัปดาห์เทียบฤดูก่อน ${e1sPctT(pct)}` : ""}${(c?.n >= 5 || p?.n >= 5) ? "&#10;เดือนที่มี 5 สัปดาห์ยอดรวมจะสูงกว่าเดือนที่มี 4 สัปดาห์ · เทียบข้ามเดือน/ฤดูให้ดูค่าเฉลี่ยราย/สัปดาห์" : ""}"/>`;
    });
  });
  return `<svg class="bars ${wide ? "w-w" : "w-n"}" viewBox="0 0 ${W} ${H}" role="img" aria-label="ผู้ป่วยรวมรายเดือน 4 กลุ่มโรค ช่วงฤดูฝุ่น เทียบฤดู ${curL} กับฤดู ${prevL} ทั้งเขตสุขภาพที่ 7 แยกแผงรายกลุ่ม">${g}</svg>`;
}
function dzMonthAll(dz, wkMax) {
  const end = dzCbEnd(dz, wkMax); if (!end.w) return "";
  const lastM = epiMonth(end.y, end.w), cur = lastM >= 10 ? end.y : end.y - 1, prev = cur - 1;   // ฤดูล่าสุดที่มีข้อมูล
  const curL = e1sLbl(cur), prevL = e1sLbl(prev), curM = e1sSeasonMonths(cur), prevM = e1sSeasonMonths(prev), memo = {};
  const mw = (d, y) => memo[y + d.key] ||= monthlyWk(dz[y] || [], d.key, y === end.y ? end.w : 99, y);
  const cell = (d, { y, m }) => (y > end.y || (y === end.y && m > lastM)) ? null : (mw(d, y)[m] || null);
  const ser = DZ.map(d => ({ d, cur: curM.map(mo => cell(d, mo)), prev: prevM.map(mo => cell(d, mo)) }));
  const hasPrev = ser.some(s => s.prev.some(Boolean)), hasProv = ser.some(s => s.cur.some(o => o?.prov));
  const asOf = (() => { const p = String(dz.meta?.dataDate || "").split("/"); return p.length === 3 ? `${+p[0]} ${TH_M[+p[1] - 1]} ${+p[2] + 543}` : ""; })();
  const lastI = (() => { for (let i = 6; i >= 0; i--) if (ser.some(x => x.cur[i])) return i; return -1; })(), lastTxt = lastI < 0 ? "" : `${TH_M[curM[lastI].m]} ${curM[lastI].y + 543}`;
  return `<article class="card dz dz-all" style="--dsoft:#eef2f7;--dc:#5f6c80">
    <div class="dz-top"><div class="dz-icon" style="background:#e6ebf2;color:#33415c"><svg><use href="#i-chart"/></svg></div>
      <div><h3>ผู้ป่วย 4 กลุ่มโรค รายเดือน ช่วงฤดูฝุ่น · ฤดู ${curL} เทียบฤดู ${prevL}</h3><div class="icd">ทั้งเขตสุขภาพที่ 7 · เฉพาะเดือนช่วงฤดูฝุ่น (1 พ.ย.–31 พ.ค.)${lastTxt ? ` · ฤดู ${curL} มีข้อมูลถึง ${lastTxt}` : ""} · หน่วย: <b>ราย/เดือน</b> (ยอดรวมทั้งเดือน · ชี้ที่แท่งเพื่อดูค่าเฉลี่ยราย/สัปดาห์และเทียบฤดูก่อน) · ผู้ป่วยสัญชาติไทยทุกคนที่รับบริการในเขต รวมผู้อยู่นอกพื้นที่</div></div><button type="button" class="ds-jump" data-preset="weekly" style="margin-left:auto"><svg class="ico"><use href="#i-down"/></svg>ดาวน์โหลดข้อมูล</button></div>
    <div class="e1lg"><span><i class="bar"></i><em>แท่งทึบ (ขวา) = ฤดู ${curL} (ปัจจุบัน)</em></span>${hasPrev ? `<span><i class="bar" style="opacity:.35"></i><em>แท่งจาง (ซ้าย) = ฤดู ${prevL} (ฤดูก่อน)</em></span>` : `<span><em>ยังไม่มีข้อมูลฤดู ${prevL}</em></span>`}</div>
    ${e1sSvg(ser, curM, 1100, curL, prevL)}${e1sSvg(ser, curM, 400, curL, prevL)}
    <details class="pv-guide pg-fold dz-fold"><summary class="pg-h"><svg class="ico"><use href="#i-chart"/></svg><b>วิธีอ่านกราฟ</b><span class="pg-more">กดเพื่อเปิด/ปิด</span></summary>
    <ul><li><b>แกนเดือนคงที่ พ.ย. → พ.ค.</b> · แต่ละเดือนมีแท่งคู่: <b>แท่งทึบ</b> = ฤดู ${curL} (ฤดูล่าสุดที่มีข้อมูล) · <b>แท่งจาง</b> = ฤดู ${prevL} เดือนเดียวกัน · เมื่อขึ้นฤดูใหม่ กราฟจะเลื่อนเทียบฤดูล่าสุดกับฤดูก่อนหน้าเองโดยไม่กว้างขึ้น</li>
      <li><b>แท่งและตัวเลข</b> = ผู้ป่วยรวมทั้งเดือนนั้น · ชี้ที่แท่งเพื่อดู<b>ค่าเฉลี่ยราย/สัปดาห์</b> (ยอดรวม ÷ จำนวนสัปดาห์ระบาดวิทยาในเดือน) และ % เทียบฤดูก่อน · เดือนที่มี 5 สัปดาห์ยอดรวมจะสูงกว่าเดือนที่มี 4 สัปดาห์ ถ้าจะเทียบข้ามเดือนหรือข้ามฤดูให้ดูค่าเฉลี่ยราย/สัปดาห์</li>
      <li>นับตาม<b>สัปดาห์ระบาดวิทยา</b> (อาทิตย์–เสาร์ · สัปดาห์ที่ 1 = 1 ม.ค. ถึงเสาร์แรกของปี) สัปดาห์ที่คร่อมสองเดือนนับเข้าเดือนที่มีวันมากกว่า · แต่ละกลุ่มโรคมีแกนซ้ายของตัวเอง เทียบขนาดจริงจากตัวเลขบนแท่ง · เดือนที่ยังไม่มีข้อมูลจะไม่มีแท่ง</li>
      <li><b>แท่งทึบจางขอบประ และพื้นเทา</b> (เดือนที่มี *) = มีข้อมูลเบื้องต้นรวมอยู่ · <b>เดือนที่มี †</b> = มีสัปดาห์ไม่เต็ม 7 วันรวมอยู่ (สัปดาห์ที่ 1 และสัปดาห์สุดท้ายของปี) ยอดรวมต่ำกว่าจริงเล็กน้อย</li></ul></details>
    <div class="dz-note"><b>หมายเหตุ</b> ข้อมูลจาก HDC${asOf ? ` ณ ${asOf}` : ""} อาจยังไม่สมบูรณ์ หน่วยบริการบางแห่งรายงานยังไม่ครบ${hasProv ? ` <span class="nw">* ${DZ_PROV_WK} สัปดาห์ล่าสุด (สัปดาห์ที่ ${Math.max(1, end.w - DZ_PROV_WK + 1)}–${end.w} · ${epiRange(end.y, Math.max(1, end.w - DZ_PROV_WK + 1), end.w)}) เป็นข้อมูลเบื้องต้น แสดงเป็นแท่งจาง ตัวเลขมักเพิ่มขึ้นเมื่อรายงานครบ จึงไม่ใช้สรุปแนวโน้ม</span>` : ""}</div>
    <div class="tip"></div></article>`;
}
