"""จุดความร้อนค้าง (20 พ.ย. 2569): GISTDA โหลดข้อมูล VIIRS เป็นชุดรายวัน (เรคคอร์ดสร้างช่วงเช้า 06.29 น. ของวันถัดไป ไฟล์ชื่อลงท้ายวันที่)
ฟีด "1day" จึงส่งชุดล่าสุดที่มี ซึ่งอาจเก่าหลายวันถ้า GISTDA ยังไม่โหลดชุดใหม่ — เดิมหน้าเว็บนำจำนวนนั้นไปแสดงเป็น "จุดความร้อน 24 ชม." ทั้งที่เก่า
แก้: ถ้าข้อมูลล่าสุดเก่ากว่า "เมื่อวาน" (อายุ ≥ 3 วัน หรือ = 2 วันและเลย 09.00 น.) → ไม่นับเป็นของวันนี้ แสดง "–/รอข้อมูลใหม่" + กล่องอธิบายพร้อมเวลาที่ตรวจพบล่าสุด
หายค้างเองเมื่อ GISTDA ส่งชุดใหม่ (หน้าเว็บขอทุก 15 นาที) · ใช้ทั้งเดโม่และเว็บจริง (ต่อท้ายขั้นตอนอื่น)"""

HELPER = r'''// ---- ฟีดจุดความร้อนค้าง: GISTDA โหลดเป็นชุดรายวัน (เช้าวันถัดไป) · ข้อมูลล่าสุดเก่ากว่า "เมื่อวาน" และเลย 09.00 น. = ยังไม่ได้ชุดใหม่ → ไม่นับเป็น 24 ชม. ----
function hsApply(feats, ok) {
  const lt = mmHsLatest(feats), now = new Date(Date.now() + 7 * 3600e3), today = now.toISOString().slice(0, 10);
  const age = lt ? Math.round((Date.parse(today) - Date.parse(lt.slice(0, 10))) / 864e5) : 0;   // อายุเป็นวัน ตามเวลาไทย
  S.hsBehind = !!(ok && lt && (age >= 3 || (age === 2 && now.getUTCHours() >= 9)));
  S.hsLast = S.hsBehind ? { n: feats.length, at: lt } : null;
  S.hsToday = S.hsBehind ? [] : feats;
  S.hsOk = !!ok && !S.hsBehind;
}
const hsLatestAny = () => S.hsBehind ? S.hsLast.at : mmHsLatest(S.hsToday);
const hsBehindNote = () => `<div class="note-box"><b>GISTDA ยังไม่ส่งข้อมูลจุดความร้อนใหม่</b><br>ข้อมูลล่าสุดที่ได้รับตรวจพบ ${esc(mmAt(S.hsLast.at))} (${S.hsLast.n} จุด) เก่ากว่า 24 ชม. จึงไม่นับเป็นจุดความร้อนวันนี้ · ระบบตรวจซ้ำทุก 15 นาที และจะแสดงเองเมื่อ GISTDA อัปเดต</div>`;
'''
ANCHOR = "// ---- จุดความร้อน: ขอข้อมูลใหม่ทุก 15 นาที ----"
REPS = [   # (เดิม, ใหม่, จำนวนที่คาด หรือ None = อย่างน้อย 1)
    ("  S.hsToday = (hs?.geojson?.features || []).filter(f => names.has(f.properties.changwat));\n  S.hsOk = !!hs?.ok;",
     "  hsApply((hs?.geojson?.features || []).filter(f => names.has(f.properties.changwat)), !!hs?.ok);", 1),
    ("S.hsToday = j.geojson.features.filter(f => names.has(f.properties.changwat)); S.hsOk = true;",
     "hsApply(j.geojson.features.filter(f => names.has(f.properties.changwat)), true);", 1),
    ("MM.hsLatest = mmHsLatest(S.hsToday);", "MM.hsLatest = hsLatestAny();", 2),
    ("GISTDA (VIIRS) · ย้อนหลัง 24 ชม. · ${MM.hsAt ? (lt ?",
     "GISTDA (VIIRS) · ${S.hsBehind ? \"<em>ยังไม่มีข้อมูลใหม่</em>\" : \"ย้อนหลัง 24 ชม.\"} · ${MM.hsAt ? (lt ?", 1),
    ('"จุดความร้อนรวม 4 จังหวัด · 24 ชม."}', '(S.hsBehind ? "จุดความร้อนรวม 4 จังหวัด" : "จุดความร้อนรวม 4 จังหวัด · 24 ชม.")}', None),
    ('<div class="hot-total num">${feats.length} <span', '<div class="hot-total num">${S.hsBehind ? "–" : feats.length} <span', None),
    ("<b>${by[p.name] || 0}</b></button>", '<b>${S.hsBehind ? "–" : (by[p.name] || 0)}</b></button>', None),
    ('${!S.hsOk ? `<div class="note-box">ดึงข้อมูล GISTDA ไม่สำเร็จ</div>` : ""}',
     '${S.hsBehind ? hsBehindNote() : !S.hsOk ? `<div class="note-box">ดึงข้อมูล GISTDA ไม่สำเร็จ</div>` : ""}', None),
    ('${S.hsOk ? S.hsToday.length + " จุด" : "ดึงข้อมูลไม่ได้"}', '${S.hsBehind ? "รอข้อมูลใหม่ GISTDA" : S.hsOk ? S.hsToday.length + " จุด" : "ดึงข้อมูลไม่ได้"}', 1),
    ('`<b class="num">${hsN}<em>จุด</em></b>`', '`<b class="num">${S.hsBehind ? "–" : hsN}<em>${S.hsBehind ? "" : "จุด"}</em></b>`', 1),
    ('  if (!n) return `<span class="ml mlhs ok">',
     '  if (S.hsBehind) return `<span class="ml mlhs">${inl("i-fire", 20)}<span class="hst"><span class="hl">จุดความร้อน · GISTDA</span><span class="hn"><b>ยังไม่มีข้อมูลใหม่</b><small>ข้อมูลล่าสุดตรวจพบ ${esc(mmAt(S.hsLast.at))}</small></span></span></span>`;\n  if (!n) return `<span class="ml mlhs ok">', 1),
    ('`${igHs().length} จุด`, "ที่มา: GISTDA")', 'S.hsBehind ? "ไม่มีข้อมูลใหม่" : `${igHs().length} จุด`, "ที่มา: GISTDA")', 1),
]


def apply(html):
    if html.count(ANCHOR) != 1:
        raise SystemExit(f"hsbehind_apply: anchor พบ {html.count(ANCHOR)} ที่")
    html = html.replace(ANCHOR, HELPER + ANCHOR)
    for old, new, n in REPS:
        c = html.count(old)
        if (n is None and c < 1) or (n is not None and c != n):
            raise SystemExit(f"hsbehind_apply: พบ {c} ที่ (คาด {n or '≥1'}) : {old[:80]}")
        html = html.replace(old, new)
    return html
