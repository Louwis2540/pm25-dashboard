"""รอบขึ้นเว็บจริง (เดโม่ v74): E1 กราฟเส้น · E2 แกนคู่ · แนวโน้ม dropdown+ซูม · เจาะลึก dropdown · คำอธิบายจุดความร้อน
· หมายเหตุคาดการณ์ · PHEOC เกณฑ์ LINE · ป้ายเวลา 15.00 น.   ใช้: python3 live_apply.py <scratch> <repo>"""
import re, sys, pathlib
SCR = pathlib.Path(sys.argv[1]); REPO = pathlib.Path(sys.argv[2]); sys.path.insert(0, str(SCR))
ix = REPO / "index.html"; html = ix.read_text(encoding="utf-8")
SRC = (SCR / "build_demo.py").read_text(encoding="utf-8")
miss = []
def sub(old, new, count=1):
    global html
    n = html.count(old)
    if n != count: miss.append((n, old[:110])); return
    html = html.replace(old, new)
def cut(a, b, src=SRC):
    i = src.index(a); j = src.index(b, i); return src[i:j]
def pm_sub(code):
    out = []
    for ln in code.split("\n"):
        t = ln.lstrip()
        if "PM2.5" in ln and not (t.startswith("//") or t.startswith("/*") or "aria-label=" in ln or "alt=" in ln or ".alt =" in ln):
            ln = ln.replace("PM2.5", '<span class="pm25">PM<sub>2.5</sub></span>')
        out.append(ln)
    return "\n".join(out)

# ---- 1) E1 กราฟเส้น + E2 แกนคู่: แทนโมดูลเดิม (DZ_PROV_WK … ก่อน pvWait) ----
e1 = (SCR / "e1_monthly.js").read_text(encoding="utf-8"); e1 = e1[e1.index("const DZ_PROV_WK"):]
e2 = (SCR / "e2_prov.js").read_text(encoding="utf-8")
e2x = (SCR / "e2x.js").read_text(encoding="utf-8")
code = e1 + e2 + e2x
code = re.sub(r'<button type="button" class="ds-jump"[^`]*?</button>', "", code)
assert "ds-jump" not in code
a = html.index("const DZ_PROV_WK"); b = html.index("// E2 ระหว่างรอ /api/disease-pv")
html = html[:a] + pm_sub(code) + "\n" + html[b:]
sub("(window.DZPV?.ok ? dzPvAll(wkMax) : pvWait())", "(window.DZPV?.ok ? e2xBlock(wkMax) : pvWait())")
# CSS โซน E ชุดใหม่ (ตัดจากเดโม่เหมือน B3) แทนบล็อก B3 เดิม
a = html.index("/* ===== B3: โซน E"); b = html.index("</style>", a)
old_b3 = html[a:b]
keep = old_b3[old_b3.index(".pv-wait .pv-grid"):]          # กรอบรอ/ล้มเหลว ของ B3
css_e = cut(".dz-all .lg{", "#ig .pm-tag sub") + cut(".mock-b{", ".fr-note{")
html = html[:a] + "/* ===== B3+: โซน E (E1 เส้นรายเดือน · E2 แกนคู่) ===== */\n" + css_e + keep + (SCR / "e2x.css").read_text(encoding="utf-8") + html[b:]

# ---- 1b) C5 คาดการณ์ 3 วัน + ปัจจัยอากาศ (ข้อมูล trend/fac จาก /api/pm25/provinces) ----
import c5_apply
html = c5_apply.apply(html, live=True)

# ---- 2) แนวโน้ม · เจาะลึก · จุดความร้อน (zbc_apply ชุดเดียวกับเดโม่) ----
import zbc_apply
css_z = zbc_apply.apply(sub)
html = zbc_apply.apply_area_bind(html)
sub(zbc_apply.FC_OLD, zbc_apply.FC_NEW)

import load_fix; load_fix.apply(sub)   # โหลดค่าฝุ่นลองใหม่ + ข้อความแจ้งเมื่อโหลดไม่สำเร็จ

# ---- 3) PHEOC เกณฑ์ LINE + ป้ายเวลา 15.00 น. ----
import pheoc_apply
html = pheoc_apply.apply(html)

# ---- 4) ดาวน์โหลดข้อมูล (B5) เป็นส่วนสุดท้าย · สารบัญแถบขวา · สถิติการเข้าชม ----
DS_ADAPT = r'''
// ชุดดาวน์โหลด: แปลงข้อมูลรายจังหวัดจาก /api/disease-pv เป็นรูปแบบ DSDATA (s1/s2 = "wk,resp,heart,eye,skin;…")
Object.defineProperty(window, "DSDATA", { configurable: true, get() {
  const d = window.DZPV; if (!d?.ok) return {};
  if (d._ds) return d._ds;
  const pack = rows => { const o = {}; for (const r of rows || []) (o[r.pv] ||= []).push([r.wk, r.resp, r.heart, r.eye, r.skin].join(",")); for (const k in o) o[k] = o[k].join(";"); return o; };
  const dc = String(d.dateCom || ""), dateCom = dc.length >= 12 ? `${dc.slice(0, 4)}-${dc.slice(4, 6)}-${dc.slice(6, 8)} ${dc.slice(8, 10)}:${dc.slice(10, 12)}` : (d.meta?.dataDate || "");
  return d._ds = { s1: pack(d.rows1), s2: pack(d.rows), pop: d.pop || {}, dateCom };
} });
'''
sub("function renderDisease() {", DS_ADAPT + (SCR / "ds_module.js").read_text(encoding="utf-8") + "\nrenderDisease = (f => function () { f.apply(this, arguments); window.dsInit && dsInit(); })(renderDisease);\nfunction renderDisease() {")
sub('<h2>โรคที่ต้องเฝ้าระวังผลกระทบจากฝุ่น</h2>', '<h2>โรคที่เฝ้าระวังในช่วงฝุ่น</h2>')   # ไม่สื่อว่าฝุ่นเป็นสาเหตุ
import nav_apply
html = nav_apply.apply(html)
# หมายเหตุตารางสรุปช่วงที่เลือก (แนวโน้ม): ค่า ณ 07.00 น. จากสถานี + ดาวเทียม
sub('<div class="tr-note">ค่ารายวันจากสถานีตรวจวัด Air4Thai · ', '<div class="tr-note">ค่าเฉลี่ย 24 ชม. ณ 07.00 น. จากสถานีตรวจวัด Air4Thai ร่วมกับดาวเทียม GISTDA · ')
sub("</style>", "\n/* ===== รอบ 16 ต.ค. 2569 ===== */\n" + (css_z or zbc_apply.CSS) + pheoc_apply.CSS + (SCR / "ds.css").read_text(encoding="utf-8") + nav_apply.TOC_CSS + "</style>")
if miss:
    for n, o in miss: print("MISS", n, repr(o))
    raise SystemExit(1)
html = re.sub(r"font-size:\s*([0-9.]+)px", lambda m: f"font-size:calc({m.group(1)}px*var(--fs,1))", html)
html = html.replace("calc(calc(", "calc(")  # กันห่อซ้ำ
ix.write_text(html, encoding="utf-8"); print("ok", len(html))
