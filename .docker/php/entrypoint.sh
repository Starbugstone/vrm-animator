#!/bin/bash
set -e

# Install dependencies if vendor directory doesn't exist
if [ ! -d "/var/www/html/vendor" ]; then
    echo "Installing Composer dependencies..."
    composer install --no-interaction --optimize-autoloader
fi

# Generate JWT keys if they don't exist
if [ ! -f "/var/www/html/config/jwt/private.pem" ]; then
    echo "Generating JWT keys..."
    mkdir -p /var/www/html/config/jwt
    openssl genpkey -out /var/www/html/config/jwt/private.pem -aes256 -algorithm rsa -pkeyopt rsa_keygen_bits:4096 -pass pass:${JWT_PASSPHRASE:-vrm-animator-jwt-passphrase}
    openssl pkey -in /var/www/html/config/jwt/private.pem -out /var/www/html/config/jwt/public.pem -pubout -passin pass:${JWT_PASSPHRASE:-vrm-animator-jwt-passphrase}
    chmod 644 /var/www/html/config/jwt/private.pem /var/www/html/config/jwt/public.pem
fi

# Wait for database to be ready, then run migrations
echo "Waiting for database..."
until php <<'PHP' > /dev/null 2>&1
<?php
$pdo = new PDO(
    sprintf(
        'mysql:host=%s;port=%s;dbname=%s',
        getenv('DATABASE_HOST') ?: 'database',
        getenv('DATABASE_PORT') ?: '3306',
        getenv('DATABASE_NAME') ?: 'vrm_animator',
    ),
    getenv('DATABASE_USER') ?: 'vrm_user',
    getenv('DATABASE_PASSWORD') ?: 'vrm_pass',
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
);
$pdo->query('SELECT 1');
PHP
do
    sleep 1
done

echo "Ensuring test database exists..."
php <<'PHP'
<?php
$host = getenv('DATABASE_HOST') ?: 'database';
$port = getenv('DATABASE_PORT') ?: '3306';
$appUser = getenv('DATABASE_USER') ?: 'vrm_user';
$appPassword = getenv('DATABASE_PASSWORD') ?: 'vrm_pass';
$rootUser = getenv('DATABASE_ROOT_USER') ?: 'root';
$rootPassword = getenv('DATABASE_ROOT_PASSWORD') ?: 'root';
$testDatabase = getenv('DATABASE_TEST_NAME') ?: 'vrm_animator_test';

$pdo = new PDO(
    sprintf('mysql:host=%s;port=%s', $host, $port),
    $rootUser,
    $rootPassword,
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION],
);

$quotedDatabase = sprintf('`%s`', str_replace('`', '``', $testDatabase));
$quotedUser = str_replace("'", "''", $appUser);
$quotedPassword = str_replace("'", "''", $appPassword);

$pdo->exec(sprintf(
    'CREATE DATABASE IF NOT EXISTS %s CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',
    $quotedDatabase,
));
$pdo->exec(sprintf(
    "CREATE USER IF NOT EXISTS '%s'@'%%' IDENTIFIED BY '%s'",
    $quotedUser,
    $quotedPassword,
));
$pdo->exec(sprintf(
    "GRANT ALL PRIVILEGES ON %s.* TO '%s'@'%%'",
    $quotedDatabase,
    $quotedUser,
));
$pdo->exec('FLUSH PRIVILEGES');
PHP

run_migration_command() {
    local label="$1"
    shift

    echo "Running ${label}..."
    if timeout 90 "$@"; then
        return 0
    fi

    local exit_code=$?
    echo "Warning: ${label} did not complete cleanly (exit ${exit_code}). Continuing startup so Apache can serve requests."
    return 0
}

echo "Running database migrations..."
run_migration_command "database migrations" php /var/www/html/bin/console doctrine:migrations:migrate --no-interaction --allow-no-migration
rm -rf /var/www/html/var/cache/test
run_migration_command "test database migrations" env APP_ENV=test php /var/www/html/bin/console doctrine:migrations:migrate --no-interaction --allow-no-migration

# Fix permissions
chown -R www-data:www-data /var/www/html/var /var/www/html/config/jwt 2>/dev/null || true

# Start Apache
exec apache2-foreground
