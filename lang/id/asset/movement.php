<?php

return [
    'title'              => 'Perpindahan Aset',
    'add'                => 'Tambah Perpindahan',
    'new'                => 'Perpindahan Baru',
    'delete'             => 'Hapus Perpindahan',
    'delete.description' => 'Apakah Anda yakin ingin menghapus perpindahan ini?',
    'delete.confirm'     => 'Hapus',
    'cancel'             => 'Batal',

    'asset_must_be_active'             => 'Aset :code harus berstatus Active untuk disertakan dalam perpindahan.',
    'transfer_requires_both_locations' => 'Transfer membutuhkan lokasi asal dan lokasi tujuan.',
    'issue_requires_target_location'   => 'Issue membutuhkan lokasi tujuan.',
    'receipt_requires_source_location' => 'Receipt membutuhkan lokasi asal.',
    'source_location_mismatch'         => 'Lokasi asal tidak sesuai dengan lokasi aset :code saat ini.',

    'purpose' => [
        'issue'              => 'Keluar',
        'receipt'            => 'Diterima',
        'transfer'           => 'Transfer',
        'transfer_and_issue' => 'Transfer dan Keluar',
    ],

    'columns' => [
        'code'             => 'Kode',
        'purpose'          => 'Tujuan',
        'transaction_date' => 'Tanggal Transaksi',
        'branch_id'        => 'Cabang',
        'status'           => 'Status',
    ],
];
