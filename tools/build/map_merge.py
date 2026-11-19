"""แผนที่รวม ค่าฝุ่นรายจังหวัด + จุดความร้อน (ขั้น 2 · เดโม่) — html = apply(html)

รวม 2 ส่วนเดิม (zHot = Leaflet จุดความร้อน · zMap = แผนที่ SVG ค่าฝุ่น) เป็นส่วนเดียว id="zMap":
  • Leaflet แผนที่เดียว: พื้นที่จังหวัดสีตามระดับฝุ่น + ป้ายค่า + จุดความร้อน · ชิปเปิด/ปิดแต่ละชั้น
  • แผงข้างแผนที่ (#hotSide): ค่าฝุ่นและจำนวนจุดความร้อนรายจังหวัด รวมที่มา/คำอธิบายสี
  • ค่าฝุ่น = ค่าเฉลี่ยรายชั่วโมงจาก GISTDA (/api/pm25/provinces) แสดงที่จังหวัด · ค่ารายอำเภอ (/api/pm25/districts) แสดงเมื่อชี้เคอร์เซอร์ที่อำเภอ
    ไม่ใช้สีระดับฝุ่นบนแผนที่ · จุดความร้อน = GISTDA VIIRS ย้อนหลัง 24 ชม. ดึงตอนเปิดหน้า (ไม่รีเฟรชอัตโนมัติ) · ปุ่มรีเฟรชขอเฉพาะค่าฝุ่น
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
.mm-chip .d.pm{background:#6b7689}
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
#drillMap[hidden],#mapNote[hidden]{display:none!important}
.mm-main #map{height:520px;background:#e7edf3}
.mm-badge{background:rgba(255,255,255,.94);border:1.5px solid var(--line-strong);border-radius:12px;padding:6px 11px;font:600 12.5px "IBM Plex Sans Thai",sans-serif;color:var(--ink-1);line-height:1.35;box-shadow:0 2px 8px rgba(15,27,45,.18);max-width:230px}
.mm-badge small{display:block;font-weight:500;font-size:11px;color:var(--ink-3)}
.mm-badge.prev{background:#fff8e6;border-color:#f0c36d;color:#7a5200}.mm-badge.prev small{color:#9a6b00}
.mm-dl{transform:translate(-50%,-50%);white-space:nowrap;pointer-events:none;font:600 11px "IBM Plex Sans Thai",sans-serif;color:#33475f;text-shadow:0 0 3px #fff,0 0 3px #fff,0 0 4px #fff}
.mm-bases{display:flex;flex-direction:column;gap:0;margin-top:8px;background:#fff;border:2px solid rgba(0,0,0,.2);border-radius:4px;overflow:hidden;box-shadow:none}
.mm-bases button{appearance:none;border:0;background:#fff;color:var(--ink-2,#33415c);font:600 12.5px "IBM Plex Sans Thai",sans-serif;padding:7px 10px;cursor:pointer;text-align:center;white-space:nowrap;min-height:34px}
.mm-bases button+button{border-top:1px solid #d5dce6}
.mm-bases button[aria-pressed="true"]{background:#0e2a47;color:#fff}
.mm-bases button:focus-visible{outline:3px solid var(--sec,#1c6ed6);outline-offset:-3px}
#map .leaflet-interactive,#map path,#map svg,#map.leaflet-container,#map .leaflet-container{outline:none!important;-webkit-tap-highlight-color:transparent}   /* ไม่ให้เบราว์เซอร์วาดกรอบสี่เหลี่ยมรอบอำเภอ/จังหวัดตอนชี้หรือคลิก */
.hot-side .label small{display:block;font-weight:500;font-size:calc(11.5px*var(--fs,1));color:var(--ink-3);text-transform:none;letter-spacing:0;margin-top:2px}
.mm-note{position:absolute;left:50%;bottom:34px;transform:translateX(-50%);z-index:800;max-width:min(92%,460px);padding:6px 12px;border-radius:10px;background:#fff8e6;border:1px solid #f0c36d;color:#7a5200;font:600 12.5px "IBM Plex Sans Thai",sans-serif;text-align:center;box-shadow:0 2px 8px rgba(15,27,45,.2);pointer-events:none}
.mm-note[hidden]{display:none}
.mm-sat .mm-dl{color:#fff;text-shadow:0 0 3px #000,0 0 4px #000,0 0 6px #000}
.mm-sat .mm-lab b{color:#fff;text-shadow:0 0 3px #000,0 0 5px #000,0 0 7px #000}
.mm-main .leaflet-control-scale-line{font:600 11px "IBM Plex Sans Thai",sans-serif}
.mm-main .legend{justify-content:center;margin-top:8px}
.mm-main .map-note{margin-top:10px}
.mm-lab{transform:translate(-50%,-50%);text-align:center;pointer-events:none;white-space:nowrap;display:flex;flex-direction:column;align-items:center;gap:2px}
.mm-lab b{font:600 12.5px "IBM Plex Sans Thai",sans-serif;color:#0e2a47;text-shadow:0 0 3px #fff,0 0 3px #fff,0 0 5px #fff}
.mm-lab span{display:inline-block;padding:1px 9px;border-radius:999px;font:700 15px "Anuphan","IBM Plex Sans Thai",sans-serif;background:#fff;color:#1f2a3d;border:1.5px solid #b8c4d3;box-shadow:0 1px 4px rgba(0,0,0,.22)}
.mm-tp{font-weight:500;color:#5f6c80}
#aqiLegend[hidden]{display:none!important}
.mm-tb{display:flex;flex-direction:column}
.mm-th,.mm-row{display:grid;grid-template-columns:minmax(0,1fr) 64px 56px;gap:8px;align-items:center}
.mm-th{font-size:calc(11.5px*var(--fs,1));font-weight:600;color:var(--ink-3);padding:0 0 4px}
.mm-th span:nth-child(n+2),.mm-row b{text-align:center}
.mm-th small{display:block;font-size:calc(10.5px*var(--fs,1));font-weight:500}
.mm-row{width:100%;background:none;border:0;border-top:1px solid var(--line);padding:6px 0;cursor:pointer;font:inherit;color:inherit;text-align:left}
.mm-row:hover{background:rgba(15,27,45,.04)}
.mm-pm{display:inline-block;text-align:center;border-radius:999px;padding:1px 0;font-weight:700;background:#eef1f5;color:var(--ink-1)}
.mm-src{font-size:calc(11.5px*var(--fs,1));color:var(--ink-3);line-height:1.5;font-weight:500}
@media (max-width:1100px){.hot.mm{grid-template-columns:minmax(0,1fr)}}
@media (max-width:680px){.mm-main #map{height:420px}.mm-badge{max-width:160px;font-size:11px;padding:5px 8px}.mm-badge small{font-size:10px}.mm-chip{flex:1 1 100%}.mm-lab b{font-size:11px}.mm-lab span{font-size:13px;padding:0 6px}}
@media (prefers-reduced-motion:reduce){.mm-dot{animation:none}}
"""


def _cut(html, a, b):
    i = html.index(a); j = html.index(b, i)
    return html[:i], html[i:j], html[j:]


DEMO_MOCK = r"""<script>
/* DEMO — ค่าเฉลี่ยรายชั่วโมง GISTDA จำลอง (เดโม่เท่านั้น · เว็บจริงใช้ pm25 จาก /api/pm25/provinces และ /api/pm25/districts)
   เติมฟิลด์ pm25 + เวลาปัจจุบันให้เฉพาะคำขอที่มี ?src=map เพื่อไม่กระทบข้อมูลคาดการณ์/หน้าอื่นที่ใช้ endpoint เดียวกัน */
(function () {
  const f = window.fetch.bind(window);
  const mk = (j, asOf, hh) => new Response(JSON.stringify({ ...j, asOf, items: (j.items || []).map((it, i) => ({ ...it, pm25: Math.round(it.avg24 * (1 + .3 * Math.sin(hh / 24 * 2 * Math.PI + i)) * 10) / 10 })) }), { headers: { "Content-Type": "application/json" } });
  window.fetch = (u, o) => {
    const s = String(u), k = s.replace(/^https?:\/\/[^/]+/, "").split("?")[0];
    if (!/[?&]src=map\b/.test(s) || (k !== "/api/pm25/provinces" && k !== "/api/pm25/districts")) return f(u, o);
    const d = new Date(Date.now() + 7 * 3600e3), p = n => String(n).padStart(2, "0"), hh = d.getUTCHours(), asOf = `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(hh)}:00:00`;   // เวลาไทย
    return f(u, o).then(r => r.json()).then(j => new Promise(ok => setTimeout(() => ok(mk(j, asOf, hh)), 900)));
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
      <div><h2>แผนที่ค่าฝุ่น {pm} และจุดความร้อน</h2><p>ค่าเฉลี่ยรายชั่วโมงรายจังหวัด (GISTDA) ซ้อนกับจุดความร้อน (GISTDA VIIRS · ย้อนหลัง 24 ชม.) · ชี้เคอร์เซอร์หรือแตะที่อำเภอบนแผนที่เพื่อดูค่ารายอำเภอ</p></div></div>
    <div class="mm-bar" id="mmBar">
      <div class="mm-ctl">
        <div class="mm-layers" role="group" aria-label="ชั้นข้อมูลบนแผนที่">
          <button type="button" class="mm-chip" data-l="pm" aria-pressed="true"><i class="d pm"></i><span>ค่าฝุ่น {pm} รายจังหวัด<small>ค่าเฉลี่ยรายชั่วโมง · GISTDA</small></span></button>
          <button type="button" class="mm-chip" data-l="hs" aria-pressed="true"><i class="d hs"></i><span>จุดความร้อน<small>GISTDA VIIRS · ย้อนหลัง 24 ชม.</small></span></button>
        </div>
      </div>
      <div class="mm-live" id="mmLive" role="status"></div>
    </div>
    <div class="hot mm">
      <div class="mm-main">
        <div id="map"></div>
        <svg id="drillMap" hidden aria-hidden="true" viewBox="0 0 400 290"></svg>
        <div class="legend" id="aqiLegend" hidden></div>
        <div class="map-note" id="mapNote" hidden></div>   <!-- เลิกแสดงกล่องค่าสูงสุด/ต่ำสุด · คงองค์ประกอบไว้ให้ renderDrill/renderToday เดิมเขียนได้ไม่ error -->
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

    # ---------- 3b) เดโม่: เติม pm25 รายชั่วโมงจำลองให้ /api/pm25/provinces และ /districts (?src=map) (วางก่อนสคริปต์หลัก ต่อจากตัวจำลองเดิมของ build_demo) ----------
    if demo:
        mk = "<script>\n/* ==="
        assert html.count(mk) == 1, html.count(mk)
        html = html.replace(mk, DEMO_MOCK + mk)

    # ---------- 4) CSS: <style> ก้อนสุดท้ายก่อน <body> (ชนะ CSS เดิม) ----------
    body = html.index('<body id="top"'); k = html.rindex("</style>", 0, body)
    html = html[:k] + CSS + html[k:]
    return html
