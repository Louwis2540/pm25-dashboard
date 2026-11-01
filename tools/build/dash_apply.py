"""ข้อความเทียบกับวันก่อนหน้าบนแดชบอร์ด (การ์ดจังหวัด + แผงเจาะลึก) — ใช้ igDelta() จาก ig_new.js
   igDelta ตรวจวันที่จริงของแถวก่อนหน้า: ติดกัน 1 วันเขียน "เมื่อวาน" ไม่ติดเขียนวันที่ · แสดงค่าของวันนั้นด้วย
   เรียกจาก build_demo.py (เดโม่) และ live_apply.py (เว็บจริง) ด้วยฟังก์ชัน sub ของแต่ละฝั่ง"""
TILE_OLD = '${dd != null ? `${dd > 0 ? "▲" : dd < 0 ? "▼" : "●"} ${Math.abs(dd).toFixed(1)} จากวันก่อนหน้า` : "ไม่มีค่าวันก่อนหน้า"}'
TILE_NEW = '${dd != null ? igDelta(p.name) : "ไม่มีค่าวันก่อนหน้า"}'
DRILL_OLD = '${dd > 0 ? "▲" : dd < 0 ? "▼" : "●"} ${Math.abs(dd).toFixed(1)} จากวันก่อนหน้า (${f1(pr)})'
DRILL_NEW = '${igDelta(pvName)}'
def apply(sub):
    sub(TILE_OLD, TILE_NEW)
    sub(DRILL_OLD, DRILL_NEW)
