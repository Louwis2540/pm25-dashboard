<?php
require_once __DIR__ . '/_common.php';
$cached = getCached('sheet-disease');
if ($cached) jsonOut($cached);

$id  = readConfig()['api']['sheet_id'] ?? '';
$csv25 = fetchCSV(["https://docs.google.com/spreadsheets/d/{$id}/gviz/tq?tqx=out:csv&sheet=2025"]);
$csv26 = fetchCSV(["https://docs.google.com/spreadsheets/d/{$id}/gviz/tq?tqx=out:csv&sheet=2026"]);

// สัปดาห์ที่ LINE OA รายงาน — ให้หน้าเว็บตัดที่จุดเดียวกัน (ดู server.js buildDiseaseData)
$csvSt = fetchCSV(["https://docs.google.com/spreadsheets/d/{$id}/gviz/tq?tqx=out:csv&sheet=_sync_status"]);
$reportWeek = null;
foreach (explode("\n", $csvSt ?: '') as $line) {
    $c = array_map(fn($s) => str_replace('"', '', $s), csvLine($line));
    if (($c[0] ?? '') === 'report_week' && preg_match('/^\d{1,2}$/', $c[1] ?? '')) $reportWeek = (int)$c[1];
}

$data = ['ok'=>true, 2025=>$csv25?parseDiseaseData($csv25):[], 2026=>$csv26?parseDiseaseData($csv26):[],
         'meta'=>['source'=>'sheet', 'reportWeek'=>$reportWeek]];
setCached('sheet-disease', $data, 3600);
jsonOut($data);
