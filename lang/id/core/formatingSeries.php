<?php

return [
    'formating_series' => 'Seri Pemformatan',
    'title'            => 'Seri Pemformatan',
    'columns'          => [
        'name'           => 'Nama',
        'model'          => 'Model',
        'format'         => 'Kode Format',
        'example_result' => 'Contoh Hasil',
    ],
    'placeholder' => 'Gunakan "{" untuk menampilkan atribut',
    'formats'     => [
        'year'   => 'Tahun',
        'month'  => 'Bulan',
        'number' => 'Angka',
        'branch' => 'Cabang',
    ],
    'errors' => [
        'month_invalid'      => 'Atribut tahun (year) diwajibkan bila atribut bulan (month) digunakan.',
        'increment_notfound' => 'Atribut angka (number) diwajibkan',
    ],
];
