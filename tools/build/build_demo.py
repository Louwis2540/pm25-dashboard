import json, base64, random, datetime, sys, pathlib

REPO = pathlib.Path(__import__("os").environ.get("PM25_REPO") or pathlib.Path(__file__).resolve().parents[2])   # ค่าเริ่มต้น = โฟลเดอร์ repo (tools/build/../..)
SCR = pathlib.Path(sys.argv[1])
OUT = SCR / "demo-a1.html"

import subprocess
html = subprocess.run(["git", "-C", str(REPO), "show", "6015e8b:index.html"], capture_output=True, text=True, check=True).stdout

def sub(old, new, count=1):
    global html
    if html.count(old) != count:
        raise SystemExit(f"match count {html.count(old)} != {count}: {old[:80]!r}")
    html = html.replace(old, new)

# ---------- assets inline ----------
def data_uri(p, mime):
    return f"data:{mime};base64," + base64.b64encode((REPO / p).read_bytes()).decode()
# ปกบนใหม่ (2400×300 สัดส่วน 8:1 เท่าเดิม) — ใช้ทั้งหัวเว็บและหัวอินโฟกราฟิก
sub('src="/header-v2.webp"', "src=\"data:image/webp;base64," + base64.b64encode((SCR / "header-v3.webp").read_bytes()).decode() + "\"", 2)
sub('src="/ddc-seal.png"', f'src="{data_uri("ddc-seal.png", "image/png")}"')

# ---------- mock data ----------
th = json.loads((SCR / "dl" / "thailand.json").read_text(encoding="utf-8"))
EN = {"Khon Kaen": "ขอนแก่น", "Kalasin": "กาฬสินธุ์", "Maha Sarakham": "มหาสารคาม", "Roi Et": "ร้อยเอ็ด"}
feats = []
for f in th["features"]:
    n = f["properties"].get("shapeName") or f["properties"].get("name") or ""
    if n in EN:
        f["properties"]["name_th"] = EN[n]
        feats.append(f)
geo = {"type": "FeatureCollection", "features": feats}

random.seed(7)
PV = ["ขอนแก่น", "มหาสารคาม", "ร้อยเอ็ด", "กาฬสินธุ์"]
end = datetime.date(2026, 10, 12)
allData = {}
import math
for i in range(720, -1, -1):
    d = end - datetime.timedelta(days=i)
    # จำลองฤดูฝุ่น: สูงช่วง ม.ค.–เม.ย. (พีคราว มี.ค.) ต่ำช่วงฤดูฝน
    doy = d.timetuple().tm_yday
    season = max(0.0, math.cos(2 * math.pi * (doy - 70) / 365)) ** 2
    base = 13 + 62 * season + random.uniform(-4, 4)
    allData[d.isoformat()] = {p: round(base + k * 1.7 + random.uniform(-2.5, 2.5), 1) for k, p in enumerate(PV)}
allData[end.isoformat()] = {"ขอนแก่น": 12.4, "มหาสารคาม": 21.8, "ร้อยเอ็ด": 31.2, "กาฬสินธุ์": 48.6}
last7 = [{"date": d, **allData[d]} for d in sorted(allData)[-7:]]
pm = {"ok": True, "last7": last7, "allData": allData}
# E2–E5: ผู้ป่วยรายสัปดาห์รายจังหวัด — ข้อมูลจริง HDC s_pm25_2_in_week (date_com 9 ต.ค. 2569, ดึง 15 ต.ค. 2569)
#   ตัวตั้ง = ผู้ป่วยที่อยู่อาศัยจริงตามเขตรับผิดชอบ (TYPEAREA 1 และ 3) ตัดซ้ำรายคน/สัปดาห์ (คอลัมน์ w_NN_m)
#   (s_pm25_1_in_week นับทุก TYPEAREA ตามหน่วยบริการ → ใช้เฉพาะยอดรวมเขต E1)
#   ตัวหาร = ประชากร TYPEAREA 1+3 หลังตัดซ้ำ (HDC s_persontype) ประมาณ ณ 1 ก.ค. 2569
#            = P(ปี 2568) + 0.75 × (P(ปี 2569) − P(ปี 2568))  [ยอด HDC นับ ณ สิ้นปีงบประมาณ 30 ก.ย.]
import json as _json
PVPOP = {"ขอนแก่น": 1311335, "มหาสารคาม": 660752, "ร้อยเอ็ด": 871165, "กาฬสินธุ์": 748456}
_rows = []
for pv, _s in _json.loads((SCR / "dzpv2_real.json").read_text(encoding="utf-8")).items():
    for _t in _s.split(";"):
        _w, *_v = map(int, _t.split(","))
        _rows.append({"wk": _w, "pv": pv, **dict(zip(("resp", "heart", "eye", "skin"), _v))})
DZPV = {"mock": False, "pop": PVPOP, "popNote": "ประชากร Type 1+3 (HDC) กลางปี 2569", "rows": _rows}
_REG26 = {}
for _r in [{"wk": _w, **dict(zip(("resp", "heart", "eye", "skin"), _v))} for _s in _json.loads((SCR / "dzpv_real.json").read_text(encoding="utf-8")).values() for _w, *_v in (map(int, _t.split(",")) for _t in _s.split(";"))]:
    _REG26.setdefault(_r["wk"], {"resp": 0, "heart": 0, "eye": 0, "skin": 0})
    for _k in ("resp", "heart", "eye", "skin"): _REG26[_r["wk"]][_k] += _r[_k]
_hs = json.loads((REPO / "hotspot-sample-2026-05-07.json").read_text(encoding="utf-8"))
_feat = []
for f in _hs["features"]:
    f = json.loads(json.dumps(f)); f["properties"]["acq_date"] = end.isoformat() + "T00:00:00"; _feat.append(f)
hs = {"ok": True, "geojson": {"type": "FeatureCollection", "features": _feat}}

# GISTDA จำลอง: จังหวัด + คาดการณ์ 3 วัน, รายอำเภอ, รายตำบล (ชื่อตำบลเป็นชื่อตัวอย่าง)
dgeo = json.loads((REPO / "districts-r7.geojson").read_text(encoding="utf-8"))
codes = {"ขอนแก่น": "40", "มหาสารคาม": "44", "ร้อยเอ็ด": "45", "กาฬสินธุ์": "46"}
today_v = allData[end.isoformat()]
gpv = {"ok": True, "asOf": end.isoformat() + "T07:00:00", "asOfThai": "12 ต.ค. 2569 07:00 น.",
       "items": [{"code": codes[n], "name": n, "avg24": round(v * 0.95, 1), "pred": [round(v * f, 1) for f in (1.08, 1.18, 1.02)], "vent": [0 if v * f < 25 else 1 if v * f < 40 or k == 2 else 2 for k, f in enumerate((1.08, 1.18, 1.02))],
       "fac": [{"hs": 0 if v * f < 25 else 1 if v * f < 40 else 2, "wd": ["ตะวันออกเฉียงเหนือ", "ตะวันออก", "เหนือ"][k], "inv": 1 if v * f >= 30 else 0, "rain": 1 if v * f < 20 and k == 2 else 0, "rh": 1 if k == 1 else 0} for k, f in enumerate((1.08, 1.18, 1.02))]} for n, v in today_v.items()]}
# C5 final: แนวโน้มจากสภาพอากาศ + ปัจจัยเทียบค่าปกติ (ค่าจำลอง)
_FX = {"ขอนแก่น": [35, 60, 8], "มหาสารคาม": [70, 140, 15], "ร้อยเอ็ด": [120, 260, 22], "กาฬสินธุ์": [180, 420, 30]}
for it in gpv["items"]:
    it["trend"] = [0, 1, -1]
    it["fac"] = [{"vr": vr, "hs200": h, "wd": wd, "rain": rn, "rh": rh} for vr, h, wd, rn, rh in
                 zip([2600, 1150, 3900], _FX[it["name"]], ["ตะวันออกเฉียงเหนือ", "ตะวันออก", "ใต้"], [0, 0, 6.5], [62, 52, 78])]
dist = {}
for f in dgeo["features"]:
    pr = f["properties"]; pvn = pr["pv_name"]
    a = round(max(5, today_v[pvn] + random.uniform(-9, 9)), 1)
    dist.setdefault(pr["pv"], []).append({"code": pr["code"], "name": pr["name"], "avg24": a,
        "past": [round(max(5, a + random.uniform(-6, 6)), 1) for _ in range(3)], "max": {"v": round(70 + random.uniform(0, 25), 1), "date": "2026-03-14"}})
pdays = [(end - datetime.timedelta(days=k)).isoformat() for k in (3, 2, 1)]
SEASON = {"label": "68/69"}
dist = {k: {"ok": True, "days": pdays, "season": SEASON, "items": v} for k, v in dist.items()}
# ข้อมูลโรคจริง: ปี 2568 จาก API แดชบอร์ด · ปี 2569 รวม 4 จังหวัดจาก HDC (date_com 9 ต.ค. 2569)
import csv
_K25 = {"resp": "ทางเดินหายใจ (Sum J44+J45+...)", "heart": "หัวใจ/หลอดเลือด (Sum I20+I21+...)", "eye": "ตาอักเสบ (H10)", "skin": "ผิวหนัง (L30.9)"}
_K26 = {"resp": "ทางเดินหายใจ", "heart": "หัวใจ", "eye": "ตาอักเสบ", "skin": "ผิวหนัง"}
dz = {"2025": [], "2026": [], "ok": True, "meta": {"source": "moph", "reportWeek": None, "dataDate": "9/10/2026", "ageDays": 5, "staleDays": 10, "stale": False}}
for r in csv.DictReader(open(SCR / "disease.csv", encoding="utf-8")):
    if r["year"] != "2025": continue   # ปี 2569 ใช้ยอดรวม 4 จังหวัดจาก HDC โดยตรง (API แดชบอร์ดจริงขาด จ.ขอนแก่น)
    dz["2025"].append({"wk": int(r["wk"]), **{_K25[k]: int(r[k]) for k in _K25}})
for _w in sorted(_REG26):
    dz["2026"].append({"wk": _w, **{_K26[k]: _REG26[_w][k] for k in _K26}})
shim = f"""<script>
/* DEMO — ข้อมูลจำลองทั้งหมด ไม่ได้ดึงจากแหล่งจริง */
(function(){{
  const PM07 = () => {{ const o = {{}}, A = window.PMREAL || {{}}; for (const d in A) if (d >= "2026-08-02") {{ o[d] = {{}}; for (const p in A[d]) o[d][p] = Math.round(A[d][p] * 0.93 * 10) / 10; }} return o; }};
  const PHEOC_MOCK = {{ ok: true, anyHit: false, hit: [], dates: ["2026-10-11", "2026-10-12"], provinces: [["ขอนแก่น", 11.2, 12.6], ["มหาสารคาม", 18.4, 21.0], ["ร้อยเอ็ด", 24.9, 29.8], ["กาฬสินธุ์", 38.2, 44.1]].map(([name, a, b]) => ({{ name, days: [{{ date: "2026-10-11", v: a }}, {{ date: "2026-10-12", v: b }}], hit: false }})) }};
  const MOCK = {{ "/api/sheet-pm25": {json.dumps(pm, ensure_ascii=False)}, "/api/sheet-disease": {json.dumps(dz, ensure_ascii=False)}, "/api/hotspot": {json.dumps(hs, ensure_ascii=False)}, "/hotspot-sample-2026-05-07.json": {json.dumps(_hs, ensure_ascii=False)}, "/api/provinces-geojson": {json.dumps(geo, ensure_ascii=False)}, "/api/pm25/provinces": {json.dumps(gpv, ensure_ascii=False)}, "/districts-r7.geojson": {json.dumps(dgeo, ensure_ascii=False)} }};
  const DIST = {json.dumps(dist, ensure_ascii=False)};
  const SUBD = amp => ({{ ok: true, days: {json.dumps(pdays)}, season: {json.dumps(SEASON)}, items: Array.from({{ length: 8 }}, (_, i) => {{ const a = Math.round((14 + ((amp * 7 + i * 13) % 30)) * 10) / 10; return {{ code: amp + String(i + 1).padStart(2, "0"), name: "ตำบลตัวอย่าง " + (i + 1), avg24: a, past: [a - 2.1, a + 1.4, a - 0.6].map(x => Math.round(x * 10) / 10), max: {{ v: 72 + i * 2.3, date: "2026-03-14" }} }}; }}) }});
  const real = window.fetch.bind(window);
  window.fetch = (u, o) => {{
    const k = String(u).replace(/^https?:\\/\\/[^/]+/, "").split("?")[0], q = new URLSearchParams(String(u).split("?")[1] || "");
    const J = o => Promise.resolve(new Response(JSON.stringify(o), {{ headers: {{ "Content-Type": "application/json" }} }}));
    if (k === "/api/visit") {{ window.__v = window.__v || {{ ok: true, today: 47, month: 1126, total: 10912, since: "2026-10-16" }}; if ((o?.method || "GET") === "POST") {{ __v.today++; __v.month++; __v.total++; }} return J(__v); }}
    if (k === "/api/pm25-07") return J({{ ok: true, allData: PM07() }});
    if (k === "/api/pheoc") return new Promise(r => setTimeout(() => r(J(PHEOC_MOCK)), 1200));
    if (k === "/api/pm25/districts") return J(DIST[q.get("pv")] || {{ ok: false }});
    if (k === "/api/pm25/subdistricts") return J(SUBD(+q.get("amp")));
    if (k in MOCK) return new Promise(r => setTimeout(r, 3500)).then(() => new Response(JSON.stringify(MOCK[k]), {{ headers: {{ "Content-Type": "application/json" }} }}));
    if (k.startsWith("/api/") || k.endsWith(".json")) return Promise.resolve(new Response("null", {{ status: 503 }}));
    return real(u, o);
  }};
}})();
</script>
"""
sub("<script>\n/* ===", shim + "<script>\n/* ===")
sub('const API = location.protocol === "file:" ? "https://pm25-dashboard-ex8l.onrender.com" : "";', 'const API = "";')

# ---------- zone A: ลบ A1 (hero), เอา A4 แผนที่ขึ้นแทน ----------
OLD_WS = """    <div class="ws">
      <div class="ws-left">
        <div class="glass wx-hero" id="hero"></div>
        <div class="tiles" id="tiles"></div>
      </div>
      <!-- แผนที่ค่าฝุ่นวันนี้ — คลิกจังหวัดแล้วเลื่อนไปแผงเจาะลึก -->
      <div class="glass mapbox today-map">
        <div class="box-h"><span class="bi"><svg class="ico"><use href="#i-map"/></svg></span>
          <div><h3>แผนที่ค่าฝุ่น PM2.5 วันนี้</h3><p>ค่าเฉลี่ย 24 ชม. ณ 07.00 น. · คลิกจังหวัดเพื่อดูรายละเอียด</p></div></div>
        <svg id="drillMap" viewBox="0 0 400 290" role="img" aria-label="แผนที่ค่าฝุ่น PM2.5 วันนี้ 4 จังหวัด คลิกเพื่อดูรายละเอียด"></svg>
        <div class="legend" style="justify-content:center;margin-top:6px" id="aqiLegend"></div>
        <div class="map-note" id="mapNote"></div>
      </div>
    </div>"""
NEW_WS = """    <div class="ws ws-v2">
      <!-- A4 แผนที่ค่าฝุ่นวันนี้ — ย้ายมาแทนที่ A1 (ฝั่งซ้าย) -->
      <div class="glass mapbox today-map">
        <div class="box-h"><span class="bi"><svg class="ico"><use href="#i-map"/></svg></span>
          <div><h3>แผนที่ค่าฝุ่น PM2.5 วันนี้</h3><p>ค่าเฉลี่ย 24 ชม. ณ 07.00 น. · คลิกจังหวัดเพื่อดูรายละเอียด</p></div></div>
        <svg id="drillMap" viewBox="0 0 400 290" role="img" aria-label="แผนที่ค่าฝุ่น PM2.5 วันนี้ 4 จังหวัด คลิกเพื่อดูรายละเอียด"></svg>
        <div class="legend" style="justify-content:center;margin-top:6px" id="aqiLegend"></div>
        <div class="map-note" id="mapNote"></div>
      </div>
      <!-- ฝั่งขวา: A3 การ์ดจังหวัด 2×2 + A2 ข้อมูลย่อย -->
      <div class="ws-side">
        <div class="tiles" id="tiles"></div>
        <div class="glass facts-box" id="facts"></div>
      </div>
    </div>"""
sub(OLD_WS, NEW_WS)
# กรอบโหลดระหว่างรอข้อมูล (skeleton) — เดโม่หน่วงข้อมูล 3.5 วินาทีให้เห็น
sys.path.insert(0, str(SCR)); import sk_apply
SK_CSS = sk_apply.apply(html, sub)
import tip_fix; tip_fix.apply(sub); import load_fix; load_fix.apply(sub)   # tooltip กราฟโรคไม่ถูกบีบ/บังที่ขอบการ์ด · โหลดค่าฝุ่นลองใหม่

OLD_HERO_START = '  document.getElementById("hero").innerHTML = `\n    <div class="art">${weatherArt(S.lv)}</div>'
i0 = html.index(OLD_HERO_START)
i1 = html.index('    <div class="facts">', i0)
html = html[:i0] + '  document.getElementById("facts").innerHTML = `\n' + html[i1:]

CSS = """
/* DEMO A1 → A4 */
.ws.ws-v2{grid-template-columns:minmax(0,1fr) 460px}
.ws-side{display:flex;flex-direction:column;gap:16px;min-width:0}
.ws-side .tiles{grid-template-columns:repeat(2,minmax(0,1fr))}
.facts-box{padding:14px}
.facts-box .facts{display:grid;grid-template-columns:minmax(0,1fr);gap:10px}
.ws-v2 .today-map svg#drillMap{max-height:560px}
@media (max-width:1100px){.ws.ws-v2{grid-template-columns:minmax(0,1fr)}.facts-box .facts{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (max-width:680px){.facts-box .facts{grid-template-columns:minmax(0,1fr)}}
/* DEMO A3: ชื่อจังหวัดเด่น + กราฟิกท้องฟ้าตามระดับ (มุมขวาบน) */
.ws-v2 .tile{container-type:inline-size;padding:14px 12px 12px 14px}
.ws-v2 .tile .th{display:grid;grid-template-columns:auto auto;justify-content:space-between;align-items:start;gap:6px;letter-spacing:0;margin-bottom:0}
.ws-v2 .tile .th .tn{display:flex;flex-direction:column;align-items:flex-start;gap:5px;min-width:0}
.ws-v2 .tile .th .pn{display:block;font-family:"Anuphan","IBM Plex Sans Thai",sans-serif;font-size:20px;font-weight:700;line-height:1.15;color:var(--ink-1);white-space:nowrap}
.ws-v2 .tile .th .chip{font-size:12px;font-weight:700;white-space:nowrap}
.ws-v2 .tile .t-art{display:block;width:88px;margin:-8px -6px -6px 0;filter:saturate(1.35) contrast(1.12) drop-shadow(0 3px 4px rgba(15,27,45,.18))}
.ws-v2 .tile .t-art svg{display:block;width:100%;height:auto}
.ws-v2 .tile .ring{margin-top:0}
@container (max-width:185px){.ws-v2 .tile .th .pn{font-size:18px}.ws-v2 .tile .t-art{width:70px}}
@container (max-width:170px){.ws-v2 .tile .th{grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"pn art" "chip chip";row-gap:2px}.ws-v2 .tile .th .tn{display:contents}.ws-v2 .tile .th .pn{grid-area:pn;font-size:16px;align-self:center}.ws-v2 .tile .th .chip{grid-area:chip;justify-self:start}.ws-v2 .tile .t-art{grid-area:art;width:58px;margin-right:-8px}}
/* DEMO A3: ตัวเลขค่าฝุ่น */
.ws-v2 .ring-t{margin:2px auto 0}
.ws-v2 .ring-t .c{gap:3px}
.ws-v2 .ring-t .c em{font-family:"Anuphan","IBM Plex Sans Thai",sans-serif;font-size:14px;font-weight:700;line-height:21px;padding:0 9px;border-radius:7px;margin:0;letter-spacing:.01em}
.ws-v2 .ring-t .c em sub{font-size:.68em;line-height:0;vertical-align:-.28em;margin-left:1px;letter-spacing:0}
.ws-v2 .ring-t .c b{font-family:"Anuphan","IBM Plex Sans Thai",sans-serif;font-size:54px;font-weight:700;line-height:.9;letter-spacing:-.045em;color:var(--ink-1);display:flex;align-items:baseline}
.ws-v2 .ring-t .c b i{font-style:normal;font-size:.5em;letter-spacing:-.02em;color:var(--tk);margin-left:1px}
.ws-v2 .ring-t .c span{font-size:13.5px;font-weight:700;margin:0}
@container (max-width:170px){.ws-v2 .ring-t{width:132px!important;height:132px!important}.ws-v2 .ring-t .c b{font-size:46px}.ws-v2 .ring-t .c em{font-size:13px;line-height:19px}}
/* DEMO A3: ชื่อจังหวัด + ป้ายเกณฑ์ ใหญ่ขึ้น 1.5 เท่า */
/* คอม: คอลัมน์ขวากว้างขึ้นให้ชื่อ 30px กับกราฟิกอยู่แถวเดียวกัน · A2 เรียง 3 ช่องแนวนอนใต้การ์ด */
.ws.ws-v2{grid-template-columns:minmax(0,1fr) 568px}
.ws-v2 .facts-box .facts{grid-template-columns:repeat(3,minmax(0,1fr))}
.ws-v2 .tile .th{grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"pn art" "chip chip";row-gap:4px;column-gap:8px;align-items:center}
.ws-v2 .tile .th .tn{display:contents}
.ws-v2 .tile .th .pn{grid-area:pn;font-size:30px;line-height:1.15}
.ws-v2 .tile .th .chip{grid-area:chip;justify-self:start;font-size:18px;line-height:1.3;padding:2px 12px;border-radius:10px;white-space:nowrap}
.ws-v2 .tile .t-art{grid-area:art;width:84px;margin:-8px -6px -6px 0}
@media (max-width:1100px){.ws.ws-v2{grid-template-columns:minmax(0,1fr)}}
/* มือถือ: การ์ดเรียงทีละใบแบบแนวนอน — ชื่อ+กราฟิก / ป้ายเกณฑ์ / เทียบเมื่อวาน ทางซ้าย · วงแหวนทางขวา */
@media (max-width:680px){
  .ws.ws-v2 .ws-side .tiles{grid-template-columns:minmax(0,1fr);gap:12px}
  .ws.ws-v2 .tile{display:grid;grid-template-columns:minmax(0,1fr) auto 120px;grid-template-areas:"pn art ring" "chip chip ring" "ft ft ring";align-items:center;column-gap:8px;row-gap:6px;padding:14px}
  .ws.ws-v2 .tile .th{display:contents}
  .ws.ws-v2 .tile .th .pn{font-size:clamp(18px,5.6vw,24px)}   /* ชื่อยาว (มหาสารคาม) ไม่ถูกตัดบนจอแคบ */
  .ws.ws-v2 .tile .th .chip{font-size:17px}
  .ws.ws-v2 .tile .t-art{width:54px;margin:0}
  .ws.ws-v2 .tile .ring-t{grid-area:ring;width:120px!important;height:120px!important;margin:0}
  .ws.ws-v2 .tile .ring-t .c b{font-size:42px}
  .ws.ws-v2 .tile .ft{grid-area:ft;text-align:left;margin:0}
  .ws-v2 .facts-box .facts{grid-template-columns:minmax(0,1fr)}
}
/* ทุกส่วน: ตัวห้อย PM₂.₅ */
.pm25{white-space:nowrap}
.pm25 sub{font-size:.66em;line-height:0;vertical-align:-.3em;margin-left:.04em;letter-spacing:0;font-weight:inherit}
/* DEMO B3: ตารางย้อนหลัง 7 วัน */
.t7-head{display:flex;align-items:center;gap:12px;padding-bottom:10px;border-bottom:1px solid color-mix(in srgb,var(--sec) 22%,transparent)}
.t7-head .bi{width:44px;height:44px;border-radius:12px;background:var(--sec);color:#fff;display:grid;place-items:center;flex:none;box-shadow:0 4px 10px color-mix(in srgb,var(--sec) 30%,transparent)}
.t7-head .bi .ico{width:24px;height:24px}
.t7-head h3{font-family:"Anuphan","IBM Plex Sans Thai",sans-serif;font-size:21px;font-weight:700;line-height:1.25;color:color-mix(in srgb,var(--sec) 72%,#000)}
.t7-head p{font-size:14px;font-weight:600;line-height:1.4;color:color-mix(in srgb,var(--sec) 50%,#2a3344)}
.trend .t7-card .t7{font-size:18px;margin-top:6px;border-spacing:0 6px}
.trend .t7-card .t7 th{font-size:15px;font-weight:700;color:var(--ink-1);padding:8px 4px;vertical-align:bottom}
.trend .t7-card .t7 td{padding:12px 6px}
.trend .t7-card .t7 td:first-child{font-size:17px}
.trend .t7-card .t7 td.cell{font-family:"Anuphan","IBM Plex Sans Thai",sans-serif;font-size:19px;letter-spacing:-.01em;border-width:3px}
.trend .t7-card .t7 td.today-col{font-size:23px;outline:3px solid var(--ink-1);outline-offset:-3px;box-shadow:0 6px 14px rgba(15,27,45,.22)}
.th-today{padding-bottom:10px!important}
.tdh{display:inline-flex;flex-direction:column;align-items:center;gap:6px}
.tcal{display:flex;flex-direction:column;width:48px;border-radius:10px;overflow:hidden;background:#fff;border:2px solid var(--sec);box-shadow:0 3px 8px rgba(15,27,45,.14);text-align:center}
.tcal i{font-style:normal;background:var(--sec);color:#fff;font-size:11.5px;font-weight:700;line-height:17px}
.tcal b{font-family:"Anuphan","IBM Plex Sans Thai",sans-serif;font-size:21px;font-weight:700;line-height:26px;color:var(--ink-1)}
.tlab{position:relative;background:var(--ink-1);color:#fff;font-size:15px;font-weight:700;border-radius:999px;padding:4px 13px 3px;line-height:1.7;white-space:nowrap}
.tlab::after{content:"";position:absolute;left:50%;bottom:-6px;transform:translateX(-50%);border:6px solid transparent;border-top-color:var(--ink-1);border-bottom:0}
.trend .t7-card .t7-note{font-size:13.5px}
@media (max-width:680px){.t7-card .t7 th:first-child,.t7-card .t7 td:first-child{position:sticky;left:0;z-index:2;background:color-mix(in srgb,var(--sec) 11%,#fff);box-shadow:6px 0 8px -6px rgba(15,27,45,.25)}.trend .t7-card .t7 td:first-child{font-size:15px;padding-right:8px}.trend .t7-card .t7 td.cell{font-size:17px}.trend .t7-card .t7 td.today-col{font-size:20px}.t7-head h3{font-size:19px}}
/* DEMO B4: ตารางสรุป ต่ำสุด/สูงสุด/วันเกิน 75 */
.tr-st td small{margin-top:2px}
.ov-btn{font:inherit;color:#b00000;background:#fff0f0;border:1.5px solid #f3b7b7;border-radius:10px;padding:4px 10px 3px;cursor:pointer;display:inline-flex;flex-direction:column;align-items:center;line-height:1.2;transition:background .15s,border-color .15s}
.ov-btn b{font-family:"Anuphan","IBM Plex Sans Thai",sans-serif;font-size:20px;line-height:1.1}
.ov-btn:hover{background:#ffe2e2;border-color:#e88}
.ov-btn:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
.ov-cta{font-size:11.5px;font-weight:700;color:#7a1f1f;display:inline-flex;align-items:center;gap:3px;text-decoration:underline;text-underline-offset:2px}
.ov-car{display:inline-block;transition:transform .2s;text-decoration:none}
.ov-btn[aria-expanded="true"] .ov-car{transform:rotate(180deg)}
.ov-btn[aria-expanded="true"]{background:#b00000;color:#fff;border-color:#b00000}
.ov-btn[aria-expanded="true"] .ov-cta{color:#fff}
.ov-zero{color:var(--ink-3);font-weight:700}
.tr-st tr.ov-det td{background:transparent;padding:0 0 4px;border-radius:0}
.ov-box{background:#fff;border:1.5px solid #f3b7b7;border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:8px;text-align:left}
.ov-h{font-size:13px;font-weight:700;color:#7a1f1f}
.ov-m{display:flex;flex-direction:column;gap:5px}
.ov-mn{font-size:13px;font-weight:700;color:var(--ink-1)}
.ov-mn em{font-style:normal;font-weight:600;color:var(--ink-3);margin-left:4px}
.ov-ds{display:flex;flex-wrap:wrap;gap:5px}
.ov-d{display:inline-flex;align-items:baseline;gap:5px;background:#d10000;color:#fff;border-radius:7px;padding:2px 8px;font-size:12.5px;font-weight:600}
.ov-d b{font-size:14px;font-weight:700}
.ov-d span{background:rgba(255,255,255,.22);border-radius:5px;padding:0 5px;font-size:12px}
.ov-n{display:inline-flex;align-items:baseline;gap:4px;font-weight:700}
/* DEMO C2: การ์ดจังหวัดแบบ A1 เดิม */
.pv-wx{margin-top:4px;background:linear-gradient(135deg,#fff 0%,var(--lv-tint) 55%,var(--lv-soft) 100%)!important;border:2px solid color-mix(in srgb,var(--lv) 45%,#fff)!important}
.pv-wx .pv-adv{margin-top:10px}
/* C2 ลดสเกลลงครึ่งหนึ่ง (กราฟิก + ตัวเลข 50%) · ข้อความไม่ต่ำกว่าขนาดที่อ่านได้ */
.wx-hero.pv-wx{grid-template-columns:100px minmax(0,1fr);gap:8px 18px;padding:12px 18px}
.pv-wx .art{width:100px;height:75px;margin:-4px 0 -4px -4px}
.pv-wx .art svg{width:100%;height:100%}
.pv-wx .kpi-h{border-left-width:4px;padding-left:9px}
.pv-wx .kpi-title{font-size:20px}
.pv-wx .kpi-sub{font-size:12.5px}
.pv-wx .kpi-v{gap:8px;margin:6px 0 6px}
.pv-wx .kpi-num{font-size:58px}
.pv-wx .kpi-unit{padding-bottom:4px}
.pv-wx .kpi-unit b{font-size:17px}
.pv-wx .kpi-unit small{font-size:11px}
.pv-wx .kpi-lv{font-size:15px;padding:2px 12px 2px 8px;border-width:1.5px;margin-bottom:4px}
.pv-wx .kpi-lv span{font-size:16px}
.pv-wx .delta{font-size:12.5px}
.pv-wx .pv-adv{font-size:13.5px;margin-top:6px}
@media (max-width:680px){.wx-hero.pv-wx{grid-template-columns:minmax(0,1fr)}.pv-wx .art{margin:0 auto}.pv-wx .kpi-num{font-size:52px}}
/* DEMO C5: ตารางคาดการณ์รายจังหวัดอย่างเดียว */
.fc .fc-t{font-size:17px;margin-top:6px;border-spacing:0 6px}
.fc .fc-t th{font-size:14px;font-weight:700;color:var(--ink-1);padding:4px 2px;line-height:1.25}
.fc .fc-t th small{display:block;font-size:11.5px;font-weight:600;color:var(--ink-3)}
.fc .fc-t td{padding:11px 4px}
.fc .fc-t td:first-child{font-size:15px;font-weight:700;color:var(--ink-1);padding-right:8px}
.fc .fc-t td.cell{font-family:"Anuphan","IBM Plex Sans Thai",sans-serif;font-size:18px;border-width:3px}
.fc-note{display:flex;flex-wrap:wrap;gap:6px 10px;margin-top:8px;font-size:12px;font-weight:600;color:var(--ink-2)}
.fc-note span{display:flex;align-items:center;gap:5px}.fc-note i{width:12px;height:12px;border-radius:3px}
/* DEMO C5: การระบายอากาศ */
.fc .fc-t td.cell{line-height:1.15;padding:8px 3px 7px}
.vb{display:inline-flex;align-items:center;gap:3px;font-family:"IBM Plex Sans Thai",sans-serif;font-size:11px;font-weight:700;line-height:1;border-radius:5px;padding:3px 5px;white-space:nowrap}
.fc-t .vb{display:flex;width:max-content;margin:5px auto 0}
.vb-i{width:12px;height:12px;flex:none}
.vb.v0{background:#eaf6e4;color:#1f5a0a}.vb.v1{background:#fdf0d6;color:#6b4100}.vb.v2{background:#fde4e4;color:#8a1414}
.fc-t .vb{box-shadow:0 0 0 1px rgba(15,27,45,.12)}
.vw{display:flex;gap:8px;align-items:flex-start;margin-top:8px;padding:8px 10px;border-radius:10px;background:#fff4f4;border:1.5px solid #f3c0c0;font-size:13px;line-height:1.45;color:#5c1a1a}
.vw b{color:#8a1414}
.vw-i{width:26px;height:26px;border-radius:8px;background:#fde4e4;color:#8a1414;display:grid;place-items:center;flex:none}
.vw-i .ico{width:17px;height:17px}
@media (max-width:680px){.fc .fc-t{table-layout:fixed;border-spacing:3px 6px}.fc .fc-t td:first-child,.fc .fc-t th:first-child{width:27%;font-size:13.5px;padding-right:2px;white-space:normal;word-break:break-word}.fc .fc-t td.cell{font-size:16px;padding:7px 1px 6px}.fc-t .vb{font-size:10px;padding:3px 3px;gap:2px}.fc-t .vb-i{width:10px;height:10px}}
/* DEMO C5: กล่องปัจจัยอากาศ */
.fc-hint{font-size:12.5px;font-weight:600;color:var(--ink-2);margin:2px 0 0}
.fc-c{cursor:pointer;transition:transform .12s}
.fc-c:hover{transform:translateY(-1px)}
.fc-c:focus-visible{outline:3px solid var(--accent)!important;outline-offset:-3px}
.fc-c[aria-pressed="true"]{outline:3px solid var(--ink-1);outline-offset:-3px;box-shadow:0 4px 10px rgba(15,27,45,.22)}
.fc-det{margin-top:6px;background:#fff;border:1.5px solid var(--line);border-radius:12px;padding:10px 12px}
.fc-det .dh{display:flex;flex-direction:column;gap:2px;margin-bottom:6px}
.fc-det .dh>b{font-family:"Anuphan","IBM Plex Sans Thai",sans-serif;font-size:16px;color:var(--ink-1)}
.fc-det .dh span{font-size:12.5px;font-weight:600;color:var(--ink-2)}
.fr{display:grid;grid-template-columns:20px minmax(0,1fr) auto;gap:8px;align-items:center;padding:7px 0;border-top:1px solid var(--line);font-size:13.5px;font-weight:600;color:var(--ink-1)}
.fr .ico{width:18px;height:18px;color:var(--ink-2)}
.fr small{display:block;font-size:11.5px;font-weight:600;color:var(--ink-3)}
.st{font-size:12px;font-weight:700;border-radius:6px;padding:3px 8px;white-space:nowrap}
.st.ok{background:#eaf6e4;color:#1f5a0a}.st.mid{background:#fdf0d6;color:#6b4100}.st.bad{background:#fde4e4;color:#8a1414}.st.na{background:var(--subtle);color:var(--ink-3)}
.fr-v{display:flex;align-items:center;gap:6px;justify-content:flex-end;flex-wrap:wrap}
.fr-v b{font-size:13.5px;font-weight:700;color:var(--ink-1);white-space:nowrap}
.tr-sum{display:flex;gap:10px;align-items:center;border-radius:10px;padding:8px 10px;margin:2px 0 4px}
.tr-sum.bad{background:#fde4e4;color:#8a1414}.tr-sum.mid{background:#fdf0d6;color:#6b4100}.tr-sum.ok{background:#eaf6e4;color:#1f5a0a}
.tr-sum .tr-i{font-size:22px;line-height:1;width:28px;text-align:center;flex:none}
.tr-sum b{display:block;font-family:"Anuphan","IBM Plex Sans Thai",sans-serif;font-size:16px;font-weight:700}
.tr-sum small{display:block;font-size:11.5px;font-weight:600;opacity:.85}
.dz-all .lg{flex-wrap:wrap;gap:6px 14px}
.dz-scale{font-size:11.5px;font-weight:600;color:var(--ink-3);margin:0;padding-left:16px;line-height:1.55}
.dz-all .icd b{color:var(--ink-1)}
.dz-all{grid-column:1/-1}
.dz-all svg.bars.w-w{display:none}
@media(min-width:900px){.dz-all svg.bars.w-w{display:block}.dz-all svg.bars.w-n{display:none}}
.pv-guide{grid-column:1/-1;background:#f4f7fb;border:1px solid #dbe3ee;border-radius:14px;padding:12px 16px;font-size:13px;font-weight:600;color:var(--ink-2);line-height:1.6}
.pv-guide .pg-h{display:flex;align-items:center;gap:8px;color:var(--ink-1);font-size:15px;margin-bottom:2px}
.pv-guide .pg-h .ico{width:18px;height:18px}
.pv-guide ul{margin:0;padding-left:18px}
.pv-guide b{color:var(--ink-1)}
.pv-guide .pg-w{margin:8px 0 0;background:#fff7e6;border:1px solid #f3dca8;border-radius:10px;padding:7px 10px;color:#6b4a00}
.pv-guide .pg-w b{color:#8a5a00}.pv-guide .pg-w u{text-decoration-color:#d99a1b;text-underline-offset:3px}
.dz-pv .pv-pm{margin-left:auto;text-align:right;border-radius:10px;padding:5px 10px;line-height:1.15;flex:none}
.dz-pv .pv-pm span{display:block;font-size:11px;font-weight:700}
.dz-pv .pv-pm b{font-family:"Anuphan";font-size:22px;font-weight:700}
.dz-pv .pv-pm small{display:block;font-size:11px;font-weight:600}
.dz-pv .pv-lg{flex-wrap:wrap;gap:4px 14px;font-size:12px!important}
.dz-pv .pv-lg i.ma{width:16px;height:3px;border-radius:2px;background:#5f6c80}
.dz-pv .pv-lg i.pt{background:repeating-linear-gradient(45deg,#c9d1dc 0 2px,#eef1f5 2px 4px)}
.dz-pv svg.bars.pv-n{display:none}
@media(max-width:680px){.dz-pv svg.bars.pv-n{display:block}.dz-pv svg.bars.pv-w{display:none}.dz-pv .dz-top{flex-wrap:wrap}.dz-pv .dz-top>div:nth-child(2){flex:1 1 0;min-width:0}.dz-pv .pv-pm{margin-left:58px;display:flex;align-items:baseline;gap:6px;text-align:left}.dz-pv .pv-pm b{font-size:18px}}
.pv-guide .pg-h{flex-wrap:wrap}
.dz-pv .wkcol{fill:transparent;cursor:crosshair}
.dz-pv .wkcol:hover{fill:rgba(15,27,45,.09)}
.dz-pv .tip{white-space:pre-line;line-height:1.5;max-width:300px}
.dz-pv .pv-lg i.dot{width:9px;height:9px;border-radius:50%;background:#c2410c}
.pv-block{grid-column:1/-1;background:#fff;border:1px solid var(--line,#dfe5ee);border-radius:18px;padding:16px 18px;display:flex;flex-direction:column;gap:10px;box-shadow:0 1px 3px rgba(15,27,45,.06)}
.pv-bh{display:flex;align-items:center;gap:12px}
.pv-bh h3{font-size:17px;font-weight:700}
.pv-bh .icd{font-size:13px;font-weight:600;color:var(--ink-2)}
.pv-bh sub{font-size:.7em;vertical-align:-.25em;line-height:0}
.pv-block>.pv-lg{display:flex;flex-wrap:wrap;gap:4px 16px;font-size:12.5px;font-weight:600;color:var(--ink-2);background:#f6f8fb;border-radius:10px;padding:7px 12px}
.pv-block>.pv-lg span{display:flex;align-items:center;gap:6px}
.pv-block>.pv-lg i{width:12px;height:12px;border-radius:3px}
.pv-block>.pv-lg i.ma{width:16px;height:3px;border-radius:2px}
.pv-block>.pv-lg i.dot{width:9px;height:9px;border-radius:50%;background:#c2410c}
.pv-block>.pv-lg i.pt{background:repeating-linear-gradient(45deg,#c9d1dc 0 2px,#eef1f5 2px 4px)}
.pv-block>.pv-lg i.hd{width:2px;height:14px;border-radius:0;background:repeating-linear-gradient(#6b7689 0 3px,transparent 3px 6px)}
.pv-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.pv-grid .dz-pv{box-shadow:none}
.pv-block .pv-guide{margin:0}
@media(max-width:680px){.pv-grid{grid-template-columns:minmax(0,1fr)}.pv-block{padding:14px 12px}}
#ig .pm-tag sub,#ig .pm sub{font-size:.7em;vertical-align:-.25em;line-height:0}
#ig .pvs .me,#ig .pvrow .me{outline:4px solid var(--lv-ink);outline-offset:-1px}
#ig .facts3 .k{display:block}
#ig .dzg2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
#ig .dzg2>div{border:1px solid var(--line);border-radius:16px;padding:8px 14px 2px}
#ig .dzg2 .dh .dz-icon{width:34px;height:34px;border-radius:10px}
#ig .dzg2 .dh .nm{font-size:17px}
#ig .dzl{display:block;font-size:13.5px;margin-top:-4px}
#ig .fc3{width:100%;border-collapse:separate;border-spacing:4px;font-size:16px;margin-top:4px}
#ig .fc3 th{font-size:14px;font-weight:600;color:var(--ink-2);text-align:center;line-height:1.2}
#ig .fc3 th small{display:block;font-size:12px;color:var(--ink-3)}
#ig .fc3 td{text-align:center;border-radius:8px;padding:5px 4px;font-weight:700}
#ig .fc3 td:first-child{text-align:left;font-weight:600;padding-left:2px}
#ig .fc3 tr.me td:first-child{color:var(--lv-ink);font-weight:800}
#ig .fc3 tr.me td:not(:first-child){outline:3px solid var(--ink-1);outline-offset:-2px}
#ig .ig-note{font-size:14px;color:var(--ink-3)}
#ig .lvleg{display:flex;gap:6px;flex-wrap:wrap}
#ig .kpis{display:grid;grid-template-rows:repeat(3,auto);gap:8px;align-content:space-between}
#ig .kpis.kpis-h{grid-template-rows:none;grid-template-columns:1.3fr 1fr 1fr}#ig .kpis .k{white-space:nowrap}
#ig .pvrow4{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}

/* การ์ดจังหวัดแบบ Liquid Glass (แดชบอร์ด + อินโฟกราฟิก ใช้ชุดเดียวกัน) */
section .ws-v2 .ws-side .tiles,#ig .igt .tiles{position:relative;border-radius:24px;padding:10px;background:
  radial-gradient(38% 45% at 18% 22%,rgba(116,192,252,.45),transparent 70%),
  radial-gradient(40% 45% at 82% 25%,rgba(177,151,252,.38),transparent 70%),
  radial-gradient(42% 45% at 22% 82%,rgba(255,192,120,.42),transparent 70%),
  radial-gradient(40% 45% at 80% 80%,rgba(140,233,154,.40),transparent 70%),
  linear-gradient(135deg,#eef4fb,#f7f1fb)}
section .ws-v2 .tile,#ig .igt .tile{
  background:
    linear-gradient(135deg,rgba(255,255,255,.78) 0%,rgba(255,255,255,.22) 34%,rgba(255,255,255,0) 58%,rgba(255,255,255,.28) 100%),
    radial-gradient(85% 55% at 88% 108%,color-mix(in srgb,var(--tc,#ccc) 42%,transparent),transparent 72%),
    radial-gradient(70% 45% at 8% -8%,rgba(255,255,255,.95),transparent 62%),
    color-mix(in srgb,var(--tint,#fff) 45%,rgba(255,255,255,.32))!important;
  -webkit-backdrop-filter:blur(18px) saturate(180%);backdrop-filter:blur(18px) saturate(180%);
  border:1px solid rgba(255,255,255,.75)!important;border-radius:22px!important;
  box-shadow:inset 0 1.5px 0 rgba(255,255,255,.95),inset 1px 0 0 rgba(255,255,255,.55),inset 0 -1px 0 rgba(255,255,255,.45),
    inset 0 0 0 1px color-mix(in srgb,var(--tc,#ccc) 18%,transparent),inset 0 -14px 24px -14px color-mix(in srgb,var(--tc,#ccc) 45%,transparent),
    0 2px 6px rgba(15,27,45,.07),0 14px 30px -12px color-mix(in srgb,var(--tc,#ccc) 55%,transparent)!important}
section .ws-v2 .tile[aria-pressed="true"]{outline:2px solid rgba(255,255,255,.95);box-shadow:inset 0 1.5px 0 #fff,inset 0 0 0 2px color-mix(in srgb,var(--tc,#ccc) 55%,transparent),0 18px 36px -12px color-mix(in srgb,var(--tc,#ccc) 70%,transparent)!important}
section .ws-v2 .tile .ring,#ig .igt .tile .ring{border-radius:50%;background:radial-gradient(circle at 50% 30%,rgba(255,255,255,.9),rgba(255,255,255,.45) 62%,rgba(255,255,255,0) 72%);box-shadow:inset 0 2px 1px rgba(255,255,255,.9),0 10px 18px -10px color-mix(in srgb,var(--tc,#ccc) 75%,transparent)}
section .ws-v2 .tile .ring svg circle:first-child,#ig .igt .tile .ring svg circle:first-child{stroke:rgba(255,255,255,.75)}
section .ws-v2 .tile .th .chip,#ig .igt .tile .th .chip{background:rgba(255,255,255,.6)!important;box-shadow:inset 0 1px 0 #fff,0 1px 3px rgba(15,27,45,.08);border:1px solid rgba(255,255,255,.8)}
#ig .igt{overflow:visible}
/* อินโฟกราฟิก: html2canvas วาด inset shadow / radial-gradient ไม่ถูก → ใช้ชั้นแบบ linear + เงาด้านนอก ให้ได้ลุคกระจกใกล้เคียงแดชบอร์ด */
#ig .igt .tiles{background:linear-gradient(120deg,rgba(116,192,252,.35),rgba(177,151,252,.28) 35%,rgba(255,192,120,.32) 68%,rgba(140,233,154,.32))!important}
#ig .igt .tile{
  background:linear-gradient(155deg,rgba(255,255,255,.92) 0%,rgba(255,255,255,.45) 28%,rgba(255,255,255,.05) 52%,rgba(255,255,255,0) 70%),
    linear-gradient(0deg,color-mix(in srgb,var(--tc,#ccc) 30%,transparent) 0%,transparent 42%),
    color-mix(in srgb,var(--tint,#fff) 70%,#fff)!important;
  border:2px solid rgba(255,255,255,.95)!important;
  box-shadow:0 2px 6px rgba(15,27,45,.08),0 16px 28px -12px color-mix(in srgb,var(--tc,#ccc) 60%,transparent)!important}
#ig .igt .tile .ring{background:rgba(255,255,255,.62);box-shadow:0 10px 18px -10px color-mix(in srgb,var(--tc,#ccc) 75%,transparent)}
#ig .maxbar{display:flex;align-items:center;gap:14px;background:linear-gradient(90deg,var(--lv-soft),var(--lv-tint));border:2px solid var(--lv);border-left:10px solid var(--lv);border-radius:14px;padding:2px 18px}
#ig .maxbar .mk{display:flex;align-items:center;gap:6px;font-size:17px;font-weight:700;color:var(--ink-2)}
#ig .maxbar .mp{font-family:Anuphan;font-size:26px;font-weight:700;color:var(--lv-ink);line-height:1.2}
#ig .maxbar .mv{font-family:Anuphan;font-size:30px;font-weight:700;color:var(--ink-1)}
#ig .maxbar .mv small{font-size:16px;color:var(--ink-3)}
#ig .maxbar .ml{margin-left:auto;font-family:Anuphan;font-size:22px;font-weight:700;color:#fff;background:var(--lv-ink);border-radius:999px;padding:2px 16px}
#ig .igt>.tiles{width:1360px;transform-origin:0 0}
#ig .ig-date .kl{font-size:15px;color:var(--ink-1)}#ig .ig-date .kl b{color:var(--lv-ink)}
#ig .igt .tiles{display:grid;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:14px}
#ig .ig-date b{font-weight:700}
#ig .igt .tile{background:linear-gradient(170deg,color-mix(in srgb,var(--tint,#fff) 45%,#fff),var(--tint,#fff));border:1px solid color-mix(in srgb,var(--tc,#ccc) 30%,#fff);border-radius:18px;cursor:default;transform:none!important}
#ig .igt .tile.mx{outline:4px solid var(--tc);outline-offset:-2px}
#ig .kpis.kpis-h>div{padding:3px 12px}
#ig .pvrow4>div{position:relative;border:1px solid var(--line);border-radius:16px;padding:12px 10px 10px;display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center}
#ig .pvrow4>div.mx{outline:4px solid var(--lv-ink);outline-offset:-2px}
#ig .pvrow4 .mxb{position:absolute;top:-2px;right:10px;background:var(--lv-ink);color:#fff;font-size:13px;font-weight:700;border-radius:0 0 8px 8px;padding:1px 9px}
#ig .pvrow4 .pn{font-family:Anuphan;font-size:26px;font-weight:700;color:var(--ink-1);line-height:1.2}
#ig .pvrow4 .x{font-family:Anuphan;font-size:46px;font-weight:700;line-height:1.1;white-space:nowrap}
#ig .pvrow4 .x small{font-size:16px;color:var(--ink-3)}
#ig .pvrow4 .x .pm{font-style:normal;font-family:"IBM Plex Sans Thai";font-size:14px;font-weight:700;color:#fff;border-radius:6px;padding:1px 6px;margin-right:6px;vertical-align:middle;position:relative;top:-6px}
#ig .pvrow4 .chip{font-size:15px;font-weight:700;border-radius:999px;padding:2px 10px;white-space:nowrap}
#ig .kpis>div{display:flex;align-items:center;gap:12px;border:1px solid var(--line);border-radius:14px;padding:4px 14px;background:var(--subtle)}
#ig .kpis .fi{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;flex:none}
#ig .kpis .k{display:block;font-size:16px;font-weight:600;color:var(--ink-2)}
#ig .kpis b{font-family:Anuphan;font-size:22px;display:block;line-height:1.2}
#ig .kpis small{display:block;font-size:16px;font-weight:600;color:var(--ink-2)}
#ig:not(.social) .ig-note{font-size:16px}
#ig:not(.social) .lvleg{display:grid;grid-template-columns:repeat(5,auto);gap:5px}#ig:not(.social) .lvleg span{font-size:15px;padding:3px 8px 3px 5px;white-space:nowrap;gap:5px}#ig:not(.social) .lvleg b{font-size:16px}
#ig:not(.social) .t7{font-size:16.5px}#ig:not(.social) .t7 td{padding:2px 5px!important}#ig:not(.social) .fc3 td{padding:2px 4px}#ig:not(.social) .row1{grid-template-columns:520px 1fr}
#ig:not(.social) .box h4 small{font-size:15px!important}
#ig:not(.social) .dzl{font-size:15px}
#ig:not(.social) .ig-f{font-size:15px}
#ig:not(.social) .fc3{font-size:17px}#ig:not(.social) .fc3 th{font-size:15px}
#ig .trd{display:flex;align-items:center;gap:4px;font-size:14px;font-weight:700;color:var(--ink-2);margin-top:2px}
#ig .s7{display:flex;gap:4px;justify-content:center;margin-top:8px}
#ig .ig-date .today-b{font-family:Anuphan;font-weight:700;font-size:26px;color:#fff;background:var(--lv-ink);border-radius:12px;padding:2px 16px;line-height:1.35}
#ig:not(.social) .ig-date .today-b{font-size:21px;padding:1px 12px}
#ig .avg .k{display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 8px}
#ig .avg .k .hp{font-family:Anuphan;font-weight:700;font-size:30px;color:var(--lv-ink);line-height:1.2}
#ig:not(.social) .avg .k .hp{font-size:24px}
#ig.social .pvrow .n{font-family:Anuphan;font-size:28px;font-weight:700;color:var(--ink-1);line-height:1.3}
#ig .pvs .pn{font-family:Anuphan;font-size:22px;font-weight:700;color:var(--ink-1)}
#ig .pvs .chip{white-space:nowrap;font-size:13px!important}
#ig .ig-date .d{white-space:nowrap}
#ig:not(.social) .ig-date>span:last-child{text-align:right;font-size:16px;line-height:1.3;white-space:nowrap}
#ig .ig-date .ew{display:block;font-size:14px;color:var(--ink-2);font-weight:600}
#ig.social[data-dense] .avg .v{font-size:80px!important}#ig.social[data-dense="3"] .avg .wart{width:150px;height:110px}
#ig.social .pvrow div{padding:8px 10px}#ig.social .pvrow .x{line-height:1.2}#ig.social .s7{margin-top:6px}#ig.social .avg{padding:8px 18px}
#ig .s7 i{width:22px;height:16px;border-radius:4px}
#ig .s7 i.td{outline:2.5px solid var(--ink-1);outline-offset:1px}
#ig .s7k{display:block;font-size:12.5px;color:var(--ink-3);margin-top:3px}
#ig.social .ig-body{justify-content:space-between;padding-bottom:14px}
#ig.social .avg{flex:1 1 auto}
#ig.social[data-dense] .avg .v{font-size:96px!important}#ig.social .avg .l{font-size:32px}
#ig .trd.up{color:#c2410c}#ig .trd.dn{color:#0e7a3a}
#ig .ig-act{display:flex;align-items:center;gap:10px;background:#fff1e6;border:2px solid #fdba74;color:#9a3412;border-radius:14px;padding:8px 14px;font-size:18px;font-weight:600}
#ig:not(.social) .ig-act{padding:4px 12px;font-size:16px}#ig:not(.social) .ig-act b{font-size:18px}
#ig .ig-act b{font-family:Anuphan;font-size:20px}
#ig .ig-note b{color:var(--ink-1)}
.modal .cap{display:flex;gap:10px;align-items:flex-start;padding:0 16px 12px}
.modal .cap textarea{flex:1;min-height:96px;font:13px/1.5 "IBM Plex Sans Thai",sans-serif;border:1px solid var(--line-strong);border-radius:10px;padding:8px 10px;resize:vertical;color:var(--ink-1)}

#ig .fcs{display:grid;grid-template-columns:auto 1fr 1fr 1fr;gap:10px;align-items:stretch}
#ig .fcs .t{display:flex;align-items:center;gap:8px;font-family:Anuphan;font-weight:700;font-size:20px;color:var(--lv-ink);padding-right:4px}
#ig .fcs .c{border:3px solid;border-radius:14px;padding:6px 12px;display:flex;flex-direction:column;line-height:1.25}
#ig .fcs .c small{font-size:15px;font-weight:600}
#ig .fcs .c b{font-family:Anuphan;font-size:21px}
#ig .lvleg span{display:flex;align-items:center;gap:6px;border-radius:999px;padding:3px 12px 3px 6px;font-size:14px;border:2px solid transparent}
#ig .lvleg span.cur{border-color:var(--ink-1)}
#ig .lvleg i{width:14px;height:14px;border-radius:50%}
#ig .lvleg b{font-family:Anuphan;font-size:15px}
#ig:not(.social) .avg .l{font-size:28px}
#ig:not(.social) .avg .k{font-size:17px}
#ig:not(.social) .facts3 div{padding:8px 14px}
#ig:not(.social) .facts3 b{font-size:20px}
#ig:not(.social) .facts3 .fi{width:40px;height:40px}
#ig .fc3 td{padding:3px 4px}
#ig[data-dense="2"] .facts3 .k,#ig[data-dense="3"] .facts3 .k{font-size:13px}

#ig[data-dense="3"]:not(.social) .ig-body{gap:4px}#ig[data-dense="3"]:not(.social) .advice .w{padding:6px 14px;gap:5px}#ig[data-dense="3"]:not(.social) .advice .w h4{margin:0}#ig:not(.social) .advice{grid-template-columns:150px 1fr 1fr}#ig:not(.social) .advice .lv b{font-size:24px!important}#ig:not(.social) .advice .lv .f{font-size:40px}
#ig[data-dense="3"]:not(.social) .facts3 div{padding:4px 12px}#ig[data-dense="3"]:not(.social) .facts3 .fi{width:34px;height:34px}#ig[data-dense="3"]:not(.social) .facts3 b{font-size:18px}
#ig[data-dense="3"] .dzg2>div{padding:4px 12px 0}#ig[data-dense="3"] .dzg2{gap:8px}#ig[data-dense="3"] .ig-date{padding:6px 44px}#ig[data-dense="3"] .ig-f{padding:8px 44px}
#ig .ig-f{align-items:center;font-size:13.5px;line-height:1.5}
#ig .ig-f .qr{flex:none;display:block;line-height:0;border:1px solid var(--line);border-radius:8px;overflow:hidden}
#ig .ig-f b{color:var(--ink-1)}#ig{position:relative}#ig .ig-f{position:absolute;left:0;right:0;bottom:0}#ig .ig-body{padding-bottom:130px}
.hdr-in .meta .btns{flex-wrap:wrap}
.mock-b{display:inline-block;vertical-align:middle;font-size:11px;font-weight:700;color:#9a3412;background:#ffedd5;border:1px solid #fdba74;border-radius:999px;padding:1px 8px;margin-left:4px}
.dz-note{font-size:12px;font-weight:600;color:#6b4a00;background:#fff7e6;border:1px solid #f3dca8;border-radius:10px;padding:7px 10px;line-height:1.5}
.dz-note b{color:#8a5a00;margin-right:4px}
.dz-note .nw{display:block;color:var(--ink-2)}
.fr-note{font-size:11.5px;font-weight:600;color:var(--ink-3);margin:6px 0 0}
""" + (SCR / "ios.css").read_text(encoding="utf-8") + (SCR / "fonts.css").read_text(encoding="utf-8") + (SCR / "responsive.css").read_text(encoding="utf-8") + (SCR / "ds.css").read_text(encoding="utf-8") + (SCR / "e2x.css").read_text(encoding="utf-8") + __import__("zbc_apply").CSS + __import__("pheoc_apply").CSS + __import__("nav_apply").TOC_CSS + SK_CSS + """
.demo-bar{position:sticky;top:0;z-index:4000;background:#1f2937;color:#fff;font:600 13px/1.4 "IBM Plex Sans Thai",sans-serif;padding:8px 16px;text-align:center}body:has(.demo-bar) .sb{top:calc(var(--demo-h,36px) + 12px)}body:has(.demo-bar) .sb-scrim{top:var(--demo-h,36px)!important}body:has(.demo-bar) .dp{top:var(--demo-h,36px)}body:has(.demo-bar) .sb-btn{top:calc(var(--demo-h,36px) + 10px)}
.demo-bar b{color:#fcd34d}
.demo-bar sub{font-size:.7em;vertical-align:-.25em;line-height:0}
</style>"""
sub("</style>", CSS)
sub('<header class="hdr">', '<div class="demo-bar"><b>DEMO</b> · ข้อมูลบางส่วนเป็นค่าจำลอง · ยังไม่ได้แก้โค้ดจริง · หน่วงโหลด 3.5 วินาทีเพื่อให้เห็นกรอบโหลด (กดรีเฟรชเพื่อดูอีกครั้ง)</div><script>(()=>{const f=()=>{const d=document.querySelector(".demo-bar");if(d)document.body.style.setProperty("--demo-h",d.offsetHeight+"px")};f();addEventListener("resize",f)})()</script>\n<header class="hdr">')
sub("<title>รายงานสถานการณ์ PM2.5 เขตสุขภาพที่ 7</title>", "<title>Demo แดชบอร์ด PM2.5 เขต 7</title>")

# B3: ตารางย้อนหลัง 7 วัน — หัวการ์ดสีตามธีม, ตัวเลขใหญ่, หัวคอลัมน์ "วันนี้" มีกราฟิกปฏิทิน
sub('<div class="card chart-card"><div class="label">ค่าฝุ่น PM2.5 ย้อนหลัง 7 วัน · เฉลี่ย 24 ชม. ณ 07.00 น. · µg/m³</div>',
    '<div class="card chart-card t7-card"><div class="t7-head"><span class="bi"><svg class="ico"><use href="#i-cal"/></svg></span><div><h3>ค่าฝุ่น PM2.5 ย้อนหลัง 7 วัน</h3><p>เฉลี่ย 24 ชม. ณ 07.00 น. · หน่วย µg/m³</p></div></div>')
sub('${days.map((d, i) => `<th style="white-space:nowrap">${i === days.length - 1 ? "วันนี้" : short(d.date)}</th>`).join("")}',
    '${days.map((d, i) => `<th style="white-space:nowrap"${i === days.length - 1 && !compact ? \' class="th-today"\' : ""}>${i === days.length - 1 ? (compact ? "วันนี้" : todayHead(d.date)) : short(d.date)}</th>`).join("")}')
sub("function renderT7() {", """// หัวคอลัมน์ "วันนี้" (B3) — ปฏิทินเล็กแสดงวันที่ + ป้ายวันนี้ชี้ลงคอลัมน์
function todayHead(iso) {
  const d = new Date(iso + "T00:00:00");
  return `<span class="tdh"><span class="tcal" aria-hidden="true"><i>${TH_M[d.getMonth()]}</i><b>${d.getDate()}</b></span><span class="tlab">วันนี้</span></span>`;
}
function renderT7() {
  const toEnd = () => { const w = document.querySelector(".t7-card .t7-wrap"); if (w) w.scrollLeft = w.scrollWidth; };
  requestAnimationFrame(toEnd); document.fonts?.ready.then(toEnd); setTimeout(toEnd, 600);""")
# B4: ตารางสรุป — ต่ำสุด / สูงสุด / วันเกิน 75 (กดดูวันที่)
_a = html.index("// การ์ดสรุปช่วงที่เลือก (ใช้ค่ารายวันเสมอ"); _b = html.index("let _trendW = 0;", _a)
html = html[:_a] + (SCR / "b4_fn.js").read_text(encoding="utf-8") + html[_b:]
# C2: การ์ดค่าจังหวัด ใช้รูปแบบเดียวกับ A1 เดิม (กราฟิกท้องฟ้า + ตัวเลขใหญ่ + หน่วย + ป้ายระดับ) สเกลเท่าเดิม
OLD_PV = """    <div class="pv-hero" style="--pc:${l.c};--ps:${l.soft};--pk:${l.ink};--tk:${l.ink}">
      ${ring(v, 150)}
      <div class="pv-h">
        <span class="pv-k">ค่าฝุ่น PM2.5 วันนี้</span>
        <div class="pv-lv"><span aria-hidden="true">${l.face}</span>คุณภาพอากาศ${l.name}</div>
        ${dd != null ? `<div class="delta ${dd > 0 ? "up" : "down"}">${dd > 0 ? "▲" : dd < 0 ? "▼" : "●"} ${Math.abs(dd).toFixed(1)} จากเมื่อวาน (${f1(pr)})</div>` : ""}
        <p class="pv-adv"><svg class="ico"><use href="#i-shield"/></svg><span>${l.summary || l.pub[0]}</span></p>
      </div>
    </div>"""
NEW_PV = """    <div class="glass wx-hero pv-wx" style="--lv:${l.c};--lv-soft:${l.soft};--lv-tint:${l.tint};--lv-ink:${l.ink};--pk:${l.ink}">
      <div class="art">${weatherArt(v != null ? lvOf(v) : 1).replace('viewBox="0 0 260 190"', 'viewBox="34 10 206 150"')}</div>
      <div class="kpi">
        <div class="kpi-h"><h3 class="kpi-title">ค่าฝุ่น PM2.5</h3><span class="kpi-sub">จังหวัด${pvName} · เฉลี่ย 24 ชม. ณ ${REPORT_TIME}</span></div>
        <div class="kpi-v"><span class="kpi-num num">${v != null ? f1(v) : "–"}</span>
          <span class="kpi-unit"><b>µg/m³</b><small>ไมโครกรัม<br>ต่อลูกบาศก์เมตร</small></span></div>
        <div class="kpi-lv"><span aria-hidden="true">${l.face}</span>คุณภาพอากาศ${l.name}</div>
        ${dd != null ? `<div class="delta ${dd > 0 ? "up" : "down"}">${dd > 0 ? "▲" : dd < 0 ? "▼" : "●"} ${Math.abs(dd).toFixed(1)} จากวันก่อนหน้า (${f1(pr)})</div>` : ""}
        <p class="pv-adv"><svg class="ico"><use href="#i-shield"/></svg><span>${l.summary || l.pub[0]}</span></p>
      </div>
    </div>"""
sub(OLD_PV, NEW_PV)
# C5: เอาแถบช่วงค่า 4 จังหวัดออก คงไว้แค่ตารางรายจังหวัด (หัวคอลัมน์บอกวันที่ + พรุ่งนี้/วันในสัปดาห์)
sub("""  const days = [0, 1, 2].map(k => { const d = new Date(base.getTime() + (k + 1) * 864e5); return `${d.getDate()}/${d.getMonth() + 1}`; });""",
    """  const days = [0, 1, 2].map(k => { const d = new Date(base.getTime() + (k + 1) * 864e5); return `${d.getDate()} ${TH_M[d.getMonth()]}<small>${k === 0 ? "พรุ่งนี้" : TH_D[d.getDay()]}</small>`; });""")
sub("""  el.innerHTML = head + `<div class="sub">แถบ = ต่ำสุด–สูงสุดของ 4 จังหวัด · จุด = ค่าเฉลี่ย</div>${rows}<div class="fc-scale num"><span>0</span><span>25</span><span>50</span></div>${tbl}""",
    """  el.innerHTML = head + `${tbl}<div class="t7-note fc-note">${LV.map(l => `<span><i style="background:${l.c}"></i>${l.name}</span>`).join("")}</div>""")
# C5: ป้ายการระบายอากาศในทุกช่อง + ข้อความเตือนวันที่ระบายอากาศอ่อน
sub("""  const tbl = `<table class="t7 fc-t num"><tr><th>จังหวัด</th>${days.map(d => `<th>${d}</th>`).join("")}</tr>${items.map(({ p, it }) => `<tr><td>${p.name}</td>${it.pred.map(x => x == null
    ? `<td class="na">–</td>` : `<td class="cell" style="background:${LV[lvOf(x)].c};color:${textOn(LV[lvOf(x)].c)}">${f1(x)}</td>`).join("")}</tr>`).join("")}</table>`;""",
"""  const tbl = `<table class="t7 fc-t num"><tr><th>จังหวัด</th>${days.map(d => `<th>${d}</th>`).join("")}</tr>${items.map(({ p, it }) => `<tr><td>${p.name}</td>${it.pred.map((x, k) => x == null
    ? `<td class="na">–</td>` : `<td class="cell" style="background:${LV[lvOf(x)].c};color:${textOn(LV[lvOf(x)].c)}">${f1(x)}${ventBadge(it.vent?.[k])}</td>`).join("")}</tr>`).join("")}</table>`;
  // ข้อความเตือนเฉพาะวันที่มีจังหวัดระบายอากาศอ่อน
  const warn = [0, 1, 2].map(k => { const d = new Date(base.getTime() + (k + 1) * 864e5), pv = items.filter(o => o.it.vent?.[k] === 2).map(o => o.p.name);
    return pv.length ? `<div class="vw"><span class="vw-i" aria-hidden="true"><svg class="ico"><use href="#a-dust"/></svg></span><span><b>${d.getDate()} ${TH_M[d.getMonth()]} · ระบายอากาศอ่อน</b> ${pv.join(" ")} — ฝุ่นมีแนวโน้มสะสม ควรลดกิจกรรมกลางแจ้ง</span></div>` : ""; }).join("");""")
sub("""  el.innerHTML = head + `${tbl}<div class="t7-note fc-note">""",
    """  el.innerHTML = head + `${tbl}${warn}<div class="t7-note fc-note"><span class="vb v0">${VENT_ICO}ดี</span><span class="vb v1">${VENT_ICO}ปานกลาง</span><span class="vb v2">${VENT_ICO}อ่อน</span><span>= การระบายอากาศ</span></div><div class="t7-note fc-note">""")
sub("function renderForecast() {", """// ป้ายการระบายอากาศ (C5) · 0 ดี · 1 ปานกลาง · 2 อ่อน — เกณฑ์ชั่วคราว รอยืนยันกับกรมอุตุนิยมวิทยา
const VENT = ["ดี", "ปานกลาง", "อ่อน"];
const VENT_ICO = `<svg class="vb-i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M3 8h10a3 3 0 1 0-3-3"/><path d="M3 12h15a3 3 0 1 1-3 3"/><path d="M3 16h7"/></svg>`;
const ventBadge = c => c == null ? "" : `<span class="vb v${c}" title="การระบายอากาศ${VENT[c]}">${VENT_ICO}${VENT[c]}</span>`;
function renderForecast() {""")
sub('    <symbol id="i-heartp"', '    <symbol id="i-rain" viewBox="0 0 24 24"><path d="M7 15a4 4 0 0 1-.6-8A5.5 5.5 0 0 1 17 7.5a3.8 3.8 0 0 1 .5 7.5z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/></symbol>\n    <symbol id="i-drop" viewBox="0 0 24 24"><path d="M12 3s6 6.6 6 11a6 6 0 0 1-12 0c0-4.4 6-11 6-11z"/></symbol>\n    <symbol id="i-therm" viewBox="0 0 24 24"><path d="M10 14.5V5a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0z"/><path d="M12 9v7"/></symbol>\n    <symbol id="i-heartp"')
# C5: กดช่องเพื่อดูปัจจัยอากาศ (ยังไม่รวมเป็นระดับเดียว รอแบบจำลอง)
sub("""`<td class="cell" style="background:${LV[lvOf(x)].c};color:${textOn(LV[lvOf(x)].c)}">${f1(x)}${ventBadge(it.vent?.[k])}</td>`""",
    """`<td class="cell fc-c" tabindex="0" role="button" aria-pressed="false" data-pv="${p.name}" data-k="${k}" style="background:${LV[lvOf(x)].c};color:${textOn(LV[lvOf(x)].c)}">${f1(x)}${ventBadge(it.vent?.[k])}</td>`""")
sub("""  el.innerHTML = head + `${tbl}${warn}<div class="t7-note fc-note">""",
    """  el.innerHTML = head + `<p class="fc-hint">กดช่องตัวเลขเพื่อดูปัจจัยอากาศของจังหวัดและวันนั้น</p>${tbl}<div id="fcDet" class="fc-det" hidden></div>${warn}<div class="t7-note fc-note">""")
sub("""เป็นค่าประมาณ อาจต่างจากค่าสถานีตรวจวัด Air4Thai</span></div>`;
}""", """เป็นค่าประมาณ อาจต่างจากค่าสถานีตรวจวัด Air4Thai</span></div>`;
  // กล่องปัจจัยอากาศ — แสดงทีละช่อง กดซ้ำเพื่อปิด
  const det = el.querySelector("#fcDet");
  const st = (t, c) => `<span class="st ${c}">${t}</span>`;
  const show = td => {
    const was = td.getAttribute("aria-pressed") === "true";
    el.querySelectorAll(".fc-c").forEach(c => c.setAttribute("aria-pressed", "false"));
    if (was) { det.hidden = true; return; }
    td.setAttribute("aria-pressed", "true");
    const k = +td.dataset.k, o = items.find(o => o.p.name === td.dataset.pv), f = o.it.fac?.[k] || {}, v = o.it.vent?.[k], x = o.it.pred[k];
    const d = new Date(base.getTime() + (k + 1) * 864e5), l = LV[lvOf(x)];
    const row = (ic, lab, val) => `<div class="fr"><svg class="ico"><use href="#${ic}"/></svg><span>${lab}</span>${val}</div>`;
    det.innerHTML = `<div class="dh"><b>จ.${o.p.name} · ${d.getDate()} ${TH_M[d.getMonth()]}</b><span>ค่าฝุ่นคาดการณ์ <b style="color:${l.ink}">${f1(x)}</b> µg/m³ · ${l.name}</span></div>
      ${row("a-dust", "การระบายอากาศ", v == null ? st("ไม่มีข้อมูล", "na") : st(VENT[v], ["ok", "mid", "bad"][v]))}
      ${f.hs != null ? row("i-fire", `จุดความร้อนต้นลม 72 ชม.${f.wd ? ` <small>ลมจากทิศ${f.wd}</small>` : ""}`, st(["น้อย", "ปานกลาง", "มาก"][f.hs], ["ok", "mid", "bad"][f.hs])) : ""}
      ${f.inv != null ? row("i-therm", "อุณหภูมิผกผันช่วงเช้า", f.inv ? st("มี", "bad") : st("ไม่มี", "ok")) : ""}
      ${f.rain != null ? row("i-rain", "ฝน", f.rain ? st("มีฝน", "ok") : st("ไม่มีฝน", "mid")) : ""}
      ${f.rh != null ? row("i-drop", "ความชื้นสัมพัทธ์", f.rh ? st("สูง", "mid") : st("ปกติ", "ok")) : ""}
      <p class="fr-note">แสดงแต่ละปัจจัยแยกกัน ยังไม่รวมเป็นระดับความเสี่ยง</p>`;
    det.hidden = false;
  };
  el.querySelectorAll(".fc-c").forEach(td => { td.addEventListener("click", () => show(td)); td.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); show(td); } }); });
}""")
# Leaflet ฝังในหน้า (หน้า demo โหลด stylesheet ภายนอกไม่ได้)
LF = SCR / "lf" / "package" / "dist"
# Infographic ฉบับปรับ: เลือกจังหวัด · ตัดเทียบปี 2568 · โรคแบบ E1 · คาดการณ์ 3 วัน · QR
_a = html.index("function buildInfographic("); _b = html.index("// html2canvas 1.4 อ่านสีแบบ", _a)
html = html[:_a] + (SCR / "ig_new.js").read_text(encoding="utf-8") + html[_b:]
sub('<script src="/html2canvas.min.js"></script>', "<script>" + (SCR / "npmq" / "h2c" / "package" / "dist" / "html2canvas.min.js").read_text(encoding="utf-8") + "</script><script>" + (SCR / "npmq" / "package" / "qrcode.js").read_text(encoding="utf-8") + "</script>")
sub('''          <option value="social">1080×1350 · โพสต์ Facebook/LINE</option>
        </select>''', '''          <option value="social">1080×1350 · โพสต์ Facebook/LINE</option>
        </select>
        <label class="sr-only" for="igPv">พื้นที่</label>
        <select class="size" id="igPv">
          <option value="">ทั้งเขตสุขภาพที่ 7</option>
          <option>ขอนแก่น</option><option>มหาสารคาม</option><option>ร้อยเอ็ด</option><option>กาฬสินธุ์</option>
        </select>''')
sub('    const size = document.getElementById("igSize").value;\n', '    const size = document.getElementById("igSize").value; S.igPv = document.getElementById("igPv").value;\n')
sub("a.download = `PM25-เขต7-${S.todayRow?.date || \"today\"}-${size}.png`;", "a.download = `PM25-${S.igPv || \"เขต7\"}-${S.todayRow?.date || \"today\"}-${size}.png`;")
# โพสต์ประชาชนรายจังหวัด = เทมเพลต สคร.7 + แถบคาดการณ์ 3 วัน + QR · แก้ "PM.25" ในเทมเพลตเป็น PM₂.₅
import base64 as _b64
_tpl = {p.stem: "data:image/webp;base64," + _b64.b64encode(p.read_bytes()).decode() for p in sorted((SCR / "tpl").glob("*.webp"))}
sub("  const img = new Image(); img.src = `templates/${pv.code}-${lvOf(v)}.png`; await img.decode();",
    "  const img = new Image(); img.src = window.TPL?.[`${pv.code}-${lvOf(v)}`] || `templates/${pv.code}-${lvOf(v)}.png`; await img.decode();")
sub("// ---------- ภาพสถานการณ์รายจังหวัด (เทมเพลตกราฟิกของ สคร.7 · 1080×1080) ----------", "window.TPL = " + json.dumps(_tpl) + ";\n// ---------- ภาพสถานการณ์รายจังหวัด (เทมเพลตกราฟิกของ สคร.7 · 1080×1080) ----------")
sub("  x.textAlign = \"center\"; x.textBaseline = \"middle\"; x.fillText(ds, CARD.date.cx, CARD.date.cy);\n  return c;\n}\n",
    "  x.textAlign = \"center\"; x.textBaseline = \"middle\"; x.fillText(ds, CARD.date.cx, CARD.date.cy);\n  fixTemplatePM(x); fixTemplateToday(x);\n  return c;\n}\n" + (SCR / "pv_social.js").read_text(encoding="utf-8"))
sub('<option value="a4">A4 · พิมพ์ติดบอร์ด</option>', '<option value="a4">A4 · รายงานสำหรับเจ้าหน้าที่</option>')
sub('<option value="social">1080×1350 · โพสต์ Facebook/LINE</option>', '<option value="social">1080×1350 · โพสต์ประชาชน (Facebook/LINE)</option>')
sub('    const canvas = await html2canvas(document.getElementById("ig"),', '    const canvas = size === "social" && S.igPv ? await provinceSocial(S.igPv) : await html2canvas(document.getElementById("ig"),')
# จ. ปุ่มคัดลอกข้อความโพสต์ในหน้าต่างดาวน์โหลด
sub('    <div class="hint" id="mHint"></div>\n', '    <div class="hint" id="mHint"></div>\n    <div class="cap" id="mCap" hidden><textarea id="mCapT" readonly aria-label="ข้อความสำหรับโพสต์"></textarea><button class="btn primary" id="mCopy" type="button">คัดลอกข้อความโพสต์</button></div>\n')
sub('    document.getElementById("modal").classList.add("on"); document.getElementById("mClose").focus();\n  } catch (err) { alert("สร้าง Infographic ไม่สำเร็จ: " + err.message); }',
    '    const cap = document.getElementById("mCap"); cap.hidden = size !== "social"; if (size === "social") document.getElementById("mCapT").value = igCaption();\n    document.getElementById("modal").classList.add("on"); document.getElementById("mClose").focus();\n  } catch (err) { alert("สร้าง Infographic ไม่สำเร็จ: " + err.message); }')
sub('document.getElementById("mClose").addEventListener("click",', 'document.getElementById("mCopy").addEventListener("click", async e => { const btn = e.currentTarget, t = document.getElementById("mCapT"); t.select(); let ok = false; try { await navigator.clipboard.writeText(t.value); ok = true; } catch { try { ok = document.execCommand("copy"); } catch {} } btn.textContent = ok ? "คัดลอกแล้ว ✓" : "เลือกข้อความแล้ว กด Ctrl+C"; setTimeout(() => { btn.textContent = "คัดลอกข้อความโพสต์"; }, 2500); });\ndocument.getElementById("mClose").addEventListener("click",')
# 3. ช่วงค่าระดับ: ทศนิยม 1 ตำแหน่ง ให้ตรงกับเกณฑ์ คพ. และเทมเพลต
for _o, _n in [('range: "0 – 15"', 'range: "0 – 15.0"'), ('range: "16 – 25"', 'range: "15.1 – 25.0"'), ('range: "26 – 37.5"', 'range: "25.1 – 37.5"'), ('range: "37.6 – 75"', 'range: "37.6 – 75.0"'), ('range: "มากกว่า 75"', 'range: "75.1 ขึ้นไป"')]:
    sub(_o, _n)
# html2canvas: เรนเดอร์ด้วยความกว้างจอเดสก์ท็อปเสมอ (การ์ดจังหวัดไม่สลับเป็นแบบมือถือเมื่อกดดาวน์โหลดจากมือถือ)
sub('{ useCORS: true, allowTaint: true, scale: 2, backgroundColor: "#ffffff",', '{ useCORS: true, allowTaint: true, scale: 2, backgroundColor: "#ffffff", windowWidth: 1400, windowHeight: 1000,')
# html2canvas: แปลงสี color() เป็น rgba แบบ !important ให้ชนะกฎ CSS ที่มี !important ด้วย
sub('if (v && v.includes("color(")) el.style[p] = toRgba(v);', 'if (v && v.includes("color(")) el.style.setProperty(p.replace(/[A-Z]/g, m => "-" + m.toLowerCase()), toRgba(v), "important");')
# ฟอนต์ LINE Seed Sans TH: canvas (ภาพเทมเพลตจังหวัด) + svg ตอน export
html = html.replace("px Anuphan", "px 'LINE Seed Sans TH'")
sub('onclone: doc => canvasSafeColors(doc.getElementById("ig")) })', 'onclone: doc => { canvasSafeColors(doc.getElementById("ig")); igSvgFonts(doc.getElementById("ig")); } })')
sub("// ================= INFOGRAPHIC =================", (SCR / "lsfont.js").read_text(encoding="utf-8") + "// ================= INFOGRAPHIC =================")
sub('<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">', "<style>" + (LF / "leaflet.css").read_text(encoding="utf-8") + "</style>")
sub('<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>', "<script>" + (LF / "leaflet.js").read_text(encoding="utf-8") + "</script>")
# C5 final: แทนที่ฟังก์ชันคาดการณ์ทั้งก้อน
_a = html.index("// แผงคาดการณ์ล่วงหน้า 3 วัน — ค่าคาดการณ์"); _b = html.index("const countBy = feats", _a)
html = html[:_a] + (SCR / "c5_final.js").read_text(encoding="utf-8") + html[_b:]
# E1: กราฟรายเดือน 4 กลุ่มโรค ปี 2569 ทั้งเขต + หมายเหตุ HDC
sub('<p id="dzSub">ผู้ป่วยรายเดือน เทียบปี 2568 กับ 2569</p>', '<p id="dzSub">ผู้ป่วย 4 กลุ่มโรค ปี 2569 · ข้อมูล HDC</p>')
sub("`ผู้ป่วยรายเดือน · ปี 2569 สะสมสัปดาห์ที่ 1–${wkMax} เทียบช่วงเดียวกันปี 2568 · ข้อมูล HDC`", "`ผู้ป่วย 4 กลุ่มโรค · ปี 2569 สัปดาห์ที่ 1–${wkMax} · ทั้งเขตสุขภาพที่ 7 · ข้อมูล HDC${(() => { const p = String(dz.meta?.dataDate || '').split('/'); return p.length === 3 ? ` ณ ${+p[0]} ${TH_M[+p[1] - 1]} ${+p[2] + 543}` : ''; })()}`")
_POPROWS = [{"year_be": int(r["year_be"]), "pv_code": int(r["code"]), "pv_name": r["province"], "type1c": int(r["type1c"]), "type3c": int(r["type3c"]), "pop13_end_fy": int(r["pop13"]), "pop13_midyear": int(r["midyear_interp_1jul"])} for r in csv.DictReader(open(SCR / "pop_r7_type13.csv", encoding="utf-8-sig")) if r["code"] != "0"]
# ค่าฝุ่นจริงจากสถานี (ชีต PM25_History ผ่าน API แดชบอร์ด) — ใช้เฉพาะแผงวิเคราะห์ E2 (โซนอื่นในเดโม่ยังเป็นค่าจำลอง)
_PMREAL = {}
for _r in csv.DictReader(open(SCR / "ana" / "pm25.csv", encoding="utf-8")):
    _PMREAL[_r["date"]] = {k: float(v) for k, v in _r.items() if k != "date" and v not in ("", None) and float(v) > 0}
DSDATA = {"s1": json.loads((SCR / "dzpv_real.json").read_text(encoding="utf-8")), "s2": json.loads((SCR / "dzpv2_real.json").read_text(encoding="utf-8")), "pop": PVPOP, "popRows": _POPROWS, "dateCom": "2026-10-09 06:18", "snapshotAt": "2026-10-15"}
sub("function renderDisease() {", "window.DSDATA = " + json.dumps(DSDATA, ensure_ascii=False) + ";\n" + (SCR / "ds_module.js").read_text(encoding="utf-8") + "\nrenderDisease = (f => function () { f.apply(this, arguments); window.dsInit && dsInit(); })(renderDisease);\nwindow.DZPV = " + json.dumps(DZPV, ensure_ascii=False) + ";\n" + (SCR / "e1_monthly.js").read_text(encoding="utf-8") + (SCR / "e2_prov.js").read_text(encoding="utf-8") + "window.PMREAL = " + json.dumps(_PMREAL, ensure_ascii=False) + ";\n" + (SCR / "e2x.js").read_text(encoding="utf-8") + "function renderDisease() {")
sub("    const W = 560, H = 190, g = dzBars(d, a, b, W, H, 10.5);", "    if (di === 0) return dzMonthAll(dz, wkMax) + e2xBlock(wkMax);\n    if (di > 0) return \"\";\n    const W = 560, H = 190, g = dzBars(d, a, b, W, H, 10.5);")
# ทุกส่วน: PM2.5 → PM₂.₅ ตัวห้อยตามหลักวิชาการ (เฉพาะข้อความที่แสดงบนจอ)
SVG_OLD = 'ค่าฝุ่น PM2.5 (µg/m³)</text>'
SVG_NEW = 'ค่าฝุ่น PM<tspan font-size="9" dy="3">2.5</tspan><tspan dy="-3"> (µg/m³)</tspan></text>'
sub(SVG_OLD, SVG_NEW)
_out = []
for ln in html.split("\n"):
    t = ln.lstrip()
    if "PM2.5" in ln and not (t.startswith("//") or t.startswith("/*") or "aria-label=" in ln or "alt=" in ln or ".alt =" in ln or "<title>" in ln):
        ln = ln.replace("PM2.5", '<span class="pm25">PM<sub>2.5</sub></span>')
    _out.append(ln)
html = "\n".join(_out)
import re
html = re.sub(r'^(<!doctype html>|<html lang="th">|<head>|</head>|<body>|</body>|</html>)\n', '', html, flags=re.M | re.I)
html = html.replace('<meta charset="utf-8">\n', '', 1).replace('<meta name="viewport" content="width=device-width, initial-scale=1">\n', '', 1)

OLD_TH = '<span class="th"><span><svg class="ico" style="width:15px;height:15px"><use href="#i-pin"/></svg>${p.name}</span>${l ? `<span class="chip" style="background:${l.soft};color:${l.ink}">${l.name}</span>` : ""}</span>'
NEW_TH = '<span class="th"><span class="tn"><span class="pn">${p.name}</span>${l ? `<span class="chip" style="background:${l.soft};color:${l.ink}">${l.name}</span>` : ""}</span>${v != null ? `<span class="t-art">${weatherArt(lvOf(v), 130, 95).replace(\'viewBox="0 0 260 190"\', \'viewBox="34 10 206 150"\')}</span>` : ""}</span>'
sub(OLD_TH, NEW_TH)
# A3: ตัวเลขค่าฝุ่นในวงแหวนใหญ่และเด่นขึ้น + PM₂.₅ ห้อยถูกหลัก
sub("      ${ring(v)}\n", "      ${ringT(v)}\n")
RING_T = """// วงแหวนการ์ดจังหวัด (A3) — ตัวเลขใหญ่ ทศนิยมเล็กสีตามระดับ · PM2.5 ตัวห้อย
function ringT(v, size = 150) {
  const R = 50, C = 2 * Math.PI * R, l = v != null ? LV[lvOf(v)] : null, p = v != null ? Math.min(v, 100) / 100 : 0;
  const [ip, dp] = v != null ? f1(v).split(".") : [];
  return `<div class="ring ring-t" style="width:${size}px;height:${size}px"><svg viewBox="0 0 118 118"><circle cx="59" cy="59" r="${R}" fill="none" stroke="#e6ebf1" stroke-width="7"/>
    <circle cx="59" cy="59" r="${R}" fill="none" stroke="${l ? l.c : "#ccd4de"}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${(C * p).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 59 59)"/></svg>
    <div class="c"><em>PM<sub>2.5</sub></em><b class="num">${v != null ? `${ip}<i>.${dp}</i>` : "–"}</b><span>µg/m³</span></div></div>`;
}
"""
sub("function ring(v, size = 128) {", RING_T + "function ring(v, size = 128) {")
# แผงดาวน์โหลด: ป้ายชื่อช่องชัดเจน + กรอบแผง (ไม่ให้กลืนกับพื้นหลัง)
_a = html.index('<div class="btns">'); _b = html.index('</button>\n      </div>', _a) + len('</button>\n      </div>')
html = html[:_a] + """<div class="btns dl-panel" role="group" aria-labelledby="dlH">
        <div class="dl-h" id="dlH"><span class="dl-i"><svg class="ico"><use href="#i-down"/></svg></span><span><b>ดาวน์โหลด Infographic</b><small>เลือกรูปแบบและพื้นที่ แล้วกดสร้างภาพ</small></span></div>
        <label class="dl-f"><span>ใช้สำหรับ</span>
        <select class="size" id="igSize">
          <option value="a4">A4 · รายงานสำหรับเจ้าหน้าที่</option>
          <option value="social">1080×1350 · โพสต์ประชาชน (Facebook/LINE)</option>
        </select></label>
        <label class="dl-f"><span>พื้นที่</span>
        <select class="size" id="igPv">
          <option value="">ทั้งเขตสุขภาพที่ 7</option>
          <option>ขอนแก่น</option><option>มหาสารคาม</option><option>ร้อยเอ็ด</option><option>กาฬสินธุ์</option>
        </select></label>
        <button class="btn primary dl-go" id="btnIg"><svg class="ico"><use href="#i-down"/></svg>สร้างภาพ</button>
      </div>""" + html[_b:]
# สัปดาห์ระบาดวิทยา: monthly() เดิม + กราฟแนวโน้มรายสัปดาห์ (zone B) + หัวข้อ zone E
sub("    const mo = new Date(yearCE, 0, 1 + (wk - 1) * 7 + 3).getMonth(); m[mo] += v; has[mo] = true;", "    const mo = epiMonth(yearCE, wk); m[mo] += v; has[mo] = true;")
_a = html.index("function weekly() {"); _b = html.index("// ---------- กราฟแนวโน้ม: รายวัน/รายสัปดาห์", _a)
html = html[:_a] + """function weekly() {   // รวมเป็นสัปดาห์ระบาดวิทยา (อาทิตย์–เสาร์ · ตัดรอบที่ 1 ม.ค.)
  const all = S.pm?.allData || {}, dates = Object.keys(all).sort();
  if (!dates.length) return [];
  const wk = new Map();
  for (const d of dates) {
    const dt = new Date(d + "T00:00:00"), y = dt.getFullYear(), w = epiWeekOf(dt), key = y * 100 + w;
    if (!wk.has(key)) wk.set(key, { s: d, e: d, y, w, v: PROV.map(() => []) });
    const o = wk.get(key); o.e = d;
    PROV.forEach((p, k) => { const x = all[d]?.[p.name]; if (x != null && x > 0) o.v[k].push(x); });
  }
  return [...wk.values()].map(o => ({ s: o.s, e: o.e, y: o.y, w: o.w, v: o.v.map(a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null) }));
}
""" + html[_b:]
sub('day ? "ค่ารายวัน (เฉลี่ย 24 ชม. ณ 07.00 น.)" : "ค่าเฉลี่ยรายสัปดาห์"', 'day ? "ค่ารายวัน (เฉลี่ย 24 ชม. ณ 07.00 น.)" : "ค่าเฉลี่ยรายสัปดาห์ระบาดวิทยา (อาทิตย์–เสาร์)"')
sub(": `${thDate(r.s)} – ${thDate(r.e)}`;", ": `สัปดาห์ระบาดวิทยาที่ ${r.w}/${r.y + 543} · ${thDate(r.s)} – ${thDate(r.e)}`;")
html = html.replace("ผู้ป่วย 4 กลุ่มโรค · ปี 2569 สัปดาห์ที่ 1–${wkMax} · ทั้งเขตสุขภาพที่ 7", "ผู้ป่วย 4 กลุ่มโรค · ปี 2569 สัปดาห์ระบาดวิทยาที่ 1–${wkMax} (${epiRange(2026, 1, wkMax)}) · ทั้งเขตสุขภาพที่ 7", 1)
# ชุดปรับ 16 ต.ค. 2569: จุดความร้อน · ตัวกรองแนวโน้ม · เลือกพื้นที่เจาะลึก · หมายเหตุคาดการณ์
import zbc_apply
zbc_apply.apply(sub)
html = zbc_apply.apply_area_bind(html)
sub(zbc_apply.FC_OLD, zbc_apply.FC_NEW)
import pheoc_apply
html = pheoc_apply.apply(html)
import nav_apply
html = nav_apply.apply(html)
import c5_apply
html = c5_apply.apply(html)
# ขนาดตัวอักษรทุกจุด (CSS และ style ในเทมเพลต) คูณด้วย --fs ตามขนาดจอ — ต่ำกว่า 1366 px = เท่าเดิม
html = re.sub(r"font-size:\s*([0-9.]+)px", lambda m: f"font-size:calc({m.group(1)}px*var(--fs,1))", html)
# โซนชุดข้อมูล: แถบซ้ายข้างแดชบอร์ด สร้างโดย ds_module.js (buildSide)
OUT.write_text(html, encoding="utf-8")
print(OUT, len(html))
