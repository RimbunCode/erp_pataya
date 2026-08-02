<?php

return [
    'title' => 'Log Aktivitas',
    'name'  => 'Log',

    'columns' => [
        'code'                => 'Kode',
        'action'              => 'Aksi',
        'activity_text'       => 'Aktivitas',
        'loggable_type_label' => 'Modul',
        'loggable'            => 'Dokumen',
        'user'                => 'Pengguna',
        'created_at'          => 'Waktu',
    ],

    'action' => [
        'options' => [
            'created'   => 'Dibuat',
            'updated'   => 'Diperbarui',
            'deleted'   => 'Dihapus',
            'restored'  => 'Dipulihkan',
            'submitted' => 'Diajukan',
            'cancelled' => 'Dibatalkan',
            'amended'   => 'Diamandemen',
        ],
    ],
];
