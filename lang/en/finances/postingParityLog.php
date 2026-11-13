<?php

return [
    'title' => 'Posting Parity Logs',
    'name'  => 'Posting Parity Log',

    'columns' => [
        'document_type'         => 'Document Type',
        'document_type.options' => [
            'sales_invoice'          => 'Sales Invoice',
            'purchase_invoice'       => 'Purchase Invoice',
            'purchase_receipt'       => 'Purchase Receipt',
            'delivery_note'          => 'Delivery Note',
            'payment_entry'          => 'Payment Entry',
            'stock_entry'            => 'Stock Entry',
            'asset_depreciation'     => 'Asset Depreciation',
            'asset_scrap'            => 'Asset Scrap',
            'asset_value_adjustment' => 'Asset Value Adjustment',
            'asset_disposal'         => 'Asset Disposal',
        ],
        'status'         => 'Status',
        'status.options' => [
            'match'        => 'Match',
            'rounding'     => 'Rounding Difference',
            'config_diff'  => 'Configuration Difference',
            'mismatch'     => 'Mismatch',
            'engine_error' => 'Engine Error',
        ],
        'source_type' => 'Source Type',
        'source_id'   => 'Source ID',
        'legacy'      => 'Legacy Path',
        'engine'      => 'Engine',
        'diff'        => 'Difference',
        'created_at'  => 'Logged At',
    ],

    'filters' => [
        'document_type' => 'Document Type',
        'status'        => 'Status',
        'date_from'     => 'From Date',
        'date_to'       => 'To Date',
        'all'           => 'All',
        'apply'         => 'Apply',
        'reset'         => 'Reset',
    ],

    'list' => [
        'empty'     => 'No parity logs match the filters.',
        'show_diff' => 'Show difference',
        'hide_diff' => 'Hide difference',
        'no_diff'   => 'No difference recorded.',
        'total'     => ':count logs',
        'previous'  => 'Previous page',
        'next'      => 'Next page',
    ],

    'mode' => [
        'title'       => 'Engine Mode per Document Type',
        'description' => 'off: the legacy path writes journals. shadow: the legacy path writes, the engine only compares. on: the engine writes journals.',
        'current'     => 'Mode',
        'change'      => 'Change mode for :document_type',
        'read_only'   => 'You do not have permission to change the engine mode.',
        'switched'    => 'Mode of :document_type changed to :mode.',
        'options'     => [
            'off'    => 'Off (legacy path)',
            'shadow' => 'Shadow (compare)',
            'on'     => 'On (engine writes)',
        ],
        'confirm' => [
            'title'       => 'Enable the Engine for :document_type',
            'description' => 'Mode on makes the Posting Engine write journals for this document type and the legacy path is no longer used. Continue only when parity is proven and the product owner approves.',
            'checkbox'    => 'I understand that the engine will write journals for this document type.',
            'confirm'     => 'Enable',
            'cancel'      => 'Cancel',
        ],
    ],
];
