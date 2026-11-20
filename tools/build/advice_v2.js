// ===== โซน 6 · คำแนะนำการปฏิบัติตัว แบบใหม่ (เดโม่ 20 พ.ย. 2569) =====
// ใหญ่ขึ้น ข้อความชัด · ภาพประกอบคนในบริบทที่ตรงกับเนื้อหาของแต่ละระดับ (ภาพ AI 3 มิติ) · ไอคอนหน้าข้อความตามการกระทำ (หน้ากาก/พบแพทย์/อยู่ในห้อง ฯลฯ)
// เนื้อหาข้อความทุกบรรทัดมาจาก LV[i] เดิม (summary/pub/risk) ไม่แก้ถ้อยคำ · ประกาศ renderAdvice ซ้ำ ตัวที่อยู่ทีหลังชนะ
/* ภาพประกอบ 5 ระดับ (สร้างด้วย AI) · ไฟล์จริงอยู่ที่ img/advice/lvN.webp · เดโม่จะแทนด้วย data URI ตอน build */
const AD_IMG = ["img/advice/lv1.webp", "img/advice/lv2.webp", "img/advice/lv3.webp", "img/advice/lv4.webp", "img/advice/lv5.webp"];
const AD_ALT = [
  "ผู้หญิงวิ่งออกกำลังกายอย่างสดใส ผู้สูงอายุนั่งพักบนม้านั่ง ท้องฟ้าแจ่มใส",
  "ผู้หญิงเดินเร็ว ผู้สูงอายุเดินช้า ๆ ข้างกันในสวนสาธารณะ ท้องฟ้าโปร่ง",
  "ท้องฟ้ามีหมอกฝุ่นบาง ผู้หญิงเดินช้าลง มีป้ายห้ามวิ่ง ผู้สูงอายุสวมหน้ากากนั่งพัก",
  "หมอกควันสีส้ม ผู้หญิงและผู้สูงอายุสวมหน้ากาก N95 เดินกลางทุ่ง ไกลออกไปมีควันไฟและโรงงาน",
  "ในบ้านที่ปิดหน้าต่างสนิท ผู้หญิงและผู้สูงอายุสวมหน้ากากนั่งใกล้เครื่องฟอกอากาศ ผู้หญิงเช็กระดับฝุ่นจากมือถือ ผู้สูงอายุใส่เครื่องวัดออกซิเจนที่นิ้ว มีหน้ากากสำรองแขวนไว้ ข้างนอกมีควันหนาสีแดง"
];
const AD_I = {
  ok: c => `<circle cx="14" cy="14" r="11" fill="none" stroke="${c}" stroke-width="2.6"/><path d="M8.5 14.5l4 4 7-8" fill="none" stroke="${c}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>`,
  eye: c => `<path d="M3 14q11-14 22 0q-11 14-22 0z" fill="none" stroke="${c}" stroke-width="2.6" stroke-linejoin="round"/><circle cx="14" cy="14" r="4" fill="${c}"/>`,
  clock: c => `<circle cx="14" cy="14" r="11" fill="none" stroke="${c}" stroke-width="2.6"/><path d="M14 7v7l5 3" fill="none" stroke="${c}" stroke-width="2.6" stroke-linecap="round"/>`,
  noex: c => `<circle cx="14" cy="14" r="11" fill="none" stroke="${c}" stroke-width="2.6"/><path d="M6.5 21.5l15-15" stroke="${c}" stroke-width="2.8" stroke-linecap="round"/><circle cx="15.5" cy="9" r="2" fill="${c}"/><path d="M13 12.5l-3 5m3-5l3.5 3 3-1m-6.5-2l-.5 5.5l-3 2" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`,
  mask: c => `<path d="M5 9h18v6q0 7-9 9q-9-2-9-9z" fill="none" stroke="${c}" stroke-width="2.6" stroke-linejoin="round"/><path d="M5 12l-3 1m21-1l3 1M9 14h10M9 18h10" stroke="${c}" stroke-width="2.2" stroke-linecap="round" fill="none"/>`,
  doctor: c => `<rect x="3" y="3" width="22" height="22" rx="5" fill="none" stroke="${c}" stroke-width="2.6"/><path d="M14 8v12M8 14h12" stroke="${c}" stroke-width="3" stroke-linecap="round"/>`,
  home: c => `<path d="M3 14L14 4l11 10M6 12v12h16V12" fill="none" stroke="${c}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/><path d="M10 19q4-4 8 0" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round"/>`,
  dust: c => `<path d="M7 20a5 5 0 0 1 1-9.9a6 6 0 0 1 11.5 1.4A4.3 4.3 0 0 1 19 20z" fill="none" stroke="${c}" stroke-width="2.6" stroke-linejoin="round"/><circle cx="10" cy="24" r="1.4" fill="${c}"/><circle cx="15" cy="25" r="1.4" fill="${c}"/><circle cx="20" cy="24" r="1.4" fill="${c}"/>`,
  sun: c => `<circle cx="14" cy="14" r="5.5" fill="none" stroke="${c}" stroke-width="2.6"/>${[0, 45, 90, 135, 180, 225, 270, 315].map(a => `<line x1="${14 + Math.cos(a * Math.PI / 180) * 9}" y1="${14 + Math.sin(a * Math.PI / 180) * 9}" x2="${14 + Math.cos(a * Math.PI / 180) * 12}" y2="${14 + Math.sin(a * Math.PI / 180) * 12}" stroke="${c}" stroke-width="2.4" stroke-linecap="round"/>`).join("")}`,
};
function adIcon(text, c) {
  const k = /หน้ากาก/.test(text) ? "mask" : /พบแพทย์/.test(text) ? "doctor" : /ห้องปลอดฝุ่น|อยู่ในห้อง/.test(text) ? "home" : /ก่อฝุ่น/.test(text) ? "dust" : /เฝ้าระวัง/.test(text) ? "eye" : /ลดระยะเวลา/.test(text) ? "clock"
    : /(ลด|เลี่ยง|จำกัด|งด).*(ออกกำลัง|แรงมาก|กลางแจ้ง)/.test(text) ? "noex" : "sun";
  return `<svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true">${AD_I[k](c)}</svg>`;
}
const AD_WHO = {
  pub: c => `<circle cx="14" cy="9" r="5" fill="${c}"/><path d="M4.5 24q0-9 9.5-9t9.5 9z" fill="${c}"/>`,
  risk: c => `<path d="M14 25S3 18.5 3 10.8A5.8 5.8 0 0 1 14 8a5.8 5.8 0 0 1 11 2.8C25 18.5 14 25 14 25z" fill="none" stroke="${c}" stroke-width="2.6" stroke-linejoin="round"/><path d="M8 14h3l2-3 2.5 6 1.5-3h3" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
};
const adWho = (kind, c) => `<svg viewBox="0 0 28 28" width="30" height="30" aria-hidden="true">${AD_WHO[kind](c)}</svg>`;
function renderAdvice() {
  const scale = i => `<div class="ad2-scale" aria-hidden="true">${LV.map((x, j) => `<i style="--k:${x.c}"${j === i ? ' class="on"' : ""}></i>`).join("")}</div>`;
  document.getElementById("advRow").innerHTML = LV.map((l, i) => {
    const box = (kind, arr) => `<section class="ad2-g ad2-g-${kind}"><h4>${adWho(kind, l.ink)}<span>${kind === "pub" ? "ประชาชนทั่วไป" : "กลุ่มเสี่ยง*"}</span></h4><ul>${arr.map(t => `<li><span class="ad2-ic">${adIcon(t, l.ink)}</span><span>${t}</span></li>`).join("")}</ul></section>`;
    return `<article class="ad2" style="--c:${l.c};--soft:${l.soft};--tint:${l.tint};--ink:${l.ink}" aria-label="ระดับ${l.name}">
      <div class="ad2-art">
        <img src="${AD_IMG[i]}" alt="${AD_ALT[i]}" loading="lazy" decoding="async" width="800" height="597">
        <div class="ad2-meter"><div class="ad2-rng"><span>PM<sub>2.5</sub></span><b>${l.range}</b><small>µg/m³</small></div>${scale(i)}</div>
      </div>
      <div class="ad2-b">
        <header class="ad2-h"><span class="ad2-n">${l.name}</span></header>
        <p class="ad2-s">${l.summary || l.pub[0]}</p>
        <div class="ad2-gs">${box("pub", l.pub)}${box("risk", l.risk)}</div>
      </div></article>`;
  }).join("");
}
