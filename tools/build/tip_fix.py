"""tooltip กราฟโรค (E1/E2): กว้างพอดีข้อความ · ชิดขอบขวาแล้วสลับไปซ้ายเมาส์ · ไม่ล้นขอบล่าง/บน
ใช้ร่วมทั้งเดโม่และโค้ดจริง"""
OLD = 'rc.addEventListener("pointermove", e => { const r = card.getBoundingClientRect(); tip.style.left = (e.clientX - r.left + 12) + "px"; tip.style.top = (e.clientY - r.top - 34) + "px"; });'
NEW = ('rc.addEventListener("pointermove", e => {   // ชิดขอบขวา → สลับไปซ้ายเมาส์ · ไม่ล้นขอบการ์ด\n'
       '        const r = card.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, tw = tip.offsetWidth, th = tip.offsetHeight;\n'
       '        let L = x + 14; if (L + tw > r.width - 8) L = x - tw - 14;\n'
       '        let T = y - 34; if (T + th > r.height - 8) T = r.height - th - 8;\n'
       '        tip.style.left = Math.max(8, L) + "px"; tip.style.top = Math.max(8, T) + "px";\n'
       '      });')
CSS = "\n/* tooltip กราฟโรค: กว้างตามข้อความ ไม่ถูกบีบเมื่ออยู่ใกล้ขอบขวา */\n.dz .tip{width:max-content;max-width:min(300px,calc(100% - 16px))}\n"
def apply(sub):
    sub(OLD, NEW)
    sub("</style>", CSS + "</style>")
