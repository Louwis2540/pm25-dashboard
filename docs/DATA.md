# ข้อมูลของแดชบอร์ด PM2.5 เขตสุขภาพที่ 7

สรุปแหล่งข้อมูล ชีต สคริปต์ และการตัดสินใจเรื่องข้อมูล (อัปเดต 16 ต.ค. 2569)

## หลักการแสดงค่าฝุ่น (Louis ตัดสินใจ 16 ต.ค. 2569)

- ค่าฝุ่นรายจังหวัดทุกจุดบนเว็บแสดงเป็น **ค่าเฉลี่ย 24 ชั่วโมง ณ เวลา 07.00 น.** ของแต่ละวัน
- ใช้ **สถานีตรวจวัด Air4Thai (กรมควบคุมมลพิษ) ร่วมกับดาวเทียม GISTDA** ในวันที่สถานีไม่มีข้อมูล — รวมเป็นชุดเดียว ไม่ต้องเน้นความต่างของแหล่ง
- ไม่อ้างถึงค่ารอบบ่าย/15.00 น. บนเว็บ · ในชุดดาวน์โหลดคอลัมน์ `pm25_source` = `station` / `satellite`
- เกณฑ์ PHEOC: ค่าเฉลี่ย 24 ชม. ณ 07.00 น. ≥ 75.1 µg/m³ **ติดกัน 2 วัน** ในจังหวัดเดียวกัน (ใช้ตรงกันทั้ง `line_report.gs`, `/api/pheoc`, `config.json → pheoc`)

## Google Sheet (`config.json → api.sheet_id`)

| แท็บ | เนื้อหา |
|---|---|
| `PM25_History` | วันที่ + ค่าฝุ่น 4 จังหวัด (ขอนแก่น ร้อยเอ็ด กาฬสินธุ์ มหาสารคาม) — เว็บอ่านแท็บนี้ |
| `PM25_07` | ค่าเฉลี่ย 24 ชม. ณ 07:00 จากค่ารายชั่วโมง Air4Thai (ตั้งแต่ 2 ส.ค. 2569) |
| `_backfill_log` | ทุกค่าที่เติม/เปลี่ยน: เวลา วันที่ จังหวัด ค่า วิธี (`r15`, `to07`, `gistda`, `clear-zero`) แหล่ง |
| `PM25_History_backup_*` | สำรองอัตโนมัติก่อนสคริปต์เขียนทับทุกครั้ง |
| `latest` / `snapshot` / `_log` / `_sync_status` | ผู้ป่วย 4 กลุ่มโรครายสัปดาห์จาก HDC (`moph_to_sheet.gs`) |
| `_visits` | สถิติการเข้าชม (จาก Apps Script แยก `visits.gs`) |

### ที่มาของค่าใน `PM25_History` (ปี 2569)

| ช่วง | แหล่ง |
|---|---|
| 1–27 ม.ค. | GISTDA ดาวเทียม ไฟล์ `PM25_Province_1m_2026-01-31.csv` (เติม 16 ต.ค. ด้วย `backfillGistda`) |
| 28 ม.ค.–18 ก.พ. (+ กาฬสินธุ์ 23 ก.พ.) | GISTDA ดาวเทียม ไฟล์ `PM25_Province_1m_2026-02-28.csv` |
| 19 ก.พ.–1 ส.ค. | สถานี Air4Thai (บันทึกรายวันโดย `line_report.gs`) |
| ตั้งแต่ 2 ส.ค. | สถานี Air4Thai ค่าเฉลี่ย 24 ชม. ณ 07:00 (`historyTo07` + บันทึกทุกวัน) |

25–30 มี.ค. 2569 เติมจากไฟล์ `pm2.5_history.xlsx` ที่ Louis ส่งมาจาก IT หน่วยงาน (19 ต.ค. 2569 · `backfillGistda` — ใช้คอลัมน์ pm2_5 จากชีต air_quality_forcast)

## Apps Script

| โปรเจกต์ | ไฟล์ | ฟังก์ชันหลัก |
|---|---|---|
| `pm.2.5` | `line_report.gs` | `main` (รายงาน LINE) · `recordHistoryAndCheckPHEOC` (บันทึกค่า 07:00 เมื่อวาน+วันนี้ลง PM25_History และเช็ค PHEOC) |
| `pm.2.5` | `pm25_backfill.gs` | `backfillGistda` (เติมค่าดาวเทียม เฉพาะช่องว่าง ไม่ทับค่าสถานี) · `backfill07` · `historyTo07` · `backfillValidate` / `backfillWrite` / `backfillDebug` / `backfillProbe` |
| `pm.2.5` | `moph_to_sheet.gs` | ดึงผู้ป่วย HDC ลงแท็บ latest/snapshot |
| `pm25-visits` (แยกโปรเจกต์) | `visits.gs` | `doPost` รับยอดผู้เข้าชม · Script Property `VISIT_TOKEN` |

วิธีรันสคริปต์: เปิด script.google.com → โปรเจกต์ → วางโค้ดไฟล์จาก `tools/` ทับ → บันทึก → เลือกฟังก์ชัน → Run → ดู Execution log

## แหล่งข้อมูลภายนอก

| แหล่ง | ใช้ทำอะไร | ข้อจำกัด |
|---|---|---|
| Air4Thai `getHistoryData.php` | ค่ารายชั่วโมงของสถานี 46t (ขอนแก่น) 114t (มหาสารคาม) 113t (ร้อยเอ็ด) 107t (กาฬสินธุ์) | เก็บรายชั่วโมงย้อนหลังได้ถึง 1 ส.ค. 2569 เท่านั้น |
| GISTDA pm25.gistda.or.th/download | ค่าดาวเทียมรายจังหวัด: "รายวัน (1 เดือน)" = `/rest/getPM25by1mProvinceAsCSV?dt1=YYYY-MM-DD&id=0` · "เฉลี่ย 24 ชม. ต่อเนื่อง" รายชั่วโมง = `/rest/getPM25by24hrsProvinceAsCSV?dt1=YYYY-MM-DD HH:00&id=0` | มีย้อนหลังตั้งแต่ 1 ม.ค. 2567 · ไฟล์แต่ละรุ่นค่าต่างกันเล็กน้อย |
| GISTDA API (server, `GISTDA_KEY`) | ค่ารายอำเภอ/ตำบล คาดการณ์ จุดความร้อน VIIRS | key อยู่ใน Environment ของ Render เท่านั้น |
| กรมควบคุมมลพิษ pcd.gdcatalog.go.th | ค่ารายวันรายสถานีทั่วประเทศ (ชุด `12_02_aaq_pm2-5_bkk_metro`) | เผยแพร่รายปี ล่าสุดถึงปี 2568 |
| Open-Meteo | ลม ความสูงชั้นผสมอากาศ ความชื้น ฝน (ปัจจัยคาดการณ์) | — |
| HDC / MOPH Open Data | ผู้ป่วย 4 กลุ่มโรค (`s_pm25_1_in_week`, `s_pm25_2_in_week`) ประชากรกลางปี Type 1+3 | 4 สัปดาห์ล่าสุดเป็นข้อมูลเบื้องต้น |

## API ของ server (`server.js`)

| เส้นทาง | ข้อมูล | แคช |
|---|---|---|
| `/api/sheet-pm25` | PM25_History ทั้งหมด | 5 นาที |
| `/api/pm25-07` | แท็บ PM25_07 | — |
| `/api/pheoc` | สถานะ PHEOC จากค่า 07:00 | — |
| `/api/disease-pv` | ผู้ป่วยรายจังหวัดรายสัปดาห์ (rows = Type 1+3, rows1 = ทุกคน) | 1 ชม. |
| `/api/pm25/provinces` | ค่าดาวเทียมรายจังหวัด + ปัจจัยคาดการณ์ (C5) | — |
| `/api/visit` | สถิติการเข้าชม (ต้องตั้ง `VISIT_HOOK_URL`, `VISIT_TOKEN` ใน Render) | ส่งยอดทุก 5 นาที |

Environment ของ Render: `GISTDA_KEY`, `SHEET_ID`, `VISIT_HOOK_URL`, `VISIT_TOKEN`
