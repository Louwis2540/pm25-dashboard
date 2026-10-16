"""C5 คาดการณ์ 3 วัน + ปัจจัยอากาศ — apply(html, live=False)
เดโม่: เพิ่มไอคอนทิศลม · เว็บจริง: แทนฟังก์ชันคาดการณ์ทั้งก้อนด้วย c5_final.js + CSS + ไอคอน (ข้อมูล trend/fac จาก server)"""
import re, pathlib
SCR = pathlib.Path(__file__).parent
WIND = '<symbol id="i-wind" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 8h10a3 3 0 1 0-3-3"/><path d="M3 12h15a3 3 0 1 1-3 3"/><path d="M3 16h7"/></symbol>'

def apply(html, live=False):
    if live:
        demo = (SCR / "demo-a1.html").read_text(encoding="utf-8")
        syms = "".join(re.search(rf'<symbol id="{i}".*?</symbol>', demo, re.S).group(0) for i in ("i-rain", "i-drop", "i-therm"))
        src = (SCR / "build_demo.py").read_text(encoding="utf-8")
        a = src.index("/* DEMO C5: ตารางคาดการณ์รายจังหวัดอย่างเดียว */"); b = src.index(".dz-all .lg{flex-wrap", a)
        css = src[a:b] + re.search(r"\.fr-note\{[^}]*\}", src).group(0) + "\n"
        a = html.index("// แผงคาดการณ์ล่วงหน้า 3 วัน — ค่าคาดการณ์"); b = html.index("const countBy = feats", a)
        html = html[:a] + (SCR / "c5_final.js").read_text(encoding="utf-8") + html[b:]
        html = html.replace("</style>", "\n/* ===== C5 คาดการณ์ + ปัจจัยอากาศ ===== */\n" + css + "</style>", 1)
    else:
        syms = ""
    k = html.index("<symbol ")
    return html[:k] + syms + WIND + html[k:]
