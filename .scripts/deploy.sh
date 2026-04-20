#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

case "$1" in
  production)
    bash "$SCRIPT_DIR/deploy-production.sh"
    ;;
  staging)
    bash "$SCRIPT_DIR/deploy-staging.sh"
    ;;
  *)
    echo "Usage: deploy [production|staging]"
    ;;
esac
