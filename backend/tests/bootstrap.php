<?php

require dirname(__DIR__).'/config/bootstrap.php';

$databaseUrl = $_SERVER['DATABASE_URL'] ?? $_ENV['DATABASE_URL'] ?? getenv('DATABASE_URL') ?: null;

if (!is_string($databaseUrl) || $databaseUrl === '') {
    return;
}

$parts = parse_url($databaseUrl);
if ($parts === false || ($parts['scheme'] ?? null) !== 'mysql') {
    return;
}

$databaseName = ltrim((string) ($parts['path'] ?? ''), '/');
if ($databaseName === '') {
    return;
}

$host = $parts['host'] ?? '127.0.0.1';
$port = (string) ($parts['port'] ?? 3306);
$user = urldecode((string) ($parts['user'] ?? ''));
$password = urldecode((string) ($parts['pass'] ?? ''));

$pdo = new PDO(
    sprintf('mysql:host=%s;port=%s;dbname=%s', $host, $port, $databaseName),
    $user,
    $password,
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION],
);

$tables = $pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
if ($tables === false || $tables === []) {
    return;
}

$pdo->exec('SET FOREIGN_KEY_CHECKS = 0');

foreach ($tables as $table) {
    if (!is_string($table) || $table === 'doctrine_migration_versions') {
        continue;
    }

    $pdo->exec(sprintf('DELETE FROM `%s`', str_replace('`', '``', $table)));
}

$pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
