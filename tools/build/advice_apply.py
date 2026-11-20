"""โซน 6 คำแนะนำการปฏิบัติตัว แบบใหม่ (เดโม่ 20 พ.ย. 2569): ใหญ่ ข้อความชัด ภาพเวกเตอร์คนตามบริบทของแต่ละระดับ ไอคอนการกระทำ
ถ้อยคำทุกบรรทัดมาจาก LV เดิม · ใช้คลาส ad2-* เพื่อไม่ชนกับ .advice/.adv-row ของอินโฟกราฟิก"""
import base64, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]

JS = (pathlib.Path(__file__).parent / "advice_v2.js").read_text(encoding="utf-8")
CSS = """
/* ===== โซน 6 คำแนะนำ · Liquid Glass (ฟองกระจกแบบ iOS 26) : ภาพ+ค่าฝุ่นซ้าย · กล่องข้อความขวา ===== */
#zAdvice .ad2-list{display:flex;flex-direction:column;gap:22px}
.ad2{--rim:rgba(255,255,255,.85);--ink2:#46566a;position:relative;isolation:isolate;display:grid;grid-template-columns:minmax(250px,34%) minmax(0,1fr);border-radius:34px;overflow:hidden;
  background:linear-gradient(160deg,rgba(255,255,255,.62),rgba(255,255,255,.2) 42%,rgba(255,255,255,.06)),color-mix(in srgb,var(--c) 9%,rgba(255,255,255,.46));
  -webkit-backdrop-filter:blur(28px) saturate(190%);backdrop-filter:blur(28px) saturate(190%);
  border:1px solid var(--rim);
  box-shadow:inset 0 2px 1px rgba(255,255,255,.95),inset 0 -2px 6px color-mix(in srgb,var(--c) 14%,rgba(255,255,255,.3)),inset 0 0 0 .5px rgba(255,255,255,.5),0 2px 4px rgba(15,27,45,.05),0 26px 48px -26px color-mix(in srgb,var(--c) 55%,rgba(15,27,45,.45));
  transition:transform .45s var(--ios-spring,cubic-bezier(.2,.9,.25,1.15)),box-shadow .35s ease}
.ad2::before{content:"";position:absolute;inset:0;border-radius:inherit;z-index:-1;pointer-events:none;
  background:radial-gradient(110% 60% at 10% -12%,rgba(255,255,255,.8),transparent 58%),radial-gradient(55% 55% at 100% 105%,color-mix(in srgb,var(--c) 30%,transparent),transparent 72%),radial-gradient(40% 40% at 38% 112%,color-mix(in srgb,var(--c) 16%,transparent),transparent 75%)}
@media (hover:hover){.ad2:hover{transform:translateY(-3px)}}
.ad2-art{padding:18px 8px 18px 18px;display:flex;flex-direction:column;gap:14px}
.ad2-art img{width:100%;height:auto;aspect-ratio:4/3;object-fit:cover;display:block;border-radius:26px;
  box-shadow:0 0 0 3px rgba(255,255,255,.72),0 0 0 4px color-mix(in srgb,var(--c) 28%,rgba(255,255,255,.4)),0 16px 28px -14px color-mix(in srgb,var(--c) 60%,rgba(15,27,45,.5))}
.ad2-meter{border-radius:24px;padding:11px 16px 14px;background:linear-gradient(170deg,rgba(255,255,255,.78),rgba(255,255,255,.34));-webkit-backdrop-filter:blur(14px) saturate(170%);backdrop-filter:blur(14px) saturate(170%);
  border:1px solid var(--rim);box-shadow:inset 0 1.5px 0 #fff,inset 0 -1px 3px color-mix(in srgb,var(--c) 18%,transparent),0 8px 18px -12px color-mix(in srgb,var(--c) 55%,rgba(15,27,45,.4))}
.ad2-rng{display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 8px;color:var(--ink)}
.ad2-rng span{font:600 15px "IBM Plex Sans Thai",sans-serif;color:var(--ink2)}
.ad2-rng b{font:700 27px/1.2 "Anuphan","IBM Plex Sans Thai",sans-serif;letter-spacing:-.01em}
.ad2-rng small{font:500 14px "IBM Plex Sans Thai",sans-serif;color:var(--ink2)}
.ad2-scale{display:grid;grid-template-columns:repeat(5,1fr);gap:5px;margin-top:9px}
.ad2-scale i{height:10px;border-radius:999px;background:linear-gradient(180deg,rgba(255,255,255,.7),rgba(255,255,255,0) 60%),var(--k);opacity:.34;box-shadow:inset 0 1px 0 rgba(255,255,255,.7)}
.ad2-scale i.on{opacity:1;height:14px;margin-top:-2px;box-shadow:inset 0 1.5px 0 rgba(255,255,255,.9),0 0 0 2px rgba(255,255,255,.95),0 0 0 3.5px var(--k),0 4px 10px -2px var(--k)}
.ad2-b{padding:22px 26px 24px 20px;display:flex;flex-direction:column;gap:16px;min-width:0}
.ad2-h{display:flex}
.ad2-n{position:relative;overflow:hidden;font:700 26px/1.3 "Anuphan","IBM Plex Sans Thai",sans-serif;padding:4px 24px;border-radius:999px;color:var(--ink);
  background:linear-gradient(180deg,rgba(255,255,255,.85),rgba(255,255,255,.25) 55%),color-mix(in srgb,var(--c) 30%,rgba(255,255,255,.5));border:1px solid var(--rim);
  box-shadow:inset 0 2px 1px #fff,inset 0 -3px 6px color-mix(in srgb,var(--c) 30%,transparent),0 8px 18px -8px color-mix(in srgb,var(--c) 70%,rgba(15,27,45,.3))}
.ad2-s{position:relative;margin:0;padding:2px 0 2px 20px;font:600 22px/1.5 "IBM Plex Sans Thai",sans-serif;color:#14212f}
.ad2-s::before{content:"";position:absolute;left:0;top:3px;bottom:3px;width:7px;border-radius:999px;background:linear-gradient(90deg,rgba(255,255,255,.7),transparent 70%),var(--c);box-shadow:0 4px 10px -3px var(--c)}
.ad2-gs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.ad2-g{border-radius:26px;overflow:hidden;display:flex;flex-direction:column;padding:8px;
  background:linear-gradient(165deg,rgba(255,255,255,.7),rgba(255,255,255,.3));-webkit-backdrop-filter:blur(16px) saturate(170%);backdrop-filter:blur(16px) saturate(170%);
  border:1px solid var(--rim);box-shadow:inset 0 1.5px 0 #fff,inset 0 -1px 4px color-mix(in srgb,var(--c) 12%,transparent),0 10px 22px -16px color-mix(in srgb,var(--c) 50%,rgba(15,27,45,.4))}
.ad2-g h4{margin:0;display:flex;align-items:center;gap:10px;padding:7px 16px 7px 10px;border-radius:999px;align-self:flex-start;
  background:linear-gradient(180deg,rgba(255,255,255,.8),rgba(255,255,255,.2) 60%),color-mix(in srgb,var(--c) 26%,rgba(255,255,255,.5));border:1px solid var(--rim);
  box-shadow:inset 0 1.5px 0 #fff,inset 0 -2px 4px color-mix(in srgb,var(--c) 22%,transparent);font:700 18px "Anuphan","IBM Plex Sans Thai",sans-serif;color:var(--ink)}
.ad2-g ul{list-style:none;margin:0;padding:14px 8px 8px;display:flex;flex-direction:column;gap:13px;flex:1}
.ad2-g li{display:grid;grid-template-columns:40px minmax(0,1fr);gap:12px;align-items:center;font:500 18px/1.5 "IBM Plex Sans Thai",sans-serif;color:#14212f}
.ad2-ic{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.95);
  background:radial-gradient(circle at 30% 24%,#fff 0 11%,rgba(255,255,255,.55) 32%,color-mix(in srgb,var(--c) 26%,rgba(255,255,255,.4)) 100%);
  box-shadow:inset 0 -4px 7px color-mix(in srgb,var(--c) 26%,transparent),inset 0 2px 3px #fff,0 6px 12px -6px color-mix(in srgb,var(--c) 70%,rgba(15,27,45,.4))}
.ad2-ic svg{width:22px;height:22px;display:block}
#zAdvice .foot-note{font-size:15px;line-height:1.55;margin-top:14px}
@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){.ad2{background:color-mix(in srgb,var(--c) 10%,#fff)}.ad2-g,.ad2-meter{background:rgba(255,255,255,.92)}}
@media (max-width:1100px){.ad2-gs{grid-template-columns:minmax(0,1fr)}}
@media (max-width:900px){.ad2{grid-template-columns:minmax(0,1fr);border-radius:28px}.ad2-art{padding:14px 14px 4px}.ad2-art img{max-width:520px;margin:0 auto;border-radius:22px}.ad2-meter{max-width:520px;width:100%;margin:0 auto}.ad2-b{padding:16px 16px 18px}.ad2-s{font-size:20px}.ad2-n{font-size:24px}}
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
