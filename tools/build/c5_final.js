// แผงคาดการณ์ล่วงหน้า 3 วัน (C5)
// ช่องตาราง = ค่าคาดการณ์ GISTDA + สีระดับเท่านั้น (คำตอบเดียว)
// กดช่อง = บทวิเคราะห์ประกอบ: แนวโน้มจากสภาพอากาศ (แบบจำลอง สคร.7) + ปัจจัยเทียบค่าปกติฤดูฝุ่น
// เตือนใต้ตาราง เฉพาะวันที่ค่าคาดการณ์ ≥ 37.6 และสภาพอากาศเอื้อต่อการสะสม
const TREND = { "1": ["▲", "เอื้อต่อการสะสม", "bad"], "0": ["●", "ทรงตัว", "mid"], "-1": ["▼", "เอื้อต่อการเจือจาง", "ok"] };
const SEASON_NORM = { vr: 1830, hs200: 49 };   // ค่ามัธยฐานฤดูฝุ่น 68/69 (การระบายอากาศ m²/s · จุดความร้อนรัศมี 200 กม./วัน)
function renderForecast() {
  const el = document.getElementById("forecast");
  const head = `<div class="box-h"><span class="bi"><svg class="ico"><use href="#i-cal"/></svg></span>
    <div><h3>การคาดการณ์ล่วงหน้า 3 วัน</h3><p>ค่าฝุ่น PM2.5 คาดการณ์ · µg/m³</p></div></div>`;
  const items = PROV.map(p => ({ p, it: S.gpv?.items.find(i => i.code === String(p.code)) })).filter(o => o.it);
  if (!items.length) { el.innerHTML = head + `<div class="pending">ดึงข้อมูลคาดการณ์จาก GISTDA ไม่สำเร็จ ลองใหม่ภายหลัง</div>`; return; }
  const base = new Date((S.gpv.asOf || "").slice(0, 10) + "T00:00:00");
  const dayOf = k => new Date(base.getTime() + (k + 1) * 864e5);
  const hasFx = items.some(o => o.it.fac);
  const days = [0, 1, 2].map(k => { const d = dayOf(k); return `${d.getDate()} ${TH_M[d.getMonth()]}<small>${k === 0 ? "พรุ่งนี้" : TH_D[d.getDay()]}</small>`; });
  const tbl = `<table class="t7 fc-t num"><tr><th>จังหวัด</th>${days.map(d => `<th>${d}</th>`).join("")}</tr>${items.map(({ p, it }) => `<tr><td>${p.name}</td>${it.pred.map((x, k) => x == null
    ? `<td class="na">–</td>`
    : `<td class="cell${hasFx ? " fc-c" : ""}"${hasFx ? ` tabindex="0" role="button" aria-pressed="false" data-pv="${p.name}" data-k="${k}"` : ""} style="background:${LV[lvOf(x)].c};color:${textOn(LV[lvOf(x)].c)}">${f1(x)}</td>`).join("")}</tr>`).join("")}</table>`;
  // เตือนเฉพาะ: ค่าคาดการณ์ถึงระดับเริ่มมีผลต่อสุขภาพ และสภาพอากาศเอื้อต่อการสะสม
  const warn = [0, 1, 2].map(k => {
    const hit = items.filter(o => o.it.pred[k] != null && o.it.pred[k] > 37.5 && o.it.trend?.[k] === 1);
    if (!hit.length) return "";
    const d = dayOf(k);
    return `<div class="vw"><span class="vw-i" aria-hidden="true"><svg class="ico"><use href="#a-dust"/></svg></span><span><b>${d.getDate()} ${TH_M[d.getMonth()]} · ฝุ่นมีแนวโน้มสะสม</b> ${hit.map(o => `${o.p.name} ${f1(o.it.pred[k])}`).join(" · ")} — ค่าคาดการณ์ถึงระดับเริ่มมีผลต่อสุขภาพ และสภาพอากาศไม่เอื้อต่อการระบาย ควรลดกิจกรรมกลางแจ้ง</span></div>`;
  }).join("");
  el.innerHTML = head + (hasFx ? `<p class="fc-hint">กดช่องตัวเลขเพื่อดูสภาพอากาศที่มีผลต่อค่าฝุ่นของวันนั้น</p>` : "") + tbl
    + `<div id="fcDet" class="fc-det" hidden></div>${warn}`
    + `<div class="t7-note fc-note">${LV.map(l => `<span><i style="background:${l.c}"></i>${l.name}</span>`).join("")}</div>`
    + `<div class="fc-src"><svg class="ico"><use href="#i-sat"/></svg><span>ค่าคาดการณ์: แบบจำลองจากดาวเทียม GISTDA · ประมวลผล ${esc(S.gpv.asOfThai || S.gpv.asOf || "")}<br>เป็นค่าประมาณ อาจต่างจากค่าสถานีตรวจวัด Air4Thai</span></div>`;
  if (!hasFx) return;
  const det = el.querySelector("#fcDet");
  const st = (t, c) => `<span class="st ${c}">${t}</span>`;
  const cmp = (x, n, hiBad) => { const r = x / n; return r >= 1.5 ? (hiBad ? ["สูงกว่าปกติ", "bad"] : ["ดีกว่าปกติ", "ok"]) : r <= 0.67 ? (hiBad ? ["ต่ำกว่าปกติ", "ok"] : ["แย่กว่าปกติ", "bad"]) : ["ใกล้เคียงปกติ", "mid"]; };
  const show = td => {
    const was = td.getAttribute("aria-pressed") === "true";
    el.querySelectorAll(".fc-c").forEach(c => c.setAttribute("aria-pressed", "false"));
    if (was) { det.hidden = true; return; }
    td.setAttribute("aria-pressed", "true");
    const k = +td.dataset.k, o = items.find(o => o.p.name === td.dataset.pv), f = o.it.fac?.[k] || {}, x = o.it.pred[k], l = LV[lvOf(x)], d = dayOf(k);
    const tr = TREND[String(o.it.trend?.[k])];
    const row = (ic, lab, val, tag) => `<div class="fr"><svg class="ico"><use href="#${ic}"/></svg><span>${lab}</span><span class="fr-v"><b>${val}</b>${tag}</span></div>`;
    const vr = f.vr != null ? cmp(f.vr, SEASON_NORM.vr, false) : null, hs = f.hs200 != null ? cmp(Math.max(f.hs200, 1), SEASON_NORM.hs200, true) : null;
    det.innerHTML = `<div class="dh"><b>จ.${o.p.name} · ${d.getDate()} ${TH_M[d.getMonth()]}</b><span>ค่าฝุ่นคาดการณ์ <b style="color:${l.ink}">${f1(x)}</b> µg/m³ · ${l.name}</span></div>
      ${tr ? `<div class="tr-sum ${tr[2]}"><span class="tr-i">${tr[0]}</span><span>สภาพอากาศ<b>${tr[1]}</b><small>ประเมินจากค่าฝุ่นวันก่อน การระบายอากาศ และความชื้น</small></span></div>` : ""}
      ${f.vr != null ? row("a-dust", "การระบายอากาศ <small>ปกติฤดูฝุ่น ~1,830 m²/s</small>", `${fmt(f.vr)} m²/s`, st(vr[0], vr[2] || vr[1])) : ""}
      ${f.hs200 != null ? row("i-fire", `จุดความร้อนรัศมี 200 กม. <small>24 ชม. ล่าสุด · เฉพาะในไทย</small>`, `${fmt(f.hs200)} จุด`, st(hs[0], hs[1])) : ""}
      ${f.wd ? row("i-wind", "ทิศทางลม", `จาก${f.wd}`, "") : ""}
      ${f.rain != null ? row("i-rain", "ฝน", `${f.rain} มม.`, f.rain >= 1 ? st("ช่วยชะล้างฝุ่น", "ok") : st("ไม่มีฝน", "mid")) : ""}
      ${f.rh != null ? row("i-drop", "ความชื้นสัมพัทธ์", `${f.rh}%`, f.rh < 55 ? st("อากาศแห้ง", "bad") : st("ปกติ", "ok")) : ""}
      <p class="fr-note">แบบจำลอง สคร.7 จากข้อมูลฤดูฝุ่น 68/69 (1 ฤดู) · คลาดเคลื่อนเฉลี่ยราว ±5 µg/m³ · ใช้ประกอบการตีความ ไม่ใช่ค่าพยากรณ์แทน GISTDA</p>`;
    det.hidden = false;
  };
  el.querySelectorAll(".fc-c").forEach(td => { td.addEventListener("click", () => show(td)); td.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); show(td); } }); });
}
