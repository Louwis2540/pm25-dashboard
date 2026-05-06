<?php
// ── Shared utilities ──────────────────────────────────────────────────────
define('ROOT',        dirname(__DIR__));
define('CONFIG_PATH', ROOT . '/config.json');
define('CACHE_DIR',   ROOT . '/cache');
define('GEOJSON_PATH',ROOT . '/provinces.geojson');
define('UPLOAD_DIR',  ROOT . '/uploads');

foreach ([CACHE_DIR, UPLOAD_DIR] as $d) {
    if (!is_dir($d)) mkdir($d, 0755, true);
}

// Session
if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.gc_maxlifetime', 28800);
    session_set_cookie_params(28800);
    session_name('pm25_sess');
    session_start();
}

// Headers
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit;

// ── Config ─────────────────────────────────────────────────────────────────
function readConfig() {
    static $cfg = null;
    if ($cfg === null) $cfg = json_decode(file_get_contents(CONFIG_PATH), true);
    return $cfg;
}
function writeConfig($data) {
    file_put_contents(CONFIG_PATH, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

// ── File-based TTL cache ───────────────────────────────────────────────────
function getCached($key) {
    $f = CACHE_DIR . '/' . preg_replace('/[^a-z0-9_-]/', '_', $key) . '.json';
    if (!file_exists($f)) return null;
    $e = json_decode(file_get_contents($f), true);
    if (!$e || time() > $e['exp']) { @unlink($f); return null; }
    return $e['data'];
}
function setCached($key, $data, $ttlSec) {
    $f = CACHE_DIR . '/' . preg_replace('/[^a-z0-9_-]/', '_', $key) . '.json';
    file_put_contents($f, json_encode(['exp' => time() + $ttlSec, 'data' => $data], JSON_UNESCAPED_UNICODE));
}

// ── Auth ────────────────────────────────────────────────────────────────────
function isAuth()     { return !empty($_SESSION['admin']); }
function requireAuth() {
    if (!isAuth()) { http_response_code(401); die(json_encode(['ok'=>false,'message'=>'กรุณาเข้าสู่ระบบก่อน'])); }
}

// ── Response ────────────────────────────────────────────────────────────────
function jsonOut($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

// ── HTTP fetch via cURL ─────────────────────────────────────────────────────
function fetchURL($url, $timeout = 10) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => $timeout,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_USERAGENT      => 'PM25Dashboard/1.0',
        CURLOPT_ENCODING       => '',
    ]);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return [$body, $code];
}

function fetchCSV($urls) {
    foreach ($urls as $url) {
        [$body, $code] = fetchURL($url, 12);
        if ($code >= 200 && $code < 300 && $body &&
            !stristr($body, 'sign in') && strlen($body) > 100) return $body;
    }
    return null;
}

// ── POST body (JSON) ────────────────────────────────────────────────────────
function getBody() {
    static $b = null;
    if ($b === null) $b = json_decode(file_get_contents('php://input'), true) ?? [];
    return $b;
}

// ── CSV parser ───────────────────────────────────────────────────────────────
function csvLine($line) {
    $out = []; $cur = ''; $q = false;
    for ($i = 0, $len = strlen($line); $i < $len; $i++) {
        $c = $line[$i];
        if ($c === '"')            $q = !$q;
        elseif ($c === ',' && !$q) { $out[] = trim($cur); $cur = ''; }
        else                       $cur .= $c;
    }
    $out[] = trim($cur);
    return $out;
}

function findHeaderRow($lines, $keyword) {
    foreach ($lines as $i => $line) {
        $cols = csvLine($line);
        if (stripos(str_replace('"', '', $cols[0] ?? ''), $keyword) !== false)
            return ['idx'=>$i, 'headers'=>array_map(fn($c)=>trim(str_replace('"','',$c)), $cols)];
    }
    return null;
}

function isoDate($s) {
    $s = trim(str_replace('"', '', explode(',', explode(' ', $s)[0])[0]));
    if (!str_contains($s, '/')) return $s;
    [$d,$m,$y] = explode('/', $s);
    return sprintf('%s-%02d-%02d', $y, (int)$m, (int)$d);
}

function parseSheetData($csv, $provinces) {
    $lines  = array_filter(array_map('trim', explode("\n", $csv)));
    $header = findHeaderRow(array_values($lines), 'date');
    if (!$header) return ['latest'=>[],'last7'=>[],'allData'=>[],'sortedDates'=>[]];

    ['idx'=>$hi, 'headers'=>$headers] = $header;
    $lines = array_values($lines);
    $byDate = [];

    for ($i = $hi + 1; $i < count($lines); $i++) {
        $cols    = csvLine($lines[$i]);
        $dateKey = isoDate($cols[0] ?? '');
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateKey)) break;
        $row = [];
        foreach (array_slice($headers, 1) as $j => $h) {
            $v = isset($cols[$j+1]) ? floatval($cols[$j+1]) : null;
            if ($v !== null && !is_nan($v)) $row[$h] = $v;
        }
        $byDate[$dateKey] = $row;
    }

    $sortedDates = array_keys($byDate);
    usort($sortedDates, fn($a,$b)=>strcmp($b,$a));

    $latest = []; $latestDate = [];
    foreach ($provinces as $pv) {
        $col = $pv['name'];
        foreach ($sortedDates as $d) {
            $v = $byDate[$d][$col] ?? null;
            if ($v !== null && $v > 0) { $latest[$pv['name']] = $v; $latestDate[$pv['name']] = $d; break; }
        }
    }

    $last7 = [];
    foreach (array_slice($sortedDates, 0, 7) as $d) {
        $row = ['date'=>$d];
        foreach ($provinces as $pv) {
            if (isset($byDate[$d][$pv['name']])) $row[$pv['name']] = $byDate[$d][$pv['name']];
        }
        array_unshift($last7, $row);
    }

    return compact('latest','latestDate','last7','byDate') + ['allData'=>$byDate,'sortedDates'=>$sortedDates];
}

function parseDiseaseData($csv) {
    $lines  = array_values(array_filter(array_map('trim', explode("\n", $csv))));
    $header = findHeaderRow($lines, 'wk');
    if (!$header) return [];

    ['idx'=>$hi, 'headers'=>$headers] = $header;
    $rows = [];
    for ($i = $hi + 1; $i < count($lines); $i++) {
        $cols = csvLine($lines[$i]);
        $wk   = intval($cols[0] ?? 0);
        if (!$wk) continue;
        $row = ['wk'=>$wk];
        foreach (array_slice($headers,1) as $j=>$h) {
            if (!$h) continue;
            $raw = trim(str_replace('"', '', $cols[$j+1] ?? ''));
            $num = (float)str_replace(',', '', $raw);
            $row[$h] = (!is_nan($num) && $raw !== '') ? $num : ($raw !== '' ? $raw : null);
        }
        $rows[] = $row;
    }
    return $rows;
}

// ── Deep merge (objects only, arrays replace) ────────────────────────────────
function deepMerge($base, $patch) {
    if (!is_array($base) || !is_array($patch)) return $patch;
    // if both are sequential arrays → replace
    if (array_keys($base) === range(0, count($base)-1)) return $patch;
    foreach ($patch as $k => $v) {
        $base[$k] = (isset($base[$k]) && is_array($base[$k]) && is_array($v)
                     && array_keys($base[$k]) !== range(0, count($base[$k])-1))
                    ? deepMerge($base[$k], $v) : $v;
    }
    return $base;
}
