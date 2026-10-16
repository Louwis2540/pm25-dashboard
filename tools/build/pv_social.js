// ---------- โพสต์ประชาชนรายจังหวัด: กราฟิกเทมเพลต สคร.7 (1080×1080) + แถบคาดการณ์ 3 วัน + QR (รวม 1080×1350 · 4:5) ----------
function fixTemplatePM(x) {   // เทมเพลตพิมพ์ "PM.25" ในก้อนเมฆ → ทาทับเป็น PM₂.₅ (ตัวห้อยตามหลักวิชาการ)
  x.fillStyle = "rgb(203,203,203)"; x.fillRect(150, 548, 162, 52);
  x.fillStyle = "rgb(65,50,0)"; x.textAlign = "left"; x.textBaseline = "alphabetic";
  x.font = "700 50px Anuphan"; const w1 = x.measureText("PM").width;
  x.font = "700 30px Anuphan"; const w2 = x.measureText("2.5").width, x0 = 231 - (w1 + 3 + w2) / 2;
  x.font = "700 50px Anuphan"; x.fillText("PM", x0, 592);
  x.font = "700 30px Anuphan"; x.fillText("2.5", x0 + w1 + 3, 602);
}
const HOT_DDC = "1422", HOT_PCD = "1650";
const RISK_DEF = "เด็กเล็ก ผู้สูงอายุ หญิงตั้งครรภ์ และผู้มีโรคระบบทางเดินหายใจหรือโรคหัวใจ";
// เทียบเมื่อวาน (ค่าจริง Air4Thai ทั้งสองวัน)
function igTrend(pv) {
  const v = S.todayRow?.[pv], y = S.prevRow?.[pv];
  if (v == null || y == null) return null;
  const d = Math.round((v - y) * 10) / 10;
  return { y, d, up: d > 0.5, dn: d < -0.5, txt: d > 0.5 ? `▲ เพิ่มขึ้นจากเมื่อวาน (${f1(y)})` : d < -0.5 ? `▼ ลดลงจากเมื่อวาน (${f1(y)})` : `● ใกล้เคียงเมื่อวาน (${f1(y)})` };
}
function fixTemplateToday(x) {   // วงกลม "วันที่" → "วันนี้" (สื่อว่าเป็นข้อมูลของวันนี้)
  x.fillStyle = "rgb(203,96,64)"; x.beginPath(); x.arc(672, 366, 44, 0, 7); x.fill();
  x.fillStyle = "#fff"; x.textAlign = "center"; x.textBaseline = "alphabetic";
  let fs = 40; do { x.font = `700 ${fs}px Anuphan`; } while (x.measureText("วันนี้").width > 76 && (fs -= 1) > 24);
  x.fillText("วันนี้", 672, 382);
  fixTemplateTime(x);
}
// เทมเพลตพิมพ์ "ข้อมูล ณ เวลา 07.00 น." ไว้ตายตัว → ถ้า REPORT_TIME ไม่ใช่ 07.00 จึงทาสีพื้นกล่องทับแล้วเขียนเวลาที่ถูกต้อง
function fixTemplateTime(x) {
  if (typeof REPORT_TIME !== "string" || REPORT_TIME.startsWith("07")) return;   // เทมเพลตพิมพ์ 07.00 น. ไว้ตรงกับข้อมูลอยู่แล้ว
  const [r, g, b] = x.getImageData(396, 712, 1, 1).data;
  x.fillStyle = `rgb(${r},${g},${b})`; x.fillRect(400, 698, 290, 44);
  x.fillStyle = "#fff"; x.textAlign = "left"; x.textBaseline = "alphabetic";
  const t = `ข้อมูล ณ เวลา ${typeof REPORT_TIME === "string" ? REPORT_TIME : "07.00 น."}`;
  let fs = 31; do { x.font = `500 ${fs}px 'LINE Seed Sans TH', Anuphan`; } while (x.measureText(t).width > 270 && (fs -= 1) > 20);
  x.fillText(t, 410, 731);
}
async function provinceSocial(pvName) {
  const card = await provinceCard(pvName);
  await Promise.all(["700 30px Anuphan", "600 22px Anuphan"].map(f => document.fonts.load(f)));
  const W = 1080, H = 1350, c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d"); x.drawImage(card, 0, 0);
  const pv = PROV.find(p => p.name === pvName), it = S.gpv?.items.find(i => i.code === String(pv.code));
  const v = S.todayRow?.[pvName], lv = lvOf(v), tr = igTrend(pvName);
  const TEAL = "#25586a", INK = "#33415c";
  { const bg = x.createLinearGradient(0, 1080, W, H); bg.addColorStop(0, "#f6f3ee"); bg.addColorStop(.55, "#eef2f8"); bg.addColorStop(1, "#f3eef8"); x.fillStyle = bg; x.fillRect(0, 1080, W, H - 1080); }
  x.fillStyle = TEAL; x.fillRect(0, 1080, W, 6);
  x.textAlign = "left"; x.textBaseline = "alphabetic";
  // แถบล่าง 3 อย่าง ตัวใหญ่อ่านได้บนมือถือ: แนวโน้มจากเมื่อวาน · คาดการณ์ 3 วัน (เป็นระดับ) · สายด่วน
  if (tr) { x.font = "700 32px Anuphan"; x.fillStyle = tr.up ? "#c2410c" : tr.dn ? "#0e7a3a" : INK; x.fillText(`วันนี้ ${tr.up ? "▲ สูงขึ้นกว่าเมื่อวาน" : tr.dn ? "▼ ลดลงจากเมื่อวาน" : "● ใกล้เคียงเมื่อวาน"}`, 40, 1128); }
  if (it) {
    const base = new Date((S.gpv.asOf || "").slice(0, 10) + "T00:00:00");
    it.pred.slice(0, 3).forEach((p, k) => {
      const d = new Date(base.getTime() + (k + 1) * 864e5), l = p == null ? null : LV[lvOf(p)];
      const bx = 40 + k * 276, by = 1146, bw = 264, bh = 108;
      x.save(); x.shadowColor = "rgba(15,27,45,.32)"; x.shadowBlur = 26; x.shadowOffsetY = 10;
      x.beginPath(); x.roundRect(bx, by, bw, bh, 24); x.fillStyle = l ? l.soft : "#eceff3"; x.fill(); x.restore();
      const gl = x.createLinearGradient(0, by, 0, by + bh); gl.addColorStop(0, "rgba(255,255,255,.85)"); gl.addColorStop(.5, "rgba(255,255,255,.15)"); gl.addColorStop(1, "rgba(255,255,255,0)");
      x.beginPath(); x.roundRect(bx, by, bw, bh, 24); x.fillStyle = gl; x.fill();
      x.lineWidth = 3; x.strokeStyle = "rgba(255,255,255,.95)"; x.stroke(); x.beginPath(); x.roundRect(bx - .5, by - .5, bw + 1, bh + 1, 24); x.lineWidth = 1; x.strokeStyle = "rgba(15,27,45,.14)"; x.stroke();
      x.beginPath(); x.roundRect(bx + 3, by + bh - 9, bw - 6, 6, 3); x.fillStyle = l ? l.c : "#ccd4de"; x.fill();
      x.fillStyle = l ? l.ink : "#5f6c80"; x.font = "700 26px Anuphan";
      x.fillText(k === 0 ? "พรุ่งนี้" : `${TH_D[d.getDay()]} ${d.getDate()} ${TH_M[d.getMonth()]}`, bx + 18, by + 38);
      let fs = 32; const name = l ? l.name : "–";
      do { x.font = `700 ${fs}px Anuphan`; } while (x.measureText(name).width > bw - 36 && (fs -= 1) > 20);
      x.fillText(name, bx + 18, by + 86);
    });
  }
  x.fillStyle = TEAL; x.font = "700 30px Anuphan"; x.fillText(`ปรึกษาปัญหาสุขภาพ สายด่วน ${HOT_DDC}`, 40, 1308);
  x.fillStyle = "#6b7689"; x.font = "600 20px Anuphan"; x.fillText("คาดการณ์: GISTDA (ค่าประมาณจากดาวเทียม)", 40, 1338);
  // QR ไปแดชบอร์ด
  try {
    const q = qrcode(0, "M"); q.addData(IG_URL); q.make();
    const n = q.getModuleCount(), S_ = 150, cs = S_ / n, qx = 890, qy = 1110;
    x.save(); x.shadowColor = "rgba(15,27,45,.25)"; x.shadowBlur = 18; x.shadowOffsetY = 6; x.fillStyle = "#fff"; x.beginPath(); x.roundRect(qx - 12, qy - 12, S_ + 24, S_ + 24, 22); x.fill(); x.restore();
    x.fillStyle = "#0f1b2d";
    for (let r = 0; r < n; r++) for (let cc = 0; cc < n; cc++) if (q.isDark(r, cc)) x.fillRect(qx + cc * cs, qy + r * cs, cs + .3, cs + .3);
    x.textAlign = "center"; x.fillStyle = TEAL; x.font = "700 22px Anuphan"; x.fillText("สแกนดูข้อมูลเพิ่มเติม", qx + S_ / 2, qy + S_ + 40);
  } catch {}
  return c;
}
// จ. ข้อความโพสต์ (แคปชัน) — ใช้ข้อความเดียวกันทุกจังหวัด และช่วยผู้ใช้โปรแกรมอ่านหน้าจอ
function igCaption() {
  const F = igFocus(), L = LV[F.lv], pvn = F.f?.p.name, v = F.f?.v, tr = pvn ? igTrend(pvn) : null;
  const d = S.todayRow ? new Date(S.todayRow.date + "T00:00:00") : null;
  const ds = d ? `${TH_D[d.getDay()]}ที่ ${d.getDate()} ${TH_MF[d.getMonth()]} ${d.getFullYear() + 543}` : "";
  const it = S.gpv?.items.find(i => i.code === String(F.f?.p.code)), p1 = it?.pred?.[0];
  const head = F.region
    ? `สถานการณ์ฝุ่น PM₂.₅ เขตสุขภาพที่ 7 วัน${ds} (ค่าเฉลี่ย 24 ชม. ณ ${REPORT_TIME})\n` + PROV.map(p => { const x = S.todayRow?.[p.name]; return x == null ? "" : `• ${p.name} ${f1(x)} µg/m³ ${LV[lvOf(x)].name}`; }).filter(Boolean).join("\n")
    : `สถานการณ์ฝุ่น PM₂.₅ จ.${pvn} วัน${ds} (ค่าเฉลี่ย 24 ชม. ณ ${REPORT_TIME})\n${f1(v)} µg/m³ · ระดับ${L.name}${tr ? ` · ${tr.up ? "สูงขึ้นกว่าเมื่อวาน" : tr.dn ? "ลดลงจากเมื่อวาน" : "ใกล้เคียงเมื่อวาน"}` : ""}`;
  return [head,
    `\nคำแนะนำ${F.region ? ` (ตามระดับสูงสุดในเขต จ.${pvn})` : ""}`,
    `ประชาชนทั่วไป: ${L.pub.join(" / ")}`,
    `กลุ่มเสี่ยง*: ${L.risk.join(" / ")}`, `*${RISK_DEF}`,
    p1 != null ? `\nพรุ่งนี้คาดว่า${F.region ? ` จ.${pvn} ` : ""}จะอยู่ในระดับ${LV[lvOf(p1)].name}` : "",
    F.lv >= 3 ? "ร่วมงดเผาในที่โล่ง ลดฝุ่นเพื่อคนในชุมชน" : "",
    `\nปรึกษาปัญหาสุขภาพ สายด่วนกรมควบคุมโรค ${HOT_DDC}`,
    `ดูข้อมูลเพิ่มเติม: ${IG_URL}`,
    `#ฝุ่นPM25 #สคร7 #กรมควบคุมโรค${pvn && !F.region ? ` #${pvn}` : ""}`].filter(Boolean).join("\n");
}
