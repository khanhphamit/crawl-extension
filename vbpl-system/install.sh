
#!/bin/bash

set -e

echo "======================================="
echo "VBPL SYSTEM INSTALLER"
echo "======================================="

mkdir -p backend

echo ""
echo "[1/7] Start docker"

docker compose up -d --build

echo ""
echo "[2/7] Create Laravel project if not exists"

if [ ! -f backend/artisan ]; then

    docker compose exec app bash -c "
        rm -rf /tmp/laravel &&
        composer create-project laravel/laravel /tmp/laravel &&
        cp -r /tmp/laravel/. /var/www/
    "

fi

echo ""
echo "[3/7] Configure environment"

if [ ! -f backend/.env ]; then
    cp backend/.env.example backend/.env
fi

echo ""
echo "[4/7] Generate APP_KEY"

docker compose exec app php artisan key:generate

echo ""
echo "[5/7] Install Filament"

docker compose exec app composer require filament/filament -W

echo ""
echo "[6/7] Run migrations"

docker compose exec app php artisan migrate --force

echo ""
echo "[7/7] Storage link"

docker compose exec app php artisan storage:link || true

echo ""
echo "======================================="
echo "INSTALL COMPLETED"
echo "======================================="

echo ""
echo "Open:"
echo "http://localhost:8000"

echo ""
echo "Create admin user:"
echo "docker compose exec app php artisan make:filament-user"
