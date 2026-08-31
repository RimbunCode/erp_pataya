<?php

return [
    'enabled' => true,

    'runtime_mode' => env('HAVE_TRANSACTIONS_RUNTIME_MODE', 'sync'),

    'metadata_cache_enabled' => (bool) env('HAVE_TRANSACTIONS_METADATA_CACHE_ENABLED', true),

    'metadata_cache_ttl_seconds' => (int) env('HAVE_TRANSACTIONS_METADATA_CACHE_TTL_SECONDS', 600),

    'metadata_cache_prefix' => env('HAVE_TRANSACTIONS_METADATA_CACHE_PREFIX', 'have_transactions'),

    'runtime_debug_log' => (bool) env('HAVE_TRANSACTIONS_RUNTIME_DEBUG_LOG', false),

    'async_replay_enabled' => (bool) env('HAVE_TRANSACTIONS_ASYNC_REPLAY_ENABLED', false),

    'enforce_delete_guard' => true,

    'tracked_tables' => [
        'accounts',
        'approval_instance_steps',
        'approval_schemes',
        'attributes',
        'branches',
        'categories',
        'customers',
        'dashboards',
        'files',
        'formating_series',
        'general_ledgers',
        'item_alternatives',
        'item_variants',
        'items',
        'payment_methods',
        'payment_schedules',
        'payment_term_templates',
        'payment_terms',
        'preferences',
        'print_templates',
        'roles',
        'stock_ledger_entries',
        'suppliers',
        'taxes',
        'units',
        'users',
        'warehouses',
        'number_cards',
        'charts',
    ],

    'excluded_source_tables' => [
        'logs',
        'taggables',
        'fileables',
        'model_connections',
    ],

    'excluded_target_tables' => [
        'files',
        'users',
    ],

    'excluded_morph_relations' => [
        'loggable',
        'taggable',
        'fileable',
        'model',
        'reference',
    ],

    'excluded_submitable_statuses' => [
        'canceled',
        'rejected',
    ],
];
