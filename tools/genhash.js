#!/usr/bin/env node
/**
 * สร้าง bcrypt hash ของรหัสผ่าน admin เพื่อนำไปวางเป็น Environment Variable
 * ชื่อ ADMIN_PASSWORD_HASH ใน Render (server.js อ่านค่านี้ทับ config.json ให้เอง)
 *
 * วิธีใช้
 *   node tools/genhash.js              ← แนะนำ: พิมพ์รหัสตอนรัน ไม่แสดงบนหน้าจอ
 *   node tools/genhash.js "รหัสผ่าน"    ← สะดวกกว่าแต่รหัสจะค้างในประวัติคำสั่ง
 *
 * รหัสจริงไม่ถูกบันทึกลงไฟล์ใดทั้งสิ้น — สคริปต์พิมพ์ออกหน้าจอเท่านั้น
 */
const bcrypt   = require('bcryptjs');
const readline = require('readline');
const { Writable } = require('stream');

const ROUNDS  = 10;
const MIN_LEN = 6;   // ให้ตรงกับเงื่อนไขใน server.js /api/admin/change-password

function makeHash(plain) {
  if (!plain || plain.length < MIN_LEN) {
    console.error(`\n❌ รหัสผ่านต้องมีอย่างน้อย ${MIN_LEN} ตัวอักษร`);
    process.exit(1);
  }

  const hash = bcrypt.hashSync(plain, ROUNDS);

  // ตรวจสอบซ้ำว่า hash ที่ได้ใช้ login ได้จริง ก่อนเอาไปวางบน production
  if (!bcrypt.compareSync(plain, hash)) {
    console.error('\n❌ hash ที่สร้างตรวจสอบไม่ผ่าน — กรุณารันใหม่');
    process.exit(1);
  }

  console.log('\n── คัดลอกไปวางใน Render → Environment ──────────────────────');
  console.log('ADMIN_PASSWORD_HASH=' + hash);
  console.log('────────────────────────────────────────────────────────────');
  console.log(`ตรวจสอบแล้ว: ยาว ${hash.length} ตัว · verify ผ่าน\n`);
}

/** ถามรหัสผ่านโดยไม่ echo ตัวอักษรออกหน้าจอ */
function askHidden() {
  const muted = new Writable({
    write(chunk, enc, done) {
      if (!muted.isMuted) process.stdout.write(chunk, enc);
      done();
    }
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: muted,
    terminal: true
  });

  process.stdout.write('รหัสผ่านใหม่ (พิมพ์ได้เลย จะไม่แสดงบนหน้าจอ): ');
  muted.isMuted = true;

  rl.question('', (answer) => {
    rl.close();
    process.stdout.write('\n');
    makeHash(answer.trim());
  });
}

const fromArg = process.argv[2];
if (fromArg) makeHash(fromArg);
else askHidden();
