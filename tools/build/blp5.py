import json, base64, random, datetime, sys, pathlib

REPO = pathlib.Path(__import__("os").environ.get("PM25_REPO") or pathlib.Path(__file__).resolve().parents[2])   # ค่าเริ่มต้น = โฟลเดอร์ repo (tools/build/../..)
SCR = pathlib.Path(sys.argv[1])
OUT = pathlib.Path(sys.argv[3])

html = pathlib.Path(sys.argv[2]).read_text(encoding="utf-8")

def sub(old, new, count=1):
    global html
    if html.count(old) != count:
        raise SystemExit(f"match count {html.count(old)} != {count}: {old[:80]!r}")
    html = html.replace(old, new)

# ---------- assets inline ----------
def data_uri(p, mime):
    return f"data:{mime};base64," + base64.b64encode((REPO / p).read_bytes()).decode()
html = html.replace('src="/header-v3.webp"', f'src="{data_uri("header-v3.webp", "image/webp")}"')
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
# E2–E5: ผู้ป่วยรายสัปดาห์รายจังหวัด — ข้อมูลจริง HDC s_pm25_1_in_week (date_com 9 ต.ค. 2569, ดึง 15 ต.ค. 2569)
#   ตัวตั้ง = ผู้ป่วยสัญชาติไทย ทุก TYPEAREA ตามหน่วยบริการในจังหวัด ตัดซ้ำรายคน/สัปดาห์ (คอลัมน์ w_NN_m)
#   ตัวหาร = ประชากร TYPEAREA 1+3 หลังตัดซ้ำ (HDC s_persontype) ประมาณ ณ 1 ก.ค. 2569
#            = P(ปี 2568) + 0.75 × (P(ปี 2569) − P(ปี 2568))  [ยอด HDC นับ ณ สิ้นปีงบประมาณ 30 ก.ย.]
import json as _json
PVPOP = {"ขอนแก่น": 1311335, "มหาสารคาม": 660752, "ร้อยเอ็ด": 871165, "กาฬสินธุ์": 748456}
_rows = []
for pv, _s in _json.loads((SCR / "dzpv_real.json").read_text(encoding="utf-8")).items():
    for _t in _s.split(";"):
        _w, *_v = map(int, _t.split(","))
        _rows.append({"wk": _w, "pv": pv, **dict(zip(("resp", "heart", "eye", "skin"), _v))})
DZPV = {"mock": False, "pop": PVPOP, "popNote": "ประชากร Type 1+3 (HDC) กลางปี 2569", "rows": _rows}
_REG26 = {}
for _r in _rows:
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
_D1 = json.loads((SCR / "dzpv_real.json").read_text(encoding="utf-8"))
_ROWS1 = [dict(zip(("wk", "resp", "heart", "eye", "skin"), map(int, t.split(","))), pv=pv) for pv, src in _D1.items() for t in src.split(";")]
shim = f"""<script>
/* PREVIEW — ผู้ป่วย = ข้อมูลจริง HDC · ค่าฝุ่น/แผนที่/จุดความร้อน = ค่าจำลอง */
(function(){{
  const MOCK = {{ "/api/sheet-pm25": {json.dumps(pm, ensure_ascii=False)}, "/api/sheet-disease": {json.dumps(dz, ensure_ascii=False)}, "/api/hotspot": {json.dumps(hs, ensure_ascii=False)}, "/hotspot-sample-2026-05-07.json": {json.dumps(_hs, ensure_ascii=False)}, "/api/provinces-geojson": {json.dumps(geo, ensure_ascii=False)}, "/api/pm25/provinces": {json.dumps(gpv, ensure_ascii=False)}, "/districts-r7.geojson": {json.dumps(dgeo, ensure_ascii=False)} }};
  const DIST = {json.dumps(dist, ensure_ascii=False)};
  const SUBD = amp => ({{ ok: true, days: {json.dumps(pdays)}, season: {json.dumps(SEASON)}, items: Array.from({{ length: 8 }}, (_, i) => {{ const a = Math.round((14 + ((amp * 7 + i * 13) % 30)) * 10) / 10; return {{ code: amp + String(i + 1).padStart(2, "0"), name: "ตำบลตัวอย่าง " + (i + 1), avg24: a, past: [a - 2.1, a + 1.4, a - 0.6].map(x => Math.round(x * 10) / 10), max: {{ v: 72 + i * 2.3, date: "2026-03-14" }} }}; }}) }});
  const real = window.fetch.bind(window);
  window.fetch = (u, o) => {{
    const k = String(u).replace(/^https?:\\/\\/[^/]+/, "").split("?")[0], q = new URLSearchParams(String(u).split("?")[1] || "");
    const J = o => Promise.resolve(new Response(JSON.stringify(o), {{ headers: {{ "Content-Type": "application/json" }} }}));
    if (k === "/api/visit") {{ window.__v = window.__v || {{ ok: true, today: 47, month: 1126, total: 10912, since: "2026-10-16" }}; if ((o?.method || "GET") === "POST") {{ __v.today++; __v.month++; __v.total++; }} return J(__v); }}
    if (k === "/api/pm25-07") {{ const A = MOCK["/api/sheet-pm25"].allData || {{}}, out = {{}}; for (const d in A) if (d >= "2026-08-02") {{ out[d] = {{}}; for (const p in A[d]) out[d][p] = Math.round(A[d][p] * 0.93 * 10) / 10; }} return J({{ ok: true, allData: out }}); }}
    if (k === "/api/disease-pv") return new Promise(r => setTimeout(r, 3200)).then(() => J({json.dumps(dict(ok=True, rows1=_ROWS1, dateCom="202610090618", **DZPV), ensure_ascii=False)}));
    if (k === "/api/pheoc") return new Promise(r => setTimeout(r, 3000)).then(() => J({{ ok: true, anyHit: true, hit: ["กาฬสินธุ์"], dates: ["2026-10-11", "2026-10-12"], provinces: [["ขอนแก่น", 41.2, 52.6], ["มหาสารคาม", 58.4, 61.0], ["ร้อยเอ็ด", 64.9, 72.8], ["กาฬสินธุ์", 78.2, 84.1]].map(([name, a, b]) => ({{ name, days: [{{ date: "2026-10-11", v: a }}, {{ date: "2026-10-12", v: b }}], hit: a >= 75.1 && b >= 75.1 }})) }}));
    if (k === "/api/pm25/districts") return J(DIST[q.get("pv")] || {{ ok: false }});
    if (k === "/api/pm25/subdistricts") return J(SUBD(+q.get("amp")));
    if (k in MOCK) return new Promise(r => setTimeout(r, 2500)).then(() => new Response(JSON.stringify(MOCK[k]), {{ headers: {{ "Content-Type": "application/json" }} }}));
    if (k.startsWith("/api/") || k.endsWith(".json")) return Promise.resolve(new Response("null", {{ status: 503 }}));
    return real(u, o);
  }};
}})();
</script>
"""
sub("<script>\n/* ===", shim + "<script>\n/* ===")
sub('const API = location.protocol === "file:" ? "https://pm25-dashboard-ex8l.onrender.com" : "";', 'const API = "";')


LF = SCR / "lf" / "package" / "dist"
sub('<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">', "<style>" + (LF / "leaflet.css").read_text(encoding="utf-8") + "</style>")
sub('<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>', "<script>" + (LF / "leaflet.js").read_text(encoding="utf-8") + "</script>")
sub('<script src="/html2canvas.min.js"></script>', "<script>" + (REPO / "html2canvas.min.js").read_text(encoding="utf-8") + "</script>")
if '<script src="/qrcode.js"></script>' in html: sub('<script src="/qrcode.js"></script>', "<script>" + (REPO / "qrcode.js").read_text(encoding="utf-8") + "</script>")
import re as _re
html = _re.sub(r'(["(`])/?templates/', lambda m: m.group(1) + "file://" + str(REPO) + "/templates/", html)
TAG = sys.argv[4]
html = html.replace("<body>", f'<body><div style="position:sticky;top:0;z-index:9999;background:#0f1b2d;color:#fff;font:600 13px/1.4 sans-serif;padding:7px 14px;text-align:center">{TAG}</div>', 1)
OUT.write_text(html, encoding="utf-8"); print(OUT, len(html))
