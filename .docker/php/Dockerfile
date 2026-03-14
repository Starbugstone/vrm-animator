FROM php:8.3-apache

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    unzip \
    libicu-dev \
    libzip-dev \
    libpng-dev \
    && docker-php-ext-install \
    pdo_mysql \
    intl \
    zip \
    opcache \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Enable Apache modules needed by Symfony and live SSE responses
RUN a2enmod rewrite headers

# Copy custom vhost
COPY .docker/php/vhost.conf /etc/apache2/sites-available/000-default.conf
COPY .docker/php/uploads.ini /usr/local/etc/php/conf.d/uploads.ini

# Set working directory
WORKDIR /var/www/html

# Set correct permissions for Symfony
RUN mkdir -p var/cache var/log && \
    chown -R www-data:www-data /var/www/html

# Copy entrypoint script
COPY .docker/php/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/entrypoint.sh && chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
