<?php

return [
    'config_cache_enabled' => (bool) env('DATATABLE_CONFIG_CACHE_ENABLED', true),

    'config_cache_ttl_seconds' => (int) env('DATATABLE_CONFIG_CACHE_TTL_SECONDS', 86400),

    'config_cache_prefix' => env('DATATABLE_CONFIG_CACHE_PREFIX', 'datatable_columns'),
];
