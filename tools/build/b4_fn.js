// การ์ดสรุปช่วงที่เลือก (B4) — ต่ำสุด / สูงสุด / จำนวนวันเกิน 75 µg/m³ (กดดูรายการวันที่ได้)
const OVER_TH = 75;
const thDMY = iso => { const d = new Date(iso + "T00:00:00"); return `${d.getDate()} ${TH_M[d.getMonth()]} ${d.getFullYear() + 543}`; };
function renderTrendStats() {
  const el = document.getElementById("trStats"), D = dailySeries();
  if (!el || !D.length) return;
  const [f, t] = trendWindow(D[0].s, D.at(-1).s), rows = D.filter(r => r.s >= f && r.s <= t);
  const c = x => { const l = LV[lvOf(x)]; return `style="background:${l.soft};color:${l.ink}"`; };
  let body = "";
  PROV.forEach((p, k) => {
    const v = rows.map(r => ({ d: r.s, x: r.v[k] })).filter(o => o.x != null);
    if (!v.length) { body += `<tr><td><i style="background:${p.color}"></i>${p.name}</td><td colspan="3" class="muted">ไม่มีข้อมูล</td></tr>`; return; }
    const mn = v.reduce((a, o) => o.x < a.x ? o : a), mx = v.reduce((a, o) => o.x > a.x ? o : a), ov = v.filter(o => o.x > OVER_TH);
    const cnt = ov.length
      ? `<button type="button" class="ov-btn" data-k="${k}" aria-expanded="false" aria-controls="ov-${k}"><span class="ov-n"><b>${ov.length}</b> วัน</span><span class="ov-cta"><span class="ov-lbl">คลิกดู</span> <span class="ov-car" aria-hidden="true">▾</span></span></button>`
      : `<span class="ov-zero">0 <small>วัน</small></span>`;
    body += `<tr><td><i style="background:${p.color}"></i>${p.name}</td><td ${c(mn.x)}>${f1(mn.x)}<small>${thDMY(mn.d)}</small></td><td ${c(mx.x)}>${f1(mx.x)}<small>${thDMY(mx.d)}</small></td><td class="${ov.length ? "over" : ""}">${cnt}</td></tr>`;
    if (ov.length) {
      // รายการวันที่เกิน จัดกลุ่มตามเดือน/ปี
      const g = {};
      ov.forEach(o => { const d = new Date(o.d + "T00:00:00"), key = `${TH_MF[d.getMonth()]} ${d.getFullYear() + 543}`; (g[key] ||= []).push(o); });
      body += `<tr class="ov-det" id="ov-${k}" hidden><td colspan="4"><div class="ov-box">
        <div class="ov-h">จ.${p.name} · วันที่ค่าฝุ่นเฉลี่ย 24 ชม. เกิน ${OVER_TH} µg/m³ · ${ov.length} วัน</div>
        ${Object.entries(g).map(([m, list]) => `<div class="ov-m"><span class="ov-mn">${m} <em>${list.length} วัน</em></span><div class="ov-ds">${list.map(o => {
          const d = new Date(o.d + "T00:00:00"); return `<span class="ov-d" title="${thDMY(o.d)}"><b>${d.getDate()}</b><span>${f1(o.x)}</span></span>`; }).join("")}</div></div>`).join("")}
      </div></td></tr>`;
    }
  });
  el.innerHTML = `<div class="label">สรุปช่วงที่แสดง · ${thDate(f)} – ${thDate(t)} (${rows.length} วันที่มีข้อมูล)</div>
    <table class="tr-st num"><thead><tr><th>จังหวัด</th><th>ต่ำสุด</th><th>สูงสุด</th><th>วันเกิน ${OVER_TH}</th></tr></thead><tbody>${body}</tbody></table>
    <div class="tr-note">ค่าเฉลี่ย 24 ชม. ณ 07.00 น. จากสถานีตรวจวัด Air4Thai ร่วมกับดาวเทียม GISTDA · "วันเกิน" นับวันที่ค่าเฉลี่ย 24 ชม. เกิน ${OVER_TH} µg/m³ (ระดับมีผลต่อสุขภาพ) · กดตัวเลขเพื่อดูวันที่</div>`;
  el.querySelectorAll(".ov-btn").forEach(b => b.addEventListener("click", () => {
    const det = document.getElementById("ov-" + b.dataset.k), open = det.hidden;
    det.hidden = !open; b.setAttribute("aria-expanded", open); b.querySelector(".ov-lbl").textContent = open ? "ซ่อน" : "คลิกดู";
  }));
}
