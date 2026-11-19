"""ข้อมูลจำลอง /api/hotspot-backup สำหรับเดโม่และทดสอบออฟไลน์ (ใช้ตัวอย่างจุดความร้อน 7 พ.ค. 2569 กระจายเป็น 14 วันย้อนหลัง) — ไม่ใช่ข้อมูลจริง"""
import datetime as dt

def make(sample, days=14):
    today = dt.date.today()
    seen, rows = set(), []
    feats = sample["features"]
    for i in range(days):
        d = today - dt.timedelta(days=days - 1 - i)
        for j, f in enumerate(feats):
            if (j * 7 + i * 3) % 5 > 1:   # แต่ละวันได้ชุดย่อยต่างกัน
                continue
            p, (lng, lat) = f["properties"], f["geometry"]["coordinates"]
            if p["changwat"] not in ("ขอนแก่น", "มหาสารคาม", "ร้อยเอ็ด", "กาฬสินธุ์"):
                continue
            t = str(p["th_time"]).zfill(4)
            k = (d, t, round(lat, 4), round(lng, 4))
            if k in seen:
                continue
            seen.add(k)
            rows.append({"d": d.isoformat(), "t": t, "pv": p["changwat"], "ap": p.get("ap_en", ""), "tb": p.get("tb_en", ""), "lu": p.get("lu_name", ""),
                         "cf": p.get("confidence", ""), "frp": p.get("frp"), "lat": round(lat, 5), "lng": round(lng, 5)})
    rows.sort(key=lambda r: (r["d"], r["t"]))
    return {"ok": True, "source": "sheet", "persistent": True, "count": len(rows), "min": rows[0]["d"], "max": rows[-1]["d"], "rows": rows}
