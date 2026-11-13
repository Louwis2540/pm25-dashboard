"""แผนที่รวม ค่าฝุ่นรายจังหวัด + จุดความร้อน (ขั้น 2 · เดโม่) — html = apply(html)

รวม 2 ส่วนเดิม (zHot = Leaflet จุดความร้อน · zMap = แผนที่ SVG ค่าฝุ่น) เป็นส่วนเดียว id="zMap":
  • Leaflet แผนที่เดียว: พื้นที่จังหวัดสีตามระดับฝุ่น + ป้ายค่า + จุดความร้อน · ชิปเปิด/ปิดแต่ละชั้น
  • แผงข้างแผนที่ (#hotSide): ค่าฝุ่นและจำนวนจุดความร้อนรายจังหวัด รวมที่มา/คำอธิบายสี
  • real-time ทั้งค่าฝุ่นและจุดความร้อน: ค่าฝุ่น = Air4Thai ค่าเฉลี่ย 24 ชม. ล่าสุดรายชั่วโมง (/api/air4thai-live · ขอใหม่ทุกต้นชั่วโมง+10 นาที)
    จุดความร้อน = GISTDA (/api/hotspot · ทุก 10 นาที) · ปุ่มรีเฟรช
  • แถบนำทางซ้ายเหลือรายการเดียว "แผนที่ค่าฝุ่น · จุดความร้อน"
ไม่แตะ: อินโฟกราฟิกทุกส่วน · เว็บจริง (ใช้ร่วมเดโม่ build_demo.py เท่านั้น เรียกหลัง layout_apply)
"""
import pathlib

HERE = pathlib.Path(__file__).parent

CSS = """
/* ===== แผนที่รวมค่าฝุ่น + จุดความร้อน (ขั้น 2) ===== */
.mm-bar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px 18px;margin-bottom:12px}
.mm-layers{display:flex;flex-wrap:wrap;gap:8px}
.mm-chip{display:inline-flex;align-items:center;gap:9px;padding:8px 16px 8px 12px;border-radius:999px;border:1.5px solid var(--line-strong);background:#fff;font:600 calc(13.5px*var(--fs,1)) "IBM Plex Sans Thai",sans-serif;color:var(--ink-2);cursor:pointer;line-height:1.25;text-align:left}
.mm-chip small{display:block;font-weight:500;font-size:calc(11.5px*var(--fs,1));color:var(--ink-3)}
.mm-chip .d{width:16px;height:16px;border-radius:50%;flex:none;border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.25)}
.mm-chip .d.pm{background:conic-gradient(#00a3e8 0 25%,#0f8a00 0 50%,#ffd400 0 75%,#ff8000 0)}
.mm-chip .d.hs{background:#e8192c}
.mm-chip[aria-pressed="true"]{border-color:var(--sec,#1c6ed6);background:color-mix(in srgb,var(--sec,#1c6ed6) 9%,#fff);color:var(--ink-1);box-shadow:0 3px 10px -5px var(--sec,#1c6ed6)}
.mm-chip[aria-pressed="false"]{opacity:.6}
.mm-chip:focus-visible,.mm-rf:focus-visible,.mm-row:focus-visible{outline:3px solid var(--sec,#1c6ed6);outline-offset:2px}
.mm-ctl{display:flex;flex-wrap:wrap;align-items:center;gap:10px 18px}
.mm-live{display:flex;flex-direction:column;align-items:flex-start;gap:5px;font-size:calc(12.5px*var(--fs,1));color:var(--ink-2);font-weight:600;position:relative}
.mm-ln{display:flex;align-items:center;flex-wrap:wrap;gap:2px 10px}
.mm-ln.err{color:#b45309}.mm-ln em{font-style:normal;color:#b45309;font-weight:700}
.mm-dot.off{background:#94a3b8;animation:none}
.mm-live b{color:var(--ink-1)}
.mm-dot{width:10px;height:10px;border-radius:50%;background:#16a34a;flex:none;animation:mmPulse 2s infinite}
@keyframes mmPulse{0%{box-shadow:0 0 0 0 rgba(22,163,74,.55)}70%{box-shadow:0 0 0 9px rgba(22,163,74,0)}100%{box-shadow:0 0 0 0 rgba(22,163,74,0)}}
.mm-live.err .mm-dot{background:#d97706;animation:none}
.mm-live .mm-nx{color:var(--ink-3);font-weight:500}
.mm-live .mm-rf{align-self:flex-start;margin-top:2px}
.mm-rf{border:1.5px solid var(--line-strong);background:#fff;border-radius:999px;padding:4px 14px;font:600 calc(12.5px*var(--fs,1)) "IBM Plex Sans Thai",sans-serif;color:var(--ink-1);cursor:pointer}
.mm-rf:disabled{opacity:.55;cursor:default}
#drillMap[hidden]{display:none!important}
.mm-main #map{height:520px;background:#e7edf3}
.mm-badge{background:rgba(255,255,255,.94);border:1.5px solid var(--line-strong);border-radius:12px;padding:6px 11px;font:600 12.5px "IBM Plex Sans Thai",sans-serif;color:var(--ink-1);line-height:1.35;box-shadow:0 2px 8px rgba(15,27,45,.18);max-width:230px}
.mm-badge small{display:block;font-weight:500;font-size:11px;color:var(--ink-3)}
.mm-badge.prev{background:#fff8e6;border-color:#f0c36d;color:#7a5200}.mm-badge.prev small{color:#9a6b00}
.mm-dl{transform:translate(-50%,-50%);white-space:nowrap;pointer-events:none;font:600 11px "IBM Plex Sans Thai",sans-serif;color:#33475f;text-shadow:0 0 3px #fff,0 0 3px #fff,0 0 4px #fff}
.mm-main .leaflet-control-scale-line{font:600 11px "IBM Plex Sans Thai",sans-serif}
.mm-main .legend{justify-content:center;margin-top:8px}
.mm-main .map-note{margin-top:10px}
.mm-lab{transform:translate(-50%,-50%);text-align:center;pointer-events:none;white-space:nowrap;display:flex;flex-direction:column;align-items:center;gap:2px}
.mm-lab b{font:600 12.5px "IBM Plex Sans Thai",sans-serif;color:#0e2a47;text-shadow:0 0 3px #fff,0 0 3px #fff,0 0 5px #fff}
.mm-lab span{display:inline-block;padding:1px 9px;border-radius:999px;font:700 15px "Anuphan","IBM Plex Sans Thai",sans-serif;border:1.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3)}
.mm-tb{display:flex;flex-direction:column}
.mm-th,.mm-row{display:grid;grid-template-columns:minmax(0,1fr) 64px 56px;gap:8px;align-items:center}
.mm-th{font-size:calc(11.5px*var(--fs,1));font-weight:600;color:var(--ink-3);padding:0 0 4px}
.mm-th span:nth-child(n+2),.mm-row b{text-align:center}
.mm-th small{display:block;font-size:calc(10.5px*var(--fs,1));font-weight:500}
.mm-row{width:100%;background:none;border:0;border-top:1px solid var(--line);padding:6px 0;cursor:pointer;font:inherit;color:inherit;text-align:left}
.mm-row:hover{background:rgba(15,27,45,.04)}
.mm-pm{display:inline-block;text-align:center;border-radius:999px;padding:1px 0;font-weight:700}
.mm-src{font-size:calc(11.5px*var(--fs,1));color:var(--ink-3);line-height:1.5;font-weight:500}
@media (max-width:1100px){.hot.mm{grid-template-columns:minmax(0,1fr)}}
@media (max-width:680px){.mm-main #map{height:420px}.mm-badge{max-width:170px;font-size:11.5px}.mm-chip{flex:1 1 100%}.mm-lab b{font-size:11px}.mm-lab span{font-size:13px;padding:0 6px}}
@media (prefers-reduced-motion:reduce){.mm-dot{animation:none}}
"""


def _cut(html, a, b):
    i = html.index(a); j = html.index(b, i)
    return html[:i], html[i:j], html[j:]


DEMO_MOCK = r"""<script>
/* DEMO — ค่าฝุ่นล่าสุดรายชั่วโมงจำลอง (เดโม่เท่านั้น · เว็บจริงใช้ /api/air4thai-live จาก Air4Thai) */
(function () {
  const f = window.fetch.bind(window), BASE = { "ขอนแก่น": 12.4, "มหาสารคาม": 21.8, "ร้อยเอ็ด": 31.2, "กาฬสินธุ์": 48.6 };
  window.fetch = (u, o) => {
    const k = String(u).replace(/^https?:\/\/[^/]+/, "").split("?")[0];
    if (k !== "/api/air4thai-live") return f(u, o);
    const d = new Date(), p = n => String(n).padStart(2, "0"), hh = d.getHours(), date = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    const data = Object.keys(BASE).map((n, i) => ({ name: n, pm25: Math.round(BASE[n] * (1 + .35 * Math.sin(hh / 24 * 2 * Math.PI + i)) * 10) / 10, date, time: p(hh) + ":00", n: 3, stations: [], stale: false }));
    return new Promise(r => setTimeout(r, 1200)).then(() => new Response(JSON.stringify({ ok: true, source: "Air4Thai (จำลอง)", data }), { headers: { "Content-Type": "application/json" } }));
  };
})();
</script>
"""


def apply(html, demo=True):
    # ---------- 1) แทนส่วน zHot + zMap เดิม (ที่ layout_apply วางติดกัน) ด้วยส่วนเดียว ----------
    head, old, tail = _cut(html, "  <!-- 6) Hotspot -->", "  <!-- 8) โรค -->")
    assert 'id="zHot"' in old and 'id="zMap"' in old, "map_merge: ไม่พบ zHot/zMap ตามลำดับของ layout_apply"
    pm = '<span class="pm25">PM<sub>2.5</sub></span>'
    sec = f"""  <!-- 6) แผนที่รวม ค่าฝุ่น + จุดความร้อน (ขั้น 2) -->
  <section id="zMap" style="--sec:#1c6ed6">
    <div class="sec-h"><div class="badge"><svg class="ico"><use href="#i-map"/></svg></div>
      <div><h2>แผนที่ค่าฝุ่น {pm} และจุดความร้อน</h2><p>ค่าฝุ่นรายจังหวัดล่าสุด (เฉลี่ย 24 ชม. · Air4Thai · อัปเดตรายชั่วโมง) ซ้อนกับจุดความร้อน (GISTDA VIIRS · ย้อนหลัง 24 ชม.) · คลิกจังหวัดบนแผนที่เพื่อดูรายละเอียด</p></div></div>
    <div class="mm-bar" id="mmBar">
      <div class="mm-ctl">
        <div class="mm-layers" role="group" aria-label="ชั้นข้อมูลบนแผนที่">
          <button type="button" class="mm-chip" data-l="pm" aria-pressed="true"><i class="d pm"></i><span>ค่าฝุ่น {pm} รายจังหวัด<small>ค่าเฉลี่ย 24 ชม. · Air4Thai</small></span></button>
          <button type="button" class="mm-chip" data-l="hs" aria-pressed="true"><i class="d hs"></i><span>จุดความร้อน<small>GISTDA VIIRS · ย้อนหลัง 24 ชม.</small></span></button>
        </div>
      </div>
      <div class="mm-live" id="mmLive" role="status"></div>
    </div>
    <div class="hot mm">
      <div class="mm-main">
        <div id="map"></div>
        <svg id="drillMap" hidden aria-hidden="true" viewBox="0 0 400 290"></svg>
        <div class="legend" id="aqiLegend"></div>
        <div class="map-note" id="mapNote"></div>
      </div>
      <div class="card hot-side" id="hotSide"></div>
    </div>
  </section>

"""
    html = head + sec + tail

    # ---------- 2) แถบนำทางซ้าย: เหลือรายการเดียว ----------
    old_menu = '["zHot", "จุดความร้อน"], ["zMap", "แผนที่ค่าฝุ่น"],'
    assert html.count(old_menu) == 1, html.count(old_menu)
    html = html.replace(old_menu, '["zMap", "แผนที่ค่าฝุ่น · จุดความร้อน"],')

    # ---------- 3) JS: ประกาศ renderHotspot ใหม่ทับของเดิม (อยู่ก่อนส่วนโรค) ----------
    js = (HERE / "map_merge.js").read_text(encoding="utf-8")
    anchor = "// ---------- โรค: แท่งรายเดือน 2568 (เทา) vs 2569 (สีกลุ่มโรค) ----------"
    assert html.count(anchor) == 1, html.count(anchor)
    html = html.replace(anchor, js + "\n" + anchor)

    # ---------- 3b) เดโม่: จำลอง /api/air4thai-live (วางก่อนสคริปต์หลัก ต่อจากตัวจำลองเดิมของ build_demo) ----------
    if demo:
        mk = "<script>\n/* ==="
        assert html.count(mk) == 1, html.count(mk)
        html = html.replace(mk, DEMO_MOCK + mk)

    # ---------- 4) CSS: <style> ก้อนสุดท้ายก่อน <body> (ชนะ CSS เดิม) ----------
    body = html.index('<body id="top"'); k = html.rindex("</style>", 0, body)
    html = html[:k] + CSS + html[k:]
    return html
