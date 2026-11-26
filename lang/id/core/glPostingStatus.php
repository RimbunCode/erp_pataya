<?php

return [
    'title'            => 'Status Posting GL',
    'name'             => 'Status Posting GL',
    'retry'            => 'Coba Lagi',
    'zero_total_retry' => 'Nilai posting receipt ini 0 sehingga jurnal tidak dapat dibuat. Periksa nilai baris receipt dan valuasi stok terlebih dulu.',

    'columns' => [
        'referenceable_type' => 'Tipe Dokumen',
        'referenceable'      => 'Dokumen',
        'status'             => 'Status',
        'retry_count'        => 'Jumlah Percobaan',
        'last_error'         => 'Error Terakhir',
        'posted_at'          => 'Waktu Posting',
        'created_at'         => 'Waktu Dibuat',
    ],
];
