<?php
require_once __DIR__ . '/_common.php';

if (file_exists(GEOJSON_PATH)) {
    jsonOut(json_decode(file_get_contents(GEOJSON_PATH), true));
}

$EN_TO_PV = ['Khon Kaen'=>'ขอนแก่น','Kalasin'=>'กาฬสินธุ์','Maha Sarakham'=>'มหาสารคาม','Roi Et'=>'ร้อยเอ็ด'];
$GEOJSON_URL = 'https://raw.githubusercontent.com/apisit/thailand.json/master/thailand.json';

[$body, $code] = fetchURL($GEOJSON_URL, 15);
if ($code < 200 || $code >= 300 || !$body) jsonOut(['ok'=>false,'message'=>'GeoJSON fetch error'], 502);

$all       = json_decode($body, true);
$provinces = readConfig()['provinces'] ?? [];
$features  = [];

foreach ($all['features'] as $f) {
    $name = $f['properties']['shapeName'] ?? $f['properties']['name'] ?? '';
    if (!isset($EN_TO_PV[$name])) continue;
    $thName = $EN_TO_PV[$name];
    $pv     = current(array_filter($provinces, fn($p)=>$p['name']===$thName)) ?: null;
    $f['properties']['name_th'] = $thName;
    $f['properties']['pv_idn']  = $pv['pv_idn'] ?? 0;
    $features[] = $f;
}

$result = ['type'=>'FeatureCollection','features'=>$features];
file_put_contents(GEOJSON_PATH, json_encode($result, JSON_UNESCAPED_UNICODE));
jsonOut($result);
