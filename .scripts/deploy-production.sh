#!/bin/bash
set -e

DOMAIN=https://inkindo.rimbun.id

# Get the directory where the script is located and its parent (Project Root)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(dirname "$SCRIPT_DIR")"
DIR=$BASE_DIR/production
TEMP=$BASE_DIR/tmp
RELEASES=$DIR/releases
CURRENT=$DIR/current
SHARED=$DIR/shared

# 1. Pengecekan file source
if [ ! -f "$TEMP/release.tar.gz" ]; then
  echo "❌ Error: $TEMP/release.tar.gz tidak ditemukan!"
  exit 1
fi

mkdir -p "$RELEASES"

PREVIOUS=$(readlink -f "$CURRENT" 2>/dev/null || echo "")

RELEASE_NAME=$(stat -c %Y "$TEMP/release.tar.gz")
NEW_RELEASE="$RELEASES/$RELEASE_NAME"

if [ "$PREVIOUS" = "$(readlink -f "$NEW_RELEASE" 2>/dev/null || echo "")" ]; then
  echo "⚠️ Same release, skipping deploy"
  exit 0
fi

mkdir -p "$NEW_RELEASE"

echo "Deploying to $NEW_RELEASE"

# 2. Extract
tar -xzf "$TEMP/release.tar.gz" -C "$NEW_RELEASE"

# 3. Setup Shared Storage (Sinkronisasi folder otomatis)
echo "🏠 Symlinking shared files & folders..."
mkdir -p "$SHARED/storage"
# Copy struktur storage rilis ke shared (hanya yang belum ada, jangan menimpa yang sudah ada)
cp -rn "$NEW_RELEASE/storage/." "$SHARED/storage/" 2>/dev/null || true

# 4. Linking
ln -sfn "$SHARED/.env" "$NEW_RELEASE/.env"
rm -rf "$NEW_RELEASE/storage"
ln -sfn "$SHARED/storage" "$NEW_RELEASE/storage"

cd "$NEW_RELEASE"

# 5. Build
composer install --no-dev --optimize-autoloader
composer dump-autoload -o

# 6. Database & Cache
# Deteksi apakah ini deploy pertama berdasarkan ada tidaknya riwayat release sebelumnya
if [ -z "$PREVIOUS" ]; then
  echo "🌱 First deployment detected! Running migrations with seeds..."
  php artisan migrate --force
  php artisan db:seed --force
else
  echo "🔄 Running migrations..."
  php artisan migrate --force
fi

php artisan optimize:clear
php artisan optimize

# 7. Switch Symlink
ln -sfn "$NEW_RELEASE" "$CURRENT"
ln -sfn "$SHARED/storage/app/public" "$CURRENT/public/storage"

# 8. Health check production
if ! curl -f "$DOMAIN/health" > /dev/null 2>&1; then
  echo "❌ Health check failed"

  if [ -n "$PREVIOUS" ]; then
    ln -sfn "$PREVIOUS" "$CURRENT"
    echo "🔁 Rolled back"
  fi

  exit 1
fi

echo "✅ Production deploy success"

# 🔥 Cleanup old releases (keep last 5)
if [ -d "$RELEASES" ]; then
  cd "$RELEASES"
  if [[ "$(pwd)" == */releases ]]; then
    ls -dt */ | tail -n +6 | xargs -r rm -rf
    echo "🧹 Old releases cleaned up (kept last 5)"
  else
    echo "❌ Cleanup failed: Current directory $(pwd) does not look like a releases folder"
    exit 1
  fi
else
  echo "⚠️ Cleanup skipped: $RELEASES directory not found"
fi
