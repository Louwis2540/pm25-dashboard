<?php
require_once __DIR__ . '/_common.php';
$cached = getCached('air4thai');
if ($cached) jsonOut($cached);

$cfg       = readConfig();
$provinces = $cfg['provinces'] ?? [];
$stations  = [];

$urls = [
    'https://air4thai.pcd.go.th/services/getNewAQI_JSON.php?region=5',
    'http://air4thai.pcd.go.th/services/getNewAQI_JSON.php?region=5',
];
foreach ($urls as $url) {
    [$body, $code] = fetchURL($url, 8);
    if ($code >= 200 && $body) {
        $j = json_decode($body, true);
        if (!empty($j['stations'])) { $stations = $j['stations']; break; }
    }
}
if (!$stations) {
    $proxy = 'https://api.allorigins.win/raw?url=' . urlencode($urls[1]);
    [$body, $code] = fetchURL($proxy, 10);
    if ($code >= 200 && $body) {
        $j = json_decode($body, true);
        $stations = $j['stations'] ?? [];
    }
}

$result = [];
foreach ($provinces as $pv) {
    $pvStations = array_filter($stations, function($s) use ($pv) {
        $area = strtolower($s['areaTH'] ?? $s['areaEN'] ?? '');
        return str_contains($area, mb_strtolower($pv['name'])) || str_contains($area, mb_substr($pv['name'], 0, 4));
    });
    if (!$pvStations) { $result[] = ['name'=>$pv['name'],'pm25'=>null,'stations'=>[]]; continue; }

    $list = [];
    foreach ($pvStations as $s) {
        $upd = $s['LastUpdate'] ?? $s['AQILast'] ?? [];
        $raw = $upd['PM25']['value'] ?? null;
        $val = ($raw !== null && $raw !== '-' && $raw !== 'N/A' && $raw !== '') ? (float)$raw : null;
        if ($val !== null) $list[] = ['id'=>$s['stationID'],'name'=>$s['nameTH']??$s['nameEN'],'pm25'=>$val,'time'=>$upd['time']??''];
    }

    $list07 = array_values(array_filter($list, fn($s)=>str_starts_with(str_replace(':','',$s['time']),'07')));
    $final  = $list07 ?: $list;
    $avg    = $final ? array_sum(array_column($final,'pm25')) / count($final) : null;
    $result[] = ['name'=>$pv['name'],'pm25'=>$avg ? round($avg,1) : null,'stations'=>$final,'timeSlot'=>$list07?'07:00':null];
}

$data = ['ok'=>true,'data'=>$result,'count'=>count($stations)];
setCached('air4thai', $data, 1800);
jsonOut($data);
