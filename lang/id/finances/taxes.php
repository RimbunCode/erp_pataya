<?php

return [
    'title'              => 'Pajak',
    'add'                => 'Tambah Pajak',
    'new'                => 'Pajak Baru',
    'delete'             => 'Hapus Pajak',
    'delete.description' => 'Apakah Anda yakin ingin menghapus Pajak ini?',
    'delete.confirm'     => 'Hapus',
    'cancel'             => 'Batal',
    'category'           => 'Kategori',
    'columns'            => [
        'name'             => 'Nama',
        'rate'             => 'Tarif (%)',
        'category'         => 'Kategori',
        'category.options' => [
            'unclassified' => 'Belum Diklasifikasi',
            'ppn_standard' => 'PPN Standar',
            'ppn_luxury'   => 'PPN Barang Mewah',
            'pph_21'       => 'PPh 21',
            'pph_22'       => 'PPh 22',
            'pph_23'       => 'PPh 23',
            'pph_4_2'      => 'PPh Pasal 4 ayat 2',
            'other'        => 'Lainnya',
        ],
        'behavior'         => 'Perilaku',
        'behavior.options' => [
            'additive'    => 'Menambah Total (mis. PPN)',
            'withholding' => 'Dipotong dari Pembayaran (mis. PPh)',
        ],
        'jurisdiction_code' => 'Kode Yurisdiksi',
        'is_creditable'     => 'Dapat Dikreditkan',
    ],
];
