#!/bin/bash

case "$1" in
  production)
    bash /home/ptpsn/erp/.scripts/deploy-production.sh
    ;;
  staging)
    bash /home/ptpsn/erp/.scripts/deploy-staging.sh
    ;;
  *)
    echo "Usage: deploy [production|staging]"
    ;;
esac
