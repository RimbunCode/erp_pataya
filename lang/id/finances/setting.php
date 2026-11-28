<?php

return [
    'title'       => 'Pengaturan Keuangan',
    'tax_invoice' => [
        'title'                => 'Faktur Pajak',
        'range_start'          => 'Awal Rentang Nomor Seri',
        'range_end'            => 'Akhir Rentang Nomor Seri',
        'last_used'            => 'Nomor Seri Terakhir Digunakan',
        'range_not_configured' => 'Range nomor seri Faktur Pajak belum dikonfigurasi. Hubungi admin untuk mengisi rentang di Pengaturan Keuangan.',
        'range_exhausted'      => 'Range nomor seri Faktur Pajak yang dialokasikan sudah habis. Hubungi admin untuk alokasi range baru dari DJP.',
    ],
    'fx' => [
        'title'              => 'Kurs',
        'max_age_days'       => 'Umur Maksimum Kurs (hari)',
        'max_age_days_help'  => 'Bila tidak ada kurs pada tanggal transaksi, dipakai kurs terdekat sebelumnya dalam batas hari ini. Isi 0 untuk hanya menerima kurs pada tanggal yang tepat. Maksimal 3650.',
        'allow_inverse'      => 'Izinkan Kurs Kebalikan',
        'allow_inverse_help' => 'Bila kurs langsung tidak ada, kurs pasangan sebaliknya dipakai dengan pembagian (kurs dikalikan balik).',
    ],
    'posting' => [
        'title'                                => 'Posting',
        'discount_split_from_sales_invoice'    => 'Diskon Terpisah Sales Invoice Mulai',
        'discount_split_from_purchase_invoice' => 'Diskon Terpisah Purchase Invoice Mulai',
        'discount_split_help'                  => 'Mulai tanggal ini jurnal invoice memisahkan diskon ke akun Diskon (peran discount). Kosongkan untuk menonaktifkan. Jurnal bertanggal sebelum tanggal ini tidak berubah. Peran discount harus sudah dipetakan pada Posting Profile aktif (Purchase Invoice: lewat aturan akun untuk jenis dokumen Purchase Invoice).',
    ],
];
