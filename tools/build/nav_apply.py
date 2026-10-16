"""ชุดปรับ 16 ต.ค. 2569 (2) — ใช้ร่วมเดโม่และโค้ดจริง: html = apply(html)
1) ใส่ id ให้ทุกโซน (อ้างอิงจากสารบัญใน Figma) — ไม่ใส่สารบัญในแดชบอร์ด
2) ส่วน "ดาวน์โหลดข้อมูล" เป็นส่วนสุดท้ายของแดชบอร์ด (แทนแผงข้างซ้าย)
3) สถิติการเข้าชมที่ส่วนท้าย (นับผู้เข้าชมไม่ซ้ำต่อวัน ไม่เก็บข้อมูลส่วนบุคคล)
"""
import re

ZONES = [  # (id, ไอคอน, ชื่อ, [(ชื่อหัวข้อย่อย, selector เป้าหมาย)])
    ("zToday", "i-gauge", "สถานการณ์วันนี้", [("แผนที่ค่าฝุ่นรายจังหวัด", "#drillMap"), ("ค่าฝุ่นรายจังหวัด", "#tiles"), ("เกณฑ์ PHEOC · จุดความร้อน", "#facts")]),
    ("zTrend", "i-chart", "แนวโน้มค่าฝุ่น", [("กราฟแนวโน้ม", "#trBar"), ("ย้อนหลัง 7 วัน", "#t7"), ("สรุปช่วงที่แสดง", "#trStats")]),
    ("zDrill", "i-layers", "เจาะลึกรายพื้นที่", [("จังหวัด · อำเภอ · ตำบล", "#drillPanel"), ("คาดการณ์ล่วงหน้า 3 วัน", "#forecast")]),
    ("zHot", "i-fire", "จุดความร้อน", [("แผนที่จุดความร้อน", "#map"), ("สรุปรายจังหวัด", "#hotSide")]),
    ("zDisease", "i-steth", "โรคที่ต้องเฝ้าระวัง", [("ผู้ป่วยรายเดือนทั้งเขต", ".dz-all"), ("ฝุ่นกับผู้ป่วยรายจังหวัด", ".pv-block")]),
    ("zAdvice", "i-shield", "คำแนะนำวันนี้", [("ประชาชนและกลุ่มเสี่ยง", "#advNow")]),
    ("zData", "i-down", "ดาวน์โหลดข้อมูล", [("ชุดข้อมูล CSV · Excel", "#dsBody"), ("Infographic (ส่วนหัว)", "#dlH")]),
]

DATA_SEC = """
  <!-- ดาวน์โหลดข้อมูล — ไม่อยู่บนหน้าแดชบอร์ด · เปิดจากเมนู "ดาวน์โหลดข้อมูล" ในแถบนำทางซ้าย -->
  <div class="dp-scrim" id="dpScrim" hidden></div>
  <aside id="zData" class="dp" role="dialog" aria-modal="true" aria-labelledby="dpTitle" hidden>
    <div class="dp-h"><div class="dp-i"><svg class="ico"><use href="#i-down"/></svg></div>
      <div><h2 id="dpTitle">ดาวน์โหลดข้อมูล</h2><p>ชุดข้อมูลสำหรับเจ้าหน้าที่ · CSV/Excel พร้อมคำอธิบายตัวแปร</p></div>
      <button type="button" class="dp-x" id="dpX" aria-label="ปิด">×</button></div>
    <div class="dp-b">
      <div id="dsBody"></div>
      <p class="ds-foot">ข้อมูลรวมระดับจังหวัด ไม่มีข้อมูลรายบุคคล · ค่าฝุ่นรายวันเป็นค่าเฉลี่ย 24 ชม. ณ 07.00 น. · แหล่งค่าของแต่ละวันระบุไว้ในคอลัมน์ pm25_source · เมื่อนำไปใช้โปรดอ้างอิงแหล่งข้อมูล</p>
    </div>
  </aside>
"""

TOC_JS = r'''
// ---------- แถบนำทางด้านซ้าย (รูปแบบตามตัวอย่าง Figma Make) ----------
// ชื่อระบบด้านบน · หัวข้อ "Navigation" · เมนูไอคอน+ชื่อ (เลื่อนไปโซน) · เมนูของส่วนที่กำลังดูเป็นแถบเน้น · ปุ่มพับ/กาง
const SB_MENU = [["zToday", "สถานการณ์วันนี้"], ["zTrend", "แนวโน้มค่าฝุ่น"], ["zDrill", "เจาะลึกรายพื้นที่"],
  ["zHot", "จุดความร้อน"], ["zDisease", "โรคที่ต้องเฝ้าระวัง"], ["zAdvice", "คำแนะนำวันนี้"], ["zData", "ดาวน์โหลดข้อมูล"]];
// ไอคอนเวกเตอร์ (SVG วาดเอง · viewBox 24) บนไทล์ไล่สีแบบไอคอน iOS — [สีบน, สีล่าง, path]
const SB_ICON = {
  zToday: ["#ffb340", "#ff8a00", '<path d="M12 4.5a9.5 9.5 0 0 0-9.5 9.5c0 1.5.35 2.9.97 4.15.2.4.6.65 1.05.65h14.96c.45 0 .86-.25 1.05-.65A9.5 9.5 0 0 0 12 4.5Zm0 2.2a1 1 0 0 1 1 1v.6a1 1 0 1 1-2 0v-.6a1 1 0 0 1 1-1ZM6.4 9.1a1 1 0 0 1 1.4 0l.43.43a1 1 0 1 1-1.41 1.41l-.43-.43a1 1 0 0 1 0-1.41Zm11.2 0a1 1 0 0 1 0 1.41l-3.86 3.87a2.3 2.3 0 1 1-1.41-1.41l3.86-3.87a1 1 0 0 1 1.41 0ZM4.9 14.2h.6a1 1 0 1 1 0 2h-.6a1 1 0 1 1 0-2Zm13.6 0h.6a1 1 0 1 1 0 2h-.6a1 1 0 1 1 0-2Z"/>'],
  zTrend: ["#4aa8ff", "#0a6cff", '<path d="M4 3.5a1 1 0 0 1 1 1V18c0 .55.45 1 1 1h13.5a1 1 0 1 1 0 2H6a3 3 0 0 1-3-3V4.5a1 1 0 0 1 1-1Z"/><path d="M20.2 6.3a1.2 1.2 0 0 1 .1 1.7l-4.5 5.1a1.2 1.2 0 0 1-1.65.14l-2.6-2.1-3.1 3.9a1.2 1.2 0 0 1-1.88-1.5l3.85-4.84a1.2 1.2 0 0 1 1.69-.19l2.6 2.08 3.69-4.2a1.2 1.2 0 0 1 1.7-.1Z"/><circle cx="20.3" cy="6.6" r="1.6"/>'],
  zDrill: ["#b98bff", "#7b4dff", '<path d="M12.45 2.6a1 1 0 0 0-.9 0l-8.5 4.25a1 1 0 0 0 0 1.8l8.5 4.25c.28.14.62.14.9 0l8.5-4.25a1 1 0 0 0 0-1.8l-8.5-4.25Z"/><path d="M3.05 11.6l1.86-.93 6.64 3.32c.28.14.62.14.9 0l6.64-3.32 1.86.93a1 1 0 0 1 0 1.8l-8.5 4.25a1 1 0 0 1-.9 0l-8.5-4.25a1 1 0 0 1 0-1.8Z" opacity=".8"/><path d="M3.05 16.1l1.86-.93 6.64 3.32c.28.14.62.14.9 0l6.64-3.32 1.86.93a1 1 0 0 1 0 1.8l-8.5 4.25a1 1 0 0 1-.9 0l-8.5-4.25a1 1 0 0 1 0-1.8Z" opacity=".6"/>'],
  zHot: ["#ff7a59", "#ff2d55", '<path d="M12.9 2.3a.8.8 0 0 0-1.27.62c-.16 2.55-1.4 4.06-2.73 5.66C7.5 10.27 6 12.08 6 15a6 6 0 0 0 12 0c0-2.2-.86-3.98-2.08-5.42a.8.8 0 0 0-1.39.48 2.6 2.6 0 0 1-1.06 1.94c.3-3.6-.6-7.43-.57-9.7Z"/><path d="M12 21a3 3 0 0 1-3-3c0-1.45.8-2.35 1.6-3.24.5-.56.98-1.1 1.24-1.8a.5.5 0 0 1 .9-.05C13.86 14.5 15 15.9 15 18a3 3 0 0 1-3 3Z" fill="#ffd8cc"/>'],
  zDisease: ["#ff6b9a", "#e8336e", '<path d="M12 20.6a1 1 0 0 1-.6-.2C6.1 16.5 3 13.3 3 9.4 3 6.4 5.3 4 8.2 4c1.5 0 2.9.7 3.8 1.85A4.8 4.8 0 0 1 15.8 4C18.7 4 21 6.4 21 9.4c0 3.9-3.1 7.1-8.4 11a1 1 0 0 1-.6.2Z" opacity=".95"/><path d="M4.2 11.5h3.6l1.5-2.6 2.3 5 1.7-3.4.9 1h5.6" fill="none" stroke="#ffe2ec" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>'],
  zAdvice: ["#3ddc84", "#0fa968", '<path d="M11.6 2.2a1 1 0 0 1 .8 0l7.5 3.1a1 1 0 0 1 .6.93v5.27c0 4.9-3.3 8.6-8.2 10.3a.95.95 0 0 1-.62 0C6.8 20.1 3.5 16.4 3.5 11.5V6.23a1 1 0 0 1 .6-.93l7.5-3.1Z"/><path d="M8.3 11.9l2.4 2.4 5-5.1" fill="none" stroke="#e3fff0" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'],
  zData: ["#30d5c8", "#0b8fa3", '<path d="M12 2.8a1.1 1.1 0 0 1 1.1 1.1v8.44l2.6-2.6a1.1 1.1 0 1 1 1.56 1.55l-4.48 4.48a1.1 1.1 0 0 1-1.56 0L6.74 11.3a1.1 1.1 0 1 1 1.56-1.55l2.6 2.6V3.9A1.1 1.1 0 0 1 12 2.8Z"/><path d="M4 14.5a1 1 0 0 1 1 1V18c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-2.5a1 1 0 1 1 2 0V18a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-2.5a1 1 0 0 1 1-1Z" opacity=".85"/>'],
};
const sbTile = id => { const [a, b, d] = SB_ICON[id]; return `<span class="sb-ic" style="--a:${a};--b:${b}"><svg viewBox="0 0 24 24" fill="#fff" aria-hidden="true">${d}</svg></span>`; };
function buildSidebar() {
  if (document.getElementById("sb")) return;
  const wide = () => matchMedia("(min-width:1024px)").matches;
  let pref = null; try { pref = localStorage.getItem("pm25sb"); } catch {}
  const aside = document.createElement("aside");
  aside.id = "sb"; aside.className = "sb"; aside.setAttribute("aria-label", "แถบนำทาง");
  aside.innerHTML = `<div class="sb-glow" aria-hidden="true"></div><div class="sb-h"><span class="sb-ic sb-logo" style="--a:#5ac8fa;--b:#0a6cff"><svg viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M3.5 20.5V10.2c0-.3.13-.58.36-.77l7.5-6.2a1 1 0 0 1 1.28 0l7.5 6.2c.23.19.36.47.36.77v10.3h-6v-5.2a.8.8 0 0 0-.8-.8h-3.4a.8.8 0 0 0-.8.8v5.2h-6Z"/></svg></span>
      <div><b>PM<sub>2.5</sub> เขตสุขภาพที่ 7</b><small>สคร.7 ขอนแก่น</small></div></div>
    <nav class="sb-c"><p class="sb-l">Navigation</p><ul>${SB_MENU.map(([id, t]) => `<li><a href="#${id}" data-z="${id}" style="--i:${SB_MENU.findIndex(m => m[0] === id)}">${sbTile(id)}<span class="sb-t">${t}</span></a></li>`).join("")}</ul></nav>`;
  document.body.prepend(aside);
  const scrim = document.createElement("div"); scrim.className = "sb-scrim"; document.body.append(scrim);
  const btn = document.createElement("button");
  btn.type = "button"; btn.id = "sbBtn"; btn.className = "sb-btn"; btn.setAttribute("aria-controls", "sb");
  btn.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/></svg><span class="sb-bt"></span>`;
  document.body.append(btn);
  const set = open => {
    document.body.classList.toggle("sb-open", open); document.body.classList.toggle("sb-closed", !open);
    btn.setAttribute("aria-expanded", String(open)); btn.title = open ? "พับแถบนำทางเพื่อขยายพื้นที่แดชบอร์ด" : "กางแถบนำทาง";
    btn.querySelector(".sb-bt").textContent = open ? "« ย่อเมนู" : "เมนู »";
    if (wide()) { try { localStorage.setItem("pm25sb", open ? "1" : "0"); } catch {} setTimeout(() => dispatchEvent(new Event("resize")), 260); }
  };
  document.body.classList.add("has-sb");
  set(wide() ? pref !== "0" : false);
  btn.addEventListener("click", () => set(!document.body.classList.contains("sb-open")));
  scrim.addEventListener("click", () => set(false));
  addEventListener("keydown", e => { if (e.key === "Escape" && !wide() && document.body.classList.contains("sb-open")) set(false); });
  aside.addEventListener("click", e => {
    const a = e.target.closest("a[data-z]"); if (!a) return; e.preventDefault();
    if (a.dataset.z === "zData") { if (!wide()) set(false); return window.dsOpen && dsOpen(); }
    const z = document.getElementById(a.dataset.z); if (!z) return;
    scrollTo({ top: Math.max(0, z.getBoundingClientRect().top + scrollY - 12 - (parseFloat(getComputedStyle(document.body).getPropertyValue("--demo-h")) || 0)), behavior: "smooth" });
    if (!wide()) set(false);
  });
  // แผงดาวน์โหลด (เปิดจากเมนู) — ปิดด้วยปุ่ม ×, คลิกนอกแผง หรือ Esc
  const dp = document.getElementById("zData"), dps = document.getElementById("dpScrim");
  let dpBack = null;
  window.dsOpen = () => { if (!dp) return; dpBack = document.activeElement; dp.hidden = dps.hidden = false;
    document.body.classList.add("dp-open"); spy(); document.getElementById("dpX")?.focus(); };
  const dsClose = () => { if (!dp || dp.hidden) return; dp.hidden = dps.hidden = true;
    document.body.classList.remove("dp-open"); spy(); dpBack?.focus?.(); };
  document.getElementById("dpX")?.addEventListener("click", dsClose);
  dps?.addEventListener("click", dsClose);
  addEventListener("keydown", e => { if (e.key === "Escape") dsClose(); });
  let raf = 0;
  const NAV = SB_MENU.filter(m => m[0] !== "zData");
  function spy() { raf = 0; let cur = NAV[0][0];
    if (dp && !dp.hidden) cur = "zData";
    else { const line = innerHeight * 0.3;
      for (const [id] of NAV) { const z = document.getElementById(id); if (z && z.getBoundingClientRect().top <= line) cur = id; }
      if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) cur = NAV.at(-1)[0]; }
    aside.querySelectorAll("a[data-z]").forEach(a => a.classList.toggle("on", a.dataset.z === cur)); }
  addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(spy); }, { passive: true });
  spy();
}

// ---------- สถิติการเข้าชม (นับผู้เข้าชมไม่ซ้ำต่อวัน · ไม่เก็บข้อมูลส่วนบุคคล) ----------
async function visitStats() {
  const el = document.getElementById("ftVisit"); if (!el) return;
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
  let seen = null; try { seen = localStorage.getItem("pm25v"); } catch {}
  const first = seen !== today;
  let d = null;
  try { d = await fetch(API + "/api/visit", { method: first ? "POST" : "GET" }).then(r => r.ok ? r.json() : null); } catch {}
  if (!d?.ok) { el.hidden = true; return; }
  if (first) { try { localStorage.setItem("pm25v", today); } catch {} }
  const n = v => Number(v || 0).toLocaleString("th-TH");
  el.querySelector('[data-v="today"]').textContent = n(d.today);
  el.querySelector('[data-v="month"]').textContent = n(d.month);
  el.querySelector('[data-v="total"]').textContent = n(d.total);
  const s = d.since ? new Date(d.since + "T00:00:00") : null;
  el.querySelector('[data-v="since"]').textContent = s ? `เริ่มนับ ${s.getDate()} ${TH_M[s.getMonth()]} ${s.getFullYear() + 543}` : "";
  el.hidden = false;
}
'''

TOC_CSS = """
/* ===== แถบนำทางด้านซ้าย (ตามตัวอย่าง Figma Make) ===== */
/* แถบนำทาง = การ์ดลอยกระจกใส (liquid glass) โทนเดียวกับแดชบอร์ด: พื้นขาวโปร่ง + กรมท่า (--brand) · ปุ่มเมนูเป็นการ์ดขาวเด่น เมนูที่กำลังดูเป็นสีกรมท่า */
.sb{position:fixed;top:12px;left:12px;bottom:12px;width:244px;z-index:70;display:flex;flex-direction:column;overflow:hidden;isolation:isolate;border-radius:26px;color:var(--ink-1,#0f1b2d);font-size:15px;
  background:linear-gradient(180deg,rgba(255,255,255,.72),rgba(243,246,249,.6));-webkit-backdrop-filter:blur(22px) saturate(170%);backdrop-filter:blur(22px) saturate(170%);
  border:1px solid rgba(255,255,255,.85);box-shadow:0 18px 40px -16px rgba(14,42,71,.35),0 2px 8px rgba(14,42,71,.08),inset 0 1px 0 #fff;
  transform:translateX(calc(-100% - 16px));transition:transform .3s cubic-bezier(.2,.8,.2,1)}
body.sb-open .sb{transform:none}
/* เงาแสงเลื่อนผ่าน (sheen) */
.sb-glow{position:absolute;inset:-20% -60%;z-index:0;pointer-events:none;background:linear-gradient(105deg,transparent 38%,rgba(255,255,255,0) 42%,rgba(255,255,255,.75) 50%,rgba(255,255,255,0) 58%,transparent 62%);transform:translateX(-70%);animation:sbSheen 5s ease-in-out 1s infinite}
@keyframes sbSheen{0%{transform:translateX(-70%)}35%,100%{transform:translateX(70%)}}
.sb-h,.sb-c{position:relative;z-index:1}
.sb-h{display:flex;align-items:center;gap:10px;margin:12px 12px 4px;padding:11px 10px;border-radius:18px;color:#fff;background:linear-gradient(150deg,#1d4a7d,var(--brand,#0e2a47));box-shadow:0 8px 18px -10px rgba(14,42,71,.8),inset 0 1px 0 rgba(255,255,255,.25)}
.sb-h b{display:block;white-space:nowrap;font-size:14.5px;font-weight:700;color:#fff;line-height:1.3}
.sb-h small{display:block;font-size:12px;color:rgba(255,255,255,.8);line-height:1.35}
.sb-c{padding:10px 12px 16px;overflow:auto}
.sb-l{margin:4px 0 8px;padding:0 6px;font-size:12px;font-weight:700;letter-spacing:.04em;color:var(--ink-3,#4f5b6e);text-transform:uppercase}
.sb-c ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:7px}
.sb-c a{position:relative;overflow:hidden;display:flex;align-items:center;gap:12px;padding:8px 10px;border-radius:14px;color:var(--ink-1,#0f1b2d);text-decoration:none;font-weight:700;
  background:#fff;border:1px solid rgba(14,42,71,.08);box-shadow:0 1px 2px rgba(14,42,71,.06),0 6px 14px -10px rgba(14,42,71,.45);transition:background .2s,box-shadow .2s,transform .2s,color .2s}
.sb-c a:hover{transform:translateX(3px);box-shadow:0 2px 4px rgba(14,42,71,.08),0 10px 20px -10px rgba(14,42,71,.55)}
.sb-c a.on{color:#fff;background:linear-gradient(135deg,#24589a,var(--brand,#0e2a47));border-color:transparent;box-shadow:0 10px 22px -10px rgba(14,42,71,.9),inset 0 1px 0 rgba(255,255,255,.22)}
.sb-c a.on .sb-ic{box-shadow:0 0 0 2px rgba(255,255,255,.85),0 2px 6px -1px rgba(0,0,0,.4)}
.sb-c a::after{content:"";position:absolute;top:0;bottom:0;left:-60%;width:45%;background:linear-gradient(105deg,transparent,rgba(255,255,255,.7),transparent);transform:skewX(-18deg);opacity:0;pointer-events:none}
.sb-c a.on::after{background:linear-gradient(105deg,transparent,rgba(255,255,255,.35),transparent)}
/* เงาเลื่อนผ่านทุก 5 วินาที พร้อมกับแถบเมนู ไล่ลงทีละปุ่ม */
.sb-c a::after{animation:sbItemSheen 5s ease-in-out infinite;animation-delay:calc(1.3s + var(--i,0) * .08s)}
@keyframes sbItemSheen{0%{left:-60%;opacity:0}4%{opacity:1}24%,100%{left:120%;opacity:0}}
.sb-c a:focus-visible{outline:3px solid #5ac8fa;outline-offset:2px}
.sb-ic{width:30px;height:30px;flex:none;display:grid;place-items:center;border-radius:9px;background:linear-gradient(160deg,var(--a),var(--b));box-shadow:0 2px 6px -1px rgba(14,42,71,.35),inset 0 1px 0 rgba(255,255,255,.45),inset 0 -1px 0 rgba(0,0,0,.12)}
.sb-ic svg{width:19px;height:19px;filter:drop-shadow(0 1px 1px rgba(0,0,0,.18))}
.sb-logo{width:36px;height:36px;border-radius:10px}
.sb-logo svg{width:22px;height:22px}
.sb-t{flex:1;min-width:0}
.sb-btn{position:fixed;top:12px;left:12px;z-index:71;height:40px;padding:0 12px 0 10px;display:flex;align-items:center;gap:6px;font:inherit;font-size:14px;font-weight:700;border:1px solid rgba(255,255,255,.6);border-radius:999px;background:rgba(255,255,255,.72);-webkit-backdrop-filter:blur(14px) saturate(170%);backdrop-filter:blur(14px) saturate(170%);color:var(--brand,#0e2a47);cursor:pointer;box-shadow:0 6px 16px -6px rgba(14,42,71,.4),inset 0 1px 0 rgba(255,255,255,.9);transition:left .3s cubic-bezier(.2,.8,.2,1),background .2s}
.sb-btn:hover{background:rgba(255,255,255,.92)}
.sb-btn:focus-visible{outline:3px solid #5ac8fa}
@media (prefers-reduced-motion:reduce){.sb-glow,.sb-c a::after{animation:none!important;display:none}.sb,.sb-btn,.sb-c a{transition:none}}
.sb-scrim{display:none}
@media (min-width:1024px){
  body.has-sb,body.has-sb:not(.ds-open){padding-left:0;transition:padding-left .25s ease}
  body.has-sb.sb-open,body.has-sb.sb-open:not(.ds-open){padding-left:268px}
  body.sb-open .sb-btn{left:280px}
}
@media (max-width:1023.98px){
  body.has-sb{padding-left:0}
  body.sb-open .sb-scrim{display:block;position:fixed;inset:0;z-index:69;background:rgba(15,27,45,.4)}
  .sb-btn{top:10px;left:10px;height:38px}
  body.sb-open .sb-btn{left:auto;right:10px}
}
@media print{.sb,.sb-btn,.sb-scrim{display:none!important}body{padding-left:0!important}}
/* ===== แผงดาวน์โหลดข้อมูล (เปิดจากแถบนำทาง ไม่อยู่บนหน้าแดชบอร์ด) ===== */
.dp{position:fixed;top:0;bottom:0;left:0;z-index:1001;width:min(560px,100vw);display:flex;flex-direction:column;background:#f4f8fa;box-shadow:6px 0 28px -8px rgba(15,27,45,.35);animation:dpIn .22s ease}
.dp[hidden],.dp-scrim[hidden]{display:none}
@keyframes dpIn{from{transform:translateX(-24px);opacity:0}to{transform:none;opacity:1}}
@media (prefers-reduced-motion:reduce){.dp{animation:none}}
.dp-scrim{position:fixed;inset:0;z-index:1000;background:rgba(15,27,45,.45)}
.dp-h{display:flex;align-items:center;gap:12px;padding:16px 16px 16px 20px;background:#0b7285;color:#fff;flex:none}
.dp-h h2{margin:0;font-size:18px;font-weight:700;line-height:1.3}
.dp-h p{margin:2px 0 0;font-size:13px;opacity:.9;line-height:1.45}
.dp-i{width:40px;height:40px;border-radius:12px;background:rgba(255,255,255,.18);display:grid;place-items:center;flex:none}
.dp-i .ico{width:22px;height:22px}
.dp-x{font:inherit;font-size:26px;line-height:1;margin-left:auto;width:40px;height:40px;border-radius:10px;border:0;background:rgba(255,255,255,.16);color:#fff;cursor:pointer;flex:none}
.dp-x:hover{background:rgba(255,255,255,.28)}
.dp-x:focus-visible{outline:3px solid #ffd166}
.dp-b .ds-foot{margin:14px 0 0;font-size:12.5px;font-weight:600;color:var(--ink-3);line-height:1.55}
.dp-b{overflow-y:auto;overscroll-behavior:contain;padding:16px 18px 24px;flex:1}
body.dp-open{overflow:hidden}
@media (min-width:1024px){body.sb-open .dp{left:268px}}
@media print{.dp,.dp-scrim{display:none!important}}
/* ไม่มีสารบัญในแดชบอร์ด — สารบัญอยู่ใน Figma · แผงดาวน์โหลดซ้ายเดิมย้ายไปท้ายหน้าแล้ว จึงไม่ต้องเว้นขอบซ้าย */
@media (min-width:1280px){body,body:not(.ds-open){padding-left:0}}
.cap[hidden]{display:none!important}
/* ===== ส่วนดาวน์โหลดข้อมูล (ท้ายหน้า) ===== */
.ds-sec{padding:18px 20px}
.ds-sec .ds-foot{margin:14px 0 0;font-size:12.5px;font-weight:600;color:var(--ink-3);line-height:1.55}
@media (min-width:900px){.ds-sec #dsBody{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:0 24px}.ds-sec .ds-step.ds-last{grid-column:1/-1}}
/* ===== สถิติการเข้าชม ===== */
.ft-bar .ft-visit{justify-content:flex-start;border-bottom:1px solid rgba(255,255,255,.08)}
.ft-visit{display:flex;flex-wrap:wrap;align-items:center;gap:6px 18px;font-size:13px;color:inherit}
.ft-visit .vh{font-weight:800;letter-spacing:.02em}
.ft-visit .vs{display:inline-flex;align-items:baseline;gap:6px}
.ft-visit .vs b{font-variant-numeric:tabular-nums;font-size:15px}
.ft-visit .vn{opacity:.75;font-size:12px}
"""

FOOT_VISIT = """    <div class="ft-visit" id="ftVisit" hidden aria-live="polite">
      <span class="vh">สถิติการเข้าชม</span>
      <span class="vs">วันนี้ <b data-v="today">–</b></span>
      <span class="vs">เดือนนี้ <b data-v="month">–</b></span>
      <span class="vs">ทั้งหมด <b data-v="total">–</b></span>
      <span class="vn"><span data-v="since"></span> · นับผู้เข้าชมไม่ซ้ำต่อวัน ไม่เก็บข้อมูลส่วนบุคคล</span>
    </div>
"""


def apply(html):
    import json
    a = html.index('<main class="wrap">'); b = html.index("</main>", a)
    main = html[a:b]
    ids = iter([z[0] for z in ZONES[:-1]])
    main, n = re.subn(r'<section style="--sec:', lambda m: f'<section id="{next(ids)}" style="--sec:', main)
    assert n == 6, n
    html = html[:a] + main + DATA_SEC + html[b:]
    # ส่วนท้าย: สถิติการเข้าชมในแถบล่าง
    old = '  <div class="ft-bar"><div>\n'
    assert html.count(old) == 1, html.count(old)
    html = html.replace(old, '  <div class="ft-bar">\n' + FOOT_VISIT + '<div>\n')
    # JS: สร้างสารบัญหลังโหลดเสร็จ · ค่า 07:00 สำหรับชุดดาวน์โหลด · สถิติการเข้าชม
    js = TOC_JS.replace("__ZONES__", json.dumps([[z[0], z[1], z[2], [list(s) for s in z[3]]] for z in ZONES], ensure_ascii=False))
    anchor = "function renderToday() {"
    assert html.count(anchor) == 1
    html = html.replace(anchor, js + anchor)
    a2 = '  document.body.classList.remove("is-loading");\n'
    assert html.count(a2) == 1
    html = html.replace(a2, a2 + '  buildSidebar(); visitStats();\n  getJSON("/api/pm25-07").then(d => { if (d?.ok) { S.pm07 = d.allData; window.dsInit && dsInit(); } });\n')
    html = re.sub(r"<body(?![^>]*\bid=)", '<body id="top"', html, count=1)
    return html
