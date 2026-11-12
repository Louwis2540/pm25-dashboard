"""จัดลำดับหน้าแดชบอร์ดใหม่ (ขั้น 1 · เดโม่) — html = apply(html)

ลำดับใหม่:
  1 การ์ดจังหวัด + กล่อง facts (ใต้การ์ด)        zToday
  2 กราฟเส้นแนวโน้ม                              zTrend
  3 ย้อนหลัง 7 วัน + คาดการณ์ 3 วัน               zWeek     (ย้ายตารางเดิมมารวมกัน ไม่แก้ตาราง)
  4 เจาะลึก จังหวัด → อำเภอ → ตำบล                zDrill
  5 สรุปช่วงที่แสดง · จำนวนวันที่เกินเกณฑ์          zSummary
  6 จุดความร้อน                                   zHot
  7 แผนที่ค่าฝุ่นวันนี้ (ของเดิม ย้ายลงล่าง)        zMap      (ขั้น 2: รวมกับจุดความร้อน + real-time)
  8 โรค: ตารางรายเดือน พ.ย. 2568 → เดือนล่าสุด ระดับเขต (ไม่มีกราฟ · ตัดแผงรายจังหวัดออก)  zDisease
  9 คำแนะนำการปฏิบัติตัว 5 ระดับ (ตัดภาพรวมออก)     zAdvice

ไม่แตะ: อินโฟกราฟิกทุกส่วน (b4_*, ig_new.js, pv_social.js, fitInfographic, ig*, แผงดาวน์โหลด Infographic)
ใช้ร่วมเดโม่ (build_demo.py) — เรียกหลัง nav_apply / c5_apply
"""
import json, pathlib, re


def _sub(html, old, new, count=1):
    if html.count(old) != count:
        raise SystemExit(f"layout_apply: match count {html.count(old)} != {count}: {old[:90]!r}")
    return html.replace(old, new)


def _cut(html, a, b):
    """ตัดข้อความตั้งแต่ a ถึงก่อน b → (html ที่เหลือ, ข้อความที่ตัด)"""
    i = html.index(a); j = html.index(b, i)
    return html[:i] + html[j:], html[i:j]


def _line(html, start):
    """ดึงบรรทัดเดียวที่ขึ้นต้นด้วย start (รวมช่องว่างหน้าบรรทัด) → (html ที่เหลือ, บรรทัดนั้นรวม \\n)"""
    i = html.index(start); b = html.rfind("\n", 0, i) + 1; e = html.index("\n", i) + 1
    return html[:b] + html[e:], html[b:e]


def _sec_head(icon, title_html, sub):
    return (f'    <div class="sec-h"><div class="badge"><svg class="ico"><use href="#{icon}"/></svg></div>\n'
            f'      <div><h2>{title_html}</h2><p>{sub}</p></div></div>\n')


PM = '<span class="pm25">PM<sub>2.5</sub></span>'

CSS = """
/* ===== จัดลำดับหน้าใหม่ (ขั้น 1) ===== */
.pv-top.ws-side{display:block}   /* block (ไม่ใช่ flex) กันความสูงแผ่นการ์ดพองจากการวัดแบบ container-type ของ .tile */
.pv-top.ws-side .tiles{grid-template-columns:repeat(4,minmax(0,1fr));margin-bottom:14px}
.pv-top .facts-box .facts{grid-template-columns:repeat(3,minmax(0,1fr))}
.ws-v2 .pv-top .tile .th .pn{font-size:calc(18px*var(--fs,1))}
.ws-v2 .pv-top .tile .t-art{width:72px}
.ws-v2.map-one{display:block}
.wk-grid{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:14px;align-items:stretch}
.wk-grid .fc{position:static}
.trend.tr-one,.drill.dr-one{grid-template-columns:minmax(0,1fr)}
@media (max-width:1100px){.pv-top.ws-side .tiles{grid-template-columns:repeat(2,minmax(0,1fr))}.wk-grid{grid-template-columns:minmax(0,1fr)}}
@media (max-width:680px){.pv-top .facts-box .facts{grid-template-columns:minmax(0,1fr)}}

/* ส่วน 8 · ตารางรายเดือน */
.dzt-wrap{overflow-x:auto;margin-top:12px;border:1px solid var(--line);border-radius:12px;background:var(--surface)}
.dzt{width:100%;border-collapse:separate;border-spacing:0;font-variant-numeric:tabular-nums}
.dzt th,.dzt td{padding:8px 12px;text-align:right;white-space:nowrap;border-bottom:1px solid var(--line);vertical-align:middle}
.dzt thead th{font-size:calc(13px*var(--fs,1));font-weight:700;color:var(--ink-2);background:var(--subtle,#f3f6f9);line-height:1.3;vertical-align:bottom}
.dzt thead th small,.dzt tbody th small{display:block;font-size:calc(11.5px*var(--fs,1));font-weight:600;color:var(--ink-3)}
.dzt th:first-child{text-align:left;position:sticky;left:0;z-index:1;background:var(--surface)}
.dzt thead th:first-child{background:var(--subtle,#f3f6f9)}
.dzt tbody tr:last-child>*{border-bottom:0}
.dzt .dzt-m{font-weight:700;color:var(--ink-1);font-size:calc(14.5px*var(--fs,1))}
.dzt .dzt-m sup{font-size:.75em;color:var(--ink-2);margin-left:1px}
.dzt .dzt-dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px;vertical-align:baseline}
.dzt td b{display:block;font-size:calc(15px*var(--fs,1));font-weight:700;color:var(--ink-1)}
.dzt td small{display:block;font-size:calc(11.5px*var(--fs,1));font-weight:600;color:var(--ink-3)}
.dzt td.na{color:var(--ink-3);font-weight:600}
.dzt td.reg,.dzt th.reg{background:color-mix(in srgb,var(--dc,#5f6c80) 9%,#fff);border-left:2px solid color-mix(in srgb,var(--dc,#5f6c80) 30%,#fff)}
.dzt tr.prov td b{color:var(--ink-2)}
.dzt td.pmc{border-left:2px solid var(--line)}
@media (max-width:680px){.dzt th,.dzt td{padding:7px 9px}}
"""

# ไอคอนแถบนำทางของหัวข้อใหม่ (SVG วาดเอง · viewBox 24) — [สีบน, สีล่าง, path]
ICONS = {
    "zWeek": ["#30d5c8", "#0b8fa3", '<path fill-rule="evenodd" d="M7 2.8a1 1 0 0 1 1 1V5h8V3.8a1 1 0 1 1 2 0V5h.5A2.5 2.5 0 0 1 21 7.5v11a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 18.5v-11A2.5 2.5 0 0 1 5.5 5H6V3.8a1 1 0 0 1 1-1ZM5 10v8.5c0 .28.22.5.5.5h13a.5.5 0 0 0 .5-.5V10H5Z"/>'],
    "zSummary": ["#b98bff", "#7048e8", '<path fill-rule="evenodd" d="M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm1 4v2h12V8H6Zm0 4v2h12v-2H6Zm0 4v2h7v-2H6Z"/>'],
    "zMap": ["#4aa8ff", "#1c6ed6", '<path fill-rule="evenodd" d="M12 2.5a6.5 6.5 0 0 0-6.5 6.5c0 4.6 5.3 10.4 6.1 11.25a.55.55 0 0 0 .8 0c.8-.85 6.1-6.65 6.1-11.25A6.5 6.5 0 0 0 12 2.5Zm0 8.7a2.2 2.2 0 1 1 0-4.4 2.2 2.2 0 0 1 0 4.4Z"/>'],
}


def apply(html):
    # ---------- 1) แยกชิ้นส่วนเดิมออกมา ----------
    # แผนที่ค่าฝุ่นวันนี้ (SVG) — อยู่ใน zToday
    html, map_blk = _cut(html, "      <!-- A4 แผนที่ค่าฝุ่นวันนี้", "      <!-- ฝั่งขวา: A3")
    html, tiles = _line(html, '        <div class="tiles" id="tiles">')
    html, facts = _line(html, '        <div class="glass facts-box" id="facts">')
    # ตาราง 7 วัน และตารางสรุป — อยู่ใน zTrend
    html, t7 = _line(html, '      <div class="card chart-card t7-card">')
    html, trst = _line(html, '      <div class="card chart-card" id="trStats">')
    # การ์ดคาดการณ์ 3 วัน — อยู่ใน zDrill
    html, fc = _line(html, '      <aside class="glass fc" id="forecast"')
    # การ์ดคำแนะนำภาพรวม (ค่าเฉลี่ย 4 จังหวัด) — ตัดออก
    html, _ = _line(html, '    <div class="card adv-now" id="advNow"></div>')

    # ---------- 2) zToday = การ์ดจังหวัด + facts ใต้การ์ด ----------
    a = html.index('    <div class="ws ws-v2">'); b = html.index("  </section>", a)
    html = (html[:a] + '    <div class="ws-v2">\n      <div class="ws-side pv-top">\n' + tiles + facts + "      </div>\n    </div>\n" + html[b:])

    # ---------- 3) หัวข้อเดิมที่ข้อความเปลี่ยนตามตำแหน่งใหม่ ----------
    html = _sub(html, "ดูรายวันหรือรายสัปดาห์ · เลือกช่วงเวลา ซูมเข้า-ออกได้ · ค่าย้อนหลัง 7 วัน",
                "ดูรายวัน รายสัปดาห์ หรือรายเดือน · เลือกช่วงเวลา ซูมเข้า-ออกได้")
    html = _sub(html, "จังหวัด → อำเภอ → ตำบล · คลิกจังหวัดบนแผนที่หรือการ์ดด้านบน",
                "จังหวัด → อำเภอ → ตำบล · คลิกการ์ดจังหวัดด้านบน หรือคลิกบนแผนที่ค่าฝุ่นด้านล่าง")
    html = _sub(html, '<div class="drill">', '<div class="drill dr-one">')
    html = _sub(html, "<h2>คำแนะนำการปฏิบัติตัววันนี้</h2><p>ตามระดับคุณภาพอากาศเฉลี่ยของเขตสุขภาพที่ 7</p>",
                "<h2>คำแนะนำการปฏิบัติตัว</h2><p>ตามระดับคุณภาพอากาศ 5 ระดับ · ดูระดับของจังหวัดจากการ์ดด้านบน</p>")

    # ---------- 4) หัวข้อใหม่ 3 ส่วน ----------
    sec_week = ('  <!-- 3) ย้อนหลัง 7 วัน + คาดการณ์ 3 วัน -->\n  <section id="zWeek" style="--sec:#0b8fa3">\n'
                + _sec_head("i-cal", f"ค่าฝุ่น {PM} ย้อนหลัง 7 วัน และคาดการณ์ล่วงหน้า 3 วัน",
                            "ย้อนหลัง = ค่าเฉลี่ย 24 ชม. ณ 07.00 น. · คาดการณ์ล่วงหน้า = ค่าประมาณจาก GISTDA")
                + '    <div class="trend wk-grid">\n' + t7 + fc.replace("      <aside", "      <aside", 1) + "    </div>\n  </section>\n\n")
    sec_sum = ('  <!-- 5) สรุปช่วงที่แสดง -->\n  <section id="zSummary" style="--sec:#7048e8">\n'
               + _sec_head("i-chart", "สรุปช่วงที่แสดง",
                           "ค่าต่ำสุด · สูงสุด · จำนวนวันที่ค่าฝุ่นเกินเกณฑ์ ตามจังหวัดและช่วงเวลาที่เลือกในกราฟแนวโน้ม")
               + '    <div class="trend tr-one">\n' + trst + "    </div>\n  </section>\n\n")
    sec_map = ('  <!-- 7) แผนที่ค่าฝุ่นวันนี้ (ของเดิมย้ายลงล่าง · ขั้น 2 จะรวมกับจุดความร้อนและเป็น real-time) -->\n'
               '  <section id="zMap" style="--sec:#1c6ed6">\n'
               + _sec_head("i-map", "แผนที่ค่าฝุ่นรายจังหวัด", "คลิกจังหวัดบนแผนที่เพื่อดูรายละเอียดรายอำเภอและตำบล")
               + '    <div class="ws-v2 map-one">\n' + map_blk + "    </div>\n  </section>\n\n")

    # วางลำดับ: zDrill ก่อน → แทรก zWeek ก่อน zDrill · zSummary หลัง zDrill · zMap หลัง zHot
    html = _sub(html, '  <!-- 3) เจาะลึก จังหวัด', sec_week + '  <!-- 4) เจาะลึก จังหวัด')
    html = _sub(html, "  <!-- 4) Hotspot -->", sec_sum + "  <!-- 6) Hotspot -->")
    html = _sub(html, "  <!-- 5) โรค -->", sec_map + "  <!-- 8) โรค -->")
    html = _sub(html, "  <!-- 6) คำแนะนำ -->", "  <!-- 9) คำแนะนำ -->")

    # ---------- 5) JS: คำแนะนำ 5 ระดับอย่างเดียว ไม่ใช้ค่าเฉลี่ย 4 จังหวัด ----------
    m = re.search(r'  document\.getElementById\("advNow"\)\.innerHTML = `.*?`;\n', html, re.S)
    if not m: raise SystemExit("layout_apply: ไม่พบ advNow ใน renderAdvice")
    html = html[:m.start()] + html[m.end():]
    html = _sub(html, "function renderAdvice() {\n  const L = LV[S.lv];\n", "function renderAdvice() {\n")
    html = _sub(html, '<div class="a ${i === S.lv ? "cur" : ""}"><b><i style="background:${l.c}"></i>${l.name}${i === S.lv ? " · วันนี้" : ""}</b>',
                '<div class="a"><b><i style="background:${l.c}"></i>${l.name}</b>')

    # ---------- 6) ส่วน 8 โรค: ตารางรายเดือน พ.ย. 2568 → เดือนล่าสุด (ไม่มีกราฟ) · ดู dz_tables.js ----------
    #   อินโฟกราฟิกใช้ IG_CB_N / igDz* ของตัวเอง ไม่เกี่ยว
    js = (pathlib.Path(__file__).parent / "dz_tables.js").read_text(encoding="utf-8")
    html = _sub(html, "function e2xBlock(wkMax) { return e2xAll(wkMax); }   // แทนแผงแท่งอัตราป่วยเดิม", js)
    html = _sub(html, "ผู้ป่วย 4 กลุ่มโรค · ปี 2569 สัปดาห์ระบาดวิทยาที่ 1–${wkMax} (${epiRange(2026, 1, wkMax)})",
                "ผู้ป่วย 4 กลุ่มโรค · เฉพาะช่วงฤดูฝุ่น (พ.ย.–พ.ค.) ตั้งแต่ พ.ย. 2568 · ข้อมูลถึงสัปดาห์ระบาดวิทยาที่ ${wkMax} ปี 2569")

    # ---------- 7) แถบนำทางซ้าย: ลำดับ + ชื่อ + ไอคอนใหม่ ----------
    m = re.search(r'const SB_MENU = \[\[.*?\]\];', html, re.S)
    if not m: raise SystemExit("layout_apply: ไม่พบ SB_MENU")
    zdata = re.search(r'\["zData", "[^"]*"\]', m.group(0)).group(0)
    menu = ('const SB_MENU = [["zToday", "สถานการณ์วันนี้"], ["zTrend", "แนวโน้มค่าฝุ่น"], ["zWeek", "ย้อนหลัง 7 วัน · คาดการณ์ 3 วัน"],\n'
            '  ["zDrill", "เจาะลึกรายพื้นที่"], ["zSummary", "สรุปช่วงที่แสดง"], ["zHot", "จุดความร้อน"], ["zMap", "แผนที่ค่าฝุ่น"],\n'
            '  ["zDisease", "โรคที่ต้องเฝ้าระวัง"], ["zAdvice", "คำแนะนำการปฏิบัติตัว"], ' + zdata + '];')
    html = html[:m.start()] + menu + html[m.end():]
    icons = "".join("SB_ICON.%s = %s;\n" % (k, json.dumps(v, ensure_ascii=False)) for k, v in ICONS.items())
    html = _sub(html, "const sbTile = id =>", icons + "const sbTile = id =>")

    # ---------- 8) CSS ----------
    body = html.index('<body id="top"'); k = html.rindex("</style>", 0, body)   # <style> ก้อนสุดท้ายก่อน <body> (ชนะ CSS เดิม)
    html = html[:k] + CSS + html[k:]
    return html
