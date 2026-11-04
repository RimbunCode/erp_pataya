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
    ],
    'errors' => [
        'invalid_range'  => 'Tanggal akhir harus sama dengan atau setelah tanggal mulai.',
        'outside_year'   => 'Periode harus berada di dalam rentang tahun fiskal :year (:start s.d. :end).',
        'overlap'        => 'Rentang tanggal tumpang-tindih dengan periode :name.',
        'duplicate_name' => 'Periode bernama :name sudah ada pada tahun fiskal ini.',
    ],
];
