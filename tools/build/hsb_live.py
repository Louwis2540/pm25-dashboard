"""ขั้นสุดท้ายของเว็บจริง (ต่อจาก live_apply.py + b4_apply.py): จุดความร้อนค้าง → ไม่นับเป็น 24 ชม. ใช้: python3 hsb_live.py <scratch> <repo>"""
import sys, pathlib
SCR = pathlib.Path(sys.argv[1]); REPO = pathlib.Path(sys.argv[2]); sys.path.insert(0, str(SCR))
import hsbehind_apply
ix = REPO / "index.html"
ix.write_text(hsbehind_apply.apply(ix.read_text(encoding="utf-8")), encoding="utf-8"); print("hsb ok")
