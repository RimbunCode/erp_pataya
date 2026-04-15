<?php

return [
    'title'              => 'Syarat Pembayaran',
    'add'                => 'Tambah Syarat Pembayaran',
    'new'                => 'Syarat Pembayaran Baru',
    'delete'             => 'Hapus Syarat Pembayaran',
    'delete.description' => 'Apakah Anda yakin ingin menghapus Syarat Pembayaran ini?',
    'delete.confirm'     => 'Hapus',
    'cancel'             => 'Batal',
    'category'           => 'Kategori',
    'discount_settings'  => 'Pengaturan Diskon',
    'columns'            => [
        'name'                          => 'Nama',
        'invoice_portion'               => 'Porsi Faktur',
        'due_date_based_on'             => 'Jatuh Tempo Berdasarkan',
        'due_date_based_on.placeholder' => 'Pilih dasar jatuh tempo',
        'due_date_based_on.options'     => [
            'days_after_invoice_date'    => 'Hari setelah tanggal faktur',
            'weeks_after_invoice_week'   => 'Minggu setelah minggu faktur',
            'months_after_invoice_month' => 'Bulan setelah bulan faktur',
        ],
        'description'                => 'Deskripsi',
        'payment_method'             => 'Metode Pembayaran',
        'payment_method.placeholder' => 'Pilih metode pembayaran',
        'discount_type'              => 'Tipe Diskon',
        'discount_type.placeholder'  => 'Pilih tipe diskon',
        'discount_type.options'      => [
            'percentage' => 'Persentase',
            'amount'     => 'Nominal',
        ],
        'discount'      => 'Diskon',
        'credit_period' => 'Periode Kredit',
        'credit_days'   => 'Hari Kredit',
        'credit_weeks'  => 'Minggu Kredit',
        'credit_months' => 'Bulan Kredit',
    ],
];
