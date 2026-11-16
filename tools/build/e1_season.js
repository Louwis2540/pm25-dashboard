// ===== ส่วน 8 · ผู้ป่วย 4 กลุ่มโรครายเดือน — แนวโน้มเป็นช่วง (Louis 15 พ.ย. 2569) =====
// ช่วงที่ 1: พ.ย. 2568 → ก.ค. 2569 (9 เดือน) · ช่วงที่ 2: เริ่ม พ.ย. 2569 แล้วเพิ่มทีละเดือนเมื่อมีข้อมูล (ถึง ก.ค. 2570)
// แท่งเดี่ยวต่อเดือน = ผู้ป่วยรวมทั้งเดือน + เส้นเชื่อมยอดแท่งให้เห็นแนวโน้ม · ไม่มีเส้นค่าฝุ่น · ไม่แสดง ส.ค.–ต.ค.
// คำอธิบายบนหน้าเขียนให้คนทั่วไปอ่านเข้าใจ รายละเอียดเชิงวิชาการ (สัปดาห์ระบาดวิทยา ฯลฯ) อยู่ในส่วนพับ
// ประกาศ dzMonthAll ใหม่ (ประกาศหลังตัวเดิม → ตัวนี้ถูกใช้) · อินโฟกราฟิกไม่ได้ใช้ · กราฟรายสัปดาห์แยกจังหวัด (e2xBlock) คงเดิม · ใช้ monthlyWk / dzCbEnd ชุดเดิม
const E1P_START = [2025, 2026];   // ปีเริ่มช่วง (ค.ศ.) — ช่วงเริ่ม พ.ย. ของปีนั้น ถึง ก.ค. ปีถัดไป
const e1pMonths = s => [[s, 10], [s, 11], [s + 1, 0], [s + 1, 1], [s + 1, 2], [s + 1, 3], [s + 1, 4], [s + 1, 5], [s + 1, 6]].map(([y, m]) => ({ y, m }));
const e1pYY = y => String((y + 543) % 100);                                   // 2025 → "68"
const e1pRange = s => `พ.ย. ${s + 543} – ก.ค. ${s + 544}`;
const e1pChg = (a, b) => (a != null && b) ? (a - b) / b * 100 : null;
const e1pChgT = p => p == null ? "" : Math.abs(p) < .05 ? "เท่าเดิม" : `${p > 0 ? "▲ เพิ่มขึ้น" : "▼ ลดลง"} ${Math.abs(p).toFixed(1)}%`;
// cols: [{ y, m, per (0|1), wait }] — ช่องเดือนที่วาด · ser: [{ d, v: [cell|null] }]
function e1pSvg(ser, cols, W) {
  const wide = W > 800, fs = wide ? 11.5 : 10, n = cols.length, GAPW = wide ? 34 : 14;   // ช่องว่างคั่นสองช่วง
  const L = wide ? 54 : 38, R = wide ? 16 : 8, pw = W - L - R - GAPW, slot = pw / n, bw = Math.min(wide ? 40 : 22, slot * .56);
  const LH = wide ? 46 : 58, PH = wide ? 120 : 96, PT = 18, ML = fs * 2 + 16, GAP = 16, PB = LH + PH + ML + GAP;
  const H = ser.length * PB - GAP, n0 = cols.filter(c => c.per === 0).length;
  const X = i => L + i * slot + slot / 2 + (cols[i].per ? GAPW : 0);
  const F = `font-family="'IBM Plex Sans Thai',Anuphan,sans-serif"`, x1a = L, x1b = L + n0 * slot, x2a = x1b + GAPW, x2b = W - R;
  let g = "";
  ser.forEach((s, k) => {
    const top = k * PB, y0 = top + LH + PT, base = top + LH + PH;
    const mx = Math.max(0, ...s.v.map(o => o?.sum || 0)), bMax = e1Nice(mx * 1.08, true) || 1, Y = v => base - v / bMax * (base - y0);
    // หัวแผง: ชื่อกลุ่มโรค + สรุปเดือนล่าสุดเป็นภาษาง่าย
    const li = (() => { for (let i = n - 1; i >= 0; i--) if (s.v[i]) return i; return -1; })();
    const prevI = li > 0 && s.v[li - 1] && cols[li - 1].per === cols[li].per ? li - 1 : -1, ch = prevI >= 0 ? e1pChg(s.v[li].sum, s.v[prevI].sum) : null;
    const mxI = s.v.reduce((b, o, i) => o && (b < 0 || o.sum > s.v[b].sum) ? i : b, -1), mT = i => `${TH_M[cols[i].m]} ${e1pYY(cols[i].y)}`;
    g += `<circle cx="${L - 34 + (wide ? 0 : 6)}" cy="${top + 8}" r="5" fill="${s.d.c}"/><text x="${L - 24 + (wide ? 0 : 6)}" y="${top + 12}" font-size="${fs + 1.5}" font-weight="700" fill="#1f2a3d" ${F}>${dzName(s.d)}<tspan font-size="${fs - .5}" font-weight="600" fill="#6b7689"> · ราย/เดือน</tspan></text>`;
    if (li >= 0) {
      const a = `เดือนล่าสุด ${mT(li)}: `, bT = `${fmt(s.v[li].sum)} ราย`, c = ch == null ? "" : ` · ${e1pChgT(ch)} จากเดือนก่อน`, e = s.v[li].prov ? " (ข้อมูลยังเข้าไม่ครบ)" : "", hi = mxI >= 0 && wide ? ` · สูงสุดในกราฟ: ${mT(mxI)} (${fmt(s.v[mxI].sum)} ราย)` : "";
      const col = ch == null || Math.abs(ch) < .05 ? "#5f6c80" : ch > 0 ? "#b42318" : "#0f7b3f";
      g += wide ? `<text x="${W - R}" y="${top + 12}" text-anchor="end" font-size="${fs}" fill="#5f6c80" ${F}>${a}<tspan font-weight="700" fill="#1f2a3d">${bT}</tspan><tspan font-weight="700" fill="${col}">${c}</tspan>${e}${hi}</text>`
        : `<text x="${L - 24 + 6}" y="${top + 28}" font-size="${fs}" fill="#5f6c80" ${F}>${a}<tspan font-weight="700" fill="#1f2a3d">${bT}</tspan></text>` + (c ? `<text x="${L - 24 + 6}" y="${top + 42}" font-size="${fs}" font-weight="700" fill="${col}" ${F}>${c.slice(3)}${e}</text>` : "");
    }
    // พื้นหลังสองช่วง + ป้ายช่วง
    g += `<rect x="${x1a}" y="${top + LH}" width="${x1b - x1a}" height="${PH}" rx="8" fill="${s.d.c}" opacity=".05"/><rect x="${x2a}" y="${top + LH}" width="${x2b - x2a}" height="${PH}" rx="8" fill="${s.d.c}" opacity=".1"/>`;
    g += `<text x="${x1a + 6}" y="${top + LH + 12}" font-size="${fs - 1.5}" font-weight="700" fill="#6b7689" ${F}>ช่วงที่ 1</text><text x="${x2b - 5}" y="${top + LH + 12}" text-anchor="end" font-size="${fs - 1.5}" font-weight="700" fill="#6b7689" ${F}>ช่วงที่ 2</text>`;
    [0, .5, 1].forEach(f => { const yy = base - f * (base - y0);
      g += `<line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" stroke="rgba(15,27,45,${f ? .08 : .25})"${f ? ` stroke-dasharray="2 4"` : ""}/><text x="${L - 6}" y="${yy + 4}" text-anchor="end" font-size="${fs - 1}" fill="${s.d.c}" font-weight="700" ${F}>${fmt(Math.round(bMax * f))}</text>`; });
    let lab = "", line = "";
    cols.forEach((c, i) => {
      const o = s.v[i], x = X(i);
      if (o) { const y = Y(o.sum);
        g += `<rect x="${(x - bw / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${(base - y).toFixed(1)}" rx="3" fill="${s.d.c}" opacity="${o.prov ? .45 : .85}"${o.prov ? ` stroke="${s.d.c}" stroke-dasharray="3 2"` : ""}/>`;
        lab += `<text x="${x.toFixed(1)}" y="${(y - 5).toFixed(1)}" text-anchor="middle" font-size="${fs}" font-weight="700" fill="${o.prov ? "#8a96a8" : "#1f2a3d"}" stroke="#fff" stroke-width="3" paint-order="stroke" ${F}>${wide ? fmt(Math.round(o.sum)) : dzK(o.sum)}</text>`;
        const p = i > 0 && s.v[i - 1] && cols[i - 1].per === c.per ? s.v[i - 1] : null;   // เส้นแนวโน้ม: เชื่อมเฉพาะเดือนติดกันในช่วงเดียวกัน
        if (p) line += `<line x1="${X(i - 1).toFixed(1)}" y1="${Y(p.sum).toFixed(1)}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#1f2a3d" stroke-width="1.6" opacity=".55"${o.prov ? ` stroke-dasharray="4 3"` : ""}/>`;
        line += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.6" fill="#fff" stroke="#1f2a3d" stroke-width="1.5"/>`;
      } else if (c.wait) {   // ช่วงที่ 2 ยังไม่มีข้อมูล: กรอบประ "รอข้อมูล"
        g += `<rect x="${(x - bw / 2).toFixed(1)}" y="${(y0 + 14).toFixed(1)}" width="${bw.toFixed(1)}" height="${(base - y0 - 14).toFixed(1)}" rx="3" fill="none" stroke="#9aa6b8" stroke-dasharray="4 3"/>`;
        lab += `<text x="${x.toFixed(1)}" y="${(y0 + 8).toFixed(1)}" text-anchor="middle" font-size="${fs - 1}" font-weight="600" fill="#6b7689" ${F}>รอข้อมูล</text>`;
      }
      // ป้ายเดือน + ปี (ปีแสดงที่เดือนแรกของช่วง และ ม.ค.)
      g += `<text x="${x.toFixed(1)}" y="${base + fs + 5}" text-anchor="middle" font-size="${fs}" fill="#5f6c80" ${F}>${TH_M[c.m]}${o?.prov ? "*" : ""}</text>`;
      if (c.m === 0 || i === 0 || cols[i - 1].per !== c.per) g += `<text x="${x.toFixed(1)}" y="${base + fs * 2 + 9}" text-anchor="middle" font-size="${fs - .5}" font-weight="700" fill="#33415c" ${F}>${c.y + 543}</text>`;
      const p = i > 0 && cols[i - 1].per === c.per ? s.v[i - 1] : null, pc = o && p ? e1pChg(o.sum, p.sum) : null;
      const tip = o ? `&#10;ผู้ป่วยรวมทั้งเดือน ${fmt(o.sum)} ราย${pc != null ? `&#10;เทียบเดือนก่อน: ${e1pChgT(pc)} (${o.sum >= p.sum ? "เพิ่ม" : "ลด"} ${fmt(Math.abs(o.sum - p.sum))} ราย)` : ""}&#10;เฉลี่ยประมาณ ${fmt(Math.round(o.avg))} ราย/สัปดาห์ (${o.n} สัปดาห์)${o.prov ? "&#10;* ข้อมูลเดือนนี้ยังเข้าไม่ครบ ตัวเลขอาจเพิ่มขึ้นอีก" : ""}` : c.wait ? "&#10;ยังไม่มีข้อมูล จะแสดงเมื่อมีรายงานเข้ามา" : "&#10;ไม่มีข้อมูล";
      g += `<rect class="hb" x="${(x - slot / 2).toFixed(1)}" y="${top + LH}" width="${slot.toFixed(1)}" height="${PH}" fill="transparent" data-t="${TH_MF[c.m]} ${c.y + 543} · ${dzName(s.d)}${tip}"/>`;
    });
    g += line + lab;
  });
  return `<svg class="bars ${wide ? "w-w" : "w-n"}" viewBox="0 0 ${W} ${H}" role="img" aria-label="จำนวนผู้ป่วยรวมรายเดือน 4 กลุ่มโรค ทั้งเขตสุขภาพที่ 7 ช่วงที่ 1 ${e1pRange(E1P_START[0])} และช่วงที่ 2 เริ่ม พ.ย. ${E1P_START[1] + 543} แยกแผงรายกลุ่มโรค">${g}</svg>`;
}
function dzMonthAll(dz, wkMax) {
  const end = dzCbEnd(dz, wkMax); if (!end.w) return "";
  const lastM = epiMonth(end.y, end.w), memo = {};
  const mw = (d, y) => memo[y + d.key] ||= monthlyWk(dz[y] || [], d.key, y === end.y ? end.w : 99, y);
  const cell = (d, { y, m }) => (y > end.y || (y === end.y && m > lastM)) ? null : (mw(d, y)[m] || null);
  const has = mo => DZ.some(d => cell(d, mo));
  const p1 = e1pMonths(E1P_START[0]).map(mo => ({ ...mo, per: 0 }));
  let p2 = e1pMonths(E1P_START[1]).filter(has).map(mo => ({ ...mo, per: 1 }));
  const wait2 = !p2.length; if (wait2) p2 = [{ y: E1P_START[1], m: 10, per: 1, wait: true }];   // ยังไม่มีข้อมูลช่วงที่ 2 → ช่อง "รอข้อมูล" 1 ช่อง
  const cols = [...p1, ...p2], ser = DZ.map(d => ({ d, v: cols.map(c => c.wait ? null : cell(d, c)) }));
  const hasProv = ser.some(s => s.v.some(o => o?.prov));
  const asOf = (() => { const p = String(dz.meta?.dataDate || "").split("/"); return p.length === 3 ? `${+p[0]} ${TH_M[+p[1] - 1]} ${+p[2] + 543}` : ""; })();
  const last2 = wait2 ? "" : (() => { const c = p2[p2.length - 1]; return `${TH_M[c.m]} ${c.y + 543}`; })();
  return `<article class="card dz dz-all" style="--dsoft:#eef2f7;--dc:#5f6c80">
    <div class="dz-top"><div class="dz-icon" style="background:#e6ebf2;color:#33415c"><svg><use href="#i-chart"/></svg></div>
      <div><h3>จำนวนผู้ป่วย 4 กลุ่มโรคที่เกี่ยวข้องกับฝุ่น ในแต่ละเดือน</h3><div class="icd">ทั้งเขตสุขภาพที่ 7 · <b>1 แท่ง = จำนวนผู้ป่วยรวมของเดือนนั้น</b> (หน่วย: ราย) · แท่งสูงกว่าเดือนก่อน = ผู้ป่วยเพิ่มขึ้น</div></div><button type="button" class="ds-jump" data-preset="weekly" style="margin-left:auto"><svg class="ico"><use href="#i-down"/></svg>ดาวน์โหลดข้อมูล</button></div>
    <ul class="e1p-read" aria-label="วิธีอ่านกราฟแบบสั้น">
      <li><b>กราฟนี้บอกอะไร</b><span>แต่ละเดือนมีคนมารักษาด้วยโรค 4 กลุ่มที่อาจเกี่ยวข้องกับฝุ่นกี่ราย</span></li>
      <li><b>ดูแนวโน้มอย่างไร</b><span>ดูความสูงของแท่งและเส้นที่ลากเชื่อม เส้นชี้ขึ้น = ผู้ป่วยเพิ่ม เส้นชี้ลง = ผู้ป่วยลด</span></li>
      <li><b>ข้อควรรู้</b><span>ผู้ป่วยเพิ่มไม่ได้แปลว่าเกิดจากฝุ่นอย่างเดียว อากาศเย็นและโรคตามฤดูกาลก็มีผล ควรดูคู่กับค่าฝุ่นช่วงเดียวกัน</span></li></ul>
    <div class="e1lg"><span><i class="bar"></i><em>ช่วงที่ 1: ${e1pRange(E1P_START[0])}</em></span><span><i class="bar" style="opacity:.6"></i><em>ช่วงที่ 2: เริ่ม พ.ย. ${E1P_START[1] + 543}${wait2 ? " · ยังไม่มีข้อมูล จะเพิ่มทีละเดือน" : ` · มีข้อมูลถึง ${last2} เพิ่มทีละเดือน`}</em></span>${hasProv ? `<span><i class="bar" style="opacity:.4;outline:1.5px dashed currentColor"></i><em>แท่งจางขอบประ (*) = ข้อมูลเดือนนั้นยังเข้าไม่ครบ</em></span>` : ""}</div>
    ${e1pSvg(ser, cols, 1100)}${e1pSvg(ser, cols, 400)}
    <details class="pv-guide pg-fold dz-fold"><summary class="pg-h"><svg class="ico"><use href="#i-chart"/></svg><b>รายละเอียดเพิ่มเติม (สำหรับเจ้าหน้าที่)</b><span class="pg-more">กดเพื่อเปิด/ปิด</span></summary>
    <ul><li><b>ช่วงที่แสดง</b>: ช่วงที่ 1 = ${e1pRange(E1P_START[0])} · ช่วงที่ 2 = เริ่ม พ.ย. ${E1P_START[1] + 543} และเพิ่มทีละเดือนเมื่อมีข้อมูล (ถึง ก.ค. ${E1P_START[1] + 544}) · ไม่แสดงเดือน ส.ค.–ต.ค.</li>
      <li><b>ตัวเลขบนแท่ง</b> = ผู้ป่วยรวมทั้งเดือน · ชี้ที่แท่งเพื่อดูการเปลี่ยนแปลงจากเดือนก่อนและค่าเฉลี่ยราย/สัปดาห์ · เดือนที่มี 5 สัปดาห์ยอดรวมจะสูงกว่าเดือนที่มี 4 สัปดาห์ ถ้าจะเทียบข้ามเดือนอย่างละเอียดให้ดูค่าเฉลี่ยราย/สัปดาห์</li>
      <li>นับตาม<b>สัปดาห์ระบาดวิทยา</b> (อาทิตย์–เสาร์) สัปดาห์ที่คร่อมสองเดือนนับเข้าเดือนที่มีวันมากกว่า · แต่ละกลุ่มโรคมีแกนซ้ายของตัวเอง จึงเทียบขนาดข้ามกลุ่มโรคจากตัวเลข ไม่ใช่จากความสูงแท่ง</li>
      <li>ผู้ป่วยสัญชาติไทยทุกคนที่รับบริการในเขต รวมผู้อยู่นอกพื้นที่ · ที่มา: HDC กระทรวงสาธารณสุข</li></ul></details>
    <div class="dz-note"><b>หมายเหตุ</b> ข้อมูลจาก HDC${asOf ? ` ณ ${asOf}` : ""} อาจยังไม่สมบูรณ์ หน่วยบริการบางแห่งรายงานยังไม่ครบ${hasProv ? ` <span class="nw">* เดือนที่มีข้อมูล ${DZ_PROV_WK} สัปดาห์ล่าสุดรวมอยู่ ตัวเลขมักเพิ่มขึ้นเมื่อรายงานครบ จึงยังไม่ควรใช้สรุปแนวโน้ม</span>` : ""}</div>
    <div class="tip"></div></article>`;
}
