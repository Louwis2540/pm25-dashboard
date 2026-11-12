// ===== ส่วน 8 · กราฟแท่งผู้ป่วย 4 กลุ่มโรครายเดือน — เฉพาะช่วงฤดูฝุ่น (พ.ย.–พ.ค.) ตั้งแต่ พ.ย. 2568 → เดือนล่าสุด · ไม่มีเส้นค่าฝุ่น =====
// ประกาศ dzMonthAll ใหม่ (ประกาศหลังตัวเดิม → ตัวนี้ถูกใช้) · ใช้ e1sSvg แทน dzMonthSvg (อินโฟกราฟิกไม่ได้ใช้ทั้งสองฟังก์ชัน)
// กราฟรายสัปดาห์แยกจังหวัด (e2xBlock) คงเดิมทุกอย่าง
const E1S_START = [2025, 10];   // พ.ย. 2568 (เดือน 0–11)
function e1sMonths(dz, wkMax) {
  const e = dzCbEnd(dz, wkMax); if (!e.w) return [];
  const last = epiMonth(e.y, e.w), a = [];
  for (let y = E1S_START[0], m = E1S_START[1]; y < e.y || (y === e.y && m <= last);) { if (dzSeason(m)) a.push({ y, m }); if (++m > 11) { m = 0; y++; } }
  return a;
}
// เดือนที่ไม่ต่อจากเดือนก่อนหน้า = ขึ้นฤดูฝุ่นใหม่ (ข้าม มิ.ย.–ต.ค.)
const e1sNewSeason = (months, i) => i > 0 && (months[i].y * 12 + months[i].m) - (months[i - 1].y * 12 + months[i - 1].m) > 1;
function e1sSvg(ser, months, W) {
  const n = months.length, wide = W > 800, fs = wide ? 11.5 : 10;
  const L = wide ? 54 : 38, R = wide ? 16 : 10, pw = W - L - R, slot = pw / n, bw = Math.min(46, slot * (wide ? .58 : .66));
  const LH = 24, PH = wide ? 116 : 92, PT = 16, ML = fs * 2 + 14, GAP = 14, PB = LH + PH + ML + GAP;
  const H = ser.length * PB - GAP, X = i => L + i * slot + slot / 2;
  const provM = months.map((_, i) => ser.some(s => s.bars[i]?.prov));
  const F = `font-family="'IBM Plex Sans Thai',Anuphan,sans-serif"`;
  let g = "";
  ser.forEach((s, k) => {
    const top = k * PB, y0 = top + LH + PT, base = top + LH + PH;
    const mx = Math.max(...s.bars.map(o => o?.sum || 0)), bMax = e1Nice(mx * 1.08, true) || 1;
    const Y = v => base - v / bMax * (base - y0);
    g += `<circle cx="${L - 34 + (wide ? 0 : 6)}" cy="${top + 8}" r="5" fill="${s.d.c}"/><text x="${L - 24 + (wide ? 0 : 6)}" y="${top + 12}" font-size="${fs + 1.5}" font-weight="700" fill="#1f2a3d" ${F}>${dzName(s.d)}<tspan font-size="${fs - .5}" font-weight="600" fill="#6b7689"> · ราย/เดือน</tspan></text>`;
    months.forEach((_, i) => {     // พื้นเทา = ข้อมูลเบื้องต้น · เส้นประตั้ง = ขึ้นฤดูฝุ่นใหม่
      if (provM[i]) g += `<rect x="${L + i * slot + 1}" y="${top + LH}" width="${slot - 2}" height="${PH}" rx="6" fill="#e6eaf0" opacity=".75"/>`;
      if (e1sNewSeason(months, i)) g += `<line x1="${(L + i * slot).toFixed(1)}" x2="${(L + i * slot).toFixed(1)}" y1="${top + LH}" y2="${base + fs * 2 + 10}" stroke="#8a96a8" stroke-dasharray="4 3"/>`;
    });
    [0, .5, 1].forEach(f => { const yy = base - f * (base - y0);
      g += `<line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" stroke="rgba(15,27,45,${f ? .08 : .25})"${f ? ` stroke-dasharray="2 4"` : ""}/><text x="${L - 6}" y="${yy + 4}" text-anchor="end" font-size="${fs - 1}" fill="${s.d.c}" font-weight="700" ${F}>${fmt(Math.round(bMax * f))}</text>`; });
    s.bars.forEach((o, i) => { if (!o) return; const y = Y(o.sum);
      g += `<rect x="${(X(i) - bw / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${(base - y).toFixed(1)}" rx="3" fill="${s.d.c}" opacity="${o.prov ? .4 : .88}"${o.prov ? ` stroke="${s.d.c}" stroke-dasharray="3 2"` : ""}/>`
        + `<text x="${X(i).toFixed(1)}" y="${(y - 4).toFixed(1)}" text-anchor="middle" font-size="${fs}" font-weight="700" fill="${o.prov ? "#8a96a8" : "#1f2a3d"}" stroke="#fff" stroke-width="3" paint-order="stroke" ${F}>${wide ? fmt(Math.round(o.sum)) : dzK(o.sum)}</text>`; });
    months.forEach(({ y, m }, i) => {
      const o = s.bars[i];
      g += `<text x="${X(i).toFixed(1)}" y="${base + fs + 4}" text-anchor="middle" font-size="${fs}" fill="#5f6c80" ${F}>${TH_M[m]}${provM[i] ? "*" : ""}${o?.short ? "†" : ""}</text>`;
      if (i === 0 || m === 0 || e1sNewSeason(months, i)) g += `<text x="${(i === 0 ? L : X(i)).toFixed(1)}" y="${base + fs * 2 + 8}" text-anchor="${i === 0 ? "start" : "middle"}" font-size="${fs}" font-weight="700" fill="#33415c" ${F}>${y + 543}</text>`;
      g += `<rect class="hb" x="${(L + i * slot).toFixed(1)}" y="${top}" width="${slot.toFixed(1)}" height="${LH + PH}" fill="transparent" data-t="${TH_MF[m]} ${y + 543} · ${dzName(s.d)}${o ? `&#10;รวมทั้งเดือน ${fmt(o.sum)} ราย&#10;เฉลี่ย ${fmt(Math.round(o.avg))} ราย/สัปดาห์ (${o.n} สัปดาห์ระบาดวิทยา · สัปดาห์ที่ ${o.w0}–${o.w1} · ${epiRange(y, o.w0, o.w1)})${o.n >= 5 ? `&#10;เดือนนี้มี ${o.n} สัปดาห์ ยอดรวมจึงสูงกว่าเดือนที่มี 4 สัปดาห์ · เทียบข้ามเดือนให้ดูค่าเฉลี่ยราย/สัปดาห์` : ""}${o.short ? `&#10;† รวมสัปดาห์ไม่เต็ม 7 วัน (${o.short} วัน) ยอดรวมและค่าเฉลี่ยจึงต่ำกว่าจริงเล็กน้อย` : ""}${o.prov ? "&#10;ข้อมูลเบื้องต้น รายงานยังไม่ครบ" : ""}` : "&#10;ไม่มีข้อมูลผู้ป่วย"}"/>`;
    });
  });
  return `<svg class="bars ${wide ? "w-w" : "w-n"}" viewBox="0 0 ${W} ${H}" role="img" aria-label="ผู้ป่วยรวมรายเดือน 4 กลุ่มโรค ช่วงฤดูฝุ่น ทั้งเขตสุขภาพที่ 7 แยกแผงรายกลุ่ม">${g}</svg>`;
}
function dzMonthAll(dz, wkMax) {
  const months = e1sMonths(dz, wkMax); if (!months.length) return "";
  const end = dzCbEnd(dz, wkMax), cy = end.y;
  const byY = {}; for (const y of new Set(months.map(o => o.y))) byY[y] = Object.fromEntries(DZ.map(d => [d.key, monthlyWk(dz[y] || [], d.key, y === cy ? end.w : 99, y)]));
  const ser = DZ.map(d => ({ d, bars: months.map(({ y, m }) => byY[y]?.[d.key]?.[m] || null) }));
  const f = months[0], l = months.at(-1), rng = `${TH_M[f.m]} ${f.y + 543} – ${TH_M[l.m]} ${l.y + 543}`;
  const provMonths = [...new Set(ser.flatMap(s => s.bars.map((o, i) => o?.prov ? TH_M[months[i].m] : "")).filter(Boolean))];
  const asOf = (() => { const p = String(dz.meta?.dataDate || "").split("/"); return p.length === 3 ? `${+p[0]} ${TH_M[+p[1] - 1]} ${+p[2] + 543}` : ""; })();
  return `<article class="card dz dz-all" style="--dsoft:#eef2f7;--dc:#5f6c80">
    <div class="dz-top"><div class="dz-icon" style="background:#e6ebf2;color:#33415c"><svg><use href="#i-chart"/></svg></div>
      <div><h3>ผู้ป่วย 4 กลุ่มโรค รายเดือน ช่วงฤดูฝุ่น</h3><div class="icd">ทั้งเขตสุขภาพที่ 7 · เฉพาะเดือนช่วงฤดูฝุ่น (1 พ.ย.–31 พ.ค.) ${months.length} เดือน (${rng}) · หน่วย: <b>ราย/เดือน</b> (ยอดรวมทั้งเดือน · ชี้ที่แท่งเพื่อดูค่าเฉลี่ยราย/สัปดาห์) · ผู้ป่วยสัญชาติไทยทุกคนที่รับบริการในเขต รวมผู้อยู่นอกพื้นที่</div></div><button type="button" class="ds-jump" data-preset="weekly" style="margin-left:auto"><svg class="ico"><use href="#i-down"/></svg>ดาวน์โหลดข้อมูล</button></div>
    <div class="e1lg"><span><i class="bar"></i><em>แท่ง = ผู้ป่วยรวมรายเดือน (ราย · แกนซ้ายของแต่ละกลุ่มโรค)</em></span></div>
    ${e1sSvg(ser, months, 1100)}${e1sSvg(ser, months, 400)}
    <details class="pv-guide pg-fold dz-fold"><summary class="pg-h"><svg class="ico"><use href="#i-chart"/></svg><b>วิธีอ่านกราฟ</b><span class="pg-more">กดเพื่อเปิด/ปิด</span></summary>
    <ul><li><b>แท่งและตัวเลข</b> = ผู้ป่วยรวมทั้งเดือนนั้น · ชี้ที่แท่งเพื่อดู<b>ค่าเฉลี่ยราย/สัปดาห์</b> (ยอดรวม ÷ จำนวนสัปดาห์ระบาดวิทยาในเดือน) · เดือนที่มี 5 สัปดาห์ยอดรวมจะสูงกว่าเดือนที่มี 4 สัปดาห์ ถ้าจะเทียบข้ามเดือนให้ดูค่าเฉลี่ยราย/สัปดาห์</li>
      <li><b>แสดงเฉพาะช่วงฤดูฝุ่น</b> (พ.ย.–พ.ค.) ตั้งแต่ พ.ย. 2568 · เมื่อขึ้นฤดูใหม่จะมีเส้นประตั้งคั่นระหว่างฤดู</li>
      <li>นับตาม<b>สัปดาห์ระบาดวิทยา</b> (อาทิตย์–เสาร์ · สัปดาห์ที่ 1 = 1 ม.ค. ถึงเสาร์แรกของปี) สัปดาห์ที่คร่อมสองเดือนนับเข้าเดือนที่มีวันมากกว่า · แต่ละกลุ่มโรคมีแกนซ้ายของตัวเอง เทียบขนาดจริงจากตัวเลขบนแท่ง</li>
      <li><b>แท่งจางขอบประ และพื้นเทา</b> (เดือนที่มี *) = มีข้อมูลเบื้องต้นรวมอยู่ · <b>เดือนที่มี †</b> = มีสัปดาห์ไม่เต็ม 7 วันรวมอยู่ (สัปดาห์ที่ 1 และสัปดาห์สุดท้ายของปี) ยอดรวมต่ำกว่าจริงเล็กน้อย</li></ul></details>
    <div class="dz-note"><b>หมายเหตุ</b> ข้อมูลจาก HDC${asOf ? ` ณ ${asOf}` : ""} อาจยังไม่สมบูรณ์ หน่วยบริการบางแห่งรายงานยังไม่ครบ${provMonths.length ? ` <span class="nw">* ${DZ_PROV_WK} สัปดาห์ล่าสุด (สัปดาห์ที่ ${Math.max(1, end.w - DZ_PROV_WK + 1)}–${end.w} · ${epiRange(cy, Math.max(1, end.w - DZ_PROV_WK + 1), end.w)}) เป็นข้อมูลเบื้องต้น แสดงเป็นแท่งจาง ตัวเลขมักเพิ่มขึ้นเมื่อรายงานครบ จึงไม่ใช้สรุปแนวโน้ม</span>` : ""}</div>
    <div class="tip"></div></article>`;
}
