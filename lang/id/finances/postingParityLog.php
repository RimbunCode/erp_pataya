<?php

return [
    'title' => 'Log Parity Posting',
    'name'  => 'Log Parity Posting',

    'columns' => [
        'document_type'         => 'Jenis Dokumen',
        'document_type.options' => [
            'sales_invoice'          => 'Sales Invoice',
            'purchase_invoice'       => 'Purchase Invoice',
            'purchase_receipt'       => 'Purchase Receipt',
            'delivery_note'          => 'Delivery Note',
            'payment_entry'          => 'Payment Entry',
            'stock_entry'            => 'Stock Entry',
            'asset_depreciation'     => 'Depresiasi Aset',
            'asset_scrap'            => 'Scrap Aset',
            'asset_value_adjustment' => 'Penyesuaian Nilai Aset',
            'asset_disposal'         => 'Pelepasan Aset',
        ],
        'status'         => 'Status',
        'status.options' => [
            'match'        => 'Cocok',
            'rounding'     => 'Selisih Pembulatan',
            'config_diff'  => 'Beda Konfigurasi',
            'mismatch'     => 'Tidak Cocok',
            'engine_error' => 'Error Engine',
        ],
        'source_type' => 'Tipe Sumber',
        'source_id'   => 'ID Sumber',
        'legacy'      => 'Jalur Lama',
        'engine'      => 'Engine',
        'diff'        => 'Selisih',
        'created_at'  => 'Dicatat Pada',
    ],
];
