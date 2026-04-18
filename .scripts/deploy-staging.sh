#!bin/bash
set -e

DOMAIN=https://erp.staging.ptpsn.co.id

BASE_DIR=../staging
TEMP=../tmp
RELEASES=$BASE_DIR/releases
CURRENT=$BASE_DIR/current
SHARED=$BASE_DIR/shared

mkdir -p $RELEASES

PREVIOUS=$(readlink -f $CURRENT || echo "")

RELEASE_NAME=$(stat -c %Y $TEMP/release.tar.gz)
NEW_RELEASE=$RELEASES/$RELEASE_NAME

mkdir -p $NEW_RELEASE

echo "Deploying to $NEW_RELEASE"

tar -xzf $INCOMING/release.tar.gz -C $NEW_RELEASE

ln -sfn $SHARED/.env $NEW_RELEASE/.env

cd $NEW_RELEASE

composer install --no-dev --optimize-autoloader
composer dump-autoload -o

php artisan optimize:clear
php artisan migrate --force

php artisan optimize

# health check staging
if ! curl -f $DOMAIN/health > /dev/null 2>&1; then
  echo "❌ Health check failed"

  if [ -n "$PREVIOUS" ]; then
    ln -sfn $PREVIOUS $CURRENT
    echo "🔁 Rolled back"
  fi

  exit 1
fi

ln -sfn $NEW_RELEASE $CURRENT

echo "✅ Staging deploy success"

# 🔥 Cleanup old releases (keep last 5)
cd $RELEASES_DIR
ls -dt */ | tail -n +6 | xargs -r rm -rf
