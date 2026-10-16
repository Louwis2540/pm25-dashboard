"""กรอบโหลด (skeleton) ระหว่างรอข้อมูลครั้งแรก — ใช้ร่วมกันทั้งเดโม่และ branch B2
หลัก: Nielsen heuristic #1 Visibility of system status · skeleton screen (Wroblewski 2013) ให้เห็นโครงหน้าก่อนข้อมูลมา
ต้องเรียกหลังเปลี่ยนโซน A (ใช้ #tiles / #facts ของเลย์เอาต์ใหม่)
"""

SK_CSS = """
/* ===== กรอบโหลดระหว่างรอข้อมูล (skeleton) ===== */
@keyframes skMove{from{background-position:120% 0}to{background-position:-120% 0}}
body.is-loading .sk,body.is-loading section .tile.sk,body.is-loading main .fact.sk,
.is-loading :is(#trStats,#drillPanel,#forecast,#hotSide,#advNow,#advRow,#dz,#trendSub):empty,
.is-loading :is(#drillMap,#chart):empty,
.is-loading #t7:empty{
  background:linear-gradient(100deg,rgba(226,232,240,.85) 30%,rgba(247,249,252,.95) 50%,rgba(226,232,240,.85) 70%)!important;
  background-size:220% 100%!important;animation:skMove 1.5s ease-in-out infinite;
  border-radius:16px;box-shadow:none!important;border-color:transparent!important;color:transparent}
.is-loading :is(#trStats,#drillPanel,#forecast,#hotSide):empty{min-height:260px}
.is-loading #advNow:empty{min-height:200px}
.is-loading #advRow:empty{min-height:90px}
.is-loading #dz:empty{min-height:360px}
.is-loading #trendSub:empty{min-height:18px;width:280px}
.is-loading #t7:empty{display:block;height:230px}
.is-loading #drillMap:empty{border-radius:18px}
.is-loading .tile.sk{min-height:190px;border-radius:22px!important;pointer-events:none}
.is-loading .fact.sk{min-height:58px;border-radius:14px!important}
.is-loading #hdrDate .sk{display:block;width:min(340px,70vw);height:56px;border-radius:14px}
.sk-only{display:none}.is-loading .sk-only{display:block}
.ld-toast{display:none}
.is-loading .ld-toast{display:flex;position:fixed;left:16px;right:16px;margin:0 auto;width:max-content;bottom:22px;z-index:3000;align-items:center;gap:10px;
  background:rgba(15,27,45,.9);color:#fff;border-radius:999px;padding:10px 18px 10px 12px;font-size:14px;font-weight:600;line-height:1.35;
  box-shadow:0 10px 28px -8px rgba(15,27,45,.45);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);max-width:calc(100vw - 32px)}
.ld-toast small{display:block;font-size:12px;font-weight:500;opacity:.78}
.ld-spin{width:22px;height:22px;border-radius:50%;border:3px solid rgba(255,255,255,.28);border-top-color:#fff;animation:ldSpin .8s linear infinite;flex:none}
@keyframes ldSpin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.is-loading .sk,.is-loading :is(#trStats,#drillPanel,#forecast,#hotSide,#advNow,#advRow,#dz,#trendSub,#drillMap,#chart,#t7):empty,.ld-spin{animation:none}}
"""

TOAST = ('<div class="ld-toast" role="status" aria-live="polite"><span class="ld-spin" aria-hidden="true"></span>'
         '<span>กำลังโหลดข้อมูลล่าสุด…<small>เปิดครั้งแรกของวันอาจใช้เวลาประมาณ 30 วินาที</small></span></div>\n')


def apply(html, sub):
    """sub(old, new, count=1) จากสคริปต์ที่เรียก — ตรวจจำนวนที่แทนให้ตรง"""
    html_ = html
    # 1) body เริ่มในสถานะกำลังโหลด + แถบสถานะ (role=status ให้โปรแกรมอ่านหน้าจอประกาศ)
    sub("<body>\n", '<body class="is-loading">\n' + TOAST)
    # 2) โครงชั่วคราวในช่องที่ JS จะเขียนทับ (innerHTML) เมื่อข้อมูลมา
    sub('<div class="date" id="hdrDate">–</div>', '<div class="date" id="hdrDate"><span class="sk" aria-hidden="true"></span></div>')
    sub('<div class="tiles" id="tiles"></div>', '<div class="tiles" id="tiles">' + '<div class="tile sk" aria-hidden="true"></div>' * 4 + '</div>')
    sub('<div class="glass facts-box" id="facts"></div>',
        '<div class="glass facts-box" id="facts"><div class="facts">' + '<div class="fact sk" aria-hidden="true"></div>' * 3 + '</div></div>')
    # 3) ข้อมูลชุดแรกวาดเสร็จ → เลิกสถานะโหลด (กันค้าง: ปลดเองหลัง 90 วินาที)
    sub("  // #ig-preview = แสดงหน้า infographic ทับด้านบน",
        '  document.body.classList.remove("is-loading");\n  // #ig-preview = แสดงหน้า infographic ทับด้านบน')
    sub("(async function init() {\n", '(async function init() {\n  setTimeout(() => document.body.classList.remove("is-loading"), 90000);\n')
    return SK_CSS
