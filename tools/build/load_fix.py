"""โหลดค่าฝุ่นไม่สำเร็จ → ลองใหม่อัตโนมัติ + ข้อความแจ้งพร้อมปุ่มลองใหม่ (แทน "ไม่มีข้อมูล" ถาวร)
ใช้ร่วมทั้งเดโม่และโค้ดจริง · ฝั่ง server (server.js) ตอบชุดล่าสุดที่เคยได้เมื่อดึง Google Sheet ไม่ได้"""
GET_OLD = 'const getJSON = p => fetch(API + p).then(r => r.ok ? r.json() : null).catch(() => null);'
GET_NEW = GET_OLD + '''
// ข้อมูลหลัก (ค่าฝุ่น): ถ้าพลาด (เช่น เซิร์ฟเวอร์เพิ่งตื่น/Sheet ตอบช้า) ลองใหม่สูงสุด 3 ครั้ง ห่างกัน 1.5, 3 วินาที
const getJSONRetry = async (p, tries = 3) => { for (let i = 0; i < tries; i++) { const r = await getJSON(p); if (r && r.ok !== false) return r; if (i < tries - 1) await new Promise(ok => setTimeout(ok, 1500 * (i + 1))); } return null; };'''
CALL_OLD = 'getJSON("/api/sheet-pm25")'
CALL_NEW = 'getJSONRetry("/api/sheet-pm25")'
EMPTY_OLD = 'if (!D.length) { svg.outerHTML = `<p class="muted">ไม่มีข้อมูล</p>`; return; }'
EMPTY_NEW = '''if (!D.length) {
    svg.outerHTML = S.pm?.ok ? `<p class="muted">ไม่มีข้อมูล</p>`
      : `<p class="muted" id="trFail">โหลดข้อมูลค่าฝุ่นไม่สำเร็จ (เซิร์ฟเวอร์อาจกำลังเริ่มทำงาน) <button type="button" class="ds-jump" id="trRetry">ลองใหม่</button></p>`;
    document.getElementById("trRetry")?.addEventListener("click", () => location.reload());
    return;
  }'''
def apply(sub):
    sub(GET_OLD, GET_NEW)
    sub(CALL_OLD, CALL_NEW)
    sub(EMPTY_OLD, EMPTY_NEW)
