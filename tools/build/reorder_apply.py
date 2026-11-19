"""เรียงโซนของหน้าใหม่ (เดโม่ 20 พ.ย. 2569) — เปลี่ยนเฉพาะ "ลำดับ" ไม่แก้เนื้อหาในบล็อก
ลำดับตามที่ Louis กำหนด:
  ภาค A · ฝุ่นและความร้อน   1 ฝุ่นภาพรวม (การ์ดวันนี้ → กราฟเส้นแนวโน้ม → สรุปช่วงที่แสดง) · 2 เจาะลึกรายจังหวัด · 3 ย้อนหลัง 7 วัน/คาดการณ์ 3 วัน · 4 ความร้อน/ค่าฝุ่นรายชั่วโมง (แผนที่)
  ภาค B · ผลต่อสุขภาพ       5 ผู้ป่วย (รายเดือน · รายสัปดาห์เทียบค่าฝุ่น) · 6 คำแนะนำการปฏิบัติตัว
ค่าเริ่มต้นที่เลือกไว้ (รอ Louis ยืนยัน): การ์ดวันนี้อยู่ต้นโซน 1 · สรุปช่วงที่แสดงอยู่ใต้กราฟเส้น · แถบภาค A/B บนหน้าและกลุ่มในเมนูซ้าย
ข้อความเดียวที่ปรับให้ตรงตำแหน่งใหม่: หัวโซนคำแนะนำ "จากการ์ดด้านบน" → "จากการ์ดในส่วนฝุ่นภาพรวม"
"""
import re

ORDER = ["zToday", "zTrend", "zSummary", "zDrill", "zWeek", "zMap", "zDisease", "zAdvice"]
MENU = ('const SB_MENU = [["zToday", "ฝุ่นภาพรวม"], ["zDrill", "เจาะลึกรายจังหวัด"], ["zWeek", "ย้อนหลัง 7 วัน · คาดการณ์ 3 วัน"],\n'
        '  ["zMap", "ความร้อน · ค่าฝุ่นรายชั่วโมง"], ["zDisease", "ผู้ป่วย"], ["zAdvice", "คำแนะนำการปฏิบัติตัว"], ["zData", "ดาวน์โหลดข้อมูล"]];\n'
        'const SB_GRP = { zToday: "ภาค A · ฝุ่นและความร้อน", zDisease: "ภาค B · ผลต่อสุขภาพ" };')
PART_A = '\n  <div class="part part-a" id="partA" role="separator" aria-label="ภาค A ฝุ่นและความร้อน"><span>ภาค A · ฝุ่นและความร้อน</span></div>\n'
PART_B = '\n  <div class="part part-b" id="partB" role="separator" aria-label="ภาค B ผลต่อสุขภาพ"><span>ภาค B · ผลต่อสุขภาพ</span></div>\n'
CSS = """
/* ===== เรียงโซนใหม่: แถบภาค A/B + กลุ่มในเมนูซ้าย ===== */
.part{display:flex;align-items:center;gap:12px;margin:2px 0 -10px;font:600 calc(13px*var(--fs,1)) "IBM Plex Sans Thai",sans-serif;letter-spacing:.02em}
.part::before,.part::after{content:"";flex:1;border-top:2px dotted var(--line-strong,#b8c4d3)}
.part span{padding:3px 16px;border-radius:999px;border:1px solid currentColor;background:#fff}
.part-a{color:#1c6ed6}.part-b{color:#c2415d}
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
    missing = [k for k in ORDER if k not in blocks]
    if missing:
        raise SystemExit(f"reorder_apply: ไม่พบส่วน {missing}")
    if rest.strip() and 'id="zData"' not in rest:
        raise SystemExit("reorder_apply: มีเนื้อหาใน <main> นอกเหนือจากส่วนที่รู้จัก: " + rest.strip()[:120])
    out = PART_A
    for k in ORDER:
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
