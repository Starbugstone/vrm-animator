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
    'mysql:host=database;port=3306;dbname=vrm_animator',
    'vrm_user',
    'vrm_pass',
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
);
$pdo->query('SELECT 1');
PHP
do
    sleep 1
done

echo "Running database migrations..."
php /var/www/html/bin/console doctrine:migrations:migrate --no-interaction --allow-no-migration

# Fix permissions
chown -R www-data:www-data /var/www/html/var /var/www/html/config/jwt 2>/dev/null || true

# Start Apache
exec apache2-foreground
