// ================= แผนที่รวม: ค่าฝุ่นรายจังหวัด + จุดความร้อน (เดโม่ขั้น 2) =================
// ประกาศ renderHotspot ซ้ำ — ตัวที่อยู่ทีหลังชนะ (แทนฟังก์ชันเดิมที่วาดเฉพาะจุดความร้อน)
//  • ชั้น "ค่าฝุ่น" = ค่าเฉลี่ยรายชั่วโมงจาก GISTDA (ค่าประมาณจากดาวเทียม · ฟิลด์ pm25 ของ /api/pm25/provinces และ /api/pm25/districts)
//      - ระดับจังหวัด: แสดงตัวเลขบนแผนที่ตลอด (ป้ายขาว ไม่มีสีตามระดับฝุ่น · พื้นแผนที่สีเดียว)
//      - ระดับอำเภอ: แสดงเมื่อเอาเคอร์เซอร์ชี้ที่อำเภอเท่านั้น · ขอข้อมูลรายอำเภอของจังหวัดนั้นตอนชี้ครั้งแรก (ไม่ดึงล่วงหน้า) · ล้างทิ้งเมื่อได้ค่าจังหวัดรอบใหม่
//      - ขอค่าใหม่ทุกต้นชั่วโมง + MM.PM_MIN นาที · ดึงไม่ได้ → แสดง "ค่าก่อนหน้า" (เก็บใน localStorage ไม่เกิน 24 ชม.) · ไม่เคยมีค่า → "–" (ไม่ใช้ค่า 07.00 น. แทน)
//  • พื้นหลังแผนที่: ไทล์ OpenStreetMap (ถ้าโหลดได้) + เส้นเขตอำเภอที่วาดเอง (ใช้ได้แม้ไม่มีไทล์) + ชื่ออำเภอเมื่อซูมเข้า + สเกล + ป้ายบอกค่าบนแผนที่
//  • ชั้น "จุดความร้อน": GISTDA VIIRS ย้อนหลัง 24 ชม. แบบเดิม (ดึงตอนเปิดหน้า ไม่รีเฟรชอัตโนมัติ) · สีจุด = ความเชื่อมั่นของดาวเทียม (ไม่ใช่ระดับฝุ่น)
const MM = { on: { pm: true, hs: true }, PM_MIN: 10,
  live: null, asOf: null, pmNext: 0, pmBusy: false, pmOk: true, pmStale: false, fromCache: false,
  dist: {}, distP: {}, distFail: {}, sample: false, timer: null, bound: false, shapes: {} };
const mmPad = n => String(n).padStart(2, "0");
const mmPoint = () => matchMedia("(hover: none)").matches ? "แตะ" : "ชี้";   // มือถือไม่มีเคอร์เซอร์ → "แตะ"
const mmHM = d => `${mmPad(d.getHours())}:${mmPad(d.getMinutes())}`;
const mmLeft = t => { const s = Math.max(0, Math.round((t - Date.now()) / 1000)), h = Math.floor(s / 3600); return `${h ? h + ":" : ""}${mmPad(Math.floor(s % 3600 / 60))}:${mmPad(s % 60)}`; };
function mmNextPm() { const t = new Date(); t.setMinutes(MM.PM_MIN, 0, 0); if (t.getTime() <= Date.now()) t.setHours(t.getHours() + 1); return t.getTime(); }   // ต้นชั่วโมงถัดไป + PM_MIN นาที (รอ GISTDA อัปเดต)

// ---- เก็บ "ค่าก่อนหน้า" ข้ามการโหลดหน้า (localStorage อาจใช้ไม่ได้ → ข้ามเงียบ ๆ) ----
const MM_KEY = "mm_live_v2", MM_KEEP = 24 * 3600 * 1000;
function mmSave() { try { localStorage.setItem(MM_KEY, JSON.stringify({ at: Date.now(), live: MM.live, asOf: MM.asOf })); } catch (_) {} }
function mmLoad() { try { const o = JSON.parse(localStorage.getItem(MM_KEY) || "null"); if (o?.live && Date.now() - o.at < MM_KEEP) { MM.live = o.live; MM.asOf = o.asOf; MM.fromCache = true; } } catch (_) {} }
// ค่าที่แสดงเป็น "ค่าก่อนหน้า" = ยังไม่ได้ค่าใหม่ (ดึงไม่สำเร็จ หรือเป็นค่าจากครั้งก่อนระหว่างรอค่าใหม่)
const mmPrev = () => !!MM.live && (!MM.pmOk || MM.fromCache);

// ---- ค่าฝุ่นที่ใช้วาด (ไม่มี → null แสดง "–") ----
const mmVal = n => { const o = MM.live?.[n]; return o && o.v != null ? o.v : null; };
function mmAt(asOf) {   // "2026-11-16T14:00:00" (เวลาไทย) → "14:00 น." หรือ "15 พ.ย. 14:00 น." ถ้าไม่ใช่วันนี้
  if (!asOf) return null; const t = String(asOf), ds = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);   // "วันนี้" ตามเวลาไทย (UTC+7) ไม่ขึ้นกับเขตเวลาของเครื่อง
  return t.startsWith(ds) ? `${t.slice(11, 16)} น.` : `${+t.slice(8, 10)} ${TH_M[+t.slice(5, 7) - 1]} ${t.slice(11, 16)} น.`;
}
const mmPmTime = () => mmAt(MM.asOf);
function mmApply(j) {   // ผลตอบ /api/pm25/provinces → MM.live · ไม่มีค่าเลย = ถือว่าใช้ไม่ได้
  const live = {}; for (const p of PROV) { const it = j.items.find(i => String(i.code) === String(p.code)); if (it) live[p.name] = { v: Number.isFinite(it.pm25) ? it.pm25 : null }; }
  if (!Object.values(live).some(o => o.v != null)) return false;
  MM.live = live; MM.asOf = j.asOf || null;
  const t = new Date(String(MM.asOf || "").slice(0, 19) + "+07:00"); MM.pmStale = Number.isNaN(t.getTime()) || Date.now() - t.getTime() > 3 * 3600e3;
  return true;
}

// ---- แถบสถานะ ----
function mmLive() {
  const el = document.getElementById("mmLive"); if (!el) return;
  const pt = mmPmTime() || "–";
  let pmRow;
  const nx = `<span class="mm-nx">ขอข้อมูลใหม่ทุกชั่วโมง (ครั้งถัดไป ${mmHM(new Date(MM.pmNext))} น. · อีก <b id="mmCdP">${mmLeft(MM.pmNext)}</b>)</span>`;
  if (!MM.live) pmRow = `<div class="mm-ln${MM.pmBusy ? "" : " err"}"><span class="mm-dot${MM.pmBusy ? "" : " off"}" aria-hidden="true"></span><b>ค่าเฉลี่ยรายชั่วโมง</b><span>${MM.pmBusy ? "กำลังขอข้อมูล…" : "ยังไม่มีข้อมูล (และไม่มีค่าก่อนหน้า) · ดึงจาก GISTDA ไม่สำเร็จ"}</span>${nx}</div>`;
  else if (mmPrev()) pmRow = `<div class="mm-ln err"><span class="mm-dot off" aria-hidden="true"></span><b>ค่าเฉลี่ยรายชั่วโมง</b><span>แสดงค่าก่อนหน้า ณ ${pt} · ${MM.pmBusy ? "กำลังขอข้อมูลใหม่…" : !MM.pmOk ? "ดึงค่าใหม่ไม่สำเร็จ" : "ค่าจากครั้งก่อน"}</span>${nx}</div>`;
  else pmRow = `<div class="mm-ln"><span class="mm-dot" aria-hidden="true"></span><b>ค่าเฉลี่ยรายชั่วโมง</b><span>ณ ${pt} · GISTDA (ค่าประมาณจากดาวเทียม)${MM.pmStale ? " · <em>ข้อมูลค้าง</em>" : ""}</span>${nx}</div>`;
  const hsRow = `<div class="mm-ln"><span class="mm-dot off" aria-hidden="true"></span><b>จุดความร้อน</b><span>GISTDA (VIIRS) · ย้อนหลัง 24 ชม.</span></div>`;
  el.innerHTML = pmRow + hsRow + `<button type="button" class="mm-rf" id="mmRf" ${MM.pmBusy ? "disabled" : ""}>${MM.pmBusy ? "กำลังดึง…" : "รีเฟรชค่าฝุ่น"}</button>`;
  document.getElementById("mmRf")?.addEventListener("click", () => mmPmFetch());
}
function mmRepaint() { renderHotspot(S.hsToday, MM.sample); }
async function mmPmFetch() {
  if (MM.pmBusy) return; MM.pmBusy = true; mmLive();
  try {
    const j = await getJSON("/api/pm25/provinces?src=map");
    if (j?.ok && Array.isArray(j.items) && mmApply(j)) { MM.pmOk = true; MM.fromCache = false; MM.dist = {}; MM.distP = {}; mmSave(); }   // ค่าจังหวัดรอบใหม่ → ล้างค่ารายอำเภอเดิม
    else MM.pmOk = false;   // ดึงไม่ได้ → คง MM.live เดิม (ค่าก่อนหน้า) ไว้ ไม่ล้าง
  } catch (_) { MM.pmOk = false; }
  MM.pmBusy = false; MM.pmNext = mmNextPm();
  mmRepaint();
}
function mmStart() {
  if (MM.timer) return;
  MM.pmNext = mmNextPm();
  mmLoad();       // มีค่าก่อนหน้าจากครั้งที่แล้ว → แสดงไว้ก่อนระหว่างรอค่าใหม่
  mmPmFetch();    // ขอค่าล่าสุดทันทีที่เปิดหน้า
  MM.timer = setInterval(() => {
    if (document.visibilityState !== "visible") return;                 // แท็บที่ซ่อนอยู่ไม่ดึง · กลับมาเห็นแล้วเลยเวลาจะดึงทันที
    if (Date.now() >= MM.pmNext) mmPmFetch();
    const a = document.getElementById("mmCdP"); if (a) a.textContent = mmLeft(MM.pmNext);
  }, 1000);
}

// ---- ค่ารายอำเภอ (ขอเมื่อชี้ครั้งแรก) ----
function mmDistLoad(pvc) {
  if (MM.dist[pvc]) return Promise.resolve(MM.dist[pvc]);
  if (Date.now() - (MM.distFail[pvc] || 0) < 60e3) return Promise.resolve(null);   // เพิ่งพลาด → รอ 1 นาทีก่อนลองใหม่ (ไม่ยิงซ้ำทุกครั้งที่ชี้)
  return MM.distP[pvc] ??= getJSON(`/api/pm25/districts?pv=${pvc}&src=map`).then(j => {
    delete MM.distP[pvc];
    if (j?.ok && Array.isArray(j.items)) return MM.dist[pvc] = { by: Object.fromEntries(j.items.map(i => [String(i.code), Number.isFinite(i.pm25) ? i.pm25 : null])), asOf: j.asOf || MM.asOf };
    MM.distFail[pvc] = Date.now(); return null;
  }).catch(() => { delete MM.distP[pvc]; MM.distFail[pvc] = Date.now(); return null; });
}
function mmDistTip(f) {
  const p = f.properties, pvc = String(p.pv), d = MM.dist[pvc], head = `<b class="t">อ.${esc(p.name)}</b> <span class="mm-tp">จ.${esc(p.pv_name)}</span><br>`;
  if (d) { const v = d.by[String(p.code)]; return head + (v != null ? `${PM25T}: <b>${f1(v)}</b> µg/m³<br><small>ค่าเฉลี่ยรายชั่วโมง ณ ${esc(mmAt(d.asOf) || "–")} · GISTDA</small>` : `<small>ยังไม่มีข้อมูลของอำเภอนี้</small>`); }
  if (MM.distP[pvc]) return head + `<small>กำลังโหลดค่ารายอำเภอ…</small>`;
  return head + `<small>ยังไม่มีข้อมูลรายอำเภอ (ดึงจาก GISTDA ไม่สำเร็จ)</small>`;
}

// ---- แผนที่ ----
const MM_PV_STYLE = { color: "#fff", weight: 2 }, MM_PV_SEL = { color: "#0e2a47", weight: 4 }, MM_AP_STYLE = { color: "#5b7089", weight: .9, opacity: .8, dashArray: "3 3", fill: true, fillColor: "#0e2a47", fillOpacity: 0 };
function mmSelect(pv) {   // ไฮไลต์จังหวัดที่เลือกอยู่ (ตรงกับแผงเจาะลึก)
  for (const [n, ly] of Object.entries(MM.shapes)) ly.setStyle(n === pv ? MM_PV_SEL : MM_PV_STYLE);
  MM.shapes[pv]?.bringToFront(); mmOrder();
}
function mmBase() {
  MAP = L.map("map", { attributionControl: true, scrollWheelZoom: false, zoomSnap: .25 }).setView([16.2, 103.4], 8);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, crossOrigin: true, attribution: "© OpenStreetMap" }).addTo(MAP);
  MM.pmG = L.layerGroup(); MM.labG = L.layerGroup(); MM.hsG = L.layerGroup(); MM.shapes = {};
  if (S.geo?.features?.length) {
    const g = L.geoJSON(S.geo, {
      interactive: false,   // จังหวัดไม่รับเมาส์ — อำเภอที่ซ้อนอยู่ด้านบนรับแทน (ชี้ดูค่าอำเภอ · คลิกเลือกจังหวัด)
      style: { ...MM_PV_STYLE, fillColor: "#e3e9f0", fillOpacity: .8 },
      onEachFeature: (f, ly) => { MM.shapes[f.properties.name_th] = ly; },
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
// เส้นเขตอำเภอ (พื้นหลังที่วาดเอง) + ชี้ดูค่าอำเภอ + ชื่ออำเภอเมื่อซูมเข้า
async function mmDistricts() {
  let g = null; try { g = await (S.ampGeoP ??= getJSON("/districts-r7.geojson")); } catch (_) {}
  if (!g?.features?.length || !MAP || MM.distG) return;
  const touch = matchMedia("(hover: none)").matches;
  MM.distG = L.geoJSON(g, {
    style: MM_AP_STYLE,
    onEachFeature: (f, ly) => {
      const pvn = f.properties.pv_name;
      ly.on("mouseover", () => { if (!MM.on.pm) return; ly.setStyle({ color: "#0e2a47", weight: 2, opacity: 1, dashArray: null, fillOpacity: .14 });   // ไม่ใช้ bringToFront ตรงนี้ — ย้าย DOM ใต้เคอร์เซอร์ทำให้ mouseover/mouseout เด้งซ้ำ
        mmDistLoad(String(f.properties.pv)).then(() => { if (ly.isTooltipOpen()) ly.setTooltipContent(mmDistTip(f)); }); });
      ly.on("mouseout", () => ly.setStyle(MM_AP_STYLE));
      ly.on("click", () => { renderDrill(pvn); if (!touch) document.getElementById("drillPanel")?.scrollIntoView({ behavior: "smooth", block: "center" }); });   // คลิก = เลือกจังหวัดของอำเภอนั้น (มือถือไม่เลื่อนหน้าหนี ให้เห็นค่าอำเภอก่อน)
    },
  }).addTo(MAP);
  MM.distLab = L.layerGroup(g.features.map(f => L.marker(L.geoJSON(f).getBounds().getCenter(), { interactive: false, keyboard: false,
    icon: L.divIcon({ className: "", iconSize: [0, 0], html: `<div class="mm-dl">${esc(f.properties.name)}</div>` }) })));
  const z = () => { if (MAP.getZoom() >= 10) MM.distLab.addTo(MAP); else MM.distLab.remove(); };
  MAP.on("zoomend", z); z(); mmLayers(); mmOrder();
}
function mmOrder() {   // ลำดับซ้อน: พื้นที่จังหวัด → เส้น/พื้นที่อำเภอ (รับเมาส์) → จุดความร้อน
  MM.distG?.bringToFront(); MM.hsG?.eachLayer(l => l.bringToFront && l.bringToFront());
}
function mmBadge() {   // ป้ายบนแผนที่: บอกว่าตัวเลขบนแผนที่คือค่าอะไร ณ เมื่อไหร่
  const el = MM.badgeEl; if (!el) return;
  const pv = mmPrev(), pt = mmPmTime();
  el.className = "mm-badge" + (pv || !MM.live ? " prev" : "");
  el.innerHTML = !MM.live ? `<b>${PM25T}</b> ${MM.pmBusy ? "กำลังขอข้อมูล…" : "ยังไม่มีข้อมูล"}<small>ค่าเฉลี่ยรายชั่วโมง · ${MM.pmBusy ? "GISTDA" : "ดึงจาก GISTDA ไม่สำเร็จ"}</small>`
    : `<b>${PM25T}</b> ${pv ? "ค่าก่อนหน้า" : "ค่าเฉลี่ยรายชั่วโมง"} ณ ${esc(pt || "–")}<small>GISTDA · ค่าประมาณจากดาวเทียม${pv ? ` · ${MM.pmBusy ? "กำลังขอข้อมูลใหม่…" : !MM.pmOk ? "ดึงค่าใหม่ไม่สำเร็จ" : "ค่าจากครั้งก่อน"}` : ""}${MM.pmStale && !pv ? " · ข้อมูลค้าง" : ""}<br>${mmPoint()}ที่อำเภอเพื่อดูค่ารายอำเภอ</small>`;
}
function mmLayers() {   // เปิด/ปิดชั้นข้อมูลตามชิป
  const set = (g, on) => { if (on) g.addTo(MAP); else g.remove(); };
  set(MM.pmG, MM.on.pm); set(MM.labG, MM.on.pm); set(MM.hsG, MM.on.hs);
  MM.distG?.eachLayer(ly => { if (MM.on.pm) { if (!ly.getTooltip()) ly.bindTooltip(() => mmDistTip(ly.feature), { className: "hs-tip", sticky: true, direction: "top", offset: [0, -4] }); } else { ly.unbindTooltip(); ly.setStyle(MM_AP_STYLE); } });   // ปิดชั้นค่าฝุ่น = ไม่แสดงค่าอำเภอ
  document.querySelectorAll("#mmBar .mm-chip").forEach(b => b.setAttribute("aria-pressed", String(MM.on[b.dataset.l])));
}
function renderHotspot(feats, isSample) {
  if (!document.getElementById("map")) return;
  if (!MAP) mmBase();
  MM.sample = !!isSample;
  const by = countBy(feats);
  // --- ชั้นค่าฝุ่นระดับจังหวัด: ตัวเลขบนแผนที่ตลอด · ไม่ใช้สีระดับฝุ่น ---
  MM.labG.clearLayers();
  for (const [n, ly] of Object.entries(MM.shapes)) {
    const v = mmVal(n);
    L.marker(ly.getBounds().getCenter(), { interactive: false, icon: L.divIcon({ className: "", iconSize: [0, 0],
      html: `<div class="mm-lab"><b>${esc(n)}</b><span>${v != null ? f1(v) : "–"}</span></div>` }) }).addTo(MM.labG);
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
  mmLayers(); mmOrder(); mmBadge();
  // --- แผงข้างแผนที่: ค่าฝุ่น + จำนวนจุดความร้อนรายจังหวัด ---
  document.getElementById("hotSide").innerHTML = `
    <div class="label">${isSample ? "ข้อมูลตัวอย่าง 7 พ.ค. 2569" : "จุดความร้อนรวม 4 จังหวัด · 24 ชม."}</div>
    <div class="hot-total num">${feats.length} <span style="font-size:calc(18px*var(--fs,1));color:var(--ink-3)">จุด</span></div>
    <div class="mm-tb"><div class="mm-th"><span>จังหวัด</span><span>${PM25T}<small>${mmPrev() ? "ก่อนหน้า" : "รายชั่วโมง"}</small></span><span>จุดร้อน</span></div>${PROV.map(p => { const v = mmVal(p.name);
      return `<button type="button" class="hot-row mm-row" data-pv="${p.name}"><span>${p.name}</span><span class="mm-pm num">${v != null ? f1(v) : "–"}</span><b>${by[p.name] || 0}</b></button>`; }).join("")}</div>
    <div class="mm-src">${PM25T}: ค่าเฉลี่ยรายชั่วโมง · GISTDA (ค่าประมาณจากดาวเทียม)${MM.live ? ` · ${mmPrev() ? "ค่าก่อนหน้า" : ""} ${esc(mmPmTime() || "")}` : " · ยังไม่มีข้อมูล"}<br>${mmPoint() === "แตะ" ? "แตะ" : "ชี้เคอร์เซอร์"}ที่อำเภอบนแผนที่เพื่อดูค่ารายอำเภอ<br>ค่าบนแผนที่ต่างจากค่าในการ์ดจังหวัดด้านบน (ค่าเฉลี่ย 24 ชม. ณ 07.00 น. จากสถานี Air4Thai)<br>จุดความร้อน: GISTDA (VIIRS)</div>
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
    const rd = renderDrill; renderDrill = function (pv, level, amp) { const r = rd.apply(this, arguments); try { mmSelect(pv); } catch (_) {} return r; };   // เลือกจังหวัดจากการ์ด → ไฮไลต์บนแผนที่
    mmStart();
  }
  mmLive();
}
