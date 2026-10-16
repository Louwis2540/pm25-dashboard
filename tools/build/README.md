# เครื่องมือ build แดชบอร์ด PM2.5 เขตสุขภาพที่ 7

ชุดสคริปต์ที่ใช้สร้าง **เดโม่** (ให้ Louis ตรวจก่อน) และ **index.html ของเว็บจริง** จากโมดูลชุดเดียวกัน
ทุกการแก้ไขทำที่โมดูลในโฟลเดอร์นี้ แล้ว build ทั้งสองฝั่ง เดโม่กับเว็บจริงจึงตรงกันเสมอ

## ลำดับการทำงาน (ทุกครั้งที่มีการแก้)

1. **แก้โมดูล** ในโฟลเดอร์นี้ (ดูตาราง "โมดูล" ด้านล่าง ว่าส่วนไหนอยู่ไฟล์ไหน)
2. **build เดโม่** แล้วทดสอบ
   ```bash
   python3 tools/build/build_demo.py tools/build          # → tools/build/demo-a1.html
   python3 tools/build/tests/t_sb2.py tools/build          # แถบนำทาง · 1366 / 390 px
   python3 tools/build/tests/t_dp.py tools/build           # แผงดาวน์โหลด เปิด/ปิด
   ```
3. **เผยแพร่เดโม่** ให้ Louis ดู (Artifact เดิม https://claude.ai/artifact/4oiVyUk6xMCH6wvkas9SeV · เพิ่มเลขเวอร์ชันทุกครั้ง)
4. Louis อนุมัติแล้วจึง **build เว็บจริง** บน branch ใหม่จาก `origin/main`
   ```bash
   git checkout -B <branch> origin/main
   git show 377212d:index.html > index.html                # ฐานของเว็บจริง
   python3 tools/build/live_apply.py tools/build .
   python3 tools/build/b4_apply.py  tools/build .
   git diff --stat                                         # ต้องเปลี่ยนเฉพาะส่วนที่ตั้งใจแก้
   ```
5. **ทดสอบไฟล์เว็บจริงแบบออฟไลน์** (จำลอง API ด้วยข้อมูลตัวอย่าง)
   ```bash
   python3 tools/build/blp5.py tools/build index.html tools/build/live-prev.html "LIVE"
   python3 tools/build/tests/t_debug.py tools/build        # หา error, ข้อความ undefined/NaN, รูปเสีย
   ```
6. commit → push → เปิด PR → merge (Render deploy อัตโนมัติจาก main)

> build เว็บจริงจากฐาน `377212d` ทุกครั้ง แล้วผลต้อง **ตรงกับ main ทุกตัวอักษร** ยกเว้นส่วนที่แก้รอบนั้น — ถ้า `git diff` มีส่วนอื่นติดมา แปลว่าโมดูลกับ main ไม่ตรงกัน ให้หยุดตรวจก่อน

## ฐานของแต่ละฝั่ง

| ฝั่ง | ฐาน | สคริปต์ |
|---|---|---|
| เดโม่ | `git show 6015e8b:index.html` | `build_demo.py` (มีข้อมูลจำลอง + หน่วงโหลด 3.5 วินาที + แถบ DEMO) |
| เว็บจริง | `git show 377212d:index.html` | `live_apply.py` แล้วตามด้วย `b4_apply.py` |
| ทดสอบออฟไลน์ | index.html ที่ build แล้ว | `blp5.py` (ใส่ fetch จำลอง, html2canvas, qrcode, เทมเพลตแบบ inline) |

`build_demo.py` หา repo เองจากตำแหน่งไฟล์ (`tools/build/../..`) หรือกำหนด `PM25_REPO=<พาธ repo>`

## โมดูล

| ไฟล์ | หน้าที่ |
|---|---|
| `nav_apply.py` | id ของ 7 ส่วน (zToday … zData) · **แถบนำทางซ้าย** (การ์ดกระจกใส ไอคอนเวกเตอร์ เงาเลื่อนผ่านทุก 5 วินาที ปุ่ม « ย่อเมนู) · **แผงดาวน์โหลดข้อมูล** (เปิดจากเมนู ไม่อยู่บนหน้า) · สถิติการเข้าชมท้ายหน้า |
| `ds_module.js` | ชุดดาวน์โหลด (CSV/Excel + คำอธิบายตัวแปร) · `satDay()` = วันที่ใช้ค่าดาวเทียม (1 ม.ค.–18 ก.พ. 2569 และกาฬสินธุ์ 23 ก.พ.) · `pm25_source` = station / satellite |
| `ds.css` | สไตล์ชุดดาวน์โหลด |
| `pheoc_apply.py` | ป้าย PHEOC (เฉลี่ย 24 ชม. ณ 07.00 น. ≥ 75.1 ติด 2 วัน) · หมายเหตุแหล่งข้อมูลท้ายหน้า |
| `zbc_apply.py` | คำอธิบายจุดความร้อน · ตัวเลือกช่วงกราฟแนวโน้ม + ซูม (Ctrl/⌘ + ล้อ, ถ่างนิ้ว, ปัด) · ตัวเลือกเจาะลึก · หมายเหตุคาดการณ์ |
| `c5_apply.py` + `c5_final.js` | การ์ดคาดการณ์ 3 วัน (ปัจจัยลม/ความชื้น/ฝน/จุดความร้อน) |
| `b4_apply.py` + `b4_fn.js` + `b4_css_missing.css` + `ig_new.js` + `pv_social.js` | อินโฟกราฟิก A4 / โพสต์ประชาชน / เทมเพลตจังหวัด + QR · ตารางสรุปช่วงที่เลือก (แนวโน้ม) |
| `e1_monthly.js`, `e2_prov.js`, `e2x.js`, `e2x.css` | กราฟโรครายเดือน / ฝุ่นกับผู้ป่วยรายจังหวัด |
| `sk_apply.py`, `tip_fix.py` | กรอบโหลด (skeleton) · tooltip กราฟโรค |
| `ios.css`, `fonts.css`, `responsive.css`, `lsfont.js` | หน้าตาแบบ iOS · ฟอนต์ LINE Seed Sans TH · จอเล็ก |
| `ana/`, `dl/`, `tpl/`, `dz*_real.json`, `disease.csv`, `pop_r7_type13.csv`, `header-v3.webp` | ข้อมูลและรูปที่เดโม่ใช้ |
| `lf/`, `npmq/` | leaflet, html2canvas, qrcode (MIT) สำหรับเดโม่/ทดสอบออฟไลน์ |

## ข้อควรระวัง

- `b4_apply.py` ดึงโค้ดจาก `build_demo.py` **ตามเลขบรรทัด** (622–660) — ถ้าแก้ `build_demo.py` ห้ามเพิ่ม/ลบบรรทัดก่อนบรรทัด 661 (แก้ในบรรทัดเดิมเท่านั้น) ไม่อย่างนั้นเว็บจริงจะ build พัง
- ไม่ใส่สารบัญ (TOC) ในแดชบอร์ด — สารบัญอยู่ใน Figma
- ทุกครั้งที่การแสดงผลข้อมูลเปลี่ยน ให้แก้คำอธิบายใต้หัวข้อ/legend/หมายเหตุให้ตรงด้วย
- ห้ามใส่ API key หรือ token ในไฟล์ใด ๆ (repo เป็นสาธารณะ และ server เสิร์ฟทุกไฟล์ใน repo) — ใช้ Environment ของ Render
- ทดสอบด้วย Playwright (Chromium ติดตั้งไว้แล้วใน workspace) ทั้ง 1366 px และ 390 px: ไม่มี error, ไม่ล้นแนวนอน
