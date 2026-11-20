"""เรียงโซนของหน้าใหม่ (เดโม่ 20 พ.ย. 2569) — เปลี่ยนเฉพาะ "ลำดับ" ไม่แก้เนื้อหาในบล็อก
ลำดับตามที่ Louis กำหนด:
  ด้านมลพิษสิ่งแวดล้อม (เดิม "ภาค A")   1 ฝุ่นภาพรวม (การ์ดวันนี้ → กราฟเส้นแนวโน้ม → สรุปช่วงที่แสดง) · 2 เจาะลึกรายจังหวัด · 3 ย้อนหลัง 7 วัน/คาดการณ์ 3 วัน · 4 ความร้อน/ค่าฝุ่นรายชั่วโมง (แผนที่)
  ด้านผลกระทบสุขภาพ (เดิม "ภาค B")   5 ผู้ป่วย (รายเดือน · รายสัปดาห์เทียบค่าฝุ่น) · 6 คำแนะนำการปฏิบัติตัว
ค่าเริ่มต้นที่เลือกไว้ (รอ Louis ยืนยัน): การ์ดวันนี้อยู่ต้นโซน 1 · สรุปช่วงที่แสดงอยู่ใต้กราฟเส้น · แถบหัวด้าน (มลพิษสิ่งแวดล้อม / ผลกระทบสุขภาพ) บนหน้าและกลุ่มในเมนูซ้าย
ข้อความเดียวที่ปรับให้ตรงตำแหน่งใหม่: หัวโซนคำแนะนำ "จากการ์ดด้านบน" → "จากการ์ดในส่วนฝุ่นภาพรวม"
"""
import re

ORDER = ["zToday", "zTrend", "zDrill", "zWeek", "zMap", "zDisease", "zAdvice"]   # zSummary ย้ายเข้าไปติดกับกราฟเส้นใน zTrend
MENU = ('const SB_MENU = [["zToday", "ฝุ่นภาพรวม"], ["zDrill", "เจาะลึกรายจังหวัด"], ["zWeek", "ย้อนหลัง 7 วัน · คาดการณ์ 3 วัน"],\n'
        '  ["zMap", "ความร้อน · ค่าฝุ่นรายชั่วโมง"], ["zDisease", "ผู้ป่วย"], ["zAdvice", "คำแนะนำการปฏิบัติตัว"], ["zData", "ดาวน์โหลดข้อมูล"]];\n'
        'const SB_GRP = { zToday: "ด้านมลพิษสิ่งแวดล้อม", zDisease: "ด้านผลกระทบสุขภาพ" };')
PART_A = '\n  <div class="part part-a" id="partA" role="separator" aria-label="ด้านมลพิษสิ่งแวดล้อม"><span>ด้านมลพิษสิ่งแวดล้อม</span></div>\n'
PART_B = '\n  <div class="part part-b" id="partB" role="separator" aria-label="ด้านผลกระทบสุขภาพ"><span>ด้านผลกระทบสุขภาพ</span></div>\n'
CSS = """
/* ===== เรียงโซนใหม่: แถบภาค A/B + กลุ่มในเมนูซ้าย ===== */
.part{display:flex;align-items:center;gap:12px;margin:2px 0 -10px;font:600 calc(13px*var(--fs,1)) "IBM Plex Sans Thai",sans-serif;letter-spacing:.02em}
.part::before,.part::after{content:"";flex:1;border-top:2px dotted var(--line-strong,#b8c4d3)}
.part span{padding:3px 16px;border-radius:999px;border:1px solid currentColor;background:#fff}
.part-a{color:#1c6ed6}.part-b{color:#c2415d}
/* สรุปช่วงที่แสดง: คอลัมน์แคบอยู่ฝั่งซ้ายของกราฟเส้น (จอกว้าง) · จอแคบเรียงต่อใต้กราฟ */
#zTrend{container:trone/inline-size}
.trend.tr-one{grid-template-columns:minmax(270px,330px) minmax(0,1fr);align-items:start}
.trend.tr-one .chart-main{grid-column:2;grid-row:1;min-width:0}
.trend.tr-one .trend-sum{grid-column:1;grid-row:1}
.trend-sum{display:flex;flex-direction:column;gap:8px;min-width:0}
.trend-sum .sum-h{display:flex;flex-direction:column;gap:2px;padding:2px 6px 0}
.trend-sum .sum-h h3{margin:0;font:700 calc(19px*var(--fs,1)) "Anuphan","IBM Plex Sans Thai",sans-serif}
.trend-sum .sum-h p{margin:0;font-size:calc(12.5px*var(--fs,1));line-height:1.45;color:var(--ink-3,#6b7689)}
.trend-sum #trStats{padding:12px 12px 14px!important}
.trend-sum #trStats .label{font-size:calc(13.5px*var(--fs,1))!important;line-height:1.4}
.trend-sum .tr-st{display:block;margin-top:8px;border-spacing:0}
.trend-sum .tr-st thead{display:none}
.trend-sum .tr-st tbody{display:flex;flex-direction:column;gap:8px}
.trend-sum .tr-st tr{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;padding:7px;border-radius:16px;background:rgba(255,255,255,.55);border:1px solid rgba(255,255,255,.85);box-shadow:inset 0 1px 0 #fff}
.trend-sum .tr-st td{display:block;padding:5px 2px 6px;border-radius:10px;font-size:calc(15px*var(--fs,1));line-height:1.25}
.trend-sum .tr-st td:first-child{grid-column:1/-1;padding:1px 4px 2px;background:transparent;border-radius:0;font-size:calc(15px*var(--fs,1))}
.trend-sum .tr-st td.muted{grid-column:1/-1}
.trend-sum .tr-st td:nth-child(n+2)::before{display:block;margin-bottom:2px;font:600 calc(11px*var(--fs,1)) "IBM Plex Sans Thai",sans-serif;color:var(--ink-2,#46566a);opacity:.9}
.trend-sum .tr-st td:nth-child(2)::before{content:"ต่ำสุด"}
.trend-sum .tr-st td:nth-child(3)::before{content:"สูงสุด"}
.trend-sum .tr-st td:nth-child(4)::before{content:"วันเกิน 75"}
.trend-sum .tr-st td small{font-size:calc(10.5px*var(--fs,1))}
.trend-sum .tr-st td .ov-btn{padding:3px 6px 2px}
.trend-sum .tr-st tr.ov-det{display:block;padding:0;background:none;border:0;box-shadow:none}
.trend-sum .tr-st tr.ov-det[hidden]{display:none}
.trend-sum .tr-st tr.ov-det td{display:block}
.trend-sum .tr-st tr.ov-det td::before{content:none!important}
.trend-sum .ov-box{min-width:0}
.trend-sum .ov-h{white-space:normal;overflow-wrap:anywhere;line-height:1.4}
.trend-sum #trStats .tr-note{font-size:calc(11.5px*var(--fs,1));line-height:1.5}
@container trone (max-width:900px){
  .trend.tr-one{grid-template-columns:minmax(0,1fr)}
  .trend.tr-one .chart-main,.trend.tr-one .trend-sum{grid-column:1}
  .trend.tr-one .trend-sum{grid-row:2}
}
.sb-c li.sb-grp{list-style:none;margin:12px 4px 2px;font:600 calc(11.5px*var(--fs,1)) "IBM Plex Sans Thai",sans-serif;letter-spacing:.04em;color:#5f6c80;text-transform:none}
.sb-c li.sb-grp:first-child{margin-top:2px}
"""


def apply(html):
    i = html.index('<main class="wrap"'); j = html.index("</main>", i)
    m = html[i:j]
    head_end = m.index(">") + 1
    head, body = m[:head_end], m[head_end:]
    # แยกเป็นบล็อก: [คอมเมนต์นำหน้า +] <section id="zX">…</section>
    blocks = {}
    for mm in re.finditer(r'(?:[ \t]*<!--[^>]*-->\s*)?[ \t]*<section id="(z\w+)".*?\n  </section>\n?', body, re.S):
        blocks[mm.group(1)] = mm.group(0)
    rest = body
    for b in blocks.values():
        rest = rest.replace(b, "", 1)
    # "สรุปช่วงที่แสดง" อยู่ติดใต้กราฟเส้นในส่วนเดียวกัน (Louis 20 พ.ย. 2569) — ย้ายการ์ด #trStats เข้า zTrend คงถ้อยคำหัวข้อเดิม
    sm = re.search(r"<h2>(.*?)</h2><p>(.*?)</p>", blocks["zSummary"], re.S)
    if not sm or 'id="trStats"' not in blocks["zSummary"]:
        raise SystemExit("reorder_apply: โครงสร้าง zSummary ไม่ตรงที่คาด")
    tz = blocks["zTrend"]
    if tz.count('<div class="trend">') != 1 or not tz.rstrip().endswith("    </div>\n  </section>"):
        raise SystemExit("reorder_apply: โครงสร้าง zTrend ไม่ตรงที่คาด")
    tz = tz.replace('<div class="trend">', '<div class="trend tr-one">', 1)
    cut = tz.rindex("    </div>\n  </section>")
    tz = tz[:cut] + ('      <div class="trend-sum" id="zSummary"><div class="sum-h"><h3>' + sm.group(1) + '</h3><p>' + sm.group(2) + '</p></div>'
                     '<div class="card chart-card" id="trStats"></div></div>\n') + tz[cut:]
    blocks["zTrend"] = tz
    missing = [k for k in ORDER if k not in blocks]
    if missing:
        raise SystemExit(f"reorder_apply: ไม่พบส่วน {missing}")
    if rest.strip() and 'id="zData"' not in rest:
        raise SystemExit("reorder_apply: มีเนื้อหาใน <main> นอกเหนือจากส่วนที่รู้จัก: " + rest.strip()[:120])
    out = PART_A
    for k in ORDER:   # zSummary ไม่ถูกวางแยกอีกแล้ว
        if k == "zDisease":
            out += PART_B
        out += blocks[k]
    html = html[:i] + head + out + rest + html[j:]   # rest = แผงดาวน์โหลด (zData) ที่อยู่ท้าย <main> เดิม
    # เมนูซ้าย
    mm = re.search(r"const SB_MENU = \[\[.*?\]\];", html, re.S)
    if not mm:
        raise SystemExit("reorder_apply: ไม่พบ SB_MENU")
    html = html[:mm.start()] + MENU + html[mm.end():]
    a = '<ul>${SB_MENU.map(([id, t]) => `<li><a href="#${id}"'
    if html.count(a) != 1:
        raise SystemExit("reorder_apply: ไม่พบแม่แบบรายการเมนู")
    html = html.replace(a, '<ul>${SB_MENU.map(([id, t]) => (SB_GRP[id] ? `<li class="sb-grp">${SB_GRP[id]}</li>` : "") + `<li><a href="#${id}"')
    # ข้อความหัวโซนคำแนะนำ (ปรับให้ตรงตำแหน่งใหม่เท่านั้น)
    old = "ดูระดับของจังหวัดจากการ์ดด้านบน"
    if html.count(old) != 1:
        raise SystemExit(f"reorder_apply: ข้อความคำแนะนำพบ {html.count(old)} ที่")
    html = html.replace(old, "ดูระดับของจังหวัดจากการ์ดในส่วนฝุ่นภาพรวม")
    k = html.rindex("</style>", 0, html.index('<body id="top"'))
    return html[:k] + CSS + html[k:]
