<?php

return [
    'title' => 'Periode Fiskal',
    'name'  => 'Periode Fiskal',

    'columns' => [
        'name'           => 'Nama',
        'fiscal_year'    => 'Tahun Fiskal',
        'start_date'     => 'Tanggal Mulai',
        'end_date'       => 'Tanggal Akhir',
        'status'         => 'Status',
        'status.options' => [
            'open'   => 'Terbuka',
            'closed' => 'Ditutup',
        ],
        'closed_at' => 'Ditutup Pada',
        'actions'   => 'Aksi',
    ],
    'errors' => [
        'invalid_range'  => 'Tanggal akhir harus sama dengan atau setelah tanggal mulai.',
        'outside_year'   => 'Periode harus berada di dalam rentang tahun fiskal :year (:start s.d. :end).',
        'overlap'        => 'Rentang tanggal tumpang-tindih dengan periode :name.',
        'duplicate_name' => 'Periode bernama :name sudah ada pada tahun fiskal ini.',
    ],
    'generate' => [
        'title'   => 'Buat Tahun Fiskal',
        'year'    => 'Tahun Kalender',
        'submit'  => 'Buat',
        'success' => 'Tahun fiskal :year (12 periode bulanan) siap.',
    ],
    'actions' => [
        'close' => 'Tutup',
        'open'  => 'Buka Kembali',
    ],
    'close' => [
        'title'              => 'Tutup Periode',
        'description'        => 'Jurnal tidak dapat lagi diposting ke :period selama penegakan aktif.',
        'reason'             => 'Alasan (opsional)',
        'reason_placeholder' => 'Mengapa periode ini ditutup?',
        'confirm'            => 'Tutup Periode',
        'cancel'             => 'Batal',
        'success'            => 'Periode :period ditutup.',
    ],
    'open' => [
        'title'              => 'Buka Kembali Periode',
        'description'        => 'Jurnal dapat diposting lagi ke :period.',
        'reason'             => 'Alasan (opsional)',
        'reason_placeholder' => 'Mengapa periode ini dibuka kembali?',
        'confirm'            => 'Buka Kembali Periode',
        'cancel'             => 'Batal',
        'success'            => 'Periode :period dibuka kembali.',
    ],
    'enforcement' => [
        'title'       => 'Tegakkan Periode Fiskal',
        'description' => 'Bila aktif, jurnal hanya dapat diposting pada tanggal yang berada di periode fiskal terbuka. Nonaktif secara default agar data historis tidak terblokir.',
        'saved'       => 'Pengaturan penegakan disimpan.',
        'warning'     => ':count baris buku besar bertanggal di luar semua periode fiskal yang terdefinisi. Dengan penegakan aktif, posting pada tanggal seperti itu ditolak sampai ada periode yang mencakupnya.',
        'read_only'   => 'Anda tidak memiliki izin untuk mengubah pengaturan ini.',
    ],
    'list' => [
        'empty'   => 'Belum ada tahun fiskal. Buat satu untuk memulai.',
        'periods' => 'Periode',
        'range'   => ':start s.d. :end',
    ],
];
