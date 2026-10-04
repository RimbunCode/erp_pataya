#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

for executable in php composer node npm; do
    if ! command -v "$executable" >/dev/null 2>&1; then
        printf 'Missing required executable: %s\n' "$executable" >&2
        exit 1
    fi
done

if ! php -r 'exit(PHP_VERSION_ID >= 80400 ? 0 : 1);'; then
    printf 'PHP 8.4 or newer is required.\n' >&2
    exit 1
fi

if ! php -r 'exit(extension_loaded("pdo_sqlite") ? 0 : 1);'; then
    printf 'The PHP pdo_sqlite extension is required for an isolated worktree database.\n' >&2
    exit 1
fi

if [ ! -f .env ]; then
    if [ ! -f .env.example ]; then
        printf 'Missing .env.example; cannot initialize this checkout.\n' >&2
        exit 1
    fi

    awk '!/^(APP_ENV|APP_DEBUG|DB_CONNECTION|DB_DATABASE|DB_URL|CACHE_STORE|SESSION_DRIVER|QUEUE_CONNECTION)=/' .env.example > .env
    cat >> .env <<'EOF'

APP_ENV=local
APP_DEBUG=true
DB_CONNECTION=sqlite
CACHE_STORE=file
SESSION_DRIVER=file
QUEUE_CONNECTION=sync
EOF
fi

touch database/database.sqlite

composer install --prefer-dist --no-interaction --no-progress
npm ci --no-audit --no-fund
if ! grep -q '^APP_KEY=.' .env; then
    php artisan key:generate --force --no-interaction
fi
php artisan migrate --force --no-interaction
npm run build

printf 'ERP cloud checkout is ready with an isolated SQLite database.\n'
