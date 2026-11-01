// ================= INFOGRAPHIC (ฉบับปรับ) =================
// กลุ่มเป้าหมายหลัก: เจ้าหน้าที่สาธารณสุขรายจังหวัด (รายงานสถานการณ์ประจำวันฉบับย่อ) + ส่งต่อประชาชน
// - เลือก "ทั้งเขต" หรือรายจังหวัดก่อนดาวน์โหลด (tailored) · ธีมสีและคำแนะนำตามระดับของจังหวัดที่เลือก
//   ทั้งเขต → ใช้ระดับของจังหวัดที่ค่าสูงสุด (หลักป้องกันไว้ก่อน แบบ EPA รายงานค่าสูงสุดของพื้นที่)
// - ตัดการเทียบปี 2568 ออก · โรคใช้แบบ E1 (เฉลี่ยราย/สัปดาห์ในแต่ละเดือน) · เพิ่มคาดการณ์ 3 วัน + QR ไปแดชบอร์ด
// ---- แก้ซ้อนทับส่วนท้าย / หัวข้อโรคตัดบรรทัด (ฉีด CSS ชุดเดียว ใช้ร่วมเดโม่และเว็บจริง) ----
(function () {
  if (document.getElementById("igfix")) return;
  const st = document.createElement("style"); st.id = "igfix";
  st.textContent = `
#ig .ig-sec em.tt{font-style:normal;white-space:nowrap}
#ig .ig-sec em.tt+small{flex:1 1 0;min-width:0;text-align:right;line-height:1.25}
#ig[data-dx="1"]:not(.social) .ig-body{gap:3px;padding-top:8px}
#ig[data-dx="1"]:not(.social) .ig-sec{padding-top:3px;padding-bottom:3px}
#ig[data-dx="1"] .dzg2{gap:6px}#ig[data-dx="1"] .dzg2>div{padding:3px 10px 0}
#ig[data-dx="1"] .ig-date{padding:4px 44px}#ig[data-dx="1"] .ig-f{padding:6px 44px}
#ig[data-dx="1"]:not(.social) .advice .w{padding:4px 12px;gap:4px}
#ig[data-dx="1"] .dzl{font-size:13px;margin-top:-6px}
#ig.social[data-dense="3"] .scale{gap:6px}
#ig.social[data-dense="3"] .scale div{padding:4px 6px;font-size:13px;line-height:1.25}
#ig.social[data-dense="3"] .scale b{font-size:15px}
#ig .a4v2{gap:6px!important}#ig .a4v2 .ig-sec{padding:3px 14px 3px 5px!important;font-size:19px}#ig .a4v2 .ig-sec>span{width:30px;height:30px}
#ig .a4v2 .maxbar{padding:0 16px}#ig .a4v2 .maxbar .ml{font-size:19px}
#ig .a4v2 .row3{gap:10px}#ig .a4v2 .box{padding:6px 14px}#ig .a4v2 .box h4{font-size:17px;margin-bottom:2px}#ig .a4v2 .box h4 small{font-size:12.5px!important}#ig .a4v2 .t7,#ig .a4v2 .fc3{font-size:14px}
#ig .a4v2 .t7 td,#ig .a4v2 .t7 th,#ig .a4v2 .fc3 td,#ig .a4v2 .fc3 th{padding:0 4px!important;line-height:1.2!important}#ig .a4v2 .t7 td.cell{font-size:14px!important;border-width:1.5px;line-height:1.1!important}#ig .a4v2 .fc3 td{font-size:14px!important;padding:2px 4px!important;line-height:1.2!important}#ig .a4v2 .t7 td:first-child,#ig .a4v2 .fc3 td:first-child{font-size:14px!important}#ig .a4v2 .t7 td.today-col{font-size:16px!important}#ig .a4v2 .fc3 th small{display:inline;margin-left:3px}
#ig .maxbar .src{flex:1;min-width:0;font-size:12.5px;line-height:1.3;color:var(--ink-2);text-align:right;padding-right:6px}#ig .avg .src{display:block;font-size:12.5px;line-height:1.3;color:var(--ink-2);margin-top:4px}
#ig .a4v2 .advice .w{padding:4px 12px;gap:3px}#ig .a4v2 .advice .w h4{margin:0;font-size:16px}#ig .a4v2 .advice .do{padding:1px 8px;font-size:15px!important;line-height:1.3;min-height:0}#ig .a4v2 .advice .do span{width:26px;height:26px}#ig .a4v2 .advice .do span svg{width:18px;height:18px}#ig .a4v2 .advice{grid-template-columns:170px 1fr 1fr!important}#ig .a4v2 .advice .lv{padding:6px 8px!important;gap:2px!important}#ig .a4v2 .advice .lv b{font-size:20px!important;line-height:1.2}#ig .a4v2 .advice .lv .f{font-size:30px}#ig .a4v2 .advice .lv>span:last-child{font-size:13.5px;white-space:nowrap}#ig[data-dx="1"] .a4v2{gap:5px!important}
#ig .a4v2 .lvleg{display:grid;grid-template-columns:repeat(5,1fr);gap:5px}#ig .a4v2 .lvleg span{font-size:13.5px;padding:2px 8px 2px 5px;white-space:nowrap}#ig .a4v2 .lvleg b{font-size:14px}
#ig .a4v2 .ig-note{font-size:13px;line-height:1.35}
#ig .a4v2 .dzl{display:block!important;font-size:13px;line-height:1.4;margin-top:0;color:var(--ink-2)!important;font-weight:400!important}#ig .a4v2 .dzl b{color:var(--ink-1);font-weight:700}
#ig .a4v2 .dzg2 .dh .nm{font-size:15.5px}#ig .a4v2 .dzg2 .dh{gap:6px}#ig .a4v2 .dzg2 .dh .dz-icon{width:26px;height:26px;border-radius:8px}#ig .a4v2 .dzg2 .dh .dz-icon svg{width:17px;height:17px}#ig .a4v2 .dzg2>div{padding-top:4px}
#ig .cbk{display:flex;flex-wrap:wrap;gap:4px 16px;font-size:13px;color:var(--ink-2)}
#ig .cbk span{display:flex;align-items:center;gap:6px}
#ig .cbk i{display:block;flex:none}#ig .cbk .bar{width:12px;height:12px;border-radius:2px;background:linear-gradient(90deg,#2980b9 25%,#e74c3c 25% 50%,#27ae60 50% 75%,#f39c12 75%)}
#ig .cbk em{font-style:normal}#ig .cbk .ssn{width:14px;height:12px;border-radius:2px;background:rgba(232,89,12,.18)}#ig .cbk .ln{width:20px;height:2.5px;background:#1f2a3d}#ig .cbk .dsh{width:20px;height:2px!important;background:repeating-linear-gradient(90deg,#b84a00 0 4px,transparent 4px 7px)}
#ig .cbg{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
#ig .cbg>div{background:#fff;border:1px solid var(--line);border-radius:12px;padding:4px 6px 0}
#ig .cbh{display:flex;align-items:center;gap:5px;font-family:Anuphan;font-weight:700;font-size:14px;line-height:1.3;white-space:nowrap}
/* ===== A4 ฉบับ 4 ===== */
/* เงาไม่ล้นทับข้อความถัดไป (เงาเดิมยื่นลง 12–14px) */
#ig .a4v2 .ig-sec{box-shadow:0 1px 2px rgba(15,27,45,.16),0 3px 8px -3px var(--lv-ink)!important}
#ig .a4v2 .maxbar{box-shadow:0 0 0 1px rgba(15,27,45,.06),0 2px 6px -2px var(--lv)!important}
#ig .a4v2 .igt .tile{box-shadow:0 1px 2px rgba(15,27,45,.08),0 4px 10px -6px rgba(15,27,45,.25)!important}
#ig .a4v2 .box,#ig .a4v2 .dzg2>div,#ig .a4v2 .kpis>div,#ig .a4v2 .avg,#ig .a4v2 .advice{box-shadow:0 1px 2px rgba(15,27,45,.06),0 3px 8px -4px rgba(15,27,45,.18)!important}
/* การ์ดค่าฝุ่น: เทียบเมื่อวานชัดขึ้น */
#ig .a4v2 .igt .tile .delta{font-size:21px!important;font-weight:700;white-space:nowrap}
#ig .a4v2 .igt .tile .delta b{font-weight:800}
#ig .avg .trd4{font-size:15px;font-weight:600;color:var(--ink-2)}#ig .avg .trd4 b{color:var(--ink-1)}
/* คำแนะนำ: เด่นขึ้น (กรอบสีระดับ + พื้นอ่อน + ข้อความหนาขึ้น) */
#ig .a4v2 .advice{border:2.5px solid var(--lv)!important;background:linear-gradient(160deg,#fff 35%,var(--lv-tint))!important}
#ig .a4v2 .advice .w h4{color:var(--lv-ink);font-size:17px!important}
#ig .a4v2 .advice .do{font-weight:600;color:var(--ink-1);background:rgba(255,255,255,.85)!important;border:1px solid color-mix(in srgb,var(--lv) 30%,#fff)!important}
#ig .a4v2 .advice .do span{background:var(--lv-soft)!important;color:var(--lv-ink)!important}
/* ผู้ป่วยรายเดือน: เด่นขึ้น */
#ig .a4v2 .dzg2>div{border:1.5px solid color-mix(in srgb,var(--dzs) 30%,#c9d3df)!important}
#ig .a4v2 .dzg2 .dh .nm{font-size:16.5px!important;font-weight:700}
/* ข้อ 5 + ส่วนท้าย: กระจกใสแบบ iOS 26 (html2canvas ไม่วาด backdrop-filter → ใช้ไล่สีขาวโปร่ง + ขอบสว่าง + เงานุ่ม) */
#ig .a4v2 .cbg{gap:10px}
#ig .a4v2 .cbg>div{border-radius:18px;border:1px solid rgba(255,255,255,.95);background:linear-gradient(180deg,rgba(255,255,255,.92),rgba(255,255,255,.62));box-shadow:inset 0 1px 0 #fff,0 1px 2px rgba(15,27,45,.06),0 6px 16px -10px rgba(15,27,45,.35);padding:6px 8px 2px}
#ig .a4v2 .cbk{background:linear-gradient(180deg,rgba(255,255,255,.85),rgba(255,255,255,.55));border:1px solid rgba(255,255,255,.95);border-radius:999px;padding:3px 14px;align-self:flex-start;box-shadow:inset 0 1px 0 #fff,0 2px 6px -4px rgba(15,27,45,.25)}
#ig .a4v2 .cbh{font-size:15px}
#ig .a4v2~.ig-f{left:0!important;right:0!important;bottom:0!important;border:0!important;border-radius:0!important;padding:10px 44px!important;color:#fff!important;background:linear-gradient(100deg,var(--lv-ink),color-mix(in srgb,var(--lv-ink) 62%,var(--lv)))!important;box-shadow:none!important}
#ig .a4v2~.ig-f b,#ig .a4v2~.ig-f span{color:#fff!important}#ig .a4v2~.ig-f .qr{background:#fff;border:0!important;border-radius:10px!important;padding:3px;box-shadow:none!important}
#ig .a4v2~.ig-f .qr svg{width:66px;height:66px}
#ig:not(.social) .ig-date{padding-top:6px!important;padding-bottom:6px!important}
/* ตารางค่าฝุ่นย้อนหลัง / คาดการณ์: ช่องเรียบ ไม่มีเส้นขอบ · เอฟเฟ็กต์นูนกระจกใสมีเงาเฉพาะคอลัมน์ "วันนี้" */
#ig .a4v2 .t7,#ig .a4v2 .fc3{border-collapse:separate!important;border-spacing:4px 3px!important}
#ig .a4v2 .t7 td.cell,#ig .a4v2 .fc3 td:not(:first-child){border:0!important;outline:0!important;border-radius:8px!important;background-image:none!important;box-shadow:none!important;padding:2px 4px!important}
#ig .a4v2 .t7 td.today-col{font-weight:800;border-radius:10px!important;
  background-image:linear-gradient(180deg,rgba(255,255,255,.6) 0%,rgba(255,255,255,.2) 42%,rgba(255,255,255,0) 52%,rgba(0,0,0,.1) 100%)!important;
  box-shadow:0 0 0 2px #fff,0 2px 3px rgba(15,27,45,.22),0 6px 12px -4px rgba(15,27,45,.45)!important}
#ig .a4v2 .fc3 tr.me td:first-child{font-weight:800;color:var(--lv-ink)}
/* หัวเรื่อง/ส่วนท้าย: ไม่ให้ข้อความล้นกรอบ · ตัดบรรทัดเฉพาะระหว่างวลี */
#ig .ig-date{gap:14px}
#ig .ig-date>span:last-child{white-space:normal!important;min-width:0;flex:1 1 auto;text-align:right}
#ig .ig-date .kl .kls,#ig .ig-f .nw{white-space:nowrap}
#ig .ig-f{gap:16px}
#ig .ig-f .ig-fl{flex:1 1 auto;min-width:0}
#ig .ig-f .ig-fr{flex:none;text-align:right}
#ig .kpis:not(.kpis-h){grid-template-rows:none!important;grid-auto-rows:1fr;align-content:stretch!important}   /* KPI 1–2 ช่อง (PHEOC เฉพาะวันที่เข้าเกณฑ์) ยืดเต็มความสูงการ์ด */
#ig.social .pvrow .trd{font-size:12.5px;line-height:1.25;margin-top:2px}
#ig .igt .tile.me{outline:6px solid var(--lv-ink);outline-offset:-3px}
/* โพสต์รายจังหวัด */
#ig .sp{gap:12px!important;padding-top:14px!important}
#ig .sp-hero{display:flex;align-items:center;justify-content:center;gap:22px;border-radius:26px;padding:12px 26px;border:3px solid var(--lv);background:linear-gradient(160deg,#fff 30%,var(--lv-tint));box-shadow:0 2px 4px rgba(15,27,45,.08),0 10px 22px -14px var(--lv-ink)}
#ig .sp-art{flex:none;line-height:0}#ig .sp-art svg{display:block}
#ig .sp-txt{display:flex;flex-direction:column;align-items:flex-start;line-height:1.1}
#ig .sp-k{display:flex;align-items:center;gap:12px}#ig .sp-k .pm-tag{font-size:26px}
#ig .sp-pv{font-family:Anuphan;font-size:46px;color:var(--lv-ink)}
#ig .sp-v{font-family:Anuphan;font-weight:700;font-size:132px;color:var(--ink-1);letter-spacing:-.02em}#ig .sp-v small{font-size:34px;color:var(--ink-2);font-weight:600}
#ig .sp-l{font-family:Anuphan;font-weight:700;font-size:40px;color:#fff;background:var(--lv-ink);border-radius:999px;padding:4px 22px;margin-top:4px}
#ig .sp-d{font-size:24px;font-weight:700;color:var(--ink-1);margin-top:8px}#ig .sp-d b{color:var(--lv-ink)}
#ig .sp-src{font-size:16px;color:var(--ink-2);margin-top:6px}
#ig .sp .advice .do{font-size:21px!important}#ig .sp .advice .w h4{font-size:23px!important}
#ig .sp-row{display:grid;grid-template-columns:1.55fr 1fr;gap:12px}
#ig .sp-box{border:1px solid var(--line);border-radius:18px;padding:8px 14px 10px;background:#fff}
#ig .sp-box h4{display:flex;justify-content:space-between;align-items:baseline;font-family:Anuphan;font-size:21px;margin:0 0 6px}#ig .sp-box h4 small{font-size:15px;color:var(--ink-2);font-weight:600}
#ig .sp-d7{display:grid;grid-template-columns:repeat(7,1fr);gap:5px}#ig .sp-fc{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
#ig .sp-d7 .c,#ig .sp-fc .c{display:flex;flex-direction:column;align-items:center;border-radius:12px;padding:4px 2px;line-height:1.15}
#ig .sp-fc .c{border:2.5px solid}
#ig .sp-d7 .c small,#ig .sp-fc .c small{font-size:14px;font-weight:600;white-space:nowrap}#ig .sp-d7 .c b,#ig .sp-fc .c b{font-family:Anuphan;font-size:23px}
#ig .sp-d7 .c.td{box-shadow:0 0 0 3px #fff,0 4px 10px -3px rgba(15,27,45,.45);background-image:linear-gradient(180deg,rgba(255,255,255,.5),rgba(255,255,255,0) 50%,rgba(0,0,0,.08))}
#ig .sp-none{grid-column:1/-1;font-size:16px;color:var(--ink-2);padding:10px 2px}
#ig .sp .dzg2 .dh .nm{font-size:18px}#ig .sp .dzl{display:block!important;font-size:14px}#ig .sp .ig-note{font-size:15px}
#ig[data-sp="2"] .sp-v,#ig[data-sp="3"] .sp-v{font-size:116px}#ig[data-sp="4"] .sp-v,#ig[data-sp="5"] .sp-v,#ig[data-sp="6"] .sp-v{font-size:100px}
#ig[data-sp="3"] .sp,#ig[data-sp="4"] .sp,#ig[data-sp="5"] .sp,#ig[data-sp="6"] .sp{gap:8px!important}
#ig[data-sp="4"] .sp .advice .do,#ig[data-sp="5"] .sp .advice .do,#ig[data-sp="6"] .sp .advice .do{font-size:18px!important;padding:2px 8px!important;line-height:1.25}
#ig[data-sp="4"] .sp .advice .w,#ig[data-sp="5"] .sp .advice .w,#ig[data-sp="6"] .sp .advice .w{gap:4px!important;padding:6px 12px!important}
#ig[data-sp="4"] .sp .advice .w h4,#ig[data-sp="5"] .sp .advice .w h4,#ig[data-sp="6"] .sp .advice .w h4{font-size:20px!important;margin:0!important}
#ig[data-sp="5"] .sp-hero,#ig[data-sp="6"] .sp-hero{padding:6px 22px}#ig[data-sp="5"] .sp-l,#ig[data-sp="6"] .sp-l{font-size:32px}#ig[data-sp="5"] .sp-pv,#ig[data-sp="6"] .sp-pv{font-size:38px}
#ig[data-sp="5"] .sp .ig-act,#ig[data-sp="6"] .sp .ig-act{padding:4px 12px;font-size:16px}
#ig[data-sp="6"] .sp-v{font-size:88px}#ig[data-sp="6"] .sp-src{font-size:14px;margin-top:2px}#ig[data-sp="6"] .sp-d{font-size:20px;margin-top:4px}#ig[data-sp="6"] .sp .ig-note,#ig[data-sp="6"] .sp .dzl{font-size:13px}#ig[data-sp="6"] .sp-box{padding:4px 12px 6px}#ig[data-sp="6"] .sp-box h4{font-size:18px;margin-bottom:3px}#ig[data-sp="6"] .sp-d7 .c b,#ig[data-sp="6"] .sp-fc .c b{font-size:20px}#ig[data-sp="6"] .sp .advice .do{font-size:16px!important}#ig[data-sp="6"] .sp .advice .lv b{font-size:24px!important}#ig[data-sp="6"] .sp .advice .do span{width:26px;height:26px}
`;
  document.head.appendChild(st);
})();
// ส่วนท้ายเป็น position:absolute → เว้นที่ด้านล่างเนื้อหาเท่าความสูงจริงของส่วนท้าย (เดิมโซเชียลเว้นแค่ 14px จึงซ้อนทับ)
function igPad(ig) { const f = ig.querySelector(".ig-f"), b = ig.querySelector(".ig-body"); if (f && b) b.style.paddingBottom = (ig.clientHeight - f.offsetTop + 10) + "px"; }
// ย่อทีละขั้น (โพสต์ 0–4 · A4 0–7) จนไม่ล้น — ล้นตรวจจากส่วนที่เว้นไว้เหนือส่วนท้ายด้วย
let IG_GROW = 0;   // A4: พื้นที่ว่างที่แจกให้กราฟข้อ 4–5 (px)
function fitInfographic(size) {
  const ig = document.getElementById("ig");
  const top = size === "social" ? (S.igPv ? 6 : 4) : 7;   // โพสต์รายจังหวัดมีขั้น 5–6 เพิ่ม   // A4 มีขั้น 5–7 สำรอง (กราฟเตี้ยลง · ขั้น 7 ย่อการ์ดจังหวัด)
  let d = 0; IG_GROW = 0;
  for (; d <= top; d++) { buildInfographic(size, d); if (ig.scrollHeight <= ig.clientHeight + 1) break; }
  if (d > top) return top;
  if (size !== "social") {   // A4: พื้นที่ว่างเหนือส่วนท้าย → ขยายกราฟผู้ป่วย (ไม่ปล่อยช่องว่าง)
    const b = ig.querySelector(".ig-body"), last = b?.lastElementChild, f = ig.querySelector(".ig-f");
    let g = last && f ? Math.floor(f.offsetTop - 12 - (last.offsetTop + last.offsetHeight)) : 0;
    for (let k = 0; k < 4 && g > 6; k++) { IG_GROW = g; buildInfographic(size, d); if (ig.scrollHeight <= ig.clientHeight + 1) return d; g = Math.floor(g * .7); }
    IG_GROW = 0; buildInfographic(size, d);
  }
  return d;
}
// ---- A4 ฉบับ 2: ตัวช่วย ----
// ชื่อกลุ่มโรคบนอินโฟกราฟิก (ใช้คำว่า "โรคระบบ…" ตามที่ขอ)
const IG_DZ_NAME = { "ทางเดินหายใจ": "โรคระบบทางเดินหายใจ", "หัวใจ": "โรคระบบหัวใจและหลอดเลือด", "ตาอักเสบ": "โรคเยื่อบุตาอักเสบ", "ผิวหนัง": "โรคผิวหนังอักเสบ" };
const igDzName = d => IG_DZ_NAME[d.key] || d.label;
// ช่วงกราฟผู้ป่วยย้อนหลังเทียบค่าฝุ่น: ย้อนหลัง N เดือน นับถึงเดือนล่าสุดที่มีข้อมูลผู้ป่วย (เลื่อนเองทุกเดือน)
// ฤดูฝุ่น = 1 พ.ย. – 31 พ.ค. (แรเงาในกราฟ) · ใช้ 12 เดือน (เลือกแล้ว) · ข้อมูลเริ่มปี 2568 แล้วเลื่อนต่อไปเรื่อย ๆ
let IG_CB_N = 12;
const IG_SEASON = m => m >= 10 || m <= 4;   // พ.ย.–พ.ค.
function igCbMonths() { return dzCbMonths(S.dz || {}, S.wkMax, IG_CB_N); }   // ใช้ตัวเดียวกับแดชบอร์ด (เลื่อนข้ามปีตาม meta.dataYear/dataWk)
// ค่าฝุ่นรายเดือนทั้งเขต = ค่าเฉลี่ยรายวันของ 4 จังหวัด แล้วเฉลี่ยทั้งเดือน (เฉพาะวันที่มีค่า)
function igPmMonthly(months, pv) {
  const all = S.pm?.allData || {}, acc = {};
  for (const [d, o] of Object.entries(all)) { const v = (pv ? [pv] : PROV.map(p => p.name)).map(n => o?.[n]).filter(x => x != null && !isNaN(x) && x > 0); if (!v.length) continue;   // 0 = สถานีไม่มีข้อมูล ไม่นับ
    const k = d.slice(0, 7); (acc[k] ||= []).push(v.reduce((a, b) => a + b, 0) / v.length); }
  return months.map(({ y, m }) => { const a = acc[`${y}-${String(m + 1).padStart(2, "0")}`]; return a?.length ? a.reduce((x, z) => x + z, 0) / a.length : null; });
}
// กราฟผสม: แท่ง = ผู้ป่วยรวมรายเดือน (สเกลซ้ายของกลุ่มนั้น) · เส้น = ค่าฝุ่นรายเดือน (สเกลขวาเท่ากันทุกแผง) · เส้นประ 37.5
function igCombo(d, bars, pm, pmMax, W, H, months) {
  const F = "font-family=\"'IBM Plex Sans Thai',Anuphan,sans-serif\"", n = bars.length, L = 34, R = 26, T = 10, B = 30, pw = W - L - R, ph = H - T - B, slot = pw / n, bw = Math.max(4, slot * .68);
  const bMax = e1Nice(Math.max(...bars.map(o => o?.sum || 0)) * 1.05, true) || 1, yb = v => T + ph - v / bMax * ph, yp = v => T + ph - v / pmMax * ph, X = i => L + i * slot + slot / 2;
  const k = v => v >= 1000 ? `${+(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : String(v);
  let g = `<line x1="${L}" x2="${W - R}" y1="${T + ph}" y2="${T + ph}" stroke="rgba(15,27,45,.25)"/>`
    + `<text x="${L - 4}" y="${T + 4}" text-anchor="end" font-size="10.5" fill="${d.c}" font-weight="700" ${F}>${k(bMax)}</text><text x="${L - 4}" y="${T + ph}" text-anchor="end" font-size="10.5" fill="#5f6c80" ${F}>0</text>`
    + `<text x="${W - R + 4}" y="${T + 4}" font-size="10.5" fill="#33415c" font-weight="700" ${F}>${pmMax}</text>`;
  const y37 = yp(37.5); if (37.5 < pmMax) g += `<line x1="${L}" x2="${W - R}" y1="${y37}" y2="${y37}" stroke="#b84a00" stroke-dasharray="4 3" stroke-width="1.2"/><text x="${W - R + 4}" y="${y37 + 4}" font-size="10.5" fill="#b84a00" font-weight="700" ${F}>37.5</text>`;
  months.forEach(({ m }, i) => { if (IG_SEASON(m)) g += `<rect x="${(L + i * slot).toFixed(1)}" y="${T}" width="${(slot + .3).toFixed(1)}" height="${ph}" fill="rgba(232,89,12,.09)"/>`; });   // ฤดูฝุ่น
  const yi = bars.findIndex((_, i) => i > 0 && months[i].m === 0); if (yi > 0) g += `<line x1="${L + yi * slot}" x2="${L + yi * slot}" y1="${T}" y2="${T + ph + 26}" stroke="rgba(15,27,45,.22)" stroke-dasharray="2 2"/>`;
  bars.forEach((o, i) => { if (!o) return; const y = yb(o.sum); g += `<rect x="${X(i) - bw / 2}" y="${y}" width="${bw}" height="${T + ph - y}" rx="2" fill="${d.c}" opacity="${o.prov ? .38 : .8}"/>`; });
  const pts = pm.map((v, i) => v == null ? null : [X(i), yp(Math.min(v, pmMax))]);
  let path = "", on = false; pts.forEach(p => { if (!p) { on = false; return; } path += `${on ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`; on = true; });
  g += `<path d="${path}" fill="none" stroke="#1f2a3d" stroke-width="2.2" stroke-linejoin="round"/>` + pts.map(p => p ? `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.4" fill="#fff" stroke="#1f2a3d" stroke-width="1.6"/>` : "").join("");
  months.forEach(({ y, m }, i) => {   // ป้ายเดือนเว้นระยะ (เดือนสุดท้ายแสดงเสมอ) · ป้ายปีที่ต้นปี/ช่องแรก
    if (i === n - 1 || (!(n > 12 ? m % 3 !== 1 : m % 2 !== 0) && i < n - 2)) g += `<text x="${X(i)}" y="${T + ph + 13}" text-anchor="middle" font-size="10.5" fill="#5f6c80" ${F}>${TH_M[m]}</text>`;
    if (i === 0 || m === 0) g += `<text x="${i === 0 ? L : X(i)}" y="${T + ph + 26}" text-anchor="${i === 0 ? "start" : "middle"}" font-size="10.5" font-weight="700" fill="#33415c" ${F}>${y + 543}</text>`; });
  return `<svg viewBox="0 0 ${W} ${H}" width="100%">${g}</svg>`;
}
function igComboSec(H) {
  const months = igCbMonths(); if (!months.length) return "";
  const end = dzCbEnd(S.dz, S.wkMax), cy = end.y;
  const pv = S.igPv, src = y => pv ? (y === 2026 ? igDzRows() : []) : (S.dz?.[y] || []);   // รายจังหวัด: มีข้อมูลผู้ป่วยรายจังหวัดตั้งแต่ปี 2569
  const byY = {}; for (const y of new Set(months.map(o => o.y))) byY[y] = Object.fromEntries(DZ.map(d => [d.key, monthlyWk(src(y), d.key, y === cy ? end.w : 99, y)]));
  const pm = igPmMonthly(months, pv), pmMax = Math.max(50, Math.ceil(Math.max(...pm.filter(v => v != null), 0) / 10) * 10);
  const ser = DZ.map(d => ({ d, bars: months.map(({ y, m }) => byY[y]?.[d.key]?.[m] || null) }));
  const f = months[0], l = months.at(-1), rng = `${TH_M[f.m]} ${String(f.y + 543).slice(2)} – ${TH_M[l.m]} ${String(l.y + 543).slice(2)}`;
  const prov = ser[0].bars.some(o => o?.prov);
  return `<div class="ig-sec"><span>${inl("i-chart", 20)}</span><em class="tt">จำนวนผู้ป่วย 4 กลุ่มโรคเทียบกับค่าฝุ่น PM<sub>2.5</sub></em><small style="margin-left:auto">${rng} · ${pv ? `จ.${pv}` : "ทั้งเขต"}</small></div>
    <div class="cbk"><span><i class="bar"></i><em>แท่ง = จำนวนผู้ป่วย (ราย)</em></span><span><i class="ln"></i><em>เส้น = ค่าฝุ่นเฉลี่ยรายเดือน (µg/m³)</em></span><span><i class="dsh"></i><em>37.5 = ค่ามาตรฐาน</em></span><span><i class="ssn"></i><em>ช่วงฤดูฝุ่น พ.ย.–พ.ค.</em></span></div>
    <div class="cbg">${ser.map(s => `<div><div class="cbh" style="color:${s.d.c}">${inl(s.d.icon, 16)}${igDzName(s.d)}</div>${igCombo(s.d, s.bars, pm, pmMax, 240, H, months)}</div>`).join("")}</div>
    <div class="dzl">${prov ? "แท่งจาง = ข้อมูลยังไม่ครบ · " : ""}${pv ? `ผู้ป่วยรายจังหวัดมีข้อมูลตั้งแต่ ม.ค. 2569 · ` : ""}ใช้ดูแนวโน้มร่วมกัน ไม่ได้ยืนยันว่าฝุ่นเป็นสาเหตุโดยตรง · ที่มา: HDC กระทรวงสาธารณสุข · Air4Thai ร่วมกับ GISTDA</div>`;
}
const IG_URL = "https://pm25-dashboard-ex8l.onrender.com";
const IG_NAME = "R7_PM" + "2.5_dashboard";   // ชื่อที่แสดงท้ายหน้า (QR ยังชี้ไปที่ IG_URL) · แยกสตริงกันตัวแทนที่ชื่อสารมลพิษตอน build
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
  if (!items.length) return `<div style="padding:14px 4px;font-size:15px;color:var(--ink-2)">ยังไม่มีข้อมูลคาดการณ์จาก GISTDA ในขณะนี้</div>`;
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
// วันก่อนหน้าใน S.prevRow = แถวก่อนหน้าที่มีค่า (อาจไม่ใช่เมื่อวาน ถ้าวันนั้นไม่มีข้อมูล) → ตรวจวันที่จริง
function igPrevLbl() {
  const a = S.todayRow?.date, b = S.prevRow?.date; if (!a || !b) return "วันก่อนหน้า";
  const gap = Math.round((new Date(a + "T00:00:00") - new Date(b + "T00:00:00")) / 864e5), d = new Date(b + "T00:00:00");
  return gap === 1 ? "เมื่อวาน" : `${d.getDate()} ${TH_M[d.getMonth()]}`;
}
function igDelta(pv) {
  const v = S.todayRow?.[pv], y = S.prevRow?.[pv]; if (v == null || y == null) return "";
  const d = r1(v - y), w = d > 0 ? "▲ เพิ่มขึ้น" : d < 0 ? "▼ ลดลง" : "● เท่ากับ";
  return `${w} ${d ? Math.abs(d).toFixed(1) + " " : ""}· ${igPrevLbl()} <b>${f1(y)}</b>`;
}
// PHEOC ในอินโฟกราฟิก = เกณฑ์เดียวกับหน้าเว็บและ LINE (/api/pheoc: ค่าเฉลี่ย 24 ชม. ณ 07.00 น. ≥ 75.1 ติดกัน 2 วัน)
// เดิมเว็บจริงใช้ "มีจังหวัด ≥ 75.1 วันนี้" วันเดียว (ตัวแปลงของ pheoc_apply ทำงานก่อนที่โค้ดนี้จะถูกใส่) → เรียก pheocLabel ตรง ๆ
// จุดความร้อนของอินโฟกราฟิก: รายจังหวัด = เฉพาะจังหวัดนั้น · ระดับเขต = ทั้งเขต
const igHs = () => S.igPv ? (S.hsToday || []).filter(f => f.properties?.changwat === S.igPv) : (S.hsToday || []);
const igHsLbl = () => S.igPv ? `จ.${S.igPv}` : "เขตสุขภาพที่ 7";
function igPh(yes, no) {
  if (typeof pheocLabel === "function") return pheocLabel(yes, no);
  return PROV.some(p => (S.todayRow?.[p.name] ?? 0) >= 75.1) ? yes : no;
}
// ค่าฝุ่นย้อนหลัง 7 วัน + คาดการณ์ 3 วัน ของจังหวัดเดียว (โพสต์และ A4 รายจังหวัด)
function igPvTrend(pv, F) {
  const days = S.last7 || [], sd = iso => { const t = new Date(iso + "T00:00:00"); return `${t.getDate()}/${t.getMonth() + 1}`; };
  const d7 = days.map((r, i) => { const x = r[pv], l = x != null ? LV[lvOf(x)] : null, td = i === days.length - 1;
    return `<span class="c${td ? " td" : ""}" style="background:${l ? l.c : "#dfe4ea"};color:${l ? textOn(l.c) : "#5f6c80"}"><small>${td ? "วันนี้" : sd(r.date)}</small><b class="num">${x != null ? f1(x) : "–"}</b></span>`; }).join("");
  const it = S.gpv?.items.find(i => i.code === String(F.f?.p.code)), base = new Date((S.gpv?.asOf || "").slice(0, 10) + "T00:00:00");
  const fc = it ? it.pred.slice(0, 3).map((x, k) => { const t = new Date(base.getTime() + (k + 1) * 864e5), l = x == null ? null : LV[lvOf(x)];
    return `<span class="c" style="background:${l ? l.soft : "#eef1f5"};color:${l ? l.ink : "#5f6c80"};border-color:${l ? l.c : "#ccd4de"}"><small>${k === 0 ? "พรุ่งนี้" : `${TH_DS[t.getDay()]} ${t.getDate()} ${TH_M[t.getMonth()]}`}</small><b class="num">${x != null ? f1(x) : "–"}</b></span>`; }).join("")
    : `<span class="sp-none">ยังไม่มีข้อมูลคาดการณ์</span>`;
  const trend = `<div class="sp-row"><div class="sp-box"><h4>ค่าฝุ่นย้อนหลัง 7 วัน<small>µg/m³</small></h4><div class="sp-d7">${d7}</div></div>
    <div class="sp-box"><h4>คาดการณ์ 3 วัน<small>ที่มา: GISTDA</small></h4><div class="sp-fc">${fc}</div></div></div>`;
  return trend;
}
// ===== โพสต์รายจังหวัด 1080×1350 (1 พ.ย. 2569) · เรียงแบบอินโฟกราฟิกระดับเขต =====
// 1 การ์ดจังหวัดใหญ่ (ภาพสภาพอากาศ + ค่าฝุ่น + เทียบเมื่อวาน) → 2 คำแนะนำดูแลตัวเอง → 3 ย้อนหลัง 7 วัน + คาดการณ์ 3 วัน
// → 4 ผู้ป่วย 4 กลุ่มโรค รายเดือน ปี 2569 ของจังหวัดนั้น · ไม่มีการ์ดจังหวัดอื่น
function igSocialPv(ig, F, L, head, foot, adviceBox, riskNote, act, dense) {
  const pv = S.igPv, v = F.f?.v, d = Math.min(dense, 6); ig.dataset.sp = d;   // ระดับย่อของโพสต์รายจังหวัด 0–6
  const big = `<div class="sp-hero"><span class="sp-art">${weatherArt(F.lv, [300, 270, 240, 220, 200, 170, 140][d], [220, 196, 175, 160, 146, 124, 102][d])}</span>
    <div class="sp-txt"><span class="sp-k"><b class="pm-tag">ค่าฝุ่น PM<sub>2.5</sub></b><b class="sp-pv">จ.${pv}</b></span>
      <span class="sp-v num">${v != null ? f1(v) : "–"}<small> µg/m³</small></span>
      <span class="sp-l">${L.face} ${L.name}</span>
      ${igDelta(pv) ? `<span class="sp-d">${igDelta(pv)}</span>` : ""}
      <span class="sp-src">ค่าเฉลี่ย 24 ชม. ณ ${REPORT_TIME} · ที่มา: Air4Thai (กรมควบคุมมลพิษ)</span></div></div>`;
  const trend = igPvTrend(pv, F);
  const wkMax = S.wkMax || 0, rows = igDzRows(), ser = DZ.map(dd => ({ d: dd, m: monthlyWk(rows, dd.key, wkMax, 2026) }));
  const last = Math.max(...ser.flatMap(x => x.m.map((o, i) => o != null ? i : -1)));
  const CH = [104, 96, 90, 84, 78, 64, 54][d];
  const prov = last >= 0 && ser[0].m.some(o => o?.prov);
  const dz = last < 0 ? "" : `<div class="ig-sec"><span>${inl("i-steth", 20)}</span><em class="tt">ผู้ป่วย 4 กลุ่มโรคที่เกี่ยวข้องกับฝุ่น PM<sub>2.5</sub> · ปี 2569 · จ.${pv}</em><small style="margin-left:auto">ราย/เดือน</small></div>
    <div class="dzg2">${ser.map(x => `<div style="--dzs:${x.d.soft};background:linear-gradient(165deg,#fff 15%,${x.d.soft})"><div class="dh"><span class="dz-icon" style="background:#fff;color:${x.d.c}">${inl(x.d.icon, 20)}</span><span class="nm">${igDzName(x.d)}</span></div>${igDzPanel(x.d, x.m, last, 470, CH, 15)}</div>`).join("")}</div>
    <div class="dzl">${prov ? "* แท่งจาง = ข้อมูลยังไม่ครบ · " : ""}ที่มา: HDC กระทรวงสาธารณสุข ณ ${dzAsOf()}</div>`;
  ig.innerHTML = head + `<div class="ig-body sp">${big}${adviceBox}${act}${trend}${dz}${riskNote}</div>` + foot;
}
// หัวเรื่อง: ย่อป้าย PHEOC "ถึงเกณฑ์ · จ.ก, ข, ค" → "ถึงเกณฑ์ 3 จังหวัด" (รายชื่อยาวทำให้หัวเรื่องสูงหลายบรรทัด)
function igPhShort(t) { return String(t).replace(/ · จ\.(.+)$/, (m, l) => ` ${l.split(", ").length} จังหวัด`); }
function igTrendHtml(pv, center) {   // ข้อความเดียวกับการ์ดจังหวัดระดับเขต: "▲ เพิ่มขึ้น N · เมื่อวาน X"
  const t = igTrend(pv), x = igDelta(pv); if (!t || !x) return "";
  return `<span class="trd ${t.up ? "up" : t.dn ? "dn" : ""}"${center ? ' style="justify-content:center;text-align:center"' : ""}>${x}</span>`;
}
// แถบสี 7 วันย้อนหลัง (โพสต์ประชาชน): เห็นแนวโน้มโดยไม่ต้องอ่านตัวเลข
function igStrip7(pv) {
  const days = S.last7 || []; if (!days.length) return "";
  return `<span class="s7">${days.map((d, i) => { const x = d[pv], l = x != null ? LV[lvOf(x)] : null;
    return `<i class="${i === days.length - 1 ? "td" : ""}" style="background:${l ? l.c : "#dfe4ea"}"></i>`; }).join("")}</span><span class="s7k">7 วันที่ผ่านมา → วันนี้</span>`;
}
function dzAsOf() { const p = String(S.dz?.meta?.dataDate || "").split("/"); return p.length === 3 ? `${+p[0]} ${TH_M[+p[1] - 1]} ${+p[2] + 543}` : "–"; }
// การ์ดรายจังหวัด: ใช้การ์ดเดียวกับแดชบอร์ด (A3) ทุกประการ — คัดลอกจาก #tiles ที่แสดงอยู่
function igTiles(sel) {
  const src = document.getElementById("tiles"); if (!src || !src.children.length) return "";
  const html = src.innerHTML.replace(/aria-pressed="true"/g, 'aria-pressed="false"').replace(/<button /g, '<div ').replace(/<\/button>/g, '</div>');
  // ข้อความเทียบวันก่อนหน้า: ระบุ "เมื่อวาน"/วันที่ และค่าของวันนั้น
  const t = document.createElement("div"); t.innerHTML = html;
  t.querySelectorAll("[data-pv]").forEach(el => { const dl = el.querySelector(".delta"), x = igDelta(el.dataset.pv); if (dl && x) dl.innerHTML = x; el.classList.toggle("me", !!sel && el.dataset.pv === sel); });
  return `<div class="ws-v2 igt"><div class="tiles">${t.innerHTML}</div></div>`;
}
// ย่อการ์ด 4 ใบให้พอดีแถว ด้วย transform (html2canvas วาด transform ได้ถูก แต่ zoom วาดตัวหนังสือเพี้ยน)
const IG_TW = 1360;
function igFitTiles(ig) {
  const box = ig.querySelector(".igt"), t = box?.querySelector(".tiles"); if (!t) return;
  const tw = ig.classList.contains("social") ? IG_TW : IG_TW + (ig.dataset.tc ? 440 : 120); t.style.width = tw + "px";
  const k = box.clientWidth / tw; t.style.transform = `scale(${k})`; box.style.height = (t.offsetHeight * k) + "px";
}
function igEpiWk() { return epiWeekOf(new Date(S.todayRow?.date + "T00:00:00")); }
function buildInfographic(size = "a4", dense = 0) {
  const F = igFocus(), L = LV[F.lv], ig = document.getElementById("ig");
  ig.className = size; delete ig.dataset.sp; ig.dataset.dense = Math.min(dense, 3); ig.dataset.dx = dense >= 4 ? "1" : ""; ig.dataset.tc = dense >= 7 ? "1" : "";   // ขั้น 7 = การ์ดจังหวัดย่อ (สำรองสุดท้าย)   // ขั้น 4 = ขั้น 3 + ย่อเพิ่ม
  [["--lv", L.c], ["--lv-soft", L.soft], ["--lv-tint", L.tint], ["--lv-ink", L.ink]].forEach(([k, v]) => ig.style.setProperty(k, v));
  const pmTag = `<b class="pm-tag">ค่าฝุ่น PM<sub>2.5</sub></b>`;
  const heroK = F.region ? `${pmTag}สูงสุดในเขต <b class="hp">จ.${F.f?.p.name ?? "–"}</b>` : `${pmTag}<b class="hp">จ.${S.igPv}</b>`;
  const hero = `<div class="avg">${weatherArt(F.lv, size === "social" ? 220 : 150, size === "social" ? 160 : 110)}<div style="display:flex;flex-direction:column"><span class="k">${heroK}</span><span class="v num">${F.f ? f1(F.f.v) : "–"}<small> µg/m³</small></span><span class="l">${L.name}</span></div></div>`;
  const overN = PROV.filter(p => (S.todayRow?.[p.name] ?? 0) > 37.5), pheoc0 = PROV.some(p => (S.todayRow?.[p.name] ?? 0) >= 75.1);
  const over75 = PROV.filter(p => (S.todayRow?.[p.name] ?? 0) >= 75.1);   // เกิน 75 = เกณฑ์ PHEOC (≥ 75.1)
  // แสดง "เกิน 75" และ "PHEOC" เฉพาะวันที่มีจังหวัดเข้าเกณฑ์ PHEOC (≥ 75.1 ติดกัน 2 วัน · /api/pheoc) — วันปกติแสดงแค่จุดความร้อน
  const phHit = !!(S.pheoc?.ok && S.pheoc.anyHit);
  const kline = `<span class="kl">${phHit ? `<span class="kls">เกิน 75 µg/m³: <b>${over75.length} จังหวัด</b></span> · <span class="kls">PHEOC <b>${igPhShort(igPh("ถึงเกณฑ์", "ยังไม่ถึงเกณฑ์"))}</b></span> · ` : ""}${F.region ? `<span class="kls">จุดความร้อน <b>${S.hsToday.length.toLocaleString("en-US")} จุด</b></span>` : ""}</span>`.replace(/ · <\/span>$/, "</span>");   // รายจังหวัด: จุดความร้อนอยู่ในการ์ด KPI แล้ว
  const scope = F.region ? `${L.face} ระดับสูงสุดในเขต: ${L.name}` : `${L.face} จ.${S.igPv}: ${L.name}`;
  const head = `<div class="ig-banner"><img src="${document.querySelector(".hdr-banner img")?.src || "/header-v2.webp"}" alt="" width="2000" height="250"></div><div class="ig-date"><span class="d">${S.todayRow ? `<span class="today-b">วันนี้</span><b>${thLong(S.todayRow.date)}</b><em>ณ เวลา ${REPORT_TIME}</em>` : ""}</span><span style="color:var(--lv-ink)"><small class="ew">สัปดาห์ระบาดวิทยาที่ ${igEpiWk()}</small>${kline}</span></div>`;
  const maxBar = F.region && F.f ? `<div class="maxbar"><span class="mk">${inl("i-pin", 22)}สูงสุดในเขตวันนี้</span><b class="mp">จ.${F.f.p.name}</b><span class="mv num">${f1(F.f.v)}<small> µg/m³</small></span><span class="ml">${L.face} ${L.name}</span></div>` : "";
  const adviceBox = `<div class="ig-sec"><span>${inl("i-shield", 20)}</span>คำแนะนำการปฏิบัติตัววันนี้</div>
    <div class="advice"><div class="lv"><span class="f">${L.face}</span><b>${L.name}</b><span>${L.range} µg/m³</span></div>
      <div class="w"><h4>${inl("i-people", 24)}ประชาชนทั่วไป</h4>${L.pub.map(x => `<div class="do"><span>${inl(actIcon(x), 22)}</span>${x}</div>`).join("")}</div>
      <div class="w"><h4>${inl("i-heartp", 24)}กลุ่มเสี่ยง*</h4>${L.risk.map(x => `<div class="do"><span>${inl(actIcon(x), 22)}</span>${x}</div>`).join("")}</div></div>`;
  const scaleBox = `<div class="scale">${LV.map((l, i) => `<div class="${i === F.lv ? "cur" : ""}" style="background:${l.soft};color:${l.ink}"><b>${l.face} ${l.name}${i === F.lv ? " · วันนี้" : ""}</b>${l.range}</div>`).join("")}</div>`;
  const foot = `<div class="ig-f"><span class="qr">${igQR(size === "social" ? 92 : 84)}</span><span class="ig-fl"><b>สแกนดูแดชบอร์ดเต็ม</b> กราฟ แนวโน้ม ข้อมูลโรครายจังหวัด<br>${IG_NAME}<br><span class="nw">แหล่งข้อมูล: Air4Thai (กรมควบคุมมลพิษ)</span> · <span class="nw">GISTDA</span> · <span class="nw">HDC กระทรวงสาธารณสุข</span></span><span class="ig-fr">${size === "social" ? "" : `<span class="nw">ผู้รายงาน: กลุ่มโรคจากการประกอบอาชีพและสิ่งแวดล้อม</span><br>`}<span class="nw">สำนักงานป้องกันควบคุมโรคที่ 7 ขอนแก่น</span><br><span class="nw">กรมควบคุมโรค</span></span></div>`;
  const pheoc = PROV.some(p => (S.todayRow?.[p.name] ?? 0) >= 75.1);
  const fc1 = (() => { const it = S.gpv?.items.find(i => i.code === String(F.f?.p.code)); const x = it?.pred?.[0]; return x == null ? null : x; })();
  const facts3 = `<div class="facts3"${phHit ? "" : ' style="grid-template-columns:repeat(2,1fr)"'}>${phHit ? `<div><span class="fi" style="background:#e7f0fc;color:#1c6ed6">${inl("i-shield", 26)}</span><span><span class="k">เกณฑ์เปิด PHEOC (เกิน 75 µg/m³)</span><b>${igPhShort(igPh("ถึงเกณฑ์", "ยังไม่เข้าเกณฑ์"))}</b></span></div>` : ""}
    <div><span class="fi" style="background:#fdeee5;color:#e8590c">${inl("i-fire", 26)}</span><span><span class="k">จุดความร้อน 24 ชม. (${igHsLbl()}) · ที่มา: GISTDA</span><b>${igHs().length} จุด</b></span></div>
    <div><span class="fi" style="background:${fc1 != null ? LV[lvOf(fc1)].soft : "var(--subtle)"};color:${fc1 != null ? LV[lvOf(fc1)].ink : "var(--ink-2)"}">${inl("i-cal", 26)}</span><span><span class="k">พรุ่งนี้ (คาดการณ์) · ${F.f?.p.name ?? ""}</span><b>${fc1 != null ? `${f1(fc1)} · ${LV[lvOf(fc1)].name}` : "–"}</b></span></div></div>`;
  const pvCard = (p, cls) => { const v = S.todayRow?.[p.name], l = v != null ? LV[lvOf(v)] : null, me = !F.region && p.name === S.igPv;
    return `<div class="${me ? "me" : ""}" style="border-left:8px solid ${l ? l.c : "#ccc"};background:linear-gradient(160deg,#fff,${l ? l.soft : "#f3f6f9"})"><span class="n"><b class="pn">${p.name}</b>${l ? `<span class="chip" style="background:${l.soft};color:${l.ink};font-size:14px">${l.name}</span>` : ""}</span><span class="x num"><em class="pm" style="background:${l ? l.ink : "#5b6b7f"}">PM<sub>2.5</sub></em>${v != null ? f1(v) : "–"}<small> µg/m³</small></span>${igTrendHtml(p.name)}</div>`; };
  const over = PROV.filter(p => (S.todayRow?.[p.name] ?? 0) > 37.5);
  const kpi = (ic, bg, fg, k, b, sm) => `<div><span class="fi" style="background:${bg};color:${fg}">${inl(ic, 26)}</span><span><span class="k">${k}</span><b>${b}</b>${sm ? `<small>${sm}</small>` : ""}</span></div>`;
  const kpis = `<div class="kpis${F.region ? " kpis-h" : ""}">${phHit ? kpi("i-shield", "#e7f0fc", "#1c6ed6", "เกณฑ์เปิด PHEOC (เกิน 75 µg/m³)", igPh("ถึงเกณฑ์", "ยังไม่เข้าเกณฑ์")) : ""}
    ${kpi("i-fire", "#fdeee5", "#e8590c", `จุดความร้อน 24 ชม. (${igHsLbl()})`, `${igHs().length} จุด`, "ที่มา: GISTDA")}</div>`;   // PHEOC แสดงเฉพาะวันที่เข้าเกณฑ์ · ตัด "จังหวัดที่เกิน 37.5"
  const riskNote = `<div class="ig-note">* กลุ่มเสี่ยง: ${RISK_DEF} · <b>ปรึกษาสุขภาพ สายด่วนกรมควบคุมโรค ${HOT_DDC}</b></div>`;
  const act = F.lv >= 3 ? `<div class="ig-act">${inl("i-fire", 24)}<b>ร่วมงดเผาในที่โล่ง</b> ลดฝุ่นเพื่อคนในชุมชน · พบการเผา แจ้งท้องถิ่นหรือสายด่วน ${HOT_PCD}</div>` : "";
  if (size === "social" && !F.region) { igSocialPv(ig, F, L, head, foot, adviceBox, riskNote, act, dense); igPad(ig); return; }   // โพสต์รายจังหวัด: เรียงแบบระดับเขต
  if (size === "social") {
    ig.innerHTML = head + `<div class="ig-body">${F.region ? "" : hero}
      ${F.region ? maxBar + igTiles() : `<div class="pvrow">${PROV.map(p => { const v = S.todayRow?.[p.name], l = v != null ? LV[lvOf(v)] : null, me = p.name === S.igPv;
        return `<div class="${me ? "me" : ""}" style="border-top:6px solid ${l ? l.c : "#ccc"}"><span class="n">${p.name}</span><span class="x num"><em class="pm" style="background:${l ? l.ink : "#5b6b7f"}">PM<sub>2.5</sub></em>${v != null ? f1(v) : "–"}</span>${l ? `<span class="chip" style="background:${l.soft};color:${l.ink};font-size:14px">${l.name}</span>` : ""}${igTrendHtml(p.name, true)}${igStrip7(p.name)}</div>`; }).join("")}</div>`}
      ${facts3}${adviceBox}${igFcStrip(F)}${act}${scaleBox}${riskNote}</div>` + foot;
    igFitTiles(ig); igPad(ig);
    return;
  }
  // ===== A4 หน้าเดียว (ฉบับ 3) · หน้าตาแบบเดิม เรียงเรื่องฝุ่นให้จบก่อน แล้วจึงตามด้วยผู้ป่วย =====
  // 1 ค่าฝุ่นวันนี้ (+ที่มา) → 2 ย้อนหลัง 7 วัน / คาดการณ์ (ย่อ) → 3 คำแนะนำ + เกณฑ์ระดับ (ย่อ)
  // → 4 ผู้ป่วย 4 กลุ่มโรค รายเดือน ปี 2569 → 5 ผู้ป่วยย้อนหลัง ม.ค. 2568 – พ.ค. 2569 เทียบค่าฝุ่นรายเดือน
  const wkMax = S.wkMax || 0, rows = igDzRows();
  const ser = DZ.map(d => ({ d, m: monthlyWk(rows, d.key, wkMax, 2026) }));
  const last = Math.max(...ser.flatMap(s => s.m.map((v, i) => v != null ? i : -1)));
  const CH = [104, 98, 92, 86, 80, 68, 58, 52][dense] + Math.round(IG_GROW * .2), CBH = [150, 146, 142, 136, 128, 98, 78, 70][dense] + Math.round(IG_GROW * .55);
  const srcT = `ค่าเฉลี่ย 24 ชม. ณ ${REPORT_TIME}<br>ที่มา: Air4Thai (กรมควบคุมมลพิษ)`;
  const heroA4 = hero.replace('<span class="l">', `<span class="trd4">${igDelta(S.igPv)}</span><span class="l">`).replace(/<\/div><\/div>$/, `<span class="src">${srcT}</span></div></div>`);
  const sec1 = F.region ? maxBar.replace('<span class="ml">', `<span class="src">${srcT}</span><span class="ml">`) + igTiles() : `<div class="row1">${heroA4}${kpis}</div>`;
  const sec2 = !F.region ? igPvTrend(S.igPv, F) : `<div class="row3">
      <div class="box" style="background:linear-gradient(165deg,#fff,#f1effd)"><h4>ค่าฝุ่นย้อนหลัง 7 วัน<small>µg/m³</small></h4><table class="t7 num">${t7Html(true)}</table></div>
      <div class="box" style="background:linear-gradient(165deg,#fff,var(--lv-tint))"><h4>คาดการณ์ 3 วัน<small>ที่มา: GISTDA</small></h4>${igForecast(F)}</div>
    </div>`;
  const sec3 = adviceBox + `<div class="lvleg">${LV.map((l, i) => `<span class="${i === F.lv ? "cur" : ""}" style="background:${l.soft};color:${l.ink}"><i style="background:${l.c}"></i><b>${l.name}</b> ${l.range}</span>`).join("")}</div>`
    + `<div class="ig-note">* กลุ่มเสี่ยง: ${RISK_DEF} · <b>ปรึกษาสายด่วน ${HOT_DDC}</b>${F.lv >= 3 ? ` · <b style="color:#9a3412">ร่วมงดเผาในที่โล่ง</b> พบการเผาแจ้ง ${HOT_PCD}` : ""}</div>`;
  const provM = last < 0 ? [] : ser[0].m.map((o, i) => o?.prov ? TH_M[i] : "").filter(Boolean);
  const sec4 = last < 0 ? "" : `<div class="ig-sec"><span>${inl("i-steth", 20)}</span><em class="tt">ผู้ป่วย 4 กลุ่มโรคที่เกี่ยวข้องกับฝุ่น PM<sub>2.5</sub> · ปี 2569${F.region ? "" : ` · จ.${S.igPv}${window.DZPV?.mock ? " (จำลอง)" : ""}`}</em><small style="margin-left:auto">ผู้ป่วยรวมรายเดือน (ราย)</small></div>
    <div class="dzg2">${ser.map(s => `<div style="--dzs:${s.d.soft};background:linear-gradient(165deg,#fff 15%,${s.d.soft})"><div class="dh"><span class="dz-icon" style="background:#fff;color:${s.d.c}">${inl(s.d.icon, 22)}</span><span class="nm">${igDzName(s.d)}</span></div>${igDzPanel(s.d, s.m, last, 470, CH, 15)}</div>`).join("")}</div>
    <div class="dzl">${provM.length ? `* แท่งจาง (${provM.join(" ")}) = ข้อมูลยังไม่ครบ หน่วยบริการยังรายงานไม่ครบ · ` : ""}ที่มา: HDC กระทรวงสาธารณสุข ณ ${dzAsOf()}</div>`;
  const sec5 = igComboSec(CBH);
  ig.innerHTML = head + `
  <div class="ig-body a4v2">
    ${sec1}${sec2}${sec3}${sec4}${sec5}
  </div>${foot}`;
  igFitTiles(ig); igPad(ig);
}

// ================= สร้างภาพ / บันทึกรูป (1 พ.ย. 2569) =================
// 1) กด "สร้างภาพ" → เปิดหน้าต่างพร้อมข้อความ "กำลังสร้างภาพ…" ทันที (เดิมเห็นแค่ปุ่มเปลี่ยนข้อความ ดูเหมือนค้าง)
// 2) เร็วขึ้น: html2canvas คัดลอกเฉพาะส่วนที่ใช้วาด (ไม่คัดลอกแผนที่/กราฟทั้งหน้า) · ใช้ Blob แทน data URL ขนาดหลาย MB
// 3) ปุ่ม "บันทึกรูป": มือถือที่รองรับ → แผ่นแชร์ของระบบ (บันทึกลงคลังรูป/ส่ง LINE ได้) · อื่น ๆ → ดาวน์โหลดไฟล์
//    แทนตัวจัดการเดิมด้วยตัวดักแบบ capture ที่ document (ตัวเดิมผูกอยู่ในหน้าแล้ว ลบตรง ๆ ไม่ได้)
(function () {
  const $ = id => document.getElementById(id);
  const st = document.createElement("style");
  st.textContent = `
.modal .ig-wait{display:none;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:48px 16px;text-align:center;color:var(--ink-2)}
.modal.busy .ig-wait{display:flex}.modal.busy .img,.modal.busy .cap,.modal.busy .hint,.modal.busy #mDl{display:none!important}
.modal .ig-wait i{width:44px;height:44px;border-radius:50%;border:5px solid #e3e8ef;border-top-color:var(--accent,#1c6ed6);animation:igspin .8s linear infinite}
.modal .ig-wait b{font-size:16px;color:var(--ink-1)}.modal .ig-wait small{font-size:13px}
@keyframes igspin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.modal .ig-wait i{animation-duration:2.4s}}
#mDl[aria-busy="true"]{opacity:.6;pointer-events:none}
.modal .bar #mDl,.modal .bar #mClose{white-space:nowrap;flex:none}.modal .bar h3{min-width:0}`;
  document.head.appendChild(st);
  let wait = null, curUrl = null, curBlob = null, curName = "PM25.png";
  const ensureWait = () => { if (wait) return wait; const box = document.querySelector("#modal .box"); if (!box) return null;
    wait = document.createElement("div"); wait.className = "ig-wait"; wait.setAttribute("role", "status"); wait.setAttribute("aria-live", "polite");
    wait.innerHTML = `<i aria-hidden="true"></i><b>กำลังสร้างภาพ…</b><small>ใช้เวลาประมาณ 3–10 วินาที ขึ้นกับเครื่อง</small>`;
    box.insertBefore(wait, box.querySelector(".hint")); return wait; };
  const step = t => { const w = ensureWait(); if (w) w.querySelector("small").textContent = t; };
  const paint = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));   // ให้หน้าวาดข้อความก่อนเริ่มงานหนัก
  const toBlob = c => new Promise((ok, no) => c.toBlob(b => b ? ok(b) : no(new Error("แปลงภาพไม่สำเร็จ")), "image/png"));
  const inApp = /\bLine\/|FBAN|FBAV|Instagram|MicroMessenger/i.test(navigator.userAgent);
  const touch = matchMedia("(pointer:coarse)").matches;
  function setResult(blob, name, hint) {
    if (curUrl) URL.revokeObjectURL(curUrl);
    curUrl = URL.createObjectURL(blob); curBlob = blob; curName = name;
    $("mImg").src = curUrl;
    const a = $("mDl"); a.href = curUrl; a.download = name;
    $("mHint").textContent = hint + (inApp ? " · ถ้ากดบันทึกไม่ได้ (เปิดในแอป LINE/Facebook) ให้กดค้างที่รูป หรือเปิดหน้านี้ในเบราว์เซอร์" : "");
  }
  // ---- ปุ่ม "สร้างภาพ" ----
  document.addEventListener("click", async e => {
    const btn = e.target.closest && e.target.closest("#btnIg"); if (!btn) return;
    e.stopImmediatePropagation(); e.preventDefault();
    if (btn.disabled) return;
    const old = btn.innerHTML, m = $("modal"); btn.disabled = true; btn.textContent = "กำลังสร้างภาพ…";
    ensureWait(); step("กำลังเตรียมข้อมูล…"); $("mTitle").textContent = "กำลังสร้าง Infographic";
    $("mCap").hidden = true; m.classList.add("on", "busy"); await paint();
    try {
      const size = $("igSize").value; S.igPv = $("igPv").value;
      await document.fonts.ready; if (typeof lsFontReady === "function") await lsFontReady();
      fitInfographic(size); step("กำลังวาดภาพ…"); await paint();
      let canvas;
      if (size === "social" && S.igPv && typeof provinceSocial === "function") canvas = await provinceSocial(S.igPv);
      else {
        if (typeof html2canvas !== "function") throw new Error("ไม่พบ html2canvas — เปิดหน้านี้ผ่าน server");
        const ig = $("ig");
        canvas = await html2canvas(ig, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: "#ffffff", windowWidth: 1400, windowHeight: 1000, logging: false,
          // คัดลอกเฉพาะ head (สไตล์/ฟอนต์), บรรพบุรุษของ #ig และเนื้อหาใน #ig — ส่วนอื่นของหน้าไม่ต้องคัดลอก (เร็วขึ้นมาก)
          ignoreElements: el => !(el === ig || el.contains(ig) || ig.contains(el) || el.closest("head") || el.tagName === "STYLE" || el.tagName === "LINK"),
          onclone: doc => { const c = doc.getElementById("ig"); if (typeof canvasSafeColors === "function") canvasSafeColors(c); if (typeof igSvgFonts === "function") igSvgFonts(c); } });
      }
      step("เกือบเสร็จ…"); await paint();
      const blob = await toBlob(canvas);
      $("mTitle").textContent = "Infographic พร้อมดาวน์โหลด";
      setResult(blob, `PM25-${S.igPv || "เขต7"}-${S.todayRow?.date || "today"}-${size}.png`,
        `ขนาด ${canvas.width}×${canvas.height} px · ${size === "social" ? "สำหรับโพสต์ Facebook/LINE" : "A4 สำหรับพิมพ์"} · กด "บันทึกรูป" เพื่อบันทึกลงเครื่อง`);
      if (size === "social" && typeof igCaption === "function") { $("mCap").hidden = false; $("mCapT").value = igCaption(); }
      m.classList.remove("busy"); $("mDl").focus();
    } catch (err) { m.classList.remove("on", "busy"); alert("สร้าง Infographic ไม่สำเร็จ: " + err.message); }
    finally { btn.disabled = false; btn.innerHTML = old; }
  }, true);
  // ---- ปุ่ม "บันทึกรูป" (ใช้กับภาพทุกแบบในหน้าต่างนี้ รวมภาพการ์ดจังหวัด) ----
  document.addEventListener("click", async e => {
    const a = e.target.closest && e.target.closest("#mDl"); if (!a || !a.href) return;
    // ชื่อไฟล์ภาษาไทยถูกเบราว์เซอร์บางตัวเปลี่ยนเป็น "download" (ไม่มีนามสกุล) → ใช้ชื่ออังกฤษ
    const EN = { "เขต7": "R7", "ขอนแก่น": "KhonKaen", "มหาสารคาม": "MahaSarakham", "ร้อยเอ็ด": "RoiEt", "กาฬสินธุ์": "Kalasin" };
    let name = String(a.download || curName); Object.keys(EN).forEach(k => { name = name.split(k).join(EN[k]); });
    name = name.replace(/[^\w.\-]+/g, "-"); if (!/\.png$/i.test(name)) name += ".png";
    // ได้ไฟล์แบบ "ทันที" (ไม่ await) — iOS ยอมเปิดแผ่นแชร์เฉพาะเมื่อเรียกต่อจากการกดโดยตรง
    let blob = null;
    if (a.href === curUrl && curBlob) blob = curBlob;
    else if (a.href.startsWith("data:")) { try { const [h, d] = a.href.split(","), bin = atob(d), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); blob = new Blob([u8], { type: (h.match(/data:([^;]+)/) || [])[1] || "image/png" }); } catch { blob = null; } }
    if (!blob) return;   // ไม่รู้จักลิงก์ → ปล่อยให้ลิงก์ทำงานตามปกติ
    e.preventDefault(); e.stopImmediatePropagation();
    const file = new File([blob], name, { type: blob.type || "image/png" });
    // มือถือ: แผ่นแชร์ของระบบ (iOS/Android) → บันทึกรูป / ส่ง LINE ได้
    if (touch && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: name }); return; }
      catch (err) { if (err && err.name === "AbortError") return; }   // ผู้ใช้กดยกเลิก
    }
    // คอมพิวเตอร์ / เบราว์เซอร์ที่ไม่รองรับแชร์ไฟล์: ดาวน์โหลดผ่านลิงก์ Blob ชั่วคราว
    const u = URL.createObjectURL(blob), t = document.createElement("a");
    t.href = u; t.download = name; t.rel = "noopener"; t.style.display = "none"; document.body.appendChild(t); t.click();
    setTimeout(() => { URL.revokeObjectURL(u); t.remove(); }, 4000);
  }, true);
})();
