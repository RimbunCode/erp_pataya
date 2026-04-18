#!/bin/bash

case "$1" in
  production)
    bash ./deploy-production.sh
    ;;
  staging)
    bash ./deploy-staging.sh
    ;;
  *)
    echo "Usage: deploy [production|staging]"
    ;;
esac
