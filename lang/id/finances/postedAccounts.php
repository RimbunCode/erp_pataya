<?php

return [
    'title'    => 'Akun pencatatan',
    'subtitle' => 'Akun ditentukan otomatis oleh konfigurasi Posting Profile dan tidak dapat diubah di sini.',

    'columns' => [
        'role'    => 'Peran',
        'account' => 'Akun',
        'lines'   => 'Baris',
    ],

    'states' => [
        'preview'          => 'Pratinjau: akun yang akan dipakai saat dokumen diapprove.',
        'estimated'        => 'Perkiraan: sebagian nilai baru pasti saat approve, sehingga jurnal yang terbentuk dapat berbeda.',
        'recorded'         => 'Akun yang dipakai saat dokumen diposting.',
        'new'              => 'Akun ditentukan otomatis dan akan tampil setelah dokumen disimpan.',
        'pending_approval' => 'Akun ditentukan saat dokumen diapprove.',
        'pending_posting'  => 'Belum ada akun tercatat: posting belum berjalan atau dokumen dibuat sebelum pencatatan akun diberlakukan.',
        'unavailable'      => 'Tidak ada akun pencatatan untuk dokumen ini.',
        'no_journal'       => 'Dokumen ini tidak menghasilkan jurnal, sehingga tidak ada akun yang dicatat.',
    ],

    'lines_count'       => ':count baris',
    'fix_profile'       => 'Buka Posting Profile',
    'fix_profile_admin' => 'Hubungi administrator untuk melengkapi konfigurasi Posting Profile.',

    'errors' => [
        'preview_failed'                 => 'Pratinjau akun gagal dibuat. Coba muat ulang halaman; bila berulang, hubungi administrator.',
        'asset_category_account_missing' => 'Akun kategori aset ":category" untuk cabang aset ini belum diisi. Lengkapi akun kategori aset sebelum dokumen diapprove; tanpa itu posting akan gagal.',
        'payment_type_unsupported'       => 'Jenis pembayaran ini belum didukung oleh engine posting, sehingga pratinjau akun tidak tersedia.',
    ],
];
