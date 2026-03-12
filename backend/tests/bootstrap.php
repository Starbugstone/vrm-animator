<?php

use Doctrine\ORM\Tools\SchemaTool;
use Doctrine\Persistence\ManagerRegistry;

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

$serverPdo = new PDO(
    sprintf('mysql:host=%s;port=%s', $host, $port),
    $user,
    $password,
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION],
);

$serverPdo->exec(sprintf(
    'CREATE DATABASE IF NOT EXISTS `%s` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',
    str_replace('`', '``', $databaseName),
));

$kernelClass = $_SERVER['KERNEL_CLASS'] ?? $_ENV['KERNEL_CLASS'] ?? 'App\\Kernel';
$kernel = new $kernelClass('test', true);
$kernel->boot();

/** @var ManagerRegistry $doctrine */
$doctrine = $kernel->getContainer()->get('doctrine');
$entityManager = $doctrine->getManager();
$metadata = $entityManager->getMetadataFactory()->getAllMetadata();

if ($metadata !== []) {
    $schemaTool = new SchemaTool($entityManager);
    $schemaManager = $entityManager->getConnection()->createSchemaManager();

    if ($schemaManager->listTableNames() !== []) {
        $schemaTool->dropSchema($metadata);
    }

    $schemaTool->createSchema($metadata);
}

$entityManager->clear();
$kernel->shutdown();
