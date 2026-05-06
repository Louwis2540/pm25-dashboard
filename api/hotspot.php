<?php
require_once __DIR__ . '/_common.php';
$cached = getCached('hotspot');
if ($cached) jsonOut($cached);

$cfg       = readConfig();
$key       = $cfg['api']['gistda_key'] ?? '';
$provinces = $cfg['provinces'] ?? [];
$BASE      = 'https://api-gateway.gistda.or.th/api/2.0/resources/features/viirs/1day';
$features  = [];

foreach ($provinces as $p) {
    [$body, $code] = fetchURL("{$BASE}?api_key={$key}&pv_idn={$p['pv_idn']}&limit=500&offset=0", 15);
    if ($code >= 200 && $code < 300 && $body) {
        $j = json_decode($body, true);
        $features = array_merge($features, $j['features'] ?? []);
    }
}

$data = ['ok'=>true,'count'=>count($features),'source'=>'GISTDA VIIRS',
         'geojson'=>['type'=>'FeatureCollection','features'=>$features]];
setCached('hotspot', $data, 3600);
jsonOut($data);
