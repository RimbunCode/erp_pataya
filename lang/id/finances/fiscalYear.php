<?php

return [
    'title' => 'Tahun Fiskal',
    'name'  => 'Tahun Fiskal',

    'columns' => [
        'name'           => 'Nama',
        'start_date'     => 'Tanggal Mulai',
        'end_date'       => 'Tanggal Akhir',
        'status'         => 'Status',
        'status.options' => [
            'open'   => 'Terbuka',
            'closed' => 'Ditutup',
        ],
    ],
    'errors' => [
        'invalid_range'     => 'Tanggal akhir harus sama dengan atau setelah tanggal mulai.',
        'overlap'           => 'Rentang tanggal tumpang-tindih dengan tahun fiskal :name.',
        'not_calendar_year' => 'Tahun fiskal :name sudah ada dengan rentang non-kalender (:start sampai :end), sehingga periode bulanan kalender tidak dapat dibuat otomatis. Buat periodenya secara manual.',
    ],
];
