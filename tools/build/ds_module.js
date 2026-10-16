// ===== โซน G · ชุดข้อมูลสำหรับเจ้าหน้าที่ (เลือก → กรอง → ตรวจ → ดาวน์โหลด) =====
// หมายเหตุ: เขียน "PM2\u002E5" แทนตัวอักษรตรงๆ — ขั้น build ของ demo แปลงคำนี้เป็น HTML ตัวห้อย ซึ่งจะทำให้สตริงใน JS พัง
// หลัก: FAIR (Wilkinson 2016) — ทุกไฟล์มีคำอธิบายตัวแปร แหล่งที่มา วันที่ประมวลผล และข้อความอ้างอิง
//       Tidy data (Wickham 2014) — 1 แถว = 1 หน่วยวิเคราะห์ (จังหวัด × เวลา × กลุ่มโรค)
//       เปิดเผยทีละขั้น (progressive disclosure, NN/g) — เห็นเฉพาะตัวเลือกของขั้นนั้น
// ข้อมูล: window.DSDATA = { s1, s2: "wk,resp,heart,eye,skin;…" รายจังหวัด, pop: {จังหวัด: ประชากรกลางปี}, popRows, dateCom, snapshotAt }
(function () {
  const D = () => window.DSDATA || {};
  const GK = ["resp", "heart", "eye", "skin"];
  const GKEY = { resp: "ทางเดินหายใจ", heart: "หัวใจ", eye: "ตาอักเสบ", skin: "ผิวหนัง" };
  const GLABEL = { resp: "ระบบทางเดินหายใจ", heart: "ระบบหัวใจ/หลอดเลือด", eye: "เยื่อบุตาอักเสบ", skin: "กลุ่มโรคผิวหนังอักเสบ" };
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const thD = s => { const d = new Date(s + "T00:00:00"); return `${d.getDate()} ${TH_M[d.getMonth()]} ${d.getFullYear() + 543}`; };
  const r1 = v => v == null || !isFinite(v) ? null : Math.round(v * 10) / 10;
  const r2 = v => v == null || !isFinite(v) ? null : Math.round(v * 100) / 100;
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // ข้อมูลผู้ป่วยรายจังหวัด × สัปดาห์ (ตารางที่ 1 หรือ 2)
  function cases(tb) {
    const src = D()[tb] || {}, out = {};
    for (const pv in src) for (const t of src[pv].split(";")) {
      const [w, ...v] = t.split(",").map(Number);
      out[pv + "|" + w] = Object.fromEntries(GK.map((k, i) => [k, v[i]]));
    }
    return out;
  }
  const wkMax = () => S.wkMax || 39;
  const prelimFrom = () => wkMax() - (typeof DZ_PROV_WK === "number" ? DZ_PROV_WK : 4) + 1;
  function pmRange() { const ds = Object.keys(S.pm?.allData || {}).sort(); return [ds[0], ds.at(-1)]; }

  // ── นิยามชุดข้อมูล ───────────────────────────────────────────────
  const COL = {
    year_be: ["ปี พ.ศ.", ""], pv_code: ["รหัสจังหวัด (กระทรวงมหาดไทย)", ""], pv_name: ["ชื่อจังหวัด", ""],
    epi_week: ["สัปดาห์ระบาดวิทยา (อาทิตย์–เสาร์ · สัปดาห์ที่ 1 เริ่ม 1 ม.ค.)", "สัปดาห์"],
    week_start: ["วันแรกของสัปดาห์ (ค.ศ. ปปปป-ดด-วว)", ""], week_end: ["วันสุดท้ายของสัปดาห์", ""],
    month: ["เดือนที่สัปดาห์นั้นมีวันอยู่มากกว่า (1–12)", ""], group: ["กลุ่มโรค", ""],
    cases: ["ผู้ป่วย (รายคน ตัดซ้ำในสัปดาห์)", "ราย"], population: ["ประชากร Type area 1+3 กลางปี (ประมาณ ณ 1 ก.ค.)", "คน"],
    rate_per_100k: ["อัตราป่วยต่อประชากรแสนคน", "ต่อแสน"], preliminary: ["1 = ข้อมูลเบื้องต้น รายงานยังไม่ครบ (4 สัปดาห์ล่าสุด)", ""],
    hdc_table: ["ตาราง HDC ต้นทาง", ""], date_com: ["วันที่ HDC ประมวลผล", ""],
    date: ["วันที่ (ค.ศ. ปปปป-ดด-วว)", ""], pm25_24h: ["ค่า PM2\u002E5 เฉลี่ย 24 ชม. ณ 07.00 น.", "µg/m³"], pm25_source: ["แหล่งค่าของวันนั้น: station = สถานีตรวจวัด Air4Thai · satellite = ดาวเทียม GISTDA (วันที่สถานีไม่มีข้อมูล)", ""], pm25_07: ["ค่า PM2\u002E5 เฉลี่ย 24 ชม. ณ 07.00 น. (ใช้ตัดสินเกณฑ์ PHEOC)", "µg/m³"], pheoc_2day: ["1 = ค่า ณ 07.00 น. ≥ 75.1 µg/m³ ทั้งวันนี้และวันก่อนหน้า (เข้าเกณฑ์เปิด PHEOC)", ""], satellite_days: ["จำนวนวันในสัปดาห์ที่ใช้ค่าประมาณจากดาวเทียม GISTDA แทนค่าสถานี", "วัน"], aqi_level: ["ระดับคุณภาพอากาศ (เกณฑ์กรมควบคุมมลพิษ)", ""],
    pm25_mean: ["ค่า PM2\u002E5 เฉลี่ยของวันที่มีข้อมูลในสัปดาห์", "µg/m³"], pm25_max: ["ค่า PM2\u002E5 รายวันสูงสุดในสัปดาห์", "µg/m³"],
    days_over_37_5: ["จำนวนวันที่ค่าเฉลี่ย 24 ชม. เกิน 37.5 µg/m³ (ค่ามาตรฐาน)", "วัน"], pm25_days: ["จำนวนวันที่มีค่าฝุ่นในสัปดาห์", "วัน"],
    type1c: ["ประชากร Type area 1 (หลังตัดซ้ำ) ณ สิ้นปีงบประมาณ", "คน"], type3c: ["ประชากร Type area 3 (หลังตัดซ้ำ) ณ สิ้นปีงบประมาณ", "คน"],
    pop13_end_fy: ["ประชากร Type 1+3 ณ สิ้นปีงบประมาณ", "คน"], pop13_midyear: ["ประชากรกลางปี = ปีก่อน + 0.75 × (ปีนี้ − ปีก่อน)", "คน"],
  };
  for (const k of GK) { COL["cases_" + k] = [`ผู้ป่วย${GLABEL[k]} (Type 1+3)`, "ราย"]; COL["rate_" + k] = [`อัตราป่วย${GLABEL[k]} ต่อแสน`, "ต่อแสน"]; }

  // วันที่ใช้ค่าดาวเทียม GISTDA แทนค่าสถานี (backfillGistda 16 ต.ค. 2569 · ดูแท็บ _backfill_log)
  const satDay = (d, pv) => (d >= "2026-01-01" && d <= "2026-02-18") || (d === "2026-02-23" && pv === "กาฬสินธุ์");
  const SRC_HDC = "HDC กระทรวงสาธารณสุข (MOPH Open Data) รายงานโรคที่เกี่ยวข้องกับ PM2\u002E5 รายสัปดาห์";
  const DS = [
    { id: "cases", icon: "i-steth", title: "ผู้ป่วย 4 กลุ่มโรค รายสัปดาห์ รายจังหวัด", level: "จังหวัด · สัปดาห์ระบาดวิทยา", freq: "อัปเดตรายสัปดาห์",
      src: SRC_HDC, desc: "ผู้ป่วยโรคที่เกี่ยวข้องกับฝุ่น นับรายคน ตัดซ้ำในสัปดาห์ เลือกได้ว่านับทุกคนที่มารับบริการ หรือเฉพาะผู้อยู่จริงในจังหวัด (มีอัตราต่อแสน)",
      filters: ["pv", "weeks", "groups", "table"],
      build(f) {
        const C = cases(f.table), pop = D().pop || {}, cols = ["year_be", "hdc_table", "pv_code", "pv_name", "epi_week", "week_start", "week_end", "month", "group", "cases"];
        if (f.table === "s2") cols.push("population", "rate_per_100k");
        cols.push("preliminary", "date_com");
        const rows = [];
        for (const p of PROV.filter(p => f.pv.includes(p.name))) for (let w = f.w0; w <= f.w1; w++) for (const g of f.groups) {
          const c = C[p.name + "|" + w]; if (!c) continue;
          const r = { year_be: 2569, hdc_table: f.table === "s2" ? "s_pm25_2_in_week" : "s_pm25_1_in_week", pv_code: p.code, pv_name: p.name, epi_week: w,
            week_start: iso(epiStart(2026, w)), week_end: iso(epiEnd(2026, w)), month: epiMonth(2026, w) + 1, group: GKEY[g], cases: c[g] };
          if (f.table === "s2") { r.population = pop[p.name]; r.rate_per_100k = r2(c[g] / pop[p.name] * 1e5); }
          r.preliminary = w >= prelimFrom() ? 1 : 0; r.date_com = D().dateCom; rows.push(r);
        }
        return { cols, rows };
      },
      note: f => f.table === "s2"
        ? "ตัวตั้ง = ผู้ป่วยที่อยู่อาศัยจริงในจังหวัด (Type area 1 และ 3) · ตัวหาร = ประชากร Type 1+3 กลางปี จาก HDC — ตัวตั้งและตัวหารเป็นประชากรกลุ่มเดียวกัน"
        : "นับผู้ป่วยสัญชาติไทยทุกคนที่มารับบริการในหน่วยบริการของจังหวัด รวมผู้อยู่นอกพื้นที่ (ใช้ดูภาระงาน) จึงไม่มีอัตราต่อแสน" },
    { id: "pm_daily", icon: "i-chart", title: "ค่าฝุ่น PM2\u002E5 รายวัน รายจังหวัด", level: "จังหวัด · รายวัน", freq: "อัปเดตทุกวัน · ค่า ณ 07.00 น.",
      src: "Air4Thai กรมควบคุมมลพิษ (สถานีตรวจวัด) ร่วมกับดาวเทียม GISTDA · ค่าเฉลี่ย 24 ชม. ณ 07.00 น. (แหล่งของแต่ละวันระบุในคอลัมน์ pm25_source)", desc: "ค่าเฉลี่ย 24 ชม. ณ 07.00 น. รายจังหวัด พร้อมระดับคุณภาพอากาศและเลขสัปดาห์ระบาดวิทยา",
      filters: ["pv", "dates"],
      build(f) {
        const all = S.pm?.allData || {}, rows = [];
        for (const d of Object.keys(all).sort()) {
          if (d < f.d0 || d > f.d1) continue;
          const dt = new Date(d + "T00:00:00");
          for (const p of PROV.filter(p => f.pv.includes(p.name))) {
            const v = all[d]?.[p.name]; if (v == null || !(v > 0)) continue;
            rows.push({ date: d, year_be: dt.getFullYear() + 543, epi_week: epiWeekOf(dt), pv_code: p.code, pv_name: p.name, pm25_24h: r1(v), pm25_source: satDay(d, p.name) ? "satellite" : "station", aqi_level: LV[lvOf(v)].name });
          }
        }
        return { cols: ["date", "year_be", "epi_week", "pv_code", "pv_name", "pm25_24h", "pm25_source", "aqi_level"], rows };
      },
      note: () => "ค่าเฉลี่ย 24 ชม. ณ 07.00 น. จากสถานีตรวจวัด Air4Thai ร่วมกับดาวเทียม GISTDA ในวันที่สถานีไม่มีข้อมูล (ระบุในคอลัมน์ pm25_source) · วันที่ไม่มีข้อมูลจะไม่มีแถว" },
    { id: "analysis", icon: "i-layers", star: true, title: "ชุดพร้อมวิเคราะห์ ฝุ่น × ผู้ป่วย", level: "จังหวัด · สัปดาห์ระบาดวิทยา", freq: "อัปเดตรายสัปดาห์",
      src: "Air4Thai + GISTDA (ค่าฝุ่น ณ 07.00 น.) + " + SRC_HDC + " ชุดที่ 2 + ประชากร Type 1+3 HDC",
      desc: "1 แถว = 1 จังหวัด × 1 สัปดาห์ มีค่าฝุ่นเฉลี่ย/สูงสุด/วันเกินมาตรฐาน ผู้ป่วยและอัตราต่อแสนทั้ง 4 กลุ่ม เปิดใน Excel, R หรือ Stata แล้ววิเคราะห์ได้ทันที",
      filters: ["pv", "weeks"],
      build(f) {
        const C = cases("s2"), pop = D().pop || {}, all = S.pm?.allData || {}, rows = [];
        for (const p of PROV.filter(p => f.pv.includes(p.name))) for (let w = f.w0; w <= f.w1; w++) {
          const s = epiStart(2026, w), e = epiEnd(2026, w), v = [];
          for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) { const x = all[iso(d)]?.[p.name]; if (x != null && x > 0) v.push(x); }
          const c = C[p.name + "|" + w] || {};
          const r = { year_be: 2569, pv_code: p.code, pv_name: p.name, epi_week: w, week_start: iso(s), week_end: iso(e), month: epiMonth(2026, w) + 1,
            pm25_mean: v.length ? r1(v.reduce((a, b) => a + b, 0) / v.length) : null, pm25_max: v.length ? r1(Math.max(...v)) : null,
            days_over_37_5: v.filter(x => x > 37.5).length, pm25_days: v.length, population: pop[p.name] };
          { let n = 0; for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) if (satDay(iso(d), p.name) && all[iso(d)]?.[p.name] > 0) n++; r.satellite_days = n; }
          for (const k of GK) { r["cases_" + k] = c[k] ?? null; r["rate_" + k] = c[k] == null ? null : r2(c[k] / pop[p.name] * 1e5); }
          r.preliminary = w >= prelimFrom() ? 1 : 0; r.date_com = D().dateCom; rows.push(r);
        }
        return { cols: ["year_be", "pv_code", "pv_name", "epi_week", "week_start", "week_end", "month", "pm25_mean", "pm25_max", "days_over_37_5", "pm25_days", "satellite_days",
          ...GK.map(k => "cases_" + k), ...GK.map(k => "rate_" + k), "population", "preliminary", "date_com"], rows };
      },
      note: () => "ผู้ป่วย = ผู้อยู่จริงในจังหวัด (Type 1+3) จึงคู่กับประชากรได้ถูกต้อง · ค่าฝุ่นเฉลี่ยคิดเฉพาะวันที่มีข้อมูล ดูจำนวนวันจากคอลัมน์ pm25_days · ใช้ดูความสัมพันธ์ระดับกลุ่มประชากร ไม่ใช่หลักฐานว่าฝุ่นเป็นสาเหตุ (ecological fallacy)" },
    { id: "gistda", icon: "i-sat", title: "ค่าฝุ่นรายวัน รายอำเภอ/ตำบล", level: "อำเภอ · ตำบล · รายวัน", freq: "อัปเดตทุกวัน", soon: true,
      src: "GISTDA ระบบเช็คฝุ่น (ค่าประมาณจากดาวเทียม)", desc: "77 อำเภอ 660 ตำบล ตั้งแต่ 1 ม.ค. 2569 — กำลังเก็บข้อมูลย้อนหลัง เปิดให้ดาวน์โหลดเมื่อเก็บครบ", filters: [] },
  ];
  const PRESETS = [
    { id: "analysis", label: "ชุดวิเคราะห์ ฝุ่น × ผู้ป่วย ทั้งปี", ds: "analysis", f: () => ({ w0: 1, w1: wkMax() }) },
    { id: "weekly", label: "สรุปผู้ป่วย 4 สัปดาห์ล่าสุด (ทำรายงาน)", ds: "cases", f: () => ({ table: "s1", w0: Math.max(1, wkMax() - 3), w1: wkMax() }) },
    { id: "season", label: "ค่าฝุ่นรายวัน ฤดูฝุ่นล่าสุด", ds: "pm_daily", f: () => { const t = pmRange()[1] || iso(new Date()), y = +t.slice(0, 4), m = +t.slice(5, 7); const sy = m >= 11 ? y : y - 1; return { d0: `${sy}-11-01`, d1: m >= 6 && m <= 10 ? `${y}-05-31` : t }; } },
  ];

  // ── สถานะ ─────────────────────────────────────────────────────────
  const st = { ds: "analysis", fmt: "csv", f: {} };
  function defaults(ds) {
    const r07 = Object.keys(S.pm07 || {}).sort(), [a, b] = ds === "pm07" && r07.length ? [r07[0], r07.at(-1)] : pmRange();
    return { pv: PROV.map(p => p.name), w0: 1, w1: wkMax(), groups: [...GK], table: "s2", d0: a || "2026-01-01", d1: b || iso(new Date()) };
  }
  function pick(id, over) { st.ds = id; st.f = { ...defaults(id), ...(over || {}) }; render(); }

  // ── ไฟล์ ──────────────────────────────────────────────────────────
  const cell = v => { if (v == null) return ""; const s = String(v); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const toCsv = (cols, rows) => "﻿" + [cols.join(","), ...rows.map(r => cols.map(c => cell(r[c])).join(","))].join("\r\n");
  function meta(ds, f, n) {
    const today = iso(new Date());
    const scope = ds.filters.includes("weeks") ? `สัปดาห์ระบาดวิทยาที่ ${f.w0}–${f.w1} ปี 2569 (${epiRange(2026, f.w0, f.w1)})` : ds.filters.includes("dates") ? `${thD(f.d0)} – ${thD(f.d1)}` : "ปีงบประมาณ 2568–2569";
    return [
      ["ชุดข้อมูล", ds.title], ["พื้นที่", "เขตสุขภาพที่ 7: " + f.pv.join(", ")], ["ช่วงเวลา", scope], ["จำนวนแถว", n],
      ["แหล่งข้อมูล", ds.src], ["วันที่ประมวลผลต้นทาง", ds.id === "pm_daily" || ds.id === "pop" ? "-" : D().dateCom], ["วันที่ดาวน์โหลด", today],
      ["หมายเหตุ", ds.note(f)],
      ["นิยามสัปดาห์", "สัปดาห์ระบาดวิทยา กรมควบคุมโรค: วันอาทิตย์–เสาร์ สัปดาห์ที่ 1 เริ่ม 1 ม.ค."],
      ["รหัสโรค (ICD-10)", "ทางเดินหายใจ J44 (ยกเว้น J44.2), J45, J44.2 · หัวใจ I21, I22, I24 · ตา H10 · ผิวหนัง L30.9, L50 (ประกาศกระทรวงสาธารณสุข พ.ศ. 2565)"],
      ["การอ้างอิง", `สำนักงานป้องกันควบคุมโรคที่ 7 ขอนแก่น. (2569). ${ds.title} [ชุดข้อมูล]. แดชบอร์ด PM2\u002E5 เขตสุขภาพที่ 7. สืบค้นเมื่อ ${thD(today)}.`],
      ["ข้อควรระวัง", "ข้อมูลระดับจังหวัดเป็นข้อมูลรวม ไม่มีข้อมูลรายบุคคล · ใช้เพื่อการเฝ้าระวังและสื่อสารความเสี่ยง"],
    ];
  }
  const dict = cols => cols.map(c => [c, COL[c]?.[0] || "", COL[c]?.[1] || ""]);
  const fname = (ds, f, ext) => `pm25_r7_${ds.id}_${ds.filters.includes("weeks") ? `wk${f.w0}-${f.w1}` : ds.filters.includes("dates") ? `${f.d0}_${f.d1}` : "2569"}.${ext}`;

  async function save(filename, data) {
    // ใน claude.ai artifact ต้องผ่าน capability downloads · บนเว็บจริงใช้ลิงก์ดาวน์โหลดปกติ
    let dl = null;
    try { if (window.claude?.use) dl = await Promise.race([window.claude.use("downloads"), new Promise(r => setTimeout(() => r(null), 1500))]); } catch {}
    if (dl) { try { await dl.save({ filename, data }); return "saved"; } catch (e) { if (e?.code === "declined") return "declined"; } }
    const blob = data instanceof Blob ? data : new Blob([data], { type: filename.endsWith(".csv") ? "text/csv;charset=utf-8" : "application/octet-stream" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: filename });
    document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    return "saved";
  }
  let xlsxP = null;
  const loadXlsx = () => xlsxP ||= new Promise((ok, no) => {
    if (window.XLSX) return ok(window.XLSX);
    const s = Object.assign(document.createElement("script"), { src: "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js", onload: () => ok(window.XLSX), onerror: () => { xlsxP = null; no(new Error("โหลดตัวสร้าง Excel ไม่สำเร็จ")); } });
    document.head.append(s);
  });

  async function download(what) {
    const ds = DS.find(d => d.id === st.ds), f = st.f, { cols, rows } = ds.build(f), msg = document.getElementById("dsMsg");
    msg.textContent = "กำลังเตรียมไฟล์…";
    try {
      let r;
      if (what === "dict") r = await save(`pm25_r7_${ds.id}_คำอธิบายตัวแปร.csv`, toCsv(["column", "description", "unit"], dict(cols).map(([c, d, u]) => ({ column: c, description: d, unit: u }))));
      else if (st.fmt === "csv") r = await save(fname(ds, f, "csv"), toCsv(cols, rows));
      else {
        const X = await loadXlsx(), wb = X.utils.book_new();
        X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([cols, ...rows.map(r => cols.map(c => r[c] ?? null))]), "ข้อมูล");
        X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([["คอลัมน์", "คำอธิบาย", "หน่วย"], ...dict(cols)]), "คำอธิบายตัวแปร");
        X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([["หัวข้อ", "รายละเอียด"], ...meta(ds, f, rows.length)]), "อ่านก่อน");
        r = await save(fname(ds, f, "xlsx"), new Blob([X.write(wb, { bookType: "xlsx", type: "array" })]));
      }
      msg.textContent = r === "declined" ? "ยกเลิกการดาวน์โหลด" : "✓ ดาวน์โหลดแล้ว";
    } catch (e) { msg.textContent = "ดาวน์โหลดไม่สำเร็จ: " + (e.message || e.code || e); }
  }

  // ── หน้าจอ ────────────────────────────────────────────────────────
  const ico = id => `<svg class="ico"><use href="#${id}"/></svg>`;
  function filtersHtml(ds) {
    const f = st.f, wkOpt = sel => Array.from({ length: wkMax() }, (_, i) => `<option value="${i + 1}"${i + 1 === sel ? " selected" : ""}>สัปดาห์ที่ ${i + 1} (${epiRange(2026, i + 1)})</option>`).join(""), [a, b] = pmRange();
    const h = [];
    if (ds.filters.includes("pv")) h.push(`<fieldset class="ds-f"><legend>พื้นที่</legend><div class="ds-chips">${PROV.map(p => `<label class="ds-chip"><input type="checkbox" data-k="pv" value="${p.name}"${f.pv.includes(p.name) ? " checked" : ""}><span>${p.name}</span></label>`).join("")}</div></fieldset>`);
    if (ds.filters.includes("weeks")) h.push(`<fieldset class="ds-f"><legend>ช่วงสัปดาห์ระบาดวิทยา ปี 2569</legend><div class="ds-row"><label>ตั้งแต่<select data-k="w0">${wkOpt(f.w0)}</select></label><label>ถึง<select data-k="w1">${wkOpt(f.w1)}</select></label></div><p class="ds-hint">สัปดาห์ที่ ${prelimFrom()}–${wkMax()} เป็นข้อมูลเบื้องต้น (คอลัมน์ preliminary = 1)</p></fieldset>`);
    if (ds.filters.includes("dates")) h.push(`<fieldset class="ds-f"><legend>ช่วงวันที่</legend><div class="ds-row"><label>ตั้งแต่<input type="date" data-k="d0" value="${f.d0}" min="${a}" max="${b}"></label><label>ถึง<input type="date" data-k="d1" value="${f.d1}" min="${a}" max="${b}"></label></div><p class="ds-hint">มีข้อมูล ${a ? thD(a) : "-"} – ${b ? thD(b) : "-"}</p></fieldset>`);
    if (ds.filters.includes("groups")) h.push(`<fieldset class="ds-f"><legend>กลุ่มโรค</legend><div class="ds-chips">${GK.map(k => `<label class="ds-chip"><input type="checkbox" data-k="groups" value="${k}"${f.groups.includes(k) ? " checked" : ""}><span>${GLABEL[k]}</span></label>`).join("")}</div></fieldset>`);
    if (ds.filters.includes("table")) h.push(`<fieldset class="ds-f"><legend>นับผู้ป่วยแบบไหน</legend><div class="ds-seg">
      <label><input type="radio" name="dsTb" data-k="table" value="s2"${f.table === "s2" ? " checked" : ""}><span><b>ผู้อยู่จริงในจังหวัด</b><small>Type area 1+3 · มีอัตราต่อแสน</small></span></label>
      <label><input type="radio" name="dsTb" data-k="table" value="s1"${f.table === "s1" ? " checked" : ""}><span><b>ทุกคนที่มารับบริการ</b><small>ทุก Type area · ดูภาระงาน</small></span></label></div></fieldset>`);
    return h.join("");
  }
  function render() {
    const el = document.getElementById("dsBody"); if (!el) return;
    const ds = DS.find(d => d.id === st.ds), f = st.f;
    const ok = !ds.soon && f.pv?.length && (!ds.filters.includes("groups") || f.groups.length) && (!ds.filters.includes("weeks") || f.w0 <= f.w1) && (!ds.filters.includes("dates") || f.d0 <= f.d1);
    const out = ok ? ds.build(f) : { cols: [], rows: [] }, csv = ok ? toCsv(out.cols, out.rows) : "";
    const kb = new Blob([csv]).size / 1024;
    // ไล่หัวข้อเป็นขั้น 1 → 2 → 3 ในแนวตั้ง (stepper) · รายการที่เลือกเป็นแบบพื้นทึบ (filled)
    el.innerHTML = `
      <section class="ds-step"><div class="ds-sh"><span class="ds-n">1</span><h3>เลือกชุดข้อมูล</h3></div>
        <div class="ds-pre" aria-label="ชุดสำเร็จรูป">${PRESETS.map(p => `<button type="button" class="ds-pbtn" data-preset="${p.id}">${p.label}</button>`).join("")}</div>
        <div class="ds-list" role="radiogroup" aria-label="ชุดข้อมูล">${DS.map(d => `
          <button type="button" role="radio" aria-checked="${d.id === st.ds}" class="ds-card${d.id === st.ds ? " on" : ""}${d.soon ? " soon" : ""}" data-ds="${d.id}">
            <span class="ds-ci">${ico(d.icon)}</span>
            <span class="ds-ct"><b>${d.title}${d.star ? ` <em class="ds-star">แนะนำ</em>` : ""}${d.soon ? ` <em class="ds-soon">เร็วๆ นี้</em>` : ""}</b>
              <small>${d.level} · ${d.freq}</small>${d.id === st.ds ? `<span>${d.desc}</span>` : ""}</span></button>`).join("")}</div></section>
      <section class="ds-step"><div class="ds-sh"><span class="ds-n">2</span><h3>กรองข้อมูล</h3></div>
        ${ds.soon ? `<p class="ds-empty">ชุดนี้กำลังเก็บข้อมูลย้อนหลัง เมื่อครบจะเลือกจังหวัด อำเภอ และช่วงวันที่ได้ที่นี่</p>` : filtersHtml(ds)}
        ${ds.soon ? "" : `<p class="ds-note">${esc(ds.note(f))}</p>`}</section>
      <section class="ds-step ds-last"><div class="ds-sh"><span class="ds-n">3</span><h3>ตรวจแล้วดาวน์โหลด</h3></div>
        ${ok ? `<div class="ds-stat" aria-live="polite"><span><b class="num">${fmt(out.rows.length)}</b>แถว</span><span><b class="num">${out.cols.length}</b>คอลัมน์</span><span><b class="num">${kb < 1024 ? Math.max(1, Math.round(kb)) + " KB" : (kb / 1024).toFixed(1) + " MB"}</b>ขนาด CSV</span></div>
        <details class="ds-pv"><summary>ดูตัวอย่าง 8 แถวแรก</summary>
          <div class="ds-prev" tabindex="0"><table><thead><tr>${out.cols.map(c => `<th title="${esc(COL[c]?.[0] || "")}">${c}</th>`).join("")}</tr></thead>
          <tbody>${out.rows.slice(0, 8).map(r => `<tr>${out.cols.map(c => `<td>${esc(r[c] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
          <p class="ds-hint">ชี้ที่ชื่อคอลัมน์เพื่อดูความหมาย</p></details>
        <div class="ds-fmt" role="radiogroup" aria-label="รูปแบบไฟล์">
          <label><input type="radio" name="dsFmt" value="csv"${st.fmt === "csv" ? " checked" : ""}><span><b>CSV</b><small>Excel/R/Stata · ภาษาไทยไม่เพี้ยน</small></span></label>
          <label><input type="radio" name="dsFmt" value="xlsx"${st.fmt === "xlsx" ? " checked" : ""}><span><b>Excel</b><small>มีแผ่นอ่านก่อน + คำอธิบายตัวแปร</small></span></label></div>
        <button type="button" class="ds-dl" id="dsGo">${ico("i-down")}ดาวน์โหลด ${st.fmt === "csv" ? "CSV" : "Excel"}</button>
        ${st.fmt === "csv" ? `<button type="button" class="ds-sub" id="dsDict">คำอธิบายตัวแปร (CSV)</button>` : ""}<p id="dsMsg" class="ds-msg" aria-live="polite"></p>
        <details class="ds-cite"><summary>วิธีอ้างอิงและลิงก์ถาวร</summary>
          <p><b>อ้างอิง:</b> สำนักงานป้องกันควบคุมโรคที่ 7 ขอนแก่น. (2569). ${esc(ds.title)} [ชุดข้อมูล]. แดชบอร์ด PM2.5 เขตสุขภาพที่ 7. สืบค้นเมื่อ ${thD(iso(new Date()))}.</p>
          <p><b>ลิงก์ถาวร (Power Query/R):</b> <code>/api/dataset/${ds.id}.csv?pv=${f.pv.map(n => PROV.find(p => p.name === n).code).join(",")}${ds.filters.includes("weeks") ? `&wk=${f.w0}-${f.w1}` : ""}${ds.filters.includes("dates") ? `&from=${f.d0}&to=${f.d1}` : ""}</code> <em>(เปิดใช้เมื่อขึ้นเว็บจริง)</em></p></details>`
        : `<p class="ds-empty">${ds.soon ? "ยังไม่เปิดให้ดาวน์โหลด" : "เลือกอย่างน้อย 1 จังหวัด 1 กลุ่มโรค และช่วงเวลาที่ถูกต้อง"}</p>`}</section>`;
  }
  function onChange(e) {
    const t = e.target, k = t.dataset.k, f = st.f;
    if (t.name === "dsFmt") { st.fmt = t.value; return render(); }
    if (!k) return;
    if (t.type === "checkbox") { const s = new Set(f[k]); t.checked ? s.add(t.value) : s.delete(t.value); f[k] = k === "pv" ? PROV.map(p => p.name).filter(n => s.has(n)) : GK.filter(g => s.has(g)); }
    else f[k] = /^w[01]$/.test(k) ? +t.value : t.value;
    render();
  }
  function onClick(e) {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.ds) return pick(b.dataset.ds);
    if (b.dataset.preset) { const p = PRESETS.find(x => x.id === b.dataset.preset); return pick(p.ds, p.f()); }
    if (b.id === "dsGo") return download("data");
    if (b.id === "dsDict") return download("dict");
  }
  // ── ทางเข้า: แผง "ดาวน์โหลดข้อมูล" (#zData) เปิดจากเมนูในแถบนำทางซ้าย — ไม่อยู่บนหน้าแดชบอร์ด ────────────────
  // ทางลัดจากการ์ดกราฟ: <button class="ds-jump" data-preset="…"> → เลือกชุดไว้ แล้วเปิดแผงดาวน์โหลด
  document.addEventListener("click", e => {
    const j = e.target.closest(".ds-jump"); if (!j) return;
    const p = PRESETS.find(x => x.id === j.dataset.preset); if (p) pick(p.ds, p.f());
    window.dsOpen && dsOpen();
  });
  window.dsInit = function () {
    if (!document.getElementById("dsBody")) return;
    const el = document.getElementById("dsBody"); if (el.dataset.on) return render();
    el.dataset.on = 1; el.addEventListener("change", onChange); el.addEventListener("click", onClick);
    pick("analysis");
  };
})();
