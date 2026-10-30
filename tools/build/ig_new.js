// ================= INFOGRAPHIC (ฉบับปรับ) =================
// กลุ่มเป้าหมายหลัก: เจ้าหน้าที่สาธารณสุขรายจังหวัด (รายงานสถานการณ์ประจำวันฉบับย่อ) + ส่งต่อประชาชน
// - เลือก "ทั้งเขต" หรือรายจังหวัดก่อนดาวน์โหลด (tailored) · ธีมสีและคำแนะนำตามระดับของจังหวัดที่เลือก
//   ทั้งเขต → ใช้ระดับของจังหวัดที่ค่าสูงสุด (หลักป้องกันไว้ก่อน แบบ EPA รายงานค่าสูงสุดของพื้นที่)
// - ตัดการเทียบปี 2568 ออก · โรคใช้แบบ E1 (เฉลี่ยราย/สัปดาห์ในแต่ละเดือน) · เพิ่มคาดการณ์ 3 วัน + QR ไปแดชบอร์ด
const IG_URL = "https://pm25-dashboard-ex8l.onrender.com";
S.igPv = "";
function igQR(size) {
  try { const q = qrcode(0, "M"); q.addData(IG_URL); q.make();
    const n = q.getModuleCount(), c = size / (n + 2); let r = "";
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) r += `<rect x="${((x + 1) * c).toFixed(2)}" y="${((y + 1) * c).toFixed(2)}" width="${(c + .02).toFixed(2)}" height="${(c + .02).toFixed(2)}"/>`;
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="#fff"/><g fill="#0f1b2d">${r}</g></svg>`;
  } catch { return ""; }
}
function igFocus() {
  const vals = PROV.map(p => ({ p, v: S.todayRow?.[p.name] })).filter(o => o.v != null);
  const maxP = [...vals].sort((a, b) => b.v - a.v)[0];
  const sel = S.igPv ? vals.find(o => o.p.name === S.igPv) : null;
  const f = sel || maxP;
  return { vals, maxP, f, lv: f ? lvOf(f.v) : S.lv, region: !S.igPv };
}
function igForecast(F, big) {
  const items = PROV.map(p => ({ p, it: S.gpv?.items.find(i => i.code === String(p.code)) })).filter(o => o.it);
  if (!items.length) return "";
  const base = new Date((S.gpv.asOf || "").slice(0, 10) + "T00:00:00"), day = k => new Date(base.getTime() + (k + 1) * 864e5);
  const hd = [0, 1, 2].map(k => { const d = day(k); return `<th>${d.getDate()} ${TH_M[d.getMonth()]}<small>${k === 0 ? "พรุ่งนี้" : TH_D[d.getDay()]}</small></th>`; }).join("");
  const rows = (F.region ? items : [...items.filter(o => o.p.name === S.igPv), ...items.filter(o => o.p.name !== S.igPv)]);
  return `<table class="fc3 num"><tr><th>จังหวัด</th>${hd}</tr>${rows.map(({ p, it }) => `<tr class="${!F.region && p.name === S.igPv ? "me" : ""}"><td>${p.name}</td>${it.pred.slice(0, 3).map(x => x == null ? `<td>–</td>` : `<td style="background:${LV[lvOf(x)].c};color:${textOn(LV[lvOf(x)].c)}">${f1(x)}</td>`).join("")}</tr>`).join("")}</table>`;
}
function igDzRows() {
  if (S.igPv && window.DZPV) {   // รายจังหวัด: ผู้ป่วยที่อยู่จริงในจังหวัดนั้น (Type area 1+3 · HDC s_pm25_2_in_week)
    const K = Object.fromEntries(Object.entries(DZPV_COL).map(([k, v]) => [v, k]));
    return window.DZPV.rows.filter(r => r.pv === S.igPv).map(r => ({ wk: r.wk, ...Object.fromEntries(Object.entries(K).map(([c, k]) => [k, r[c]])) }));
  }
  return S.dz?.[2026] || [];
}
function igDzPanel(d, m, last, W, H, fs) {
  const n = last + 1, L = 2, pw = W - 4, slot = pw / n, bw = Math.min(30, slot * .6), T = fs + 6, B = fs * 1.9, ph = H - T - B;
  const mx = Math.max(...m.map(o => o?.sum || 0)) * 1.05 || 1;
  let g = `<line x1="0" x2="${W}" y1="${T + ph}" y2="${T + ph}" stroke="rgba(15,27,45,.18)"/>`;
  for (let i = 0; i < n; i++) {
    const o = m[i], x0 = L + i * slot + (slot - bw) / 2;
    if (o) { const h = o.sum / mx * ph, v = o.sum;
      g += `<rect x="${x0}" y="${T + ph - h}" width="${bw}" height="${h}" rx="3" fill="${d.c}" opacity="${o.prov ? .45 : 1}"/>`
        + `<text x="${x0 + bw / 2}" y="${T + ph - h - 4}" text-anchor="middle" font-size="${fs - 1}" font-weight="700" fill="${o.prov ? "#8a96a8" : "#33415c"}" font-family="'IBM Plex Sans Thai',Anuphan,sans-serif">${fmt(v)}</text>`; }
    g += `<text x="${L + i * slot + slot / 2}" y="${H - 4}" text-anchor="middle" font-size="${fs - 1}" fill="#5f6c80" font-family="'IBM Plex Sans Thai',Anuphan,sans-serif">${TH_M[i]}${o?.prov ? "*" : ""}</text>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" width="100%">${g}</svg>`;
}
function igFcStrip(F) {   // ขนาดโซเชียล: คาดการณ์ 3 วันของจังหวัดที่โฟกัส (สาระที่ 3: พรุ่งนี้เป็นอย่างไร)
  const it = S.gpv?.items.find(i => i.code === String(F.f?.p.code)); if (!it) return "";
  const base = new Date((S.gpv.asOf || "").slice(0, 10) + "T00:00:00");
  return `<div class="fcs"><span class="t">${inl("i-cal", 22)}คาดการณ์ 3 วัน · ${F.f.p.name}</span>${it.pred.slice(0, 3).map((x, k) => { const d = new Date(base.getTime() + (k + 1) * 864e5), l = x == null ? null : LV[lvOf(x)];
    return `<span class="c" style="background:${l ? l.soft : "#eef1f5"};color:${l ? l.ink : "#5f6c80"};border-color:${l ? l.c : "#ccd4de"}"><small>${k === 0 ? "พรุ่งนี้" : `${TH_D[d.getDay()]} ${d.getDate()} ${TH_M[d.getMonth()]}`}</small><b>${l ? `${l.face} ${l.name}` : "–"}</b></span>`; }).join("")}</div>`;
}
function igTrendHtml(pv, center) {
  const t = igTrend(pv); if (!t) return "";
  return `<span class="trd ${t.up ? "up" : t.dn ? "dn" : ""}"${center ? ' style="justify-content:center"' : ""}>${t.up ? "▲ สูงขึ้นกว่าเมื่อวาน" : t.dn ? "▼ ลดลงจากเมื่อวาน" : "● ใกล้เคียงเมื่อวาน"}</span>`;
}
// แถบสี 7 วันย้อนหลัง (โพสต์ประชาชน): เห็นแนวโน้มโดยไม่ต้องอ่านตัวเลข
function igStrip7(pv) {
  const days = S.last7 || []; if (!days.length) return "";
  return `<span class="s7">${days.map((d, i) => { const x = d[pv], l = x != null ? LV[lvOf(x)] : null;
    return `<i class="${i === days.length - 1 ? "td" : ""}" style="background:${l ? l.c : "#dfe4ea"}"></i>`; }).join("")}</span><span class="s7k">7 วันที่ผ่านมา → วันนี้</span>`;
}
function dzAsOf() { const p = String(S.dz?.meta?.dataDate || "").split("/"); return p.length === 3 ? `${+p[0]} ${TH_M[+p[1] - 1]} ${+p[2] + 543}` : "–"; }
// การ์ดรายจังหวัด: ใช้การ์ดเดียวกับแดชบอร์ด (A3) ทุกประการ — คัดลอกจาก #tiles ที่แสดงอยู่
function igTiles() {
  const src = document.getElementById("tiles"); if (!src || !src.children.length) return "";
  const html = src.innerHTML.replace(/aria-pressed="true"/g, 'aria-pressed="false"').replace(/<button /g, '<div ').replace(/<\/button>/g, '</div>');
  return `<div class="ws-v2 igt"><div class="tiles">${html}</div></div>`;
}
// ย่อการ์ด 4 ใบให้พอดีแถว ด้วย transform (html2canvas วาด transform ได้ถูก แต่ zoom วาดตัวหนังสือเพี้ยน)
const IG_TW = 1360;
function igFitTiles(ig) {
  const box = ig.querySelector(".igt"), t = box?.querySelector(".tiles"); if (!t) return;
  const tw = ig.classList.contains("social") ? IG_TW : IG_TW + 120; t.style.width = tw + "px";
  const k = box.clientWidth / tw; t.style.transform = `scale(${k})`; box.style.height = (t.offsetHeight * k) + "px";
}
function igEpiWk() { return epiWeekOf(new Date(S.todayRow?.date + "T00:00:00")); }
function buildInfographic(size = "a4", dense = 0) {
  const F = igFocus(), L = LV[F.lv], ig = document.getElementById("ig");
  ig.className = size; ig.dataset.dense = dense;
  [["--lv", L.c], ["--lv-soft", L.soft], ["--lv-tint", L.tint], ["--lv-ink", L.ink]].forEach(([k, v]) => ig.style.setProperty(k, v));
  const pmTag = `<b class="pm-tag">ค่าฝุ่น PM<sub>2.5</sub></b>`;
  const heroK = F.region ? `${pmTag}สูงสุดในเขต <b class="hp">จ.${F.f?.p.name ?? "–"}</b>` : `${pmTag}<b class="hp">จ.${S.igPv}</b>`;
  const hero = `<div class="avg">${weatherArt(F.lv, size === "social" ? 220 : 150, size === "social" ? 160 : 110)}<div style="display:flex;flex-direction:column"><span class="k">${heroK}</span><span class="v num">${F.f ? f1(F.f.v) : "–"}<small> µg/m³</small></span><span class="l">${L.name}</span></div></div>`;
  const overN = PROV.filter(p => (S.todayRow?.[p.name] ?? 0) > 37.5), pheoc0 = PROV.some(p => (S.todayRow?.[p.name] ?? 0) >= 75.1);
  const kline = `<span class="kl">เกิน 37.5 <b>${overN.length} จังหวัด</b> · PHEOC <b>${pheoc0 ? "ถึงเกณฑ์" : "ยังไม่ถึงเกณฑ์"}</b> · จุดความร้อน <b>${S.hsToday.length} จุด</b></span>`;
  const scope = F.region ? `${L.face} ระดับสูงสุดในเขต: ${L.name}` : `${L.face} จ.${S.igPv}: ${L.name}`;
  const head = `<div class="ig-banner"><img src="${document.querySelector(".hdr-banner img")?.src || "/header-v2.webp"}" alt="" width="2000" height="250"></div><div class="ig-date"><span class="d">${S.todayRow ? `<span class="today-b">วันนี้</span><b>${thLong(S.todayRow.date)}</b><em>ณ เวลา ${REPORT_TIME}</em>` : ""}</span><span style="color:var(--lv-ink)">${size === "social" ? scope : `<small class="ew">สัปดาห์ระบาดวิทยาที่ ${igEpiWk()}</small>${F.region ? kline : scope}`}</span></div>`;
  const maxBar = F.region && F.f ? `<div class="maxbar"><span class="mk">${inl("i-pin", 22)}สูงสุดในเขตวันนี้</span><b class="mp">จ.${F.f.p.name}</b><span class="mv num">${f1(F.f.v)}<small> µg/m³</small></span><span class="ml">${L.face} ${L.name}</span></div>` : "";
  const advFor = F.region ? `ตามระดับสูงสุดในเขต (จ.${F.f?.p.name ?? "–"})` : `จ.${S.igPv}`;
  const adviceBox = `<div class="ig-sec"><span>${inl("i-shield", 20)}</span>คำแนะนำการปฏิบัติตัววันนี้<small style="margin-left:auto">${advFor}</small></div>
    <div class="advice"><div class="lv"><span class="f">${L.face}</span><b>${L.name}</b><span>${L.range} µg/m³</span></div>
      <div class="w"><h4>${inl("i-people", 24)}ประชาชนทั่วไป</h4>${L.pub.map(x => `<div class="do"><span>${inl(actIcon(x), 22)}</span>${x}</div>`).join("")}</div>
      <div class="w"><h4>${inl("i-heartp", 24)}กลุ่มเสี่ยง*</h4>${L.risk.map(x => `<div class="do"><span>${inl(actIcon(x), 22)}</span>${x}</div>`).join("")}</div></div>`;
  const scaleBox = `<div class="scale">${LV.map((l, i) => `<div class="${i === F.lv ? "cur" : ""}" style="background:${l.soft};color:${l.ink}"><b>${l.face} ${l.name}${i === F.lv ? " · วันนี้" : ""}</b>${l.range}</div>`).join("")}</div>`;
  const foot = `<div class="ig-f"><span class="qr">${igQR(size === "social" ? 92 : 84)}</span><span style="margin-right:auto"><b>สแกนดูแดชบอร์ดเต็ม</b> กราฟ แนวโน้ม ข้อมูลโรครายจังหวัด<br>${IG_URL.replace("https://", "")}<br>แหล่งข้อมูล: Air4Thai (กรมควบคุมมลพิษ) · GISTDA · HDC กระทรวงสาธารณสุข</span><span style="text-align:right">${size === "social" ? "" : "ผู้รายงาน: กลุ่มโรคจากการประกอบอาชีพและสิ่งแวดล้อม<br>"}สำนักงานป้องกันควบคุมโรคที่ 7 ขอนแก่น · กรมควบคุมโรค</span></div>`;
  const pheoc = PROV.some(p => (S.todayRow?.[p.name] ?? 0) >= 75.1);
  const fc1 = (() => { const it = S.gpv?.items.find(i => i.code === String(F.f?.p.code)); const x = it?.pred?.[0]; return x == null ? null : x; })();
  const facts3 = `<div class="facts3"><div><span class="fi" style="background:#e7f0fc;color:#1c6ed6">${inl("i-shield", 26)}</span><span><span class="k">เกณฑ์เปิด PHEOC (&gt;75 µg/m³)</span><b>${pheoc ? "ถึงเกณฑ์" : "ยังไม่เข้าเกณฑ์"}</b></span></div>
    <div><span class="fi" style="background:#fdeee5;color:#e8590c">${inl("i-fire", 26)}</span><span><span class="k">จุดความร้อน 24 ชม. (เขต 7)</span><b>${S.hsToday.length} จุด</b></span></div>
    <div><span class="fi" style="background:${fc1 != null ? LV[lvOf(fc1)].soft : "var(--subtle)"};color:${fc1 != null ? LV[lvOf(fc1)].ink : "var(--ink-2)"}">${inl("i-cal", 26)}</span><span><span class="k">พรุ่งนี้ (คาดการณ์) · ${F.f?.p.name ?? ""}</span><b>${fc1 != null ? `${f1(fc1)} · ${LV[lvOf(fc1)].name}` : "–"}</b></span></div></div>`;
  const pvCard = (p, cls) => { const v = S.todayRow?.[p.name], l = v != null ? LV[lvOf(v)] : null, me = !F.region && p.name === S.igPv;
    return `<div class="${me ? "me" : ""}" style="border-left:8px solid ${l ? l.c : "#ccc"};background:linear-gradient(160deg,#fff,${l ? l.soft : "#f3f6f9"})"><span class="n"><b class="pn">${p.name}</b>${l ? `<span class="chip" style="background:${l.soft};color:${l.ink};font-size:14px">${l.name}</span>` : ""}</span><span class="x num"><em class="pm" style="background:${l ? l.ink : "#5b6b7f"}">PM<sub>2.5</sub></em>${v != null ? f1(v) : "–"}<small> µg/m³</small></span></div>`; };
  const over = PROV.filter(p => (S.todayRow?.[p.name] ?? 0) > 37.5);
  const kpi = (ic, bg, fg, k, b, sm) => `<div><span class="fi" style="background:${bg};color:${fg}">${inl(ic, 26)}</span><span><span class="k">${k}</span><b>${b}</b>${sm ? `<small>${sm}</small>` : ""}</span></div>`;
  const kpis = `<div class="kpis${F.region ? " kpis-h" : ""}">${kpi("i-pin", over.length ? LV[3].soft : LV[1].soft, over.length ? LV[3].ink : LV[1].ink, "จังหวัดที่เกิน 37.5 µg/m³", `${over.length} จาก ${PROV.length}${over.length ? ` · ${over.map(p => p.name).join(" ")}` : ""}`)}
    ${kpi("i-shield", "#e7f0fc", "#1c6ed6", "เกณฑ์เปิด PHEOC (เกิน 75)", pheoc ? "ถึงเกณฑ์" : "ยังไม่เข้าเกณฑ์")}
    ${kpi("i-fire", "#fdeee5", "#e8590c", "จุดความร้อน 24 ชม. (เขต 7)", `${S.hsToday.length} จุด`)}</div>`;
  const riskNote = `<div class="ig-note">* กลุ่มเสี่ยง: ${RISK_DEF} · <b>ปรึกษาสุขภาพ สายด่วนกรมควบคุมโรค ${HOT_DDC}</b></div>`;
  const act = F.lv >= 3 ? `<div class="ig-act">${inl("i-fire", 24)}<b>ร่วมงดเผาในที่โล่ง</b> ลดฝุ่นเพื่อคนในชุมชน · พบการเผา แจ้งท้องถิ่นหรือสายด่วน ${HOT_PCD}</div>` : "";
  if (size === "social") {
    ig.innerHTML = head + `<div class="ig-body">${F.region ? "" : hero}
      ${F.region ? maxBar + igTiles() : `<div class="pvrow">${PROV.map(p => { const v = S.todayRow?.[p.name], l = v != null ? LV[lvOf(v)] : null, me = p.name === S.igPv;
        return `<div class="${me ? "me" : ""}" style="border-top:6px solid ${l ? l.c : "#ccc"}"><span class="n">${p.name}</span><span class="x num"><em class="pm" style="background:${l ? l.ink : "#5b6b7f"}">PM<sub>2.5</sub></em>${v != null ? f1(v) : "–"}</span>${l ? `<span class="chip" style="background:${l.soft};color:${l.ink};font-size:14px">${l.name}</span>` : ""}${igTrendHtml(p.name, true)}${igStrip7(p.name)}</div>`; }).join("")}</div>`}
      ${facts3}${adviceBox}${igFcStrip(F)}${act}${scaleBox}${riskNote}</div>` + foot;
    igFitTiles(ig);
    return;
  }
  // โรค: แบบ E1 ย่อ (เฉลี่ยราย/สัปดาห์ในแต่ละเดือน) — ไม่เทียบปี 2568
  const wkMax = S.wkMax || 0, rows = igDzRows();
  const ser = DZ.map(d => ({ d, m: monthlyWk(rows, d.key, wkMax, 2026) }));
  const last = Math.max(...ser.flatMap(s => s.m.map((v, i) => v != null ? i : -1)));
  const CH = [104, 94, 80, 66][dense];
  const dzSec = last < 0 ? "" : `<div class="ig-sec"><span>${inl("i-steth", 20)}</span>โรคที่เฝ้าระวังในช่วงฝุ่น · ${F.region ? "ทั้งเขต" : `จ.${S.igPv}${window.DZPV?.mock ? " (จำลอง)" : ""}`}<small style="margin-left:auto">ผู้ป่วยรวมรายเดือน (ราย)${F.region ? "" : " · เฉพาะผู้อยู่จริงในจังหวัด"} · HDC ณ ${dzAsOf()} · อัปเดตรายสัปดาห์</small></div>
    <div class="dzg2">${ser.map(s => `<div style="--dzs:${s.d.soft};background:linear-gradient(165deg,#fff 15%,${s.d.soft})"><div class="dh"><span class="dz-icon" style="background:#fff;color:${s.d.c}">${inl(s.d.icon, 22)}</span><span class="nm">${s.d.label}</span></div>${igDzPanel(s.d, s.m, last, 470, CH, 16)}</div>`).join("")}</div>
    <div class="dzl">ปี 2569 สัปดาห์ระบาดวิทยาที่ 1–${wkMax} (${epiRange(2026, 1, wkMax)}) · * ${DZ_PROV_WK} สัปดาห์ล่าสุด (สัปดาห์ที่ ${wkMax - DZ_PROV_WK + 1}–${wkMax}) เป็นข้อมูลเบื้องต้น รายงานยังไม่ครบ (แท่งจาง) · แต่ละกลุ่มใช้สเกลของตัวเอง ${(() => { const f = ser[0].m.map((o, i) => o?.n === 5 ? TH_M[i] : "").filter(Boolean); return f.length ? ` · ${f.join(" ")} มี 5 สัปดาห์ ยอดรวมจึงสูงกว่าเดือนอื่น` : ""; })()}</div>`;
  ig.innerHTML = head + `
  <div class="ig-body">
    ${F.region ? maxBar + igTiles()
      : `<div class="row1">${hero}${kpis}</div>`}
    ${adviceBox}
    ${F.region ? "" : act}
    ${dzSec}
    <div class="row3">
      <div class="box" style="background:linear-gradient(165deg,#fff,#f1effd)"><h4>ค่าย้อนหลัง 7 วัน<small>ค่าเฉลี่ย 24 ชม. ณ ${REPORT_TIME} · Air4Thai</small></h4><table class="t7 num">${t7Html(true)}</table></div>
      <div class="box" style="background:linear-gradient(165deg,#fff,var(--lv-tint))"><h4>คาดการณ์ 3 วัน<small>GISTDA · ${esc(S.gpv?.asOfThai || "")}</small></h4>${igForecast(F)}</div>
    </div>
    <div class="lvleg">${LV.map((l, i) => `<span class="${i === F.lv ? "cur" : ""}" style="background:${l.soft};color:${l.ink}"><i style="background:${l.c}"></i><b>${l.name}</b> ${l.range}</span>`).join("")}</div>
    ${riskNote}${F.region && F.lv >= 3 ? `<div class="ig-note"><b style="color:#9a3412">ร่วมงดเผาในที่โล่ง</b> ลดฝุ่นเพื่อคนในชุมชน · พบการเผา แจ้งท้องถิ่นหรือสายด่วน ${HOT_PCD}</div>` : ""}
  </div>${foot}`;
  igFitTiles(ig);
}
