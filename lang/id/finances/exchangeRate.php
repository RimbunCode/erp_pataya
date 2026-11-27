<?php

return [
    'title' => 'Kurs',
    'name'  => 'Kurs',

    'columns' => [
        'from_currency_code' => 'Dari Mata Uang',
        'to_currency_code'   => 'Ke Mata Uang',
        'rate_type'          => 'Tipe Kurs',
        'rate_type.options'  => [
            'spot'        => 'Spot',
            'transaction' => 'Transaksi',
            'closing'     => 'Penutupan',
            'contract'    => 'Kontrak',
            'historical'  => 'Historis',
        ],
        'rate'           => 'Kurs',
        'rate_date'      => 'Tanggal Kurs',
        'source'         => 'Sumber',
        'source_ref'     => 'Referensi Sumber',
        'source.options' => [
            'manual'   => 'Manual',
            'import'   => 'Impor',
            'provider' => 'Penyedia',
        ],
    ],

    'errors' => [
        'no_rate'              => 'Kurs :from ke :to bertipe :type untuk tanggal :date tidak ditemukan. Tambahkan kurs di master Kurs.',
        'immutable_referenced' => 'Kurs ini sudah dipakai transaksi dan tidak dapat diubah atau dihapus. Buat kurs pada tipe atau tanggal lain.',
        'same_currency'        => 'Mata uang asal dan tujuan tidak boleh sama.',
        'rate_not_positive'    => 'Kurs harus lebih besar dari 0.',
        'rate_invalid_format'  => 'Kurs harus berupa angka desimal positif dengan paling banyak 8 digit desimal.',
        'rate_out_of_range'    => 'Kurs di luar rentang yang didukung (kurang dari 1.000.000.000.000).',
        'unknown_currency'     => 'Kode mata uang ":code" tidak ditemukan.',
        'invalid_type'         => 'Tipe kurs ":type" tidak dikenal.',
        'invalid_date'         => 'Tanggal kurs ":date" tidak valid; gunakan format YYYY-MM-DD.',
        'missing_field'        => 'Kolom ":field" wajib diisi.',
        'duplicate_in_file'    => 'Pasangan, tipe, dan tanggal yang sama muncul lebih dari satu kali dalam berkas (baris :first).',
        'referenced_conflict'  => 'Kurs untuk pasangan, tipe, dan tanggal ini sudah ada, sudah dipakai transaksi, dan nilainya berbeda; tidak dapat diubah.',
        'csv_missing_header'   => 'Header CSV harus memuat kolom: :columns.',
        'csv_unreadable'       => 'Berkas CSV tidak dapat dibaca.',
        'csv_column_count'     => 'Jumlah kolom baris tidak sama dengan header (diharapkan :expected, ditemukan :actual).',
    ],
];
