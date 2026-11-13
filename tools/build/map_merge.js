// ================= แผนที่รวม: ค่าฝุ่นรายจังหวัด + จุดความร้อน (เดโม่ขั้น 2) =================
// ประกาศ renderHotspot ซ้ำ — ตัวที่อยู่ทีหลังชนะ (แทนฟังก์ชันเดิมที่วาดเฉพาะจุดความร้อน)
//  • ชั้น "ค่าฝุ่น": พื้นที่จังหวัดสีตามระดับ + ป้ายค่า (ค่าเฉลี่ย 24 ชม. ณ 07.00 น. จาก S.todayRow เหมือนทุกส่วนของหน้า)
//  • ชั้น "จุดความร้อน": วงกลมตามความเชื่อมั่น/ความแรงของไฟ (เหมือนเดิม)
//  • real-time = เฉพาะจุดความร้อน: ดึง /api/hotspot ซ้ำทุก 10 นาที (เซิร์ฟเวอร์ดึง GISTDA ทุก 60 นาที) · ค่าฝุ่นยึด 07.00 น. ตามเกณฑ์ของหน้า
const MM = { on: { pm: true, hs: true }, EVERY: 10 * 60 * 1000, last: null, next: 0, timer: null, bound: false, busy: false, ok: true, shapes: {} };
function mmClock(d) { return d ? `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}` : "–"; }
function mmLeft() { const s = Math.max(0, Math.round((MM.next - Date.now()) / 1000)); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; }
function mmLive() {
  const el = document.getElementById("mmLive"); if (!el) return;
  el.classList.toggle("err", !MM.ok);
  el.innerHTML = `<span class="mm-dot" aria-hidden="true"></span><b>${MM.ok ? "สด" : "ดึงข้อมูลไม่สำเร็จ"}</b>
    <span>อัปเดตจุดความร้อนล่าสุด ${mmClock(MM.last)} น.</span>
    <span class="mm-nx">รีเฟรชอัตโนมัติทุก ${MM.EVERY / 60000} นาที · ถัดไปใน <b id="mmCd">${mmLeft()}</b></span>
    <button type="button" class="mm-rf" id="mmRf" ${MM.busy ? "disabled" : ""}>${MM.busy ? "กำลังดึง…" : "รีเฟรชตอนนี้"}</button>`;
  document.getElementById("mmRf")?.addEventListener("click", () => mmRefresh());
}
async function mmRefresh() {
  if (MM.busy) return; MM.busy = true; mmLive();
  try {
    const hs = await getJSON("/api/hotspot"), names = new Set(PROV.map(p => p.name));
    if (hs?.ok) { S.hsToday = (hs.geojson?.features || []).filter(f => names.has(f.properties.changwat)); S.hsOk = true; MM.ok = true; } else MM.ok = false;
  } catch (_) { MM.ok = false; }
  MM.busy = false; MM.last = new Date(); MM.next = Date.now() + MM.EVERY;
  renderHotspot(S.hsToday, false);
}
function mmStart() {
  if (MM.timer) return;
  MM.last = new Date(); MM.next = Date.now() + MM.EVERY;
  MM.timer = setInterval(() => {
    if (document.visibilityState !== "visible") return;                 // แท็บที่ซ่อนอยู่ไม่ดึง · กลับมาเห็นแล้วเลยเวลาจะดึงทันที
    if (Date.now() >= MM.next) return mmRefresh();
    const cd = document.getElementById("mmCd"); if (cd) cd.textContent = mmLeft();
  }, 1000);
}
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
    }).addTo(MM.pmG);
    MAP.fitBounds(g.getBounds(), { padding: [6, 6] });
  }
  MM.pmG.addTo(MAP); MM.labG.addTo(MAP); MM.hsG.addTo(MAP);
}
function mmLayers() {   // เปิด/ปิดชั้นข้อมูลตามชิป
  const set = (g, on) => { if (on) g.addTo(MAP); else g.remove(); };
  set(MM.pmG, MM.on.pm); set(MM.labG, MM.on.pm); set(MM.hsG, MM.on.hs);
  document.querySelectorAll("#mmBar .mm-chip").forEach(b => b.setAttribute("aria-pressed", String(MM.on[b.dataset.l])));
}
function renderHotspot(feats, isSample) {
  if (!document.getElementById("map")) return;
  if (!MAP) mmBase();
  const by = countBy(feats);
  // --- ชั้นค่าฝุ่น ---
  MM.labG.clearLayers();
  for (const [n, ly] of Object.entries(MM.shapes)) {
    const v = S.todayRow?.[n], l = v != null ? LV[lvOf(v)] : null;
    ly.setStyle({ fillColor: l ? l.c : "#ccd4de" });
    ly.unbindTooltip().bindTooltip(`<b class="t">${esc(n)}</b><br>${PM25T}: <b>${v != null ? f1(v) : "–"}</b> µg/m³${l ? ` · ${l.name}` : ""}<br>จุดความร้อน: <b>${by[n] || 0}</b> จุด`, { className: "hs-tip", sticky: true });
    const c = ly.getBounds().getCenter();
    L.marker(c, { interactive: false, icon: L.divIcon({ className: "", iconSize: [0, 0],
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
  mmLayers();
  // --- แผงข้างแผนที่: ค่าฝุ่น + จำนวนจุดความร้อนรายจังหวัด ---
  document.getElementById("hotSide").innerHTML = `
    <div class="label">${isSample ? "ข้อมูลตัวอย่าง 7 พ.ค. 2569" : "จุดความร้อนรวม 4 จังหวัด · 24 ชม."}</div>
    <div class="hot-total num">${feats.length} <span style="font-size:calc(18px*var(--fs,1));color:var(--ink-3)">จุด</span></div>
    <div class="mm-tb"><div class="mm-th"><span>จังหวัด</span><span>${PM25T}</span><span>จุดร้อน</span></div>${PROV.map(p => { const v = S.todayRow?.[p.name], l = v != null ? LV[lvOf(v)] : null;
      return `<button type="button" class="hot-row mm-row" data-pv="${p.name}"><span>${p.name}</span><span class="mm-pm num" style="background:${l ? l.soft : "#eef1f5"};color:${l ? l.ink : "#5b6b7f"}">${v != null ? f1(v) : "–"}</span><b>${by[p.name] || 0}</b></button>`; }).join("")}</div>
    <div class="mm-src">${PM25T}: ค่าเฉลี่ย 24 ชม. ณ 07.00 น. · Air4Thai (กรมควบคุมมลพิษ)<br>จุดความร้อน: GISTDA (VIIRS)</div>
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
