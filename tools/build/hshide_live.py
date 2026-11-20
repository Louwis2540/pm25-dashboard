"""ขั้นสุดท้ายของเว็บจริง (ต่อจาก live_apply.py + b4_apply.py): วันที่ไม่มีข้อมูลจุดความร้อนไม่ต้องขึ้น · ใช้: python3 hshide_live.py <scratch> <repo>"""
import sys, pathlib
SCR = pathlib.Path(sys.argv[1]); REPO = pathlib.Path(sys.argv[2]); sys.path.insert(0, str(SCR))
import hshide_apply
ix = REPO / "index.html"
ix.write_text(hshide_apply.apply(ix.read_text(encoding="utf-8")), encoding="utf-8"); print("hshide ok")
