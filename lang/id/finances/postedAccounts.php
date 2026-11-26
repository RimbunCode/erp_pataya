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
    ],

    'lines_count' => ':count baris',
    'fix_profile' => 'Buka Posting Profile',

    'errors' => [
        'preview_failed' => 'Pratinjau akun gagal dibuat. Coba muat ulang halaman; bila berulang, hubungi administrator.',
    ],
];
