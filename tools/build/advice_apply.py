"""โซน 6 คำแนะนำการปฏิบัติตัว แบบใหม่ (เดโม่ 20 พ.ย. 2569): ใหญ่ ข้อความชัด ภาพเวกเตอร์คนตามบริบทของแต่ละระดับ ไอคอนการกระทำ
ถ้อยคำทุกบรรทัดมาจาก LV เดิม · ใช้คลาส ad2-* เพื่อไม่ชนกับ .advice/.adv-row ของอินโฟกราฟิก"""
import pathlib

JS = (pathlib.Path(__file__).parent / "advice_v2.js").read_text(encoding="utf-8")
CSS = """
/* ===== โซน 6 คำแนะนำ แบบใหม่ ===== */
#zAdvice .ad2-list{display:flex;flex-direction:column;gap:16px}
.ad2{--ink2:#46566a;display:grid;grid-template-columns:minmax(210px,270px) minmax(0,1fr);border-radius:22px;overflow:hidden;background:var(--tint);border:2px solid color-mix(in srgb,var(--c) 45%,#fff);box-shadow:0 1px 2px rgba(15,27,45,.06),0 12px 26px -16px rgba(15,27,45,.28)}
.ad2-art{background:var(--soft);padding:14px;display:flex;align-items:center;justify-content:center;border-right:7px solid var(--c)}
.ad2-art svg{width:100%;height:auto;max-width:250px;display:block}
.ad2-b{padding:18px 22px 20px;display:flex;flex-direction:column;gap:12px;min-width:0}
.ad2-b header{display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px}
.ad2-n{font:700 24px "Anuphan","IBM Plex Sans Thai",sans-serif;line-height:1.3;padding:3px 18px;border-radius:999px;background:var(--soft);border:2.5px solid var(--c);color:var(--ink)}
.ad2-r{font:600 17px "IBM Plex Sans Thai",sans-serif;color:var(--ink2)}
.ad2-s{margin:0;font:600 21px/1.5 "IBM Plex Sans Thai",sans-serif;color:#14212f}
.ad2-gs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.ad2-g{background:rgba(255,255,255,.82);border:1px solid color-mix(in srgb,var(--c) 30%,#fff);border-radius:16px;padding:12px 14px}
.ad2-g h4{margin:0 0 8px;display:flex;align-items:center;gap:10px;font:700 18px "Anuphan","IBM Plex Sans Thai",sans-serif;color:var(--ink)}
.ad2-g ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:9px}
.ad2-g li{display:grid;grid-template-columns:28px minmax(0,1fr);gap:10px;align-items:start;font:500 18px/1.5 "IBM Plex Sans Thai",sans-serif;color:#14212f}
.ad2-g li svg{margin-top:1px}
#zAdvice .foot-note{font-size:15px;line-height:1.55;margin-top:12px}
@media (max-width:900px){.ad2{grid-template-columns:minmax(0,1fr)}.ad2-art{border-right:0;border-bottom:7px solid var(--c);padding:10px}.ad2-art svg{max-width:240px}.ad2-gs{grid-template-columns:minmax(0,1fr)}.ad2-b{padding:16px}}
"""


def apply(html):
    a = html.index("function renderAdvice() {")
    b = html.index("\n}\n", a) + 3
    html = html[:a] + JS + "\n" + html[b:]
    old = '<div class="adv-row" id="advRow"></div>'
    if html.count(old) != 1:
        raise SystemExit("advice_apply: ไม่พบ #advRow")
    html = html.replace(old, '<div class="ad2-list" id="advRow"></div>')
    k = html.rindex("</style>", 0, html.index('<body id="top"'))
    return html[:k] + CSS + html[k:]
