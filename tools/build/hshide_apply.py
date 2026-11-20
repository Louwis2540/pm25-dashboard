"""วันที่ไม่มีข้อมูลจุดความร้อน → ไม่ต้องขึ้น (ซ่อนทั้งแดชบอร์ดและอินโฟกราฟิก) — 20 พ.ย. 2569
GISTDA โหลดข้อมูล VIIRS เป็นชุดรายวัน (เช้าวันถัดไป) · ถ้าข้อมูลล่าสุดเก่ากว่า "เมื่อวาน" (อายุ ≥ 3 วัน หรือ = 2 วันและเลย 09.00 น.)
ถือว่าวันนี้ไม่มีข้อมูล → ไม่แสดงจุดความร้อนเลย (ตัวเลข การ์ด คอลัมน์ ชั้นแผนที่ ป้ายอินโฟกราฟิก) ไม่ใช้ตัวเลขเก่าแทน · กลับมาแสดงเองเมื่อมีข้อมูลใหม่
ใช้ทั้งเดโม่ (build_demo.py) และเว็บจริง (hshide_live.py ต่อท้าย live_apply + b4_apply)"""

HELPER = r'''// ---- วันที่ไม่มีข้อมูลจุดความร้อน → ซ่อนส่วนจุดความร้อน (GISTDA โหลดเป็นชุดรายวัน เช้าวันถัดไป) ----
function hsApply(feats, ok) {
  const lt = mmHsLatest(feats), now = new Date(Date.now() + 7 * 3600e3), today = now.toISOString().slice(0, 10);
  const age = lt ? Math.round((Date.parse(today) - Date.parse(lt.slice(0, 10))) / 864e5) : 0;   // อายุเป็นวัน ตามเวลาไทย
  S.hsBehind = !!(ok && lt && (age >= 3 || (age === 2 && now.getUTCHours() >= 9)));
  S.hsToday = S.hsBehind ? [] : feats; S.hsOk = !!ok && !S.hsBehind;
  document.body.classList.toggle("hs-none", S.hsBehind);
}
'''
ANCHOR = "// ---- จุดความร้อน: ขอข้อมูลใหม่ทุก 15 นาที ----"
CSS = """
/* ===== วันที่ไม่มีข้อมูลจุดความร้อน: ซ่อนส่วนจุดความร้อน ===== */
.hs-none .mm-chip[data-l="hs"],.hs-none #mmLive .mm-hs,.hs-none #hotSide .hot-total,.hs-none #hotSide .conf,.hs-none #hotSide>.label:first-child{display:none!important}
.hs-none .mm-th,.hs-none .mm-row{grid-template-columns:minmax(0,1fr) 64px}
.hs-none .mm-th span:nth-child(3),.hs-none .mm-row b{display:none}
"""
REPS = [   # (เดิม, ใหม่, จำนวนที่คาด)
    ("  S.hsToday = (hs?.geojson?.features || []).filter(f => names.has(f.properties.changwat));\n  S.hsOk = !!hs?.ok;",
     "  hsApply((hs?.geojson?.features || []).filter(f => names.has(f.properties.changwat)), !!hs?.ok);", 1),
    ("S.hsToday = j.geojson.features.filter(f => names.has(f.properties.changwat)); S.hsOk = true;",
     "hsApply(j.geojson.features.filter(f => names.has(f.properties.changwat)), true);", 1),
    ('const hsRow = `<div class="mm-ln${MM.hsErr', 'const hsRow = `<div class="mm-ln mm-hs${MM.hsErr', 1),
    ('${!S.hsOk ? `<div class="note-box">ดึงข้อมูล GISTDA ไม่สำเร็จ</div>` : ""}', '${!S.hsOk && !S.hsBehind ? `<div class="note-box">ดึงข้อมูล GISTDA ไม่สำเร็จ</div>` : ""}', 2),
    ('<div class="fact"><span class="fi" style="background:#fdeee5;color:#e8590c"><svg class="ico"><use href="#i-fire"/></svg></span><div><span>จุดความร้อน 24 ชม.</span><b>${S.hsOk ? S.hsToday.length + " จุด" : "ดึงข้อมูลไม่ได้"}</b></div></div>',
     '${S.hsBehind ? "" : `<div class="fact"><span class="fi" style="background:#fdeee5;color:#e8590c"><svg class="ico"><use href="#i-fire"/></svg></span><div><span>จุดความร้อน 24 ชม.</span><b>${S.hsOk ? S.hsToday.length + " จุด" : "ดึงข้อมูลไม่ได้"}</b></div></div>`}', 1),
    ('${stat("i-fire", "#fde8e8", "#b91c1c", "จุดความร้อน 24 ชม.",', '${S.hsBehind ? "" : stat("i-fire", "#fde8e8", "#b91c1c", "จุดความร้อน 24 ชม.",', 1),
    ("${f.hs200 != null ?", "${f.hs200 != null && !S.hsBehind ?", 1),
    ('${isD ? `<span class="chip" style="background:#fdeee5;color:#a23d00">🔥 จุดความร้อนวันนี้', '${isD && !S.hsBehind ? `<span class="chip" style="background:#fdeee5;color:#a23d00">🔥 จุดความร้อนวันนี้', 1),
    ('${isD ? `<th rowspan="2">จุด<br>ความร้อน</th>` : ""}', '${isD && !S.hsBehind ? `<th rowspan="2">จุด<br>ความร้อน</th>` : ""}', 1),
    ('${isD ? `<td class="hs-n">', '${isD && !S.hsBehind ? `<td class="hs-n">', 1),
    ("function igHsPill() {", 'function igHsPill() {\n  if (S.hsBehind) return "";', 1),
    ('    ${kpi("i-fire", "#fdeee5"', '    ${S.hsBehind ? "" : kpi("i-fire", "#fdeee5"', 1),
]


def apply(html):
    if html.count(ANCHOR) != 1:
        raise SystemExit(f"hshide_apply: anchor พบ {html.count(ANCHOR)} ที่")
    html = html.replace(ANCHOR, HELPER + ANCHOR)
    for old, new, n in REPS:
        c = html.count(old)
        if c != n:
            raise SystemExit(f"hshide_apply: พบ {c} ที่ (คาด {n}) : {old[:90]}")
        html = html.replace(old, new)
    k = html.rindex("</style>", 0, html.index('<body id="top"'))
    return html[:k] + CSS + html[k:]
