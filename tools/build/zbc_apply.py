"""ชุดปรับ 16 ต.ค. 2569 — ใช้ร่วมทั้งเดโม่และโค้ดจริง
1) จุดความร้อน: คำอธิบายความเชื่อมั่น/FRP แบบเข้าใจง่าย
2) แนวโน้มค่าฝุ่น: ตัวกรองแบบ dropdown (จังหวัด · แสดงเป็น วัน/สัปดาห์/เดือน · ช่วงเวลา ทั้งหมด/ปี/ฤดูฝุ่น)
3) เจาะลึกรายพื้นที่: เลือก จังหวัด → อำเภอ → ตำบล ได้ในโซน
4) คาดการณ์ 3 วัน: หมายเหตุว่าเป็นค่าคาดการณ์
"""

CSS = """
/* ===== ชุดปรับ 16 ต.ค. 2569 ===== */
#chart{touch-action:pan-y}
.tr-coop{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(15,27,45,.45);color:#fff;font-size:16px;font-weight:700;border-radius:14px;opacity:0;pointer-events:none;transition:opacity .25s;z-index:30;text-align:center;padding:0 16px}
.tr-coop.on{opacity:1}
.tr-hint b{color:var(--ink-1)}
.conf .cf-k{display:flex;align-items:flex-start;gap:8px;line-height:1.4}
.conf .cf-k i{flex:none;margin-top:3px}
.conf .cf-k small{display:block;font-size:11.5px;font-weight:500;color:var(--ink-3)}
.conf .cf-frp{display:flex;align-items:flex-start;gap:8px;margin-top:4px;padding-top:6px;border-top:1px dashed var(--line);line-height:1.4}
.conf .cf-frp .dots{display:flex;align-items:center;gap:3px;flex:none;margin-top:2px}
.conf .cf-frp .dots b{display:block;border-radius:50%;background:#f07d00;border:1.5px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.2)}
.conf .cf-frp small{display:block;font-size:11.5px;font-weight:500;color:var(--ink-3)}
.conf .cf-k>span,.conf .cf-frp>span:last-child{display:block;flex:1 1 auto;min-width:0;font-weight:700}
.tf-bar{display:flex;flex-wrap:wrap;align-items:flex-end;gap:10px 12px}
.tf{display:flex;flex-direction:column;gap:3px;font-size:12px;font-weight:700;color:var(--ink-2)}
.tf select{font:inherit;font-size:14px;font-weight:700;color:var(--ink-1);padding:7px 34px 7px 12px;border-radius:12px;border:1.5px solid var(--line-strong,#cfd8e3);background:#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' fill='none' stroke='%2346546a' stroke-width='2'/%3E%3C/svg%3E") no-repeat right 12px center;-webkit-appearance:none;appearance:none;min-width:150px;cursor:pointer}
.tf select:hover{border-color:#9fb0c6}
.tf select:focus-visible{outline:3px solid var(--accent,#1c6ed6);outline-offset:2px}
.tf-bar .seg{margin-left:auto}
.dpick{display:flex;flex-wrap:wrap;gap:8px 10px;margin:8px 0 4px;padding:10px 12px;border-radius:14px;background:#f4f7fb;border:1px solid #dfe6ef}
.dpick .tf select{min-width:0;width:100%}
.dpick .tf{flex:1 1 150px}
.dpick .tf select:disabled{color:var(--ink-3);background-color:#f1f3f6;cursor:not-allowed}
tr.d-hit td{box-shadow:inset 0 0 0 3px var(--ink-1)}
.fc-note2{margin:8px 0 0;font-size:12.5px;font-weight:600;line-height:1.55;color:var(--ink-2);background:#f4f6f9;border:1px solid #e1e6ee;border-radius:10px;padding:8px 10px}
.fc-note2 b{color:var(--ink-1);margin-right:6px}
@media (max-width:680px){.tf{flex:1 1 140px}.tf select{min-width:0;width:100%}.tf-bar .seg{margin-left:0}}
"""


def apply(sub):
    # ---------- 1) จุดความร้อน ----------
    sub('''<div class="conf"><div class="label">ความเชื่อมั่น (สี) · ขนาดจุดตามความร้อน (FRP)</div>${Object.values(CONF).map(([n, c]) => `<span><i style="background:${c}"></i>${n}</span>`).join("")}</div>''',
        '''<div class="conf"><div class="label">สีจุด = ความมั่นใจของดาวเทียมว่าเป็นไฟจริง</div>${Object.entries(CONF).map(([k, [n, c]]) => `<span class="cf-k"><i style="background:${c}"></i><span>${n}<small>${CONF_TXT[k]}</small></span></span>`).join("")}
      <div class="cf-frp"><span class="dots"><b style="width:7px;height:7px"></b><b style="width:11px;height:11px"></b><b style="width:16px;height:16px"></b></span><span>ขนาดจุด = ความแรงของไฟ<small>วัดจากพลังงานความร้อนที่ดาวเทียมจับได้ (FRP · เมกะวัตต์) จุดใหญ่ = ไฟแรงหรือลุกลามกว้าง</small></span></div></div>''')
    sub('const CONF = { high: ["สูง", "#e8192c"], nominal: ["ปานกลาง", "#f07d00"], low: ["ต่ำ", "#f5ce00"] };',
        '''const CONF = { high: ["สูง", "#e8192c"], nominal: ["ปานกลาง", "#f07d00"], low: ["ต่ำ", "#f5ce00"] };
// คำอธิบายระดับความเชื่อมั่นของ VIIRS (NASA FIRMS) แบบภาษาง่าย
const CONF_TXT = { high: "เกือบแน่ใจว่าเป็นไฟจริง ความร้อนสูงชัดเจน", nominal: "น่าจะเป็นไฟ", low: "อาจเป็นไฟเล็ก หรือแสงสะท้อน/พื้นผิวร้อน ควรตรวจสอบในพื้นที่" };''')

    # ---------- 2) แนวโน้มค่าฝุ่น: dropdown ----------
    sub('''<div class="seg" role="group" aria-label="ความละเอียดข้อมูล"><button type="button" data-mode="day">รายวัน</button><button type="button" data-mode="week">รายสัปดาห์</button></div>''',
        '''<label class="tf">จังหวัด<select id="trPv"><option value="all">ทั้ง 4 จังหวัด</option></select></label>
          <label class="tf">แสดงเป็น<select id="trMode"><option value="day">รายวัน</option><option value="week">รายสัปดาห์</option><option value="month">รายเดือน</option></select></label>''')
    sub('''<div class="seg" role="group" aria-label="ช่วงเวลา"><button type="button" data-range="7">7 วัน</button><button type="button" data-range="30">30 วัน</button><button type="button" data-range="90">3 เดือน</button><button type="button" data-range="season">ฤดูฝุ่น</button><button type="button" data-range="all">ทั้งหมด</button></div>''',
        '''<label class="tf">ช่วงเวลา<select id="trRange"></select></label>''')
    sub('<div class="tr-bar" id="trBar">', '<div class="tr-bar tf-bar" id="trBar">')
    sub('const TR = { mode: "day", range: "season", view: null };   // ค่าเริ่มต้น = ฤดูฝุ่น พ.ย.–พ.ค. (ข้ามปี)',
        'const TR = { mode: "day", range: "all", view: null, pv: "all" };   // ค่าเริ่มต้น = ทั้งหมด · ทุกจังหวัด')
    # ช่วงเวลาแบบใหม่: ทั้งหมด / ฤดูฝุ่น ปี พ.ศ. / ปีปฏิทิน / ช่วงล่าสุด
    sub('''    w = r === "all" ? [first, last] : r === "season" ? dustSeasonOf(last) : [addD(last, -(+r - 1)), last];''',
        '''    w = r === "all" ? [first, last] : r === "season" ? dustSeasonOf(last)
      : r.startsWith("season:") ? [`${r.slice(7)}-11-01`, `${+r.slice(7) + 1}-05-31`]
      : r.startsWith("year:") ? [`${r.slice(5)}-01-01`, `${r.slice(5)}-12-31`]
      : [addD(last, -(+r - 1)), last];''')
    sub('''function trendButtons() {
  const D = dailySeries();
  if (D.length) { const [a, b] = dustSeasonOf(D.at(-1).s); document.querySelector('#trBar [data-range="season"]').textContent = `ฤดูฝุ่น ${String(+a.slice(0, 4) + 543).slice(2)}/${String(+b.slice(0, 4) + 543).slice(2)}`; }
  document.querySelectorAll("#trBar [data-mode]").forEach(b => b.setAttribute("aria-pressed", b.dataset.mode === TR.mode));
  document.querySelectorAll("#trBar [data-range]").forEach(b => b.setAttribute("aria-pressed", !TR.view && b.dataset.range === TR.range));''',
        '''// รายการช่วงเวลา: สร้างจากข้อมูลที่มีจริง (ฤดูฝุ่น/ปีที่ยังไม่เริ่ม = เลือกไม่ได้)
function trendRangeOpts(first, last) {
  const be = y => String(y + 543), o = [["all", "ทั้งหมด"]];
  const y0 = +first.slice(0, 4) - 1, y1 = +last.slice(0, 4);
  for (let y = y1; y >= y0; y--) { const s = `${y}-11-01`, e = `${y + 1}-05-31`; if (e < first) continue;
    o.push([`season:${y}`, `ฤดูฝุ่น ${be(y).slice(2)}/${be(y + 1).slice(2)} (พ.ย.–พ.ค.)`, s > last ? `ยังไม่เริ่ม · เริ่ม 1 พ.ย. ${be(y)}` : ""]); }
  for (let y = y1; y >= +first.slice(0, 4); y--) o.push([`year:${y}`, `ปี ${be(y)} (ม.ค.–ธ.ค.)`, ""]);
  o.push(["90", "3 เดือนล่าสุด"], ["30", "30 วันล่าสุด"], ["7", "7 วันล่าสุด"]);
  return o;
}
function trendButtons() {
  const D = dailySeries();
  const sp = document.getElementById("trPv"), sm = document.getElementById("trMode"), sr = document.getElementById("trRange");
  if (sp && sp.options.length === 1) PROV.forEach(p => sp.add(new Option(p.name, p.name)));
  if (sr && D.length && !sr.options.length) trendRangeOpts(D[0].s, D.at(-1).s).forEach(([v, t, off]) => { const op = new Option(off ? `${t} — ${off}` : t, v); op.disabled = !!off; sr.add(op); });
  if (sp) sp.value = TR.pv; if (sm) sm.value = TR.mode; if (sr) sr.value = TR.range;''')
    # จังหวัดที่เลือก + รายเดือน
    sub('''  const day = TR.mode === "day", src = day ? D : weekly();
  let P = src.filter(r => r.e >= from && r.s <= to);''',
        '''  const day = TR.mode === "day", mon = TR.mode === "month", src = day ? D : mon ? monthlySeries() : weekly();
  const SHOW = TR.pv === "all" ? PROV.map((_, k) => k) : [PROV.findIndex(p => p.name === TR.pv)];
  let P = src.filter(r => r.e >= from && r.s <= to).map(r => ({ ...r, v: r.v.map((x, k) => SHOW.includes(k) ? x : null) }));''')
    sub('''  const season = !TR.view && TR.range === "season";
  const dom = season ? dustSeasonOf(last) : [P[0].s, P.at(-1).s];''',
        '''  const season = !TR.view && (TR.range === "season" || TR.range.startsWith("season:") || TR.range.startsWith("year:"));
  const dom = season ? (TR.range === "season" ? dustSeasonOf(last) : trendWindow("0000-01-01", "9999-12-31")) : [P[0].s, P.at(-1).s];''')
    sub('''  document.getElementById("legend").innerHTML = PROV.map(p => `<span><i style="background:${p.color}"></i>${p.name}</span>`).join("");''',
        '''  document.getElementById("legend").innerHTML = PROV.filter((_, k) => SHOW.includes(k)).map(p => `<span><i style="background:${p.color}"></i>${p.name}</span>`).join("");''')
    sub('''  const ends = PROV.map((p, k) => ({ k, y: lastV[k] ? Y(lastV[k].v[k]) : T + ph })).sort((a, b) => a.y - b.y);''',
        '''  const ends = PROV.map((p, k) => ({ k, y: lastV[k] ? Y(lastV[k].v[k]) : T + ph })).filter(o => lastV[o.k]).sort((a, b) => a.y - b.y);''')
    sub('''  const gapDays = day ? 1.5 : 10,''', '''  const gapDays = day ? 1.5 : mon ? 40 : 10,''')
    sub('''    const when = day ? `วัน${TH_D[new Date(r.s + "T00:00:00").getDay()]}ที่ ${thDate(r.s)} ${+r.s.slice(0, 4) + 543}` : `สัปดาห์ระบาดวิทยาที่ ${r.w}/${r.y + 543} · ${thDate(r.s)} – ${thDate(r.e)}`;''',
        '''    const when = day ? `วัน${TH_D[new Date(r.s + "T00:00:00").getDay()]}ที่ ${thDate(r.s)} ${+r.s.slice(0, 4) + 543}` : mon ? `${TH_M[+r.s.slice(5, 7) - 1]} ${+r.s.slice(0, 4) + 543} · เฉลี่ยรายเดือน (${r.n} วันที่มีข้อมูล)` : `สัปดาห์ระบาดวิทยาที่ ${r.w}/${r.y + 543} · ${thDate(r.s)} – ${thDate(r.e)}`;''')
    # ตัวกรอง dropdown แทนปุ่ม
    sub('''function initTrendBar() {
  document.getElementById("trBar").addEventListener("click", e => {''',
        '''// ซูม/เลื่อนกราฟแนวโน้มด้วยท่าทาง (แบบ Google Maps · ไม่แย่งการเลื่อนหน้าเว็บ):
// Ctrl/⌘ + ล้อเมาส์ หรือถ่างนิ้วบนทัชแพด = ซูมตรงตำแหน่งเคอร์เซอร์ · ล้อเปล่า = เลื่อนหน้าเว็บตามปกติ + ขึ้นคำแนะนำ
// ทัชแพดปัดซ้าย-ขวา/Shift+ล้อ = เลื่อนช่วง
// มือถือ: สองนิ้วถ่าง-หุบ = ซูม · นิ้วเดียวปัดแนวนอน = เลื่อน (ปัดแนวตั้งยังเลื่อนหน้าเว็บตามปกติ)
let TRG = null, TRV = null, trRaf = 0, trStatT = 0;
const isoMs = iso => Date.parse(iso + "T00:00:00Z"), msIso = ms => new Date(Math.round(ms / 864e5) * 864e5).toISOString().slice(0, 10);
function trCur() {   // ช่วงปัจจุบันแบบทศนิยม (มิลลิวินาที) เพื่อให้ซูมทีละนิดได้ลื่น
  const [f, t] = trendWindow(TRG.first, TRG.last);
  if (!TRV || msIso(TRV[0]) !== f || msIso(TRV[1]) !== t) TRV = [isoMs(f), isoMs(t)];
  return TRV;
}
function trSet(a, b) {
  const lo = isoMs(TRG.first), hi = isoMs(TRG.last), full = hi - lo;
  const minW = (TR.mode === "day" ? 6 : TR.mode === "month" ? 120 : 42) * 864e5;
  let w = Math.min(full, Math.max(minW, b - a));
  const c = (a + b) / 2; a = c - w / 2; b = c + w / 2;
  if (a < lo) { b += lo - a; a = lo; } if (b > hi) { a -= b - hi; b = hi; } if (a < lo) a = lo;
  TRV = [a, b];
  TR.view = b - a >= full - 864e5 ? null : [msIso(a), msIso(b)];
  if (!TR.view) TRV = null;
  if (!trRaf) trRaf = requestAnimationFrame(() => { trRaf = 0; renderTrend(); trendButtons(); });
  clearTimeout(trStatT); trStatT = setTimeout(renderTrendStats, 180);
}
const trFrac = (svg, cx) => { const r = svg.getBoundingClientRect(); return Math.max(0, Math.min(1, ((cx - r.left) / r.width * TRG.VW - TRG.L) / TRG.pw)); };
const trPwPx = svg => TRG.pw / TRG.VW * svg.getBoundingClientRect().width;
function trZoomAt(fr, k, base) {   // k < 1 = ซูมเข้า · วันที่ใต้เคอร์เซอร์/นิ้วอยู่กับที่
  const [a, b] = base || trCur(), at = a + fr * (b - a), w = (b - a) * k;
  trSet(at - fr * w, at - fr * w + w);
}
const TR_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
let trHintT = 0;
function trCoopHint(svg) {   // คำแนะนำชั่วคราวบนกราฟ เมื่อหมุนล้อโดยไม่กด Ctrl
  const box = svg.parentElement; if (getComputedStyle(box).position === "static") box.style.position = "relative";
  let h = box.querySelector(".tr-coop");
  if (!h) { h = document.createElement("div"); h.className = "tr-coop"; h.setAttribute("aria-hidden", "true"); box.appendChild(h); }
  h.textContent = `กด ${TR_MAC ? "⌘" : "Ctrl"} ค้างพร้อมหมุนล้อเมาส์เพื่อซูมกราฟ`;
  document.getElementById("tip")?.classList.remove("on");
  h.classList.add("on"); clearTimeout(trHintT); trHintT = setTimeout(() => h.classList.remove("on"), 1400);
}
function initTrendGestures() {
  const chartOf = e => TRG && e.target.closest?.("#chart");
  document.addEventListener("wheel", e => {
    const svg = chartOf(e); if (!svg) return;
    const u = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1, dx = (e.shiftKey ? e.deltaY : e.deltaX) * u, dy = e.shiftKey ? 0 : e.deltaY * u;
    if (Math.abs(dx) > Math.abs(dy)) {   // เลื่อนซ้าย-ขวา
      if (!TR.view) return;
      e.preventDefault(); const [a, b] = trCur(), s = dx / trPwPx(svg) * (b - a); trSet(a + s, b + s); return;
    }
    if (!(e.ctrlKey || e.metaKey)) { trCoopHint(svg); return; }   // ล้อเปล่า → หน้าเว็บเลื่อนตามปกติ
    e.preventDefault();   // กันเบราว์เซอร์ซูมทั้งหน้า
    trZoomAt(trFrac(svg, e.clientX), Math.exp(Math.max(-120, Math.min(120, dy)) * .0022));
  }, { passive: false });
  let g = null;
  const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY), midX = t => (t[0].clientX + t[1].clientX) / 2;
  document.addEventListener("touchstart", e => {
    const svg = chartOf(e); if (!svg) { g = null; return; }
    const t = e.touches;
    if (t.length === 2) { e.preventDefault(); g = { svg, k: 2, d0: dist(t), fr: trFrac(svg, midX(t)), m0: midX(t), v0: [...trCur()] }; }
    else if (t.length === 1) g = { svg, k: 1, x0: t[0].clientX, y0: t[0].clientY, v0: [...trCur()], dir: null };
  }, { passive: false });
  document.addEventListener("touchmove", e => {
    if (!g) return; const t = e.touches;
    if (g.k === 2 && t.length === 2) {
      e.preventDefault();
      const [a, b] = g.v0, w = (b - a) * g.d0 / Math.max(20, dist(t)), at = a + g.fr * (b - a);
      const shift = -(midX(t) - g.m0) / trPwPx(g.svg) * w;   // ถ่างพร้อมเลื่อนได้
      trSet(at - g.fr * w + shift, at - g.fr * w + w + shift);
    } else if (g.k === 1 && t.length === 1) {
      const dx = t[0].clientX - g.x0, dy = t[0].clientY - g.y0;
      if (!g.dir && Math.hypot(dx, dy) > 8) g.dir = Math.abs(dx) > Math.abs(dy) && TR.view ? "h" : "v";
      if (g.dir !== "h") return;
      e.preventDefault();
      const [a, b] = g.v0, s = -dx / trPwPx(g.svg) * (b - a); trSet(a + s, b + s);
    }
  }, { passive: false });
  document.addEventListener("touchend", e => { if (g && e.touches.length === 0) g = null; });
}
// ค่าเฉลี่ยรายเดือน (ปฏิทิน) จากค่ารายวัน — ต้องมีอย่างน้อย 10 วันที่มีข้อมูล
function monthlySeries() {
  const D = dailySeries(), mm = new Map();
  for (const r of D) { const k = r.s.slice(0, 7); if (!mm.has(k)) mm.set(k, { s: k + "-01", e: r.s, n: 0, v: PROV.map(() => []) }); const o = mm.get(k); o.e = r.s; o.n++; r.v.forEach((x, i) => { if (x != null) o.v[i].push(x); }); }
  return [...mm.values()].map(o => ({ s: o.s, e: o.e, n: o.n, v: o.v.map(a => a.length >= 10 ? a.reduce((x, y) => x + y, 0) / a.length : null) }));
}
function initTrendBar() {
  const onSel = () => {
    TR.pv = document.getElementById("trPv").value; TR.mode = document.getElementById("trMode").value;
    const r = document.getElementById("trRange").value; if (r !== TR.range) { TR.range = r; TR.view = null; }
    if (TR.mode === "month" && ["7", "30", "90"].includes(TR.range)) { TR.range = "all"; TR.view = null; }   // รายเดือนในช่วงสั้นมีไม่กี่จุด
    renderTrend(); renderTrendStats();
  };
  ["trPv", "trMode", "trRange"].forEach(id => document.getElementById(id)?.addEventListener("change", onSel));
  initTrendGestures();
  document.getElementById("trBar").addEventListener("click", e => {''')
    # เก็บเรขาคณิตของกราฟไว้ให้ตัวจัดการท่าทาง (ล้อเมาส์/สองนิ้ว)
    sub('''  svg.innerHTML = g;

  // ---- tooltip''', '''  svg.innerHTML = g;
  TRG = { VW, L, pw, first, last };

  // ---- tooltip''')
    sub('''💡 ลากเมาส์บนกราฟเพื่อซูมช่วงที่ต้องการ · ดับเบิลคลิกเพื่อรีเซ็ต · บนมือถือใช้ปุ่ม ＋ － ◀ ▶''',
        '''💡 <b>ซูม</b> กด Ctrl (Mac: ⌘) ค้างพร้อมหมุนล้อเมาส์ · ถ่าง-หุบสองนิ้วบนทัชแพดหรือจอสัมผัส · <b>เลื่อนช่วง</b> ปัดซ้าย-ขวา (ทัชแพด/นิ้วเดียว) · ลากเมาส์เพื่อเลือกช่วง · ดับเบิลคลิกหรือกด รีเซ็ต เพื่อกลับ''')
    sub('''      const minW = TR.mode === "day" ? 6 : 42, full = dDiff(first, last);''', '''      const minW = TR.mode === "day" ? 6 : TR.mode === "month" ? 120 : 42, full = dDiff(first, last);''')
    # สรุปช่วงที่แสดง (ตาราง B4): เฉพาะจังหวัดที่เลือก
    sub('''  let body = "";
  PROV.forEach((p, k) => {
    const v = rows.map(r => ({ d: r.s, x: r.v[k] })).filter(o => o.x != null);''',
        '''  let body = "";
  PROV.forEach((p, k) => {
    if (TR.pv !== "all" && p.name !== TR.pv) return;
    const v = rows.map(r => ({ d: r.s, x: r.v[k] })).filter(o => o.x != null);''')

    # ---------- 3) เจาะลึกรายพื้นที่: dropdown ----------
    sub('''function drillCrumb(pvName, level, amp) {
  return `<nav class="crumb" aria-label="ระดับพื้นที่">''',
        '''// แถบเลือกพื้นที่ในโซน: จังหวัด → อำเภอ → ตำบล (อำเภอ/ตำบลจากรายการ GISTDA ที่ server แคชไว้)
function drillPick(pvName, level, amp) {
  return `<div class="dpick" role="group" aria-label="เลือกพื้นที่">
    <label class="tf">จังหวัด<select data-dp="pv">${PROV.map(p => `<option ${p.name === pvName ? "selected" : ""}>${p.name}</option>`).join("")}</select></label>
    <label class="tf">อำเภอ<select data-dp="amp"><option value="">ภาพรวมจังหวัด</option>${amp ? `<option value="${esc(amp.code)}" selected>${esc(amp.name)}</option>` : ""}</select></label>
    <label class="tf">ตำบล<select data-dp="tb" ${level === "subdistrict" ? "" : "disabled"}><option value="">${level === "subdistrict" ? "ทุกตำบล" : "เลือกอำเภอก่อน"}</option></select></label></div>`;
}
async function bindPick(panel, pvName, level, amp) {
  const box = panel.querySelector(".dpick"); if (!box) return;
  const sp = box.querySelector('[data-dp="pv"]'), sa = box.querySelector('[data-dp="amp"]'), st = box.querySelector('[data-dp="tb"]');
  sp.addEventListener("change", () => renderDrill(sp.value));
  sa.addEventListener("change", () => { const o = sa.selectedOptions[0]; sa.value ? renderDrill(pvName, "subdistrict", { code: sa.value, name: o.textContent }) : renderDrill(pvName); });
  st.addEventListener("change", () => {
    panel.querySelectorAll("tr.d-hit").forEach(r => r.classList.remove("d-hit"));
    const row = [...panel.querySelectorAll(".area-t tbody tr")].find(r => r.cells[0]?.textContent.trim() === st.value);
    if (row) { row.classList.add("d-hit"); row.scrollIntoView({ behavior: "smooth", block: "center" }); }
  });
  const pv = PROV.find(p => p.name === pvName);
  S.dpAmp = S.dpAmp || {};
  const r = S.dpAmp[pv.code] || (S.dpAmp[pv.code] = await getJSON(`/api/pm25/districts?pv=${pv.code}`));
  if (!sa.isConnected) return;
  const list = (r?.items || []).map(i => [i.code, i.name]).sort((a, b) => a[1].localeCompare(b[1], "th"));
  sa.innerHTML = `<option value="">ภาพรวมจังหวัด</option>` + list.map(([c, n]) => `<option value="${esc(c)}" ${amp && amp.code === c ? "selected" : ""}>${esc(n)}</option>`).join("");
  if (level === "subdistrict") {
    const names = [...panel.querySelectorAll(".area-t tbody tr")].map(r => r.cells[0]?.textContent.trim()).filter(Boolean).sort((a, b) => a.localeCompare(b, "th"));
    if (names.length) st.innerHTML = `<option value="">ทุกตำบล (${names.length})</option>` + names.map(n => `<option>${esc(n)}</option>`).join("");
  }
}
function drillCrumb(pvName, level, amp) {
  return drillPick(pvName, level, amp) + `<nav class="crumb" aria-label="ระดับพื้นที่">''')
    sub('''function bindCrumb(panel, pvName) {
  panel.querySelectorAll(".crumb button[data-l]").forEach''',
        '''function bindCrumb(panel, pvName, level = "province", amp = null) {
  bindPick(panel, pvName, level, amp);
  panel.querySelectorAll(".crumb button[data-l]").forEach''')
    # คำอธิบายใต้กราฟแนวโน้ม: รายเดือน · ปี/ฤดูฝุ่น · จังหวัดที่เลือก
    sub(''': "ค่าเฉลี่ยรายสัปดาห์ระบาดวิทยา (อาทิตย์–เสาร์)"} · ${season ? "ฤดูฝุ่น " : ""}''',
        ''': mon ? "ค่าเฉลี่ยรายเดือน" : "ค่าเฉลี่ยรายสัปดาห์ระบาดวิทยา (อาทิตย์–เสาร์)"} · ${TR.pv !== "all" ? "จ." + TR.pv + " · " : ""}${season ? (TR.range.startsWith("year:") ? "ปี " : "ฤดูฝุ่น ") : ""}''')
    return CSS


def apply_area_bind(html):
    """renderArea เรียก bindCrumb(panel, pvName) หลายจุด → ส่ง level, amp ไปด้วย"""
    a = html.index("async function renderArea(pvName, level, amp) {")
    b = html.index("// จุด [lng, lat] อยู่ในขอบเขต feature ไหม", a)
    seg = html[a:b].replace("bindCrumb(panel, pvName);", "bindCrumb(panel, pvName, level, amp);")
    return html[:a] + seg + html[b:]


FC_OLD = '<br>เป็นค่าประมาณ อาจต่างจากค่าสถานีตรวจวัด Air4Thai</span></div>`'
FC_NEW = ('<br>เป็นค่าประมาณ อาจต่างจากค่าสถานีตรวจวัด Air4Thai</span></div>'
          '<p class="fc-note2"><b>หมายเหตุ</b>เป็นค่าคาดการณ์ล่วงหน้าจากแบบจำลอง ใช้ประกอบการวางแผนเฝ้าระวังและแจ้งเตือนประชาชน '
          'ค่าที่เกิดขึ้นจริงอาจต่างไปตามลม ฝน และการเผาในพื้นที่ · ค่าที่วัดได้จริงดูจากสถานีตรวจวัด Air4Thai</p>`')
