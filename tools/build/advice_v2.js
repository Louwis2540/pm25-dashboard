// ===== โซน 6 · คำแนะนำการปฏิบัติตัว แบบใหม่ (เดโม่ 20 พ.ย. 2569) =====
// ใหญ่ขึ้น ข้อความชัด · ภาพเวกเตอร์ (SVG) เป็นคนในบริบทที่ตรงกับเนื้อหาของแต่ละระดับ · ไอคอนหน้าข้อความตามการกระทำ (หน้ากาก/พบแพทย์/อยู่ในห้อง ฯลฯ)
// เนื้อหาข้อความทุกบรรทัดมาจาก LV[i] เดิม (summary/pub/risk) ไม่แก้ถ้อยคำ · ประกาศ renderAdvice ซ้ำ ตัวที่อยู่ทีหลังชนะ
const AD_SK = "#f1c9a5", AD_HAIR = "#3b2a20", AD_PANTS = "#34495e";
const AD_POSE = {
  stand: { h: [50, 26], t: [[50, 42], [50, 84]], l: [[[50, 84], [43, 128]], [[50, 84], [57, 128]]], a: [[[50, 50], [38, 76]], [[50, 50], [62, 76]]] },
  walk:  { h: [50, 26], t: [[50, 42], [50, 84]], l: [[[50, 84], [60, 106], [62, 128]], [[50, 84], [40, 106], [36, 128]]], a: [[[50, 50], [60, 70], [58, 84]], [[50, 50], [40, 70], [42, 84]]] },
  jog:   { h: [56, 26], t: [[53, 42], [48, 84]], l: [[[48, 84], [68, 100], [62, 128]], [[48, 84], [30, 102], [22, 124]]], a: [[[53, 50], [68, 62], [80, 54]], [[53, 50], [38, 64], [28, 72]]] },
};
const adPts = a => a.map(p => p.join(",")).join(" ");
// คน 1 คน: x,y = ตำแหน่งมุมซ้ายบนของกรอบ 100×140 · s = สเกล · o = { mask, old (ผมขาว+ไม้เท้า), kid }
function adPerson(x, y, s, pose, shirt, o = {}) {
  const P = AD_POSE[pose], h = P.h, sw = (w, c) => `fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
  let g = `<g transform="translate(${x} ${y}) scale(${s})">`;
  g += P.l.map(l => `<polyline points="${adPts(l)}" ${sw(10, AD_PANTS)}/>`).join("");
  g += `<polyline points="${adPts(P.t)}" ${sw(18, shirt)}/>`;
  g += P.a.map(a => `<polyline points="${adPts(a)}" ${sw(7, shirt)}/><circle cx="${a.at(-1)[0]}" cy="${a.at(-1)[1]}" r="4" fill="${AD_SK}"/>`).join("");
  if (o.old) g += `<polyline points="${P.a[0].at(-1).join(",")} ${P.a[0].at(-1)[0] + 2},128" ${sw(3, "#8a6a3b")}/>`;
  g += `<circle cx="${h[0]}" cy="${h[1]}" r="12.5" fill="${AD_SK}"/><path d="M${h[0] - 12.5} ${h[1] - 2} a12.5 12.5 0 0 1 25 0 q-12 -6 -25 0z" fill="${o.old ? "#e6e9ee" : AD_HAIR}"/>`;
  if (o.mask) g += `<path d="M${h[0] - 9} ${h[1] + 1} h18 q0 11 -9 12 q-9 -1 -9 -12z" fill="#fff" stroke="#8aa0b4" stroke-width="1.4"/><path d="M${h[0] - 9} ${h[1] + 3} l-5 -2 M${h[0] + 9} ${h[1] + 3} l5 -2" stroke="#8aa0b4" stroke-width="1.2" fill="none"/>`;
  else g += `<path d="M${h[0] - 5} ${h[1] + 6} q5 4 10 0" stroke="#a5663b" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
  return g + `<circle cx="${h[0] - 4}" cy="${h[1] - 2}" r="1.5" fill="#222"/><circle cx="${h[0] + 4}" cy="${h[1] - 2}" r="1.5" fill="#222"/></g>`;
}
const adSun = (x, y, r, c, o = 1) => `<g opacity="${o}"><circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>${[0, 45, 90, 135, 180, 225, 270, 315].map(a => `<line x1="${x + Math.cos(a * Math.PI / 180) * (r + 4)}" y1="${y + Math.sin(a * Math.PI / 180) * (r + 4)}" x2="${x + Math.cos(a * Math.PI / 180) * (r + 9)}" y2="${y + Math.sin(a * Math.PI / 180) * (r + 9)}" stroke="${c}" stroke-width="2.4" stroke-linecap="round"/>`).join("")}</g>`;
const adCloud = (x, y, s, c = "#fff", o = 1) => `<g transform="translate(${x} ${y}) scale(${s})" opacity="${o}"><ellipse cx="0" cy="0" rx="20" ry="9" fill="${c}"/><ellipse cx="-10" cy="-6" rx="11" ry="9" fill="${c}"/><ellipse cx="7" cy="-8" rx="13" ry="10" fill="${c}"/></g>`;
const adTree = (x, y, s, c = "#3f9d4e") => `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-3" y="-4" width="6" height="22" rx="2" fill="#8a6239"/><circle cx="0" cy="-14" r="15" fill="${c}"/><circle cx="-9" cy="-6" r="10" fill="${c}"/><circle cx="9" cy="-6" r="10" fill="${c}"/></g>`;
const adHaze = (c, o) => `<rect width="200" height="150" rx="14" fill="${c}" opacity="${o}"/>`;
const adDots = (c, n, seed = 3) => Array.from({ length: n }, (_, i) => { const x = (i * 53 + seed * 31) % 196 + 2, y = (i * 37 + seed * 17) % 120 + 4; return `<circle cx="${x}" cy="${y}" r="${1.2 + (i % 3) * .5}" fill="${c}" opacity=".55"/>`; }).join("");
function adScene(i, c) {
  const sky = [["#bfe8fb", "#eaf8ff"], ["#c9ecc8", "#effaee"], ["#fff1a8", "#fffbe6"], ["#ffd2a1", "#fff1e0"], ["#f5b3b3", "#fde7e7"]][i];
  let s = `<defs><linearGradient id="adsky${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset="1" stop-color="${sky[1]}"/></linearGradient></defs><rect width="200" height="150" rx="14" fill="url(#adsky${i})"/>`;
  const ground = (col) => `<path d="M0 122 Q50 112 100 120 T200 116 V136 a14 14 0 0 1 -14 14 H14 a14 14 0 0 1 -14 -14z" fill="${col}"/>`;
  if (i === 0) { // ดีมาก: ฟ้าใส ออกกำลังกลางแจ้งได้
    s += adSun(160, 30, 13, "#ffb703") + adCloud(60, 30, .8) + ground("#79c46a") + adTree(26, 112, .9) + adTree(176, 114, .75) + adPerson(66, 20, .88, "jog", c);
  } else if (i === 1) { // ดี: เดินกลางแจ้งได้ กลุ่มเสี่ยงเฝ้าระวัง
    s += adSun(158, 30, 12, "#ffc233") + adCloud(110, 36, .9) + adCloud(40, 24, .6, "#fff", .9) + ground("#7bbf62") + adTree(184, 114, .7) + adPerson(30, 24, .8, "walk", c) + adPerson(108, 40, .72, "walk", "#7a8fa5", { old: true });
  } else if (i === 2) { // ปานกลาง: หมอกจาง ลดงานหนัก กลุ่มเสี่ยงใส่หน้ากาก
    s += adSun(160, 30, 12, "#e6b800", .8) + adCloud(60, 30, .8, "#f3e7a0") + ground("#9fb36a") + adHaze("#e9d36a", .22) +
      `<g transform="translate(14 78)"><rect x="0" y="0" width="38" height="30" rx="5" fill="#fff" stroke="#c9a700" stroke-width="2"/><g transform="translate(8 3) scale(.2)">${adPerson(0, 0, 1, "jog", "#9aa7b4")}</g><line x1="4" y1="26" x2="34" y2="4" stroke="#d10000" stroke-width="3" stroke-linecap="round"/><rect x="17" y="30" width="4" height="28" fill="#8a6239"/></g>` +
      adPerson(66, 22, .86, "walk", c) + adPerson(130, 40, .72, "stand", "#7a8fa5", { old: true, mask: true });
  } else if (i === 3) { // เริ่มมีผล: หมอกควัน ทุกคนใส่หน้ากาก
    s += adSun(165, 32, 11, "#e08a00", .55) + `<rect x="12" y="86" width="12" height="34" fill="#9a9aa8"/><rect x="28" y="96" width="10" height="24" fill="#b0b0bc"/><path d="M18 84 q-8 -12 2 -22 q8 -10 0 -20" stroke="#8a8a96" stroke-width="7" fill="none" stroke-linecap="round" opacity=".5"/>` +
      ground("#b9a56a") + adHaze("#e8b36a", .3) + adDots("#a8794a", 22, 2) + adPerson(70, 22, .86, "stand", c, { mask: true }) + adPerson(128, 40, .72, "stand", "#7a8fa5", { mask: true, old: true });
  } else { // มีผล: อยู่ในอาคาร ปิดหน้าต่าง เครื่องฟอกอากาศ
    s += adHaze("#c25a5a", .28) + adDots("#8a3f3f", 26, 5) + `<path d="M24 76 L100 22 L176 76z" fill="#8a4b4b"/><rect x="38" y="74" width="124" height="68" fill="#fff5f0" stroke="#8a4b4b" stroke-width="3"/>` +
      `<rect x="52" y="86" width="48" height="40" rx="3" fill="#dfeff7" stroke="#6c7a89" stroke-width="3"/><line x1="76" y1="86" x2="76" y2="126" stroke="#6c7a89" stroke-width="2"/><line x1="52" y1="106" x2="100" y2="106" stroke="#6c7a89" stroke-width="2"/>` +
      `<g clip-path="url(#adwin)"><clipPath id="adwin"><rect x="52" y="86" width="48" height="40"/></clipPath>${adPerson(56, 82, .5, "stand", c, { mask: true })}</g>` +
      `<rect x="118" y="100" width="28" height="36" rx="4" fill="#fff" stroke="#6c7a89" stroke-width="2.4"/><circle cx="132" cy="114" r="7" fill="none" stroke="#2f9e8f" stroke-width="2.4"/><path d="M122 126 h20 M122 130 h20" stroke="#2f9e8f" stroke-width="2"/>` +
      `<path d="M125 92 q7 -8 14 0 M121 87 q11 -13 22 0" stroke="#2f9e8f" stroke-width="2.4" fill="none" stroke-linecap="round"/><rect x="96" y="108" width="14" height="30" fill="#d9c0a8" stroke="#8a4b4b" stroke-width="2"/>`;
  }
  return `<svg viewBox="0 0 200 150" role="img" aria-hidden="true">${s}</svg>`;
}
// ไอคอนการกระทำ 28×28 (เวกเตอร์เส้นเดียว สีตามระดับ)
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
const adWho = (kind, c) => kind === "pub"
  ? `<svg viewBox="0 0 100 140" width="34" height="48" aria-hidden="true">${adPerson(0, 0, 1, "stand", c)}</svg>`
  : `<svg viewBox="0 0 150 140" width="56" height="48" aria-hidden="true">${adPerson(0, 0, 1, "walk", "#7a8fa5", { old: true })}${adPerson(88, 40, .7, "stand", c)}</svg>`;
function renderAdvice() {
  document.getElementById("advRow").innerHTML = LV.map((l, i) => {
    const list = (kind, arr) => `<div class="ad2-g"><h4>${adWho(kind, l.c)}<span>${kind === "pub" ? "ประชาชนทั่วไป" : "กลุ่มเสี่ยง*"}</span></h4><ul>${arr.map(t => `<li>${adIcon(t, l.ink)}<span>${t}</span></li>`).join("")}</ul></div>`;
    return `<article class="ad2" style="--c:${l.c};--soft:${l.soft};--tint:${l.tint};--ink:${l.ink}" aria-label="ระดับ${l.name}">
      <div class="ad2-art">${adScene(i, l.c)}</div>
      <div class="ad2-b">
        <header><span class="ad2-n">${l.name}</span><span class="ad2-r">PM<sub>2.5</sub> ${l.range} µg/m³</span></header>
        <p class="ad2-s">${l.summary || l.pub[0]}</p>
        <div class="ad2-gs">${list("pub", l.pub)}${list("risk", l.risk)}</div>
      </div></article>`;
  }).join("");
}
