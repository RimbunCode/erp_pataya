<?php

return [
    'title'   => 'Aktivitas',
    'add'     => 'Tambah Aktivitas',
    'columns' => [
        'type'             => 'Tipe',
        'type.placeholder' => 'Pilih tipe',
        'type.options'     => [
            'task'    => 'Tugas',
            'call'    => 'Panggilan',
            'meeting' => 'Pertemuan',
            'email'   => 'Email',
        ],
        'subject'            => 'Subjek',
        'description'        => 'Deskripsi',
        'scheduled_at'       => 'Dijadwalkan Pada',
        'status'             => 'Status',
        'status.placeholder' => 'Pilih status',
        'status.options'     => [
            'open'   => 'Terbuka',
            'closed' => 'Selesai',
        ],
        'assigned_to'             => 'Ditugaskan Kepada',
        'assigned_to.placeholder' => 'Pilih pengguna',
    ],
];
