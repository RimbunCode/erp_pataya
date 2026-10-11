#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
primary_checkout="$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")"

if [ ! -f .env ]; then
    if [ ! -f "$primary_checkout/.env" ]; then
        printf 'Missing .env in primary checkout: %s\n' "$primary_checkout" >&2
        exit 1
    fi
    cp "$primary_checkout/.env" .env
fi

composer install --prefer-dist --no-interaction --no-progress
npm ci --no-audit --no-fund
npm run build
