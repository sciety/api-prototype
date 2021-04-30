FROM php:8.0.5-fpm-alpine3.13
WORKDIR /app

COPY --from=composer:2.0.13 /usr/bin/composer /usr/bin/composer
COPY composer.json \
  composer.lock \
  ./
RUN composer install --optimize-autoloader --no-cache
COPY web/ web/

EXPOSE 8082
CMD ["php", "-S", "0.0.0.0:8082", "-t", "web/"]
