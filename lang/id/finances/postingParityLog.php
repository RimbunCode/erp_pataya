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

    'filters' => [
        'document_type' => 'Jenis Dokumen',
        'status'        => 'Status',
        'date_from'     => 'Dari Tanggal',
        'date_to'       => 'Sampai Tanggal',
        'all'           => 'Semua',
        'apply'         => 'Terapkan',
        'reset'         => 'Atur Ulang',
    ],

    'list' => [
        'empty'     => 'Tidak ada catatan parity yang cocok dengan filter.',
        'show_diff' => 'Lihat selisih',
        'hide_diff' => 'Sembunyikan selisih',
        'no_diff'   => 'Tidak ada selisih tercatat.',
        'total'     => ':count catatan',
        'previous'  => 'Halaman sebelumnya',
        'next'      => 'Halaman berikutnya',
    ],

    'mode' => [
        'title'       => 'Mode Engine per Jenis Dokumen',
        'description' => 'off: jalur lama menulis jurnal. shadow: jalur lama menulis, engine hanya membandingkan. on: engine menulis jurnal.',
        'current'     => 'Mode',
        'change'      => 'Ubah mode untuk :document_type',
        'read_only'   => 'Anda tidak memiliki izin untuk mengubah mode engine.',
        'switched'    => 'Mode :document_type diubah menjadi :mode.',
        'options'     => [
            'off'    => 'Off (jalur lama)',
            'shadow' => 'Shadow (bandingkan)',
            'on'     => 'On (engine menulis)',
        ],
        'confirm' => [
            'title'       => 'Aktifkan Engine untuk :document_type',
            'description' => 'Mode on membuat Posting Engine menulis jurnal untuk jenis dokumen ini dan jalur lama tidak dipakai lagi. Lanjutkan hanya bila parity terbukti dan pemilik produk menyetujui.',
            'checkbox'    => 'Saya memahami bahwa engine akan menulis jurnal untuk jenis dokumen ini.',
            'confirm'     => 'Aktifkan',
            'cancel'      => 'Batal',
        ],
    ],
];
