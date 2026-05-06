<?php
require_once __DIR__ . '/_common.php';
$cfg = readConfig();
unset($cfg['admin']);
$cfg['api'] = ['sheet_id' => $cfg['api']['sheet_id'] ?? ''];
jsonOut($cfg);
