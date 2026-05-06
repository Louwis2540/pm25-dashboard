<?php
require_once __DIR__ . '/_common.php';
$cached = getCached('sheet-pm25');
if ($cached) jsonOut($cached);

$cfg       = readConfig();
$id        = $cfg['api']['sheet_id'] ?? '';
$provinces = $cfg['provinces'] ?? [];

$csv = fetchCSV([
    "https://docs.google.com/spreadsheets/d/{$id}/gviz/tq?tqx=out:csv&sheet=PM25_History",
    "https://docs.google.com/spreadsheets/d/{$id}/gviz/tq?tqx=out:csv&sheet=pm25_history",
    "https://docs.google.com/spreadsheets/d/{$id}/export?format=csv&gid=0",
    "https://docs.google.com/spreadsheets/d/{$id}/export?format=csv",
]);

if (!$csv) jsonOut(['ok'=>false,'message'=>'กรุณาเปิดการแชร์ Google Sheet: File → Share → Publish to web → CSV'], 403);

$data = array_merge(['ok'=>true], parseSheetData($csv, $provinces));
setCached('sheet-pm25', $data, 1800);
jsonOut($data);
