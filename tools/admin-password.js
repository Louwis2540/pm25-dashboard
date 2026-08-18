#!/usr/bin/env node
/**
 * จัดการรหัสผ่าน admin — ใช้ตอน "ลืมรหัสผ่านจนเข้าหน้า admin ไม่ได้"
 * ------------------------------------------------------------------
 * หน้าเปลี่ยนรหัสผ่านใน admin.html ใช้ได้เฉพาะตอนที่ล็อกอินอยู่แล้ว
 * ถ้าลืมรหัสจนเข้าไม่ได้ ต้องใช้เครื่องมือนี้แทน (รันจากเครื่องตัวเอง)
 *
 * วิธีใช้
 *   node tools/admin-password.js            ตั้งรหัสใหม่ (เขียน config.json + พิมพ์ค่าสำหรับ Render)
 *   node tools/admin-password.js --check    ลองรหัสที่จำได้ว่าใช่ตัวไหน
 *   node tools/admin-password.js --check --hash "$2a$10$..."   ลองเทียบกับ hash ที่คัดลอกมาจาก Render
 *
 *   ใส่รหัสท้ายคำสั่งได้ถ้าไม่อยากพิมพ์ตอนถาม (สะดวกกว่าแต่รหัสค้างในประวัติคำสั่ง):
 *     node tools/admin-password.js "รหัสใหม่"
 *     node tools/admin-password.js --check "รหัสที่อยากลอง"
 *
 * รหัสจริงไม่ถูกบันทึกลงไฟล์ใดทั้งสิ้น — เก็บเฉพาะ bcrypt hash เท่านั้น
 *
 * ⚠️ บน Render ค่า env ADMIN_PASSWORD_HASH จะทับค่าใน config.json เสมอ (server.js:105)
 *    การแก้ config.json จึงมีผลกับ "เครื่องตัวเอง" อย่างเดียว
 *    ถ้าจะเปลี่ยนรหัสบน production ต้องเอาค่าที่สคริปต์นี้พิมพ์ให้ไปวางใน Render → Environment
 */
const fs       = require('fs');
const path     = require('path');
const bcrypt   = require('bcryptjs');
const readline = require('readline');
const { Writable } = require('stream');

const CFG_PATH = path.join(__dirname, '..', 'config.json');
const ROUNDS   = 10;
const MIN_LEN  = 6;    // ให้ตรงกับ server.js /api/admin/change-password

const args    = process.argv.slice(2);
const isCheck = args.includes('--check');
const hashArg = (() => {
  const i = args.indexOf('--hash');
  return i >= 0 ? args[i + 1] : null;
})();
// รหัสที่ใส่มาท้ายคำสั่ง (ตัวแรกที่ไม่ใช่ flag และไม่ใช่ค่าของ --hash)
const pwArg = args.filter((a, i) =>
  !a.startsWith('--') && !(i > 0 && args[i - 1] === '--hash')
)[0] || null;

/* ── อ่าน config ── */
function readCfg() {
  try {
    return JSON.parse(fs.readFileSync(CFG_PATH, 'utf8'));
  } catch (e) {
    console.error('\n❌ อ่าน config.json ไม่ได้: ' + e.message);
    process.exit(1);
  }
}

/* ── ถามรหัสผ่านโดยไม่แสดงบนหน้าจอ ── */
function askHidden(prompt) {
  return new Promise((resolve, reject) => {
    const muted = new Writable({
      write(chunk, enc, done) {
        if (!muted.isMuted) process.stdout.write(chunk, enc);
        done();
      }
    });
    const rl = readline.createInterface({ input: process.stdin, output: muted, terminal: true });
    let answered = false;

    process.stdout.write(prompt);
    muted.isMuted = true;

    rl.question('', answer => {
      answered = true;
      rl.close();
      process.stdout.write('\n');
      resolve(answer.trim());
    });

    // ถ้า stdin จบก่อนตอบ (เช่นถูก pipe เข้ามา) readline จะไม่เรียก callback เลย
    // ถ้าไม่ดักตรงนี้ Promise จะค้าง แล้วโปรเซสจบเงียบๆ โดยไม่บอกว่าเกิดอะไรขึ้น
    rl.on('close', () => {
      if (answered) return;
      process.stdout.write('\n');
      reject(new Error(
        'อ่านรหัสจากแป้นพิมพ์ไม่ได้ (stdin ปิดไปก่อน)\n' +
        '   ถ้ารันผ่าน pipe หรือสคริปต์ ให้ใส่รหัสท้ายคำสั่งแทน:\n' +
        '     node tools/admin-password.js "รหัสใหม่"'
      ));
    });
  });
}

/* ── สถานะปัจจุบัน แสดงทุกครั้งก่อนทำอะไร ── */
function showStatus(cfg) {
  const h = String(cfg.admin?.password_hash || '');
  console.log('\n── สถานะรหัสผ่านตอนนี้ ──────────────────────────────────────');
  console.log('  ผู้ใช้ (config.json) : ' + (cfg.admin?.username || '(ไม่ได้ตั้ง)'));
  console.log('  hash (config.json)  : ' + (h ? h.slice(0, 10) + '…' + h.slice(-4) + '  (ยาว ' + h.length + ')' : '(ว่าง)'));
  console.log('  ค่านี้มีผลกับ        : เครื่องตัวเอง (localhost) เท่านั้น');
  console.log('  บน Render           : ใช้ค่าจาก env ADMIN_PASSWORD_HASH ทับเสมอ');
  console.log('──────────────────────────────────────────────────────────────');
}

/* ══════════ โหมด --check : ลองรหัสที่จำได้ ══════════ */
async function runCheck() {
  const cfg = readCfg();
  showStatus(cfg);

  const target = hashArg || cfg.admin?.password_hash;
  if (!target) {
    console.error('❌ ไม่มี hash ให้เทียบ — ใส่ --hash "<ค่าจาก Render>" ด้วย');
    process.exit(1);
  }
  if (hashArg) console.log('กำลังเทียบกับ hash ที่ใส่มาทาง --hash (ไม่ใช่ค่าใน config.json)\n');

  // ตรวจรูปแบบก่อนเทียบ — bcrypt hash ต้องเป็น $2a$/$2b$/$2y$ + ยาว 60 ตัวพอดี
  // ถ้าค่าเสีย (เช่นคัดลอกขาด) compareSync จะคืน false เฉยๆ ทำให้เข้าใจผิดว่า
  // "รหัสผิด" ทั้งที่ความจริงคือ hash ใช้ไม่ได้ → ล็อกอินไม่ได้ทุกรหัส
  if (!/^\$2[aby]\$\d{2}\$.{53}$/.test(String(target))) {
    console.error('❌ ค่า hash ผิดรูปแบบ — ไม่ใช่ bcrypt ที่ใช้ได้');
    console.error('   ที่ถูก: ขึ้นต้น $2a$ (หรือ $2b$/$2y$) และยาว 60 ตัวพอดี');
    console.error('   ที่ได้: ขึ้นต้น "' + String(target).slice(0, 4) + '" ยาว ' + String(target).length + ' ตัว');
    console.error('');
    console.error('   👉 อาการนี้ทำให้ล็อกอินไม่ได้ "ทุกรหัส" ไม่ใช่แค่รหัสที่ลอง');
    console.error('      ถ้าค่านี้มาจาก Render แปลว่าคัดลอกไม่ครบ ให้คัดลอกใหม่ทั้งบรรทัด');
    process.exit(1);
  }

  const pw = pwArg || await askHidden('รหัสที่อยากลอง (พิมพ์ได้เลย จะไม่แสดงบนหน้าจอ): ');
  if (!pw) { console.error('❌ ไม่ได้พิมพ์อะไรมา'); process.exit(1); }

  let ok;
  try {
    ok = bcrypt.compareSync(pw, target);
  } catch (e) {
    // hash ผิดรูปแบบ — เคยเจอตอนคัดลอกจาก Render แล้วตัวท้ายหาย
    console.error('\n❌ hash ผิดรูปแบบ ใช้เทียบไม่ได้: ' + e.message);
    console.error('   อาการนี้ทำให้ล็อกอินไม่ได้ "ทุกรหัส" — ไม่ใช่รหัสผิด แต่ค่า hash เสีย');
    console.error('   ให้ตั้งรหัสใหม่ด้วย: node tools/admin-password.js');
    process.exit(1);
  }

  console.log(ok
    ? '\n✅ ใช่ตัวนี้ — รหัสนี้ล็อกอินได้\n'
    : '\n❌ ไม่ใช่ตัวนี้ — ลองใหม่ หรือตั้งรหัสใหม่ด้วย: node tools/admin-password.js\n');
}

/* ══════════ โหมดปกติ : ตั้งรหัสใหม่ ══════════ */
async function runReset() {
  const cfg = readCfg();
  showStatus(cfg);

  const pw1 = pwArg || await askHidden(`รหัสผ่านใหม่ (อย่างน้อย ${MIN_LEN} ตัว จะไม่แสดงบนหน้าจอ): `);
  if (!pw1 || pw1.length < MIN_LEN) {
    console.error(`\n❌ รหัสผ่านต้องมีอย่างน้อย ${MIN_LEN} ตัวอักษร`);
    process.exit(1);
  }
  // ใส่รหัสมาท้ายคำสั่งแล้ว = ตั้งใจอยู่แล้ว ไม่ต้องถามยืนยันซ้ำ
  if (!pwArg) {
    const pw2 = await askHidden('พิมพ์อีกครั้งเพื่อยืนยัน: ');
    if (pw1 !== pw2) {
      console.error('\n❌ รหัสสองครั้งไม่ตรงกัน — ยังไม่ได้แก้อะไร');
      process.exit(1);
    }
  }

  // สุ่ม hash จนได้ตัวที่ลงท้ายด้วย A-Z a-z 0-9
  // เคยพลาดมาแล้ว: hash ลงท้ายด้วย '.' หรือ '/' แล้วตัวท้ายหายตอนคัดลอกไปวางใน Render
  // → bcrypt เจอ hash ผิดรูปแบบ จะปฏิเสธ "ทุก" รหัส ทำให้ 401 ทั้งรหัสเก่าและใหม่
  let hash = '';
  for (let i = 0; i < 50; i++) {
    hash = bcrypt.hashSync(pw1, ROUNDS);
    if (/[A-Za-z0-9]$/.test(hash)) break;
  }
  if (!bcrypt.compareSync(pw1, hash)) {
    console.error('\n❌ hash ที่สร้างตรวจสอบไม่ผ่าน — กรุณารันใหม่');
    process.exit(1);
  }

  // เขียน config.json ด้วยรูปแบบเดียวกับ writeConfig() ใน server.js
  if (!cfg.admin) cfg.admin = {};
  cfg.admin.password_hash = hash;
  fs.writeFileSync(CFG_PATH, JSON.stringify(cfg, null, 2), 'utf8');

  const user = cfg.admin.username || 'admin';
  console.log('\n✅ ตั้งรหัสใหม่ใน config.json แล้ว — ใช้ล็อกอินที่ localhost ได้ทันที');
  console.log('   ผู้ใช้: ' + user + '   (ถ้า server รันอยู่ ให้รีสตาร์ทก่อน)');
  console.log('   ตรวจสอบแล้ว: verify ผ่าน · ตัวท้าย hash เป็น A-Z a-z 0-9 (ปลอดภัยตอนคัดลอก)');

  console.log('\n── ถ้าจะเปลี่ยนรหัสบน Render ด้วย ──────────────────────────');
  console.log('Render → service → Environment → แก้ตัวแปรนี้ → Save');
  console.log('');
  console.log('ADMIN_PASSWORD_HASH=' + hash);
  console.log('');
  console.log('⚠️ คัดลอกให้ครบทั้งบรรทัดหลังเครื่องหมาย = (ยาว ' + hash.length + ' ตัว)');
  console.log('   ถ้าคัดลอกขาดไปตัวเดียว จะล็อกอินไม่ได้ "ทุกรหัส" ไม่ใช่แค่รหัสใหม่');
  console.log('   เช็กว่าวางถูกไหม: node tools/admin-password.js --check --hash "<ค่าที่วางไป>"');
  console.log('──────────────────────────────────────────────────────────────\n');
}

(isCheck ? runCheck() : runReset()).catch(e => {
  console.error('\n❌ ' + e.message);
  process.exit(1);
});
