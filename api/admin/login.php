<?php
require_once dirname(__DIR__) . '/_common.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonOut(['ok'=>false,'message'=>'Method not allowed'], 405);

$body     = getBody();
$username = $body['username'] ?? '';
$password = $body['password'] ?? '';
$cfg      = readConfig();

if ($username !== ($cfg['admin']['username'] ?? '') ||
    !password_verify($password, $cfg['admin']['password_hash'] ?? '')) {
    jsonOut(['ok'=>false,'message'=>'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'], 401);
}

$_SESSION['admin'] = ['username'=>$username];
jsonOut(['ok'=>true,'message'=>'เข้าสู่ระบบสำเร็จ']);
