// ================= แผนที่รวม: ค่าฝุ่นรายจังหวัด + จุดความร้อน (เดโม่ขั้น 2) =================
// ประกาศ renderHotspot ซ้ำ — ตัวที่อยู่ทีหลังชนะ (แทนฟังก์ชันเดิมที่วาดเฉพาะจุดความร้อน)
//  • ชั้น "ค่าฝุ่น": พื้นที่จังหวัดสีตามระดับ + ป้ายค่า
//      - แสดงเฉพาะค่าเรียลไทม์: ค่าเฉลี่ย 24 ชม. ล่าสุดจาก Air4Thai ผ่าน /api/air4thai-live · ขอข้อมูลใหม่ทุกต้นชั่วโมง + MM.PM_MIN นาที (ไม่ใช้ค่า 07.00 น. บนแผนที่)
//      - ดึงค่าล่าสุดไม่ได้ → แสดง "ค่าก่อนหน้า" (ครั้งล่าสุดที่ดึงสำเร็จ · เก็บใน localStorage ข้ามการโหลดหน้า ไม่เกิน 24 ชม.) พร้อมแจ้งเวลาของค่านั้น
//        ไม่เคยมีค่าเลย → แสดง "–" และแจ้งว่ายังไม่มีค่าเรียลไทม์ (ไม่ใช้ค่า 07.00 น. แทน)
//  • พื้นหลังแผนที่: ไทล์ OpenStreetMap (ถ้าโหลดได้) + เส้นเขตอำเภอที่วาดเอง (ใช้ได้แม้ไม่มีไทล์ เช่นในหน้า Artifact ที่บล็อกรูปภายนอก) + ชื่ออำเภอเมื่อซูมเข้า + สเกล + ป้ายบอกค่าบนแผนที่
//  • ชั้น "จุดความร้อน": GISTDA VIIRS · ดึง /api/hotspot ซ้ำทุก 10 นาที (เซิร์ฟเวอร์ดึง GISTDA ทุก 60 นาที)
const MM = { on: { pm: true, hs: true }, HS_EVERY: 10 * 60 * 1000, PM_MIN: 10,
  hsLast: null, hsNext: 0, hsBusy: false, hsOk: true,
  live: null, pmAt: null, pmNext: 0, pmBusy: false, pmOk: true, pmStale: false, fromCache: false,
  sample: false, timer: null, bound: false, shapes: {} };
const mmPad = n => String(n).padStart(2, "0");
const mmClock = d => d ? `${mmPad(d.getHours())}:${mmPad(d.getMinutes())}:${mmPad(d.getSeconds())}` : "–";
const mmHM = d => `${mmPad(d.getHours())}:${mmPad(d.getMinutes())}`;
const mmLeft = t => { const s = Math.max(0, Math.round((t - Date.now()) / 1000)), h = Math.floor(s / 3600); return `${h ? h + ":" : ""}${mmPad(Math.floor(s % 3600 / 60))}:${mmPad(s % 60)}`; };
function mmNextPm() { const t = new Date(); t.setMinutes(MM.PM_MIN, 0, 0); if (t.getTime() <= Date.now()) t.setHours(t.getHours() + 1); return t.getTime(); }   // ต้นชั่วโมงถัดไป + PM_MIN นาที (รอ Air4Thai อัปเดต)

// ---- เก็บ "ค่าก่อนหน้า" ข้ามการโหลดหน้า (localStorage อาจใช้ไม่ได้ → ข้ามเงียบ ๆ) ----
const MM_KEY = "mm_live_v1", MM_KEEP = 24 * 3600 * 1000;
function mmSave() { try { localStorage.setItem(MM_KEY, JSON.stringify({ at: Date.now(), live: MM.live })); } catch (_) {} }
function mmLoad() { try { const o = JSON.parse(localStorage.getItem(MM_KEY) || "null"); if (o?.live && Date.now() - o.at < MM_KEEP) { MM.live = o.live; MM.fromCache = true; } } catch (_) {} }
// ค่าที่แสดงเป็น "ค่าก่อนหน้า" = โหมดล่าสุดที่ยังไม่ได้ค่าใหม่ (ดึงไม่สำเร็จ หรือเป็นค่าจากครั้งก่อนระหว่างรอค่าใหม่)
const mmPrev = () => !!MM.live && (!MM.pmOk || MM.fromCache);

// ---- ค่าฝุ่นที่ใช้วาด: ค่าเรียลไทม์เท่านั้น (ไม่มี → null แสดง "–") ----
function mmVal(n) { const o = MM.live?.[n]; return o && o.v != null ? o.v : null; }
function mmPmTime() {   // เวลาของค่าล่าสุด (รอบล่าสุดของทุกจังหวัด)
  const t = Object.values(MM.live || {}).filter(o => o.v != null).map(o => `${o.date} ${o.time}`).sort().at(-1); if (!t) return null;
  const today = new Date(); const ds = `${today.getFullYear()}-${mmPad(today.getMonth() + 1)}-${mmPad(today.getDate())}`;
  return t.startsWith(ds) ? `${t.slice(11)} น.` : `${+t.slice(8, 10)} ${TH_M[+t.slice(5, 7) - 1]} ${t.slice(11)} น.`;
}
function mmNote() {   // กล่องค่าสูงสุด/ต่ำสุดใต้แผนที่ ให้ตรงกับค่าที่แสดงบนแผนที่
  const el = document.getElementById("mapNote"); if (!el) return;
  const sorted = PROV.map(p => ({ n: p.name, v: mmVal(p.name) })).filter(o => o.v != null).sort((a, b) => b.v - a.v);
  const note = (o, ic, t) => { const l = LV[lvOf(o.v)]; return `<div><span class="ni" style="background:${l.soft};color:${l.ink}"><svg class="ico"><use href="#${ic}"/></svg></span><span>${t}<b>${o.n} ${f1(o.v)}</b></span></div>`; };
  el.innerHTML = sorted.length > 1 ? note(sorted[0], "i-up", "ค่าสูงสุด") + note(sorted.at(-1), "i-dn", "ค่าต่ำสุด") : "";
}

// ---- แถบสถานะ real-time (ค่าฝุ่น + จุดความร้อน) ----
function mmLive() {
  const el = document.getElementById("mmLive"); if (!el) return;
  const pt = mmPmTime() || "–";
  let pmRow;
  const nx = `<span class="mm-nx">ขอข้อมูลใหม่ทุกชั่วโมง (ครั้งถัดไป ${mmHM(new Date(MM.pmNext))} น. · อีก <b id="mmCdP">${mmLeft(MM.pmNext)}</b>)</span>`;
  if (!MM.live) pmRow = `<div class="mm-ln${MM.pmBusy ? "" : " err"}"><span class="mm-dot${MM.pmBusy ? "" : " off"}" aria-hidden="true"></span><b>ค่าฝุ่น ${MM.pmBusy ? "กำลังขอค่าล่าสุด…" : "ดึงไม่สำเร็จ"}</b>${MM.pmBusy ? "" : `<span>ยังไม่มีค่าเรียลไทม์ (และไม่มีค่าก่อนหน้า)</span>`}${nx}</div>`;
  else if (mmPrev()) pmRow = `<div class="mm-ln err"><span class="mm-dot off" aria-hidden="true"></span><b>${MM.pmBusy ? "กำลังขอค่าล่าสุด…" : !MM.pmOk ? "ดึงค่าใหม่ไม่สำเร็จ" : "ค่าจากครั้งก่อน"}</b><span>แสดงค่าก่อนหน้า ณ ${pt} (ค่าเฉลี่ย 24 ชม.)</span>${nx}</div>`;
  else pmRow = `<div class="mm-ln"><span class="mm-dot" aria-hidden="true"></span><b>ค่าฝุ่น สด</b><span>ค่าเฉลี่ย 24 ชม. ล่าสุด ณ ${pt}${MM.pmStale ? " · <em>ข้อมูลค้าง</em>" : ""}</span>${nx}</div>`;
  const hsRow = `<div class="mm-ln${MM.hsOk ? "" : " err"}"><span class="mm-dot" aria-hidden="true"></span><b>จุดความร้อน ${MM.hsOk ? "สด" : "ดึงไม่สำเร็จ"}</b>
        <span>GISTDA · อัปเดต ${mmClock(MM.hsLast)} น.</span>
        <span class="mm-nx">รีเฟรชทุก ${MM.HS_EVERY / 60000} นาที (อีก <b id="mmCdH">${mmLeft(MM.hsNext)}</b>)</span></div>`;
  el.innerHTML = pmRow + hsRow + `<button type="button" class="mm-rf" id="mmRf" ${MM.hsBusy || MM.pmBusy ? "disabled" : ""}>${MM.hsBusy || MM.pmBusy ? "กำลังดึง…" : "รีเฟรชตอนนี้"}</button>`;
  document.getElementById("mmRf")?.addEventListener("click", () => { mmPmFetch(); mmHsFetch(); });
}
function mmRepaint() { renderHotspot(S.hsToday, MM.sample); }
async function mmHsFetch() {
  if (MM.hsBusy) return; MM.hsBusy = true; mmLive();
  try {
    const hs = await getJSON("/api/hotspot"), names = new Set(PROV.map(p => p.name));
    if (hs?.ok) { S.hsToday = (hs.geojson?.features || []).filter(f => names.has(f.properties.changwat)); S.hsOk = true; MM.hsOk = true; } else MM.hsOk = false;
  } catch (_) { MM.hsOk = false; }
  MM.hsBusy = false; MM.hsLast = new Date(); MM.hsNext = Date.now() + MM.HS_EVERY;
  if (!MM.sample) mmRepaint(); else mmLive();   // กำลังดูข้อมูลตัวอย่างอยู่ → ไม่ทับ
}
async function mmPmFetch() {
  if (MM.pmBusy) return; MM.pmBusy = true; mmLive();
  try {
    const j = await getJSON("/api/air4thai-live");
    if (j?.ok && Array.isArray(j.data)) {
      MM.live = Object.fromEntries(j.data.map(o => [o.name, { v: o.pm25, date: o.date, time: o.time, n: o.n, stale: !!o.stale }]));
      MM.pmStale = !!j.stale || j.data.every(o => o.stale); MM.pmOk = true; MM.fromCache = false; MM.pmAt = new Date(); mmSave();
    } else MM.pmOk = false;   // ดึงไม่ได้ → คง MM.live เดิม (ค่าก่อนหน้า) ไว้ ไม่ล้าง
  } catch (_) { MM.pmOk = false; }
  MM.pmBusy = false; MM.pmNext = mmNextPm();
  mmRepaint();
}
function mmStart() {
  if (MM.timer) return;
  MM.hsLast = new Date(); MM.hsNext = Date.now() + MM.HS_EVERY; MM.pmNext = mmNextPm();
  mmLoad();       // มีค่าก่อนหน้าจากครั้งที่แล้ว → แสดงไว้ก่อนระหว่างรอค่าใหม่
  mmPmFetch();   // ขอค่าล่าสุดทันทีที่เปิดหน้า
  MM.timer = setInterval(() => {
    if (document.visibilityState !== "visible") return;                 // แท็บที่ซ่อนอยู่ไม่ดึง · กลับมาเห็นแล้วเลยเวลาจะดึงทันที
    const now = Date.now();
    if (now >= MM.pmNext) mmPmFetch();
    if (now >= MM.hsNext) mmHsFetch();
    const a = document.getElementById("mmCdP"), b = document.getElementById("mmCdH");
    if (a) a.textContent = mmLeft(MM.pmNext); if (b) b.textContent = mmLeft(MM.hsNext);
  }, 1000);
}

// ---- แผนที่ ----
function mmSelect(pv) {   // ไฮไลต์จังหวัดที่เลือกอยู่ (ตรงกับแผงเจาะลึก)
  for (const [n, ly] of Object.entries(MM.shapes)) ly.setStyle(n === pv ? { weight: 4, color: "#0e2a47" } : { weight: 2, color: "#fff" });
  MM.shapes[pv]?.bringToFront();
}
function mmBase() {
  MAP = L.map("map", { attributionControl: true, scrollWheelZoom: false, zoomSnap: .25 }).setView([16.2, 103.4], 8);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, crossOrigin: true, attribution: "© OpenStreetMap" }).addTo(MAP);
  MM.pmG = L.layerGroup(); MM.labG = L.layerGroup(); MM.hsG = L.layerGroup(); MM.shapes = {};
  if (S.geo?.features?.length) {
    const g = L.geoJSON(S.geo, {
      style: { color: "#fff", weight: 2, fillColor: "#ccd4de", fillOpacity: .55 },
      onEachFeature: (f, ly) => {
        const n = f.properties.name_th; MM.shapes[n] = ly;
        ly.on("click", () => { renderDrill(n); document.getElementById("drillPanel")?.scrollIntoView({ behavior: "smooth", block: "center" }); });
      },
    }).addTo(MM.pmG); MM.geoLayer = g;
    MAP.fitBounds(g.getBounds(), { padding: [6, 6] });
  }
  MM.pmG.addTo(MAP); MM.labG.addTo(MAP); MM.hsG.addTo(MAP);
  const b = MM.geoLayer ? MM.geoLayer.getBounds() : null;
  if (b) { MAP.setMaxBounds(b.pad(.5)); MAP.setMinZoom(Math.floor(MAP.getBoundsZoom(b) - 1)); }
  L.control.scale({ metric: true, imperial: false, position: "bottomleft" }).addTo(MAP);
  MM.badge = L.control({ position: "topright" });
  MM.badge.onAdd = () => { const d = L.DomUtil.create("div", "mm-badge"); L.DomEvent.disableClickPropagation(d); MM.badgeEl = d; return d; };
  MM.badge.addTo(MAP);
  mmDistricts();
}
// เส้นเขตอำเภอ + ชื่ออำเภอ (แสดงเมื่อซูมเข้า) — พื้นหลังที่วาดเอง ไม่พึ่งไทล์ภายนอก
async function mmDistricts() {
  let g = null; try { g = await (S.ampGeoP ??= getJSON("/districts-r7.geojson")); } catch (_) {}
  if (!g?.features?.length || !MAP || MM.distG) return;
  MM.distG = L.geoJSON(g, { style: { color: "#5b7089", weight: .9, opacity: .8, dashArray: "3 3", fill: false }, interactive: false }).addTo(MAP);
  MM.distLab = L.layerGroup(g.features.map(f => L.marker(L.geoJSON(f).getBounds().getCenter(), { interactive: false, keyboard: false,
    icon: L.divIcon({ className: "", iconSize: [0, 0], html: `<div class="mm-dl">${esc(f.properties.name)}</div>` }) })));
  const z = () => { if (MAP.getZoom() >= 10) MM.distLab.addTo(MAP); else MM.distLab.remove(); };
  MAP.on("zoomend", z); z(); mmOrder();
}
function mmOrder() {   // ลำดับซ้อน: ค่าฝุ่น (พื้นที่) → เส้นอำเภอ → จุดความร้อน
  MM.distG?.bringToFront(); MM.hsG?.eachLayer(l => l.bringToFront && l.bringToFront());
}
function mmBadge() {   // ป้ายบนแผนที่: บอกว่าตัวเลขบนแผนที่คือค่าอะไร ณ เมื่อไหร่
  const el = MM.badgeEl; if (!el) return;
  const pv = mmPrev(), pt = mmPmTime();
  el.className = "mm-badge" + (pv || !MM.live ? " prev" : "");
  el.innerHTML = !MM.live ? `<b>${PM25T}</b> ${MM.pmBusy ? "กำลังขอค่าล่าสุด…" : "ยังไม่มีค่าเรียลไทม์"}<small>${MM.pmBusy ? "Air4Thai (กรมควบคุมมลพิษ)" : "ดึงจาก Air4Thai ไม่สำเร็จ"}</small>`
    : `<b>${PM25T}</b> ${pv ? "ค่าก่อนหน้า" : "ล่าสุด"} ณ ${esc(pt || "–")}<small>ค่าเฉลี่ย 24 ชม. · Air4Thai${pv ? ` · ${MM.pmBusy ? "กำลังขอค่าใหม่…" : !MM.pmOk ? "ดึงค่าใหม่ไม่สำเร็จ" : "ค่าจากครั้งก่อน"}` : ""}${MM.pmStale && !pv ? " · ข้อมูลค้าง" : ""}</small>`;
}
function mmLayers() {   // เปิด/ปิดชั้นข้อมูลตามชิป
  const set = (g, on) => { if (on) g.addTo(MAP); else g.remove(); };
  set(MM.pmG, MM.on.pm); set(MM.labG, MM.on.pm); set(MM.hsG, MM.on.hs);
  document.querySelectorAll("#mmBar .mm-chip").forEach(b => b.setAttribute("aria-pressed", String(MM.on[b.dataset.l])));
}
function renderHotspot(feats, isSample) {
  if (!document.getElementById("map")) return;
  if (!MAP) mmBase();
  MM.sample = !!isSample;
  const by = countBy(feats), tLab = MM.live ? `${mmPrev() ? "ค่าก่อนหน้า" : "ล่าสุด"} ${mmPmTime() || ""}` : "ยังไม่มีค่า";
  // --- ชั้นค่าฝุ่น ---
  MM.labG.clearLayers();
  for (const [n, ly] of Object.entries(MM.shapes)) {
    const v = mmVal(n), l = v != null ? LV[lvOf(v)] : null;
    ly.setStyle({ fillColor: l ? l.c : "#ccd4de" });
    ly.unbindTooltip().bindTooltip(`<b class="t">${esc(n)}</b><br>${PM25T}: <b>${v != null ? f1(v) : "–"}</b> µg/m³${l ? ` · ${l.name}` : ""}<br><small>ค่าเฉลี่ย 24 ชม. ${esc(tLab)}</small><br>จุดความร้อน: <b>${by[n] || 0}</b> จุด`, { className: "hs-tip", sticky: true });
    L.marker(ly.getBounds().getCenter(), { interactive: false, icon: L.divIcon({ className: "", iconSize: [0, 0],
      html: `<div class="mm-lab"><b>${esc(n)}</b><span style="background:${l ? l.c : "#ccd4de"};color:${l ? textOn(l.c) : "#fff"}">${v != null ? f1(v) : "–"}</span></div>` }) }).addTo(MM.labG);
  }
  mmSelect(S.sel);
  // --- ชั้นจุดความร้อน ---
  MM.hsG.clearLayers();
  for (const f of feats) {
    const [lng, lat] = f.geometry.coordinates, p = f.properties, [cn, cc] = CONF[p.confidence] || [p.confidence, "#999"];
    const r = Math.min(5 + (p.frp || 0) * .35, 13);
    const t = p.th_time ? `${String(p.th_time).padStart(4, "0").slice(0, 2)}:${String(p.th_time).padStart(4, "0").slice(2)} น.` : "–";
    L.circleMarker([lat, lng], { radius: r, fillColor: cc, color: "#fff", weight: 1, fillOpacity: .9 })
      .bindTooltip(`<b class="t">🔥 จุดความร้อน</b><br><b>จังหวัด:</b> ${esc(p.changwat)}<br><b>อำเภอ:</b> ${esc(p.ap_en || "–")}<br><b>ตำบล:</b> ${esc(p.tb_en || "–")}<br><b>เวลา:</b> ${t}<br><b>ความเชื่อมั่น:</b> ${cn}`,
        { className: "hs-tip", direction: "top", offset: [0, -r], sticky: false })
      .addTo(MM.hsG);
  }
  mmLayers(); mmOrder(); mmNote(); mmBadge();
  // --- แผงข้างแผนที่: ค่าฝุ่น + จำนวนจุดความร้อนรายจังหวัด ---
  document.getElementById("hotSide").innerHTML = `
    <div class="label">${isSample ? "ข้อมูลตัวอย่าง 7 พ.ค. 2569" : "จุดความร้อนรวม 4 จังหวัด · 24 ชม."}</div>
    <div class="hot-total num">${feats.length} <span style="font-size:calc(18px*var(--fs,1));color:var(--ink-3)">จุด</span></div>
    <div class="mm-tb"><div class="mm-th"><span>จังหวัด</span><span>${PM25T}<small>${mmPrev() ? "ก่อนหน้า" : "ล่าสุด"}</small></span><span>จุดร้อน</span></div>${PROV.map(p => { const v = mmVal(p.name), l = v != null ? LV[lvOf(v)] : null;
      return `<button type="button" class="hot-row mm-row" data-pv="${p.name}"><span>${p.name}</span><span class="mm-pm num" style="background:${l ? l.soft : "#eef1f5"};color:${l ? l.ink : "#5b6b7f"}">${v != null ? f1(v) : "–"}</span><b>${by[p.name] || 0}</b></button>`; }).join("")}</div>
    <div class="mm-src">${PM25T}: ค่าเฉลี่ย 24 ชม. · Air4Thai (กรมควบคุมมลพิษ)${MM.live ? ` ${mmPrev() ? "ค่าก่อนหน้า" : "ล่าสุด"} ${esc(mmPmTime() || "")}` : " · ยังไม่มีค่าเรียลไทม์"}<br>ค่าบนแผนที่อาจต่างจากค่า 07.00 น. ในการ์ดจังหวัดด้านบน<br>จุดความร้อน: GISTDA (VIIRS)</div>
    <div class="conf"><div class="label">สีจุด = ความมั่นใจของดาวเทียมว่าเป็นไฟจริง</div>${Object.entries(CONF).map(([k, [n, c]]) => `<span class="cf-k"><i style="background:${c}"></i><span>${n}<small>${CONF_TXT[k] || ""}</small></span></span>`).join("")}
      <div class="cf-frp"><span class="dots"><b style="width:7px;height:7px"></b><b style="width:11px;height:11px"></b><b style="width:16px;height:16px"></b></span><span>ขนาดจุด = ความแรงของไฟ<small>วงใหญ่ = ไฟแรง/พื้นที่เผากว้าง</small></span></div></div>
    ${!S.hsOk ? `<div class="note-box">ดึงข้อมูล GISTDA ไม่สำเร็จ</div>` : ""}
    ${!isSample && feats.length === 0 && S.hsOk ? `<div class="note-box">วันนี้ไม่พบจุดความร้อนในพื้นที่ 4 จังหวัด<br><button class="btn" id="hsSample" style="margin-top:8px;padding:6px 12px">ดูตัวอย่างวันที่มีจุดความร้อน (7 พ.ค. 2569)</button></div>` : ""}
    ${isSample ? `<div class="note-box">กำลังแสดงข้อมูลย้อนหลัง (ไม่ใช่วันนี้)<br><button class="btn" id="hsToday" style="margin-top:8px;padding:6px 12px">กลับไปดูวันนี้</button></div>` : ""}`;
  document.querySelectorAll("#hotSide .mm-row").forEach(b => b.addEventListener("click", () => { const ly = MM.shapes[b.dataset.pv]; if (ly) MAP.fitBounds(ly.getBounds(), { padding: [20, 20], maxZoom: 10 }); }));
  document.getElementById("hsSample")?.addEventListener("click", async () => {
    const j = await fetch("/hotspot-sample-2026-05-07.json").then(r => r.json()).catch(() => null);
    if (!j?.features) return;   // ดึงไฟล์ตัวอย่างไม่ได้ → ไม่เปลี่ยนแผนที่
    const names = new Set(PROV.map(p => p.name)); renderHotspot(j.features.filter(f => names.has(f.properties.changwat)), true); });
  document.getElementById("hsToday")?.addEventListener("click", () => renderHotspot(S.hsToday, false));
  if (!MM.bound) {
    MM.bound = true;
    document.querySelectorAll("#mmBar .mm-chip").forEach(b => b.addEventListener("click", () => { MM.on[b.dataset.l] = !MM.on[b.dataset.l]; mmLayers(); }));
    const rd = renderDrill; renderDrill = function (pv, level, amp) { const r = rd.apply(this, arguments); try { mmSelect(pv); mmNote(); } catch (_) {} return r; };   // เลือกจังหวัดจากการ์ด → ไฮไลต์บนแผนที่ · กล่องสูงสุด/ต่ำสุดตรงกับค่าบนแผนที่
    const rt = renderToday; renderToday = function () { const r = rt.apply(this, arguments); try { mmNote(); } catch (_) {} return r; };   // renderToday เขียนกล่องสูงสุด/ต่ำสุดด้วยค่า 07.00 น. ทับ → เขียนใหม่ตามค่าที่แสดงบนแผนที่
    mmStart();
  }
  mmLive();
}
