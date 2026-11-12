// ===== ส่วน 8 · ตารางรายเดือน เฉพาะช่วงฤดูฝุ่น (พ.ย.–พ.ค.) ตั้งแต่ พ.ย. 2568 → เดือนล่าสุด แทนกราฟ =====
// ประกาศ dzMonthAll และ e2xBlock ใหม่ (ประกาศหลังตัวเดิม → ตัวนี้ถูกใช้) — ฟังก์ชันกราฟเดิมยังอยู่ในไฟล์แต่ไม่ถูกเรียก
// ระดับเขต: ผู้ป่วย 4 กลุ่มโรครายเดือน + ค่าฝุ่นเฉลี่ยรายเดือน (นิยามเดียวกับกราฟเดิม: monthlyWk / dzPmMonth)
// แผงรายจังหวัด (e2x) ถูกตัดออก → e2xBlock คืนค่าว่าง
const DZT_START = [2025, 10];   // พ.ย. 2568 (เดือน 0–11) — ยาวไปจนถึงเดือนล่าสุดที่ข้อมูลนิ่งแล้ว
const dztLbl = ({ y, m }) => `${TH_M[m]} ${y + 543}`;
function dztMonths(dz, wkMax) {
  const e = dzCbEnd(dz, wkMax); if (!e.w) return [];
  const last = epiMonth(e.y, e.w), a = [];
  for (let y = DZT_START[0], m = DZT_START[1]; y < e.y || (y === e.y && m <= last);) { if (dzSeason(m)) a.push({ y, m }); if (++m > 11) { m = 0; y++; } }   // เฉพาะเดือนช่วงฤดูฝุ่น พ.ย.–พ.ค. (dzSeason)
  return a;
}
const dztMark = (prov, short) => (prov || short) ? `<sup>${prov ? "*" : ""}${short ? "†" : ""}</sup>` : "";
const dztMonthTh = (mo, c0, prov, short) => `<th scope="row"><span class="dzt-m">${dztLbl(mo)}${dztMark(prov, short)}</span>${c0 ? `<small>สัปดาห์ที่ ${c0.w0}${c0.w1 !== c0.w0 ? "–" + c0.w1 : ""}</small>` : ""}</th>`;
const dztNA = `<td class="na" title="ไม่มีข้อมูล">–</td>`;
const dztPmTd = (v, cls = "") => { if (v == null) return dztNA; const l = LV[lvOf(v)]; return `<td class="${cls}" style="background:${l.soft};color:${l.ink}"><b>${f1(v)}</b></td>`; };

// ---------- 8ก · ระดับเขต ----------
function dzMonthAll(dz, wkMax) {
  const months = dztMonths(dz, wkMax); if (!months.length) return "";
  const end = dzCbEnd(dz, wkMax), memo = {};
  const mw = (d, y) => memo[y + d.key] ||= monthlyWk(dz[y] || [], d.key, y === end.y ? end.w : 99, y);
  const pm = dzPmMonth(months);
  const asOf = (() => { const p = String(dz.meta?.dataDate || "").split("/"); return p.length === 3 ? `${+p[0]} ${TH_M[+p[1] - 1]} ${+p[2] + 543}` : ""; })();
  let anyProv = false, anyShort = false;
  const body = months.map((mo, i) => {
    const cs = DZ.map(d => mw(d, mo.y)[mo.m]), prov = cs.some(c => c?.prov), short = cs.some(c => c?.short);
    anyProv ||= prov; anyShort ||= short;
    return `<tr${prov ? ' class="prov"' : ""}>${dztMonthTh(mo, cs.find(Boolean), prov, short)}${cs.map(c => c ? `<td><b>${fmt(c.sum)}</b><small>${fmt(Math.round(c.avg))}/สัปดาห์</small></td>` : dztNA).join("")}${dztPmTd(pm[i]?.avg, "pmc")}</tr>`;
  }).join("");
  const f = months[0], l = months.at(-1), rng = `${TH_M[f.m]} ${f.y + 543} – ${TH_M[l.m]} ${l.y + 543}`;
  const head = `<tr><th>เดือน</th>${DZ.map(d => `<th><i class="dzt-dot" style="background:${d.c}"></i>${dzName(d)}<small>ราย/เดือน</small></th>`).join("")}<th>ค่าฝุ่น <span class="pm25">PM<sub>2.5</sub></span> เฉลี่ย<small>µg/m³ · ทั้งเขต</small></th></tr>`;
  return `<article class="card dz dz-all dzt-card" style="--dsoft:#eef2f7;--dc:#5f6c80">
    <div class="dz-top"><div class="dz-icon" style="background:#e6ebf2;color:#33415c"><svg><use href="#i-chart"/></svg></div>
      <div><h3>ผู้ป่วย 4 กลุ่มโรค เทียบค่าฝุ่น <span class="pm25">PM<sub>2.5</sub></span> รายเดือน</h3><div class="icd">ทั้งเขตสุขภาพที่ 7 · <b>เฉพาะช่วงฤดูฝุ่น (1 พ.ย.–31 พ.ค.)</b> ${months.length} เดือน (${rng}) · หน่วย: <b>ราย/เดือน</b> (ยอดรวมทั้งเดือน · ตัวเล็ก = ค่าเฉลี่ยราย/สัปดาห์) · ผู้ป่วยสัญชาติไทยทุกคนที่รับบริการในเขต รวมผู้อยู่นอกพื้นที่</div></div><button type="button" class="ds-jump" data-preset="weekly" style="margin-left:auto"><svg class="ico"><use href="#i-down"/></svg>ดาวน์โหลดข้อมูล</button></div>
    <div class="dzt-wrap"><table class="dzt num"><thead>${head}</thead><tbody>${body}</tbody></table></div>
    <div class="dz-note"><b>หมายเหตุ</b> ข้อมูลจาก HDC${asOf ? ` ณ ${asOf}` : ""} อาจยังไม่สมบูรณ์ หน่วยบริการบางแห่งรายงานยังไม่ครบ
      <span class="nw">นับตามสัปดาห์ระบาดวิทยา (อาทิตย์–เสาร์) สัปดาห์ที่คาบเกี่ยวสองเดือนนับเข้าเดือนที่มีวันมากกว่า · เดือนที่มี 5 สัปดาห์ยอดรวมจะสูงกว่าเดือนที่มี 4 สัปดาห์ ถ้าจะเทียบข้ามเดือนให้ดูค่าเฉลี่ยราย/สัปดาห์</span>${anyProv ? ` <span class="nw"><b>*</b> ${DZ_PROV_WK} สัปดาห์ล่าสุด (สัปดาห์ที่ ${Math.max(1, end.w - DZ_PROV_WK + 1)}–${end.w} · ${epiRange(end.y, Math.max(1, end.w - DZ_PROV_WK + 1), end.w)}) เป็นข้อมูลเบื้องต้น ตัวเลขมักเพิ่มขึ้นเมื่อรายงานครบ จึงไม่ใช้สรุปแนวโน้ม</span>` : ""}${anyShort ? ` <span class="nw"><b>†</b> มีสัปดาห์ไม่เต็ม 7 วันรวมอยู่ (สัปดาห์ที่ 1 และสัปดาห์สุดท้ายของปี) ยอดรวมต่ำกว่าจริงเล็กน้อย</span>` : ""}
      <span class="nw"><b>ค่าฝุ่น</b> = เฉลี่ย 4 จังหวัด (ค่าเฉลี่ย 24 ชม. ณ 07.00 น. จากสถานี Air4Thai ร่วมกับดาวเทียม GISTDA) · <b>การอ่านผล</b> เปรียบเทียบเชิงสถานการณ์เพื่อเฝ้าระวัง ไม่ได้ทดสอบความสัมพันธ์เชิงสาเหตุกับฝุ่น</span></div>
    <div class="tip"></div></article>`;
}

// ---------- 8ข (แผงค่าฝุ่นกับผู้ป่วยรายจังหวัด) · ตัดออกตามสั่ง — เหลือตารางระดับเขต 8ก อย่างเดียว ----------
function e2xBlock() { return ""; }
