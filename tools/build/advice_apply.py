"""โซน 6 คำแนะนำการปฏิบัติตัว แบบใหม่ (เดโม่ 20 พ.ย. 2569): ใหญ่ ข้อความชัด ภาพเวกเตอร์คนตามบริบทของแต่ละระดับ ไอคอนการกระทำ
ถ้อยคำทุกบรรทัดมาจาก LV เดิม · ใช้คลาส ad2-* เพื่อไม่ชนกับ .advice/.adv-row ของอินโฟกราฟิก"""
import base64, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]

JS = (pathlib.Path(__file__).parent / "advice_v2.js").read_text(encoding="utf-8")
CSS = """
/* ===== โซน 6 คำแนะนำ แบบใหม่ (การ์ดมืออาชีพ: ภาพ+ค่าฝุ่น ซ้าย · กล่องข้อความ ขวา) ===== */
#zAdvice .ad2-list{display:flex;flex-direction:column;gap:18px}
.ad2{--line:#e1e7ef;--ink2:#46566a;display:grid;grid-template-columns:minmax(250px,34%) minmax(0,1fr);background:#fff;border:1px solid var(--line);border-top:6px solid var(--c);border-radius:20px;overflow:hidden;box-shadow:0 1px 2px rgba(15,27,45,.05),0 16px 30px -20px rgba(15,27,45,.38)}
.ad2-art{background:linear-gradient(180deg,var(--soft),var(--tint));padding:14px 14px 16px;display:flex;flex-direction:column;gap:12px;border-right:1px solid var(--line)}
.ad2-art img{width:100%;height:auto;aspect-ratio:4/3;object-fit:cover;display:block;border-radius:14px;box-shadow:0 0 0 1px rgba(15,27,45,.08),0 8px 18px -10px rgba(15,27,45,.4)}
.ad2-meter{background:#fff;border:1px solid color-mix(in srgb,var(--c) 35%,#fff);border-radius:14px;padding:10px 14px 12px}
.ad2-rng{display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 8px;color:var(--ink)}
.ad2-rng span{font:600 15px "IBM Plex Sans Thai",sans-serif;color:var(--ink2)}
.ad2-rng b{font:700 26px/1.2 "Anuphan","IBM Plex Sans Thai",sans-serif;letter-spacing:-.01em}
.ad2-rng small{font:500 14px "IBM Plex Sans Thai",sans-serif;color:var(--ink2)}
.ad2-scale{display:grid;grid-template-columns:repeat(5,1fr);gap:4px;margin-top:8px}
.ad2-scale i{height:8px;border-radius:4px;background:var(--k);opacity:.28}
.ad2-scale i.on{opacity:1;height:10px;margin-top:-1px;box-shadow:0 0 0 2px #fff,0 0 0 3.5px var(--k)}
.ad2-b{padding:20px 24px 22px;display:flex;flex-direction:column;gap:14px;min-width:0}
.ad2-h{display:flex}
.ad2-n{font:700 26px/1.3 "Anuphan","IBM Plex Sans Thai",sans-serif;padding:3px 20px;border-radius:999px;background:var(--soft);border:2.5px solid var(--c);color:var(--ink)}
.ad2-s{margin:0;padding:2px 0 2px 16px;border-left:5px solid var(--c);font:600 22px/1.5 "IBM Plex Sans Thai",sans-serif;color:#14212f}
.ad2-gs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.ad2-g{background:#fff;border:1px solid var(--line);border-radius:14px;overflow:hidden;display:flex;flex-direction:column}
.ad2-g h4{margin:0;display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--soft);border-bottom:2px solid color-mix(in srgb,var(--c) 55%,#fff);font:700 18px "Anuphan","IBM Plex Sans Thai",sans-serif;color:var(--ink)}
.ad2-g ul{list-style:none;margin:0;padding:12px 14px 14px;display:flex;flex-direction:column;gap:12px;flex:1}
.ad2-g li{display:grid;grid-template-columns:36px minmax(0,1fr);gap:12px;align-items:center;font:500 18px/1.5 "IBM Plex Sans Thai",sans-serif;color:#14212f}
.ad2-ic{width:36px;height:36px;border-radius:50%;background:var(--tint);border:1px solid color-mix(in srgb,var(--c) 40%,#fff);display:flex;align-items:center;justify-content:center}
.ad2-ic svg{width:22px;height:22px;display:block}
#zAdvice .foot-note{font-size:15px;line-height:1.55;margin-top:12px}
@media (max-width:1100px){.ad2-gs{grid-template-columns:minmax(0,1fr)}}
@media (max-width:900px){.ad2{grid-template-columns:minmax(0,1fr)}.ad2-art{border-right:0;border-bottom:1px solid var(--line);padding:12px}.ad2-art img{max-width:520px;margin:0 auto}.ad2-meter{max-width:520px;width:100%;margin:0 auto}.ad2-b{padding:16px}.ad2-s{font-size:20px}.ad2-n{font-size:24px}}
"""


def apply(html, embed=True):
    a = html.index("function renderAdvice() {")
    b = html.index("\n}\n", a) + 3
    html = html[:a] + JS + "\n" + html[b:]
    if embed:  # เดโม่ใน Artifact โหลดภาพภายนอกไม่ได้ (CSP) จึงฝังเป็น data URI ; เว็บจริงใช้ไฟล์ img/advice/lvN.webp
        for n in range(1, 6):
            f = ROOT / "img" / "advice" / f"lv{n}.webp"
            uri = "data:image/webp;base64," + base64.b64encode(f.read_bytes()).decode()
            html = html.replace(f'"img/advice/lv{n}.webp"', f'"{uri}"', 1)
    old = '<div class="adv-row" id="advRow"></div>'
    if html.count(old) != 1:
        raise SystemExit("advice_apply: ไม่พบ #advRow")
    html = html.replace(old, '<div class="ad2-list" id="advRow"></div>')
    k = html.rindex("</style>", 0, html.index('<body id="top"'))
    return html[:k] + CSS + html[k:]
