/**
 * Web App endpoint — คืนข้อมูลพื้นที่เผาไหม้ GISTDA เป็น JSON
 * (ไฟล์นี้คือ "doget.gs" ใน Apps Script project — เก็บเข้า repo ไว้กันหาย)
 * ------------------------------------------------------------------
 * ⚠️ สถานะ ณ 18/08/2026: ยังไม่มีใครเรียก endpoint นี้
 *    แดชบอร์ดใช้ server.js → /api/hotspot ยิง GISTDA ตรงอยู่แล้ว และคนละ
 *    endpoint กันด้วย (viirs/1day = จุดความร้อน ส่วนตัวนี้ = พื้นที่เผาไหม้)
 *    ถ้าไม่มีอะไรใช้จริง แนะนำให้ถอน deployment ทิ้ง — Web App ที่ตั้งเป็น
 *    "Anyone" คือ endpoint สาธารณะที่ใครก็ยิงได้ และทุกครั้งที่ถูกยิงคือการ
 *    ใช้โควตา GISTDA ของเรา
 *
 * ถ้ายังต้องใช้ต่อ เวอร์ชันนี้กันไว้ 3 ชั้น:
 *    1. cache 30 นาที — ไม่ให้ทุก request ทะลุไปหา GISTDA (4 จังหวัด/ครั้ง)
 *    2. try/catch คืน JSON เสมอ — ของเดิมถ้า error จะคืนหน้า HTML ของ
 *       Apps Script ทำให้ฝั่งที่เรียกไป JSON.parse แตก
 *    3. token (ถ้าตั้ง Script Property ชื่อ DOGET_TOKEN ไว้) — ถ้าไม่ตั้ง
 *       ก็เปิดสาธารณะเหมือนเดิม จะได้ไม่พังของที่อาจเรียกอยู่โดยไม่รู้
 */

const DOGET_CACHE_KEY = 'gistda_burnt_area_r7';
const DOGET_CACHE_SEC = 30 * 60;   // GISTDA อัปเดตวันละครั้ง 30 นาทีถือว่าถี่พอ

function doGet(e) {
  try {
    // ── ชั้นที่ 3: token (บังคับเฉพาะเมื่อมีการตั้งค่าไว้) ──
    const want = PropertiesService.getScriptProperties().getProperty('DOGET_TOKEN');
    if (want) {
      const got = e && e.parameter ? e.parameter.token : '';
      if (got !== want) return jsonOut_({ ok: false, error: 'unauthorized' });
    }

    // ── ชั้นที่ 1: cache ──
    const cache  = CacheService.getScriptCache();
    const cached = cache.get(DOGET_CACHE_KEY);
    if (cached) return jsonOut_(JSON.parse(cached));

    const data = getGistdaHotspotsRegion7();   // อยู่ใน line_report.gs
    const body = { ok: true, count: data.length, data: data };

    // put() รับได้ไม่เกิน 100KB — ถ้าใหญ่กว่านั้นก็ข้ามการ cache ไป
    try { cache.put(DOGET_CACHE_KEY, JSON.stringify(body), DOGET_CACHE_SEC); } catch (_) {}

    return jsonOut_(body);

  } catch (err) {
    // ── ชั้นที่ 2: error ก็ยังต้องเป็น JSON ──
    return jsonOut_({ ok: false, error: String(err && err.message || err) });
  }
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
