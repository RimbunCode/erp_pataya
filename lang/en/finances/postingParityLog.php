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
];
