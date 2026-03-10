<?php

use Symfony\Component\Dotenv\Dotenv;

require dirname(__DIR__).'/vendor/autoload.php';

$appEnv = $_SERVER['APP_ENV'] ?? $_ENV['APP_ENV'] ?? null;
if (is_string($appEnv) && $appEnv !== '') {
    putenv('APP_ENV='.$appEnv);
    $_ENV['APP_ENV'] = $appEnv;
    $_SERVER['APP_ENV'] = $appEnv;
}

$appDebug = $_SERVER['APP_DEBUG'] ?? $_ENV['APP_DEBUG'] ?? null;
if ($appDebug !== null) {
    $normalizedAppDebug = in_array($appDebug, [true, '1', 1, 'true'], true) ? '1' : '0';
    putenv('APP_DEBUG='.$normalizedAppDebug);
    $_ENV['APP_DEBUG'] = $normalizedAppDebug;
    $_SERVER['APP_DEBUG'] = $normalizedAppDebug;
}

if (file_exists(dirname(__DIR__).'/.env')) {
    (new Dotenv())->bootEnv(dirname(__DIR__).'/.env');
}
