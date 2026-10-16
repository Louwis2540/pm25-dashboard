"""PHEOC บนเว็บใช้เกณฑ์เดียวกับ LINE (/api/pheoc: เฉลี่ย 24 ชม. ณ 07:00 ≥ 75.1 ติดกัน 2 วัน)
+ ค่ารายวันบนเว็บ = ค่า ณ 07.00 น. (PM25_History เปลี่ยนเป็นค่า 07:00 ตั้งแต่ 16 ต.ค. 2569 · เติมย้อนถึง 2 ส.ค.)
ใช้ร่วมเดโม่และโค้ดจริง: html = apply(html)"""
import re

CSS = """
.fact .fact-s{display:block;font-size:11px;letter-spacing:-.1px;font-weight:600;color:var(--ink-3);margin-top:1px;line-height:1.3}
.fact.ph-hit{background:#fdecec;border-color:#f3b9b9}.fact.ph-hit b{color:#a30d0d}
"""

JS = r'''
// ---------- PHEOC: เกณฑ์เดียวกับรายงาน LINE (server /api/pheoc) ----------
// ค่าเฉลี่ย 24 ชม. ณ 07.00 น. จาก Air4Thai ถึง 75.1 µg/m³ ติดกัน 2 วัน · ดึงค่าจากสถานีโดยตรง
const pheocHit = () => S.pheoc?.ok ? S.pheoc.anyHit : null;
function pheocLabel(yes, no) {
  if (!S.pheoc) return "กำลังตรวจ…";
  if (!S.pheoc.ok) return "ตรวจไม่ได้ขณะนี้";
  return S.pheoc.anyHit ? `${yes} · จ.${S.pheoc.hit.join(", ")}` : no;
}
function pheocTitle() {
  if (!S.pheoc?.ok) return "";
  const th = d => `${+d.slice(8)} ${TH_M[+d.slice(5, 7) - 1]}`;
  return "ค่าเฉลี่ย 24 ชม. ณ 07.00 น. (Air4Thai)\n" + S.pheoc.provinces.map(p => `${p.name}: ` + p.days.map(x => `${th(x.date)} ${x.v == null ? "ไม่มีข้อมูล" : x.v}`).join(" · ")).join("\n");
}
'''

PH_RULE = "07.00 น. ≥75.1 ติด 2 วัน"

def apply(html, mock=False):
    n0 = html.count("07.00 น.")
    # 1) ค่ารายวันบนเว็บ = ค่าเฉลี่ย 24 ชม. ณ 07.00 น. (Louis 16 ต.ค. 2569) — PM25_History เปลี่ยนเป็นค่า 07:00 แล้ว
    html = html.replace("// ชีต PM25_History เก็บค่าเฉลี่ย 24 ชม. ณ 07:00 (ดู plan07Row_ ใน tools/line_report.gs)",
                        "// ชีต PM25_History = ค่าเฉลี่ย 24 ชม. ณ 07:00 จากสถานี Air4Thai ร่วมกับดาวเทียม GISTDA ในวันที่สถานีไม่มีข้อมูล")
    # 1b) แหล่งข้อมูล: ช่วงก่อน 2 ส.ค. เป็นค่ารอบบ่าย · ช่วงที่ใช้ค่าดาวเทียม GISTDA
    src = "ค่าฝุ่นรายจังหวัดเป็นค่าเฉลี่ย 24 ชั่วโมง ณ เวลา 07.00 น. ของแต่ละวัน"
    assert html.count(src) == 1, html.count(src)
    html = html.replace(src, src + " จากสถานีตรวจวัด Air4Thai กรมควบคุมมลพิษ ร่วมกับค่าจากดาวเทียม GISTDA ในวันที่สถานีไม่มีข้อมูล")
    # 2) PHEOC: เลิกตัดสินจากค่าในชีตวันเดียว
    expr = r"PROV\.some\(p => \(S\.todayRow\?\.\[p\.name\] \?\? 0\) >= 75\.1\)"
    html, k1 = re.subn(r'(\b(?:pheoc0?)|' + expr + r') \? "([^"]+)" : "([^"]+)"', lambda m: f'pheocLabel("{m.group(2)}", "{m.group(3)}")', html)
    html, k2 = re.subn(expr, "pheocHit()", html)
    assert k1 >= 2, k1
    # การ์ดหน้าแรก: บรรทัดเกณฑ์ + tooltip ค่ารายจังหวัด + สีเมื่อถึงเกณฑ์
    old = '<div class="fact"><span class="fi" style="background:#e7f0fc;color:#1c6ed6"><svg class="ico"><use href="#i-shield"/></svg></span><div><span>เกณฑ์เปิด PHEOC</span><b>${pheocLabel("มีจังหวัดถึงเกณฑ์", "ยังไม่เข้าเกณฑ์")}</b></div></div>'
    assert html.count(old) == 1, html.count(old)
    html = html.replace(old, '<div class="fact${pheoc ? " ph-hit" : ""}" title="${esc(pheocTitle())}"><span class="fi" style="background:#e7f0fc;color:#1c6ed6"><svg class="ico"><use href="#i-shield"/></svg></span><div><span>เกณฑ์เปิด PHEOC</span><b>${pheocLabel("ถึงเกณฑ์", "ยังไม่เข้าเกณฑ์")}</b><small class="fact-s">' + PH_RULE + '</small></div></div>')
    for a in ["เกณฑ์เปิด PHEOC (&gt;75 µg/m³)", "เกณฑ์เปิด PHEOC (เกิน 75)"]:
        html = html.replace(a, "เกณฑ์เปิด PHEOC (07.00 น. ≥75.1 · 2 วันติด)")
    # 3) ฟังก์ชัน + โหลดเบื้องหลัง
    anchor = "function renderToday() {"
    assert html.count(anchor) == 1
    html = html.replace(anchor, JS + anchor)
    a2 = '  document.body.classList.remove("is-loading");\n'
    assert html.count(a2) == 1
    html = html.replace(a2, a2 + '  getJSON("/api/pheoc").then(d => { S.pheoc = d?.ok ? d : { ok: false }; if (S.todayRow) renderToday(); });\n')
    return html
