<?php
require_once __DIR__ . '/_common.php';
$cached = getCached('sheet-disease');
if ($cached) jsonOut($cached);

$id  = readConfig()['api']['sheet_id'] ?? '';
$csv25 = fetchCSV(["https://docs.google.com/spreadsheets/d/{$id}/gviz/tq?tqx=out:csv&sheet=2025"]);
$csv26 = fetchCSV(["https://docs.google.com/spreadsheets/d/{$id}/gviz/tq?tqx=out:csv&sheet=2026"]);

$data = ['ok'=>true, 2025=>$csv25?parseDiseaseData($csv25):[], 2026=>$csv26?parseDiseaseData($csv26):[]];
setCached('sheet-disease', $data, 3600);
jsonOut($data);
