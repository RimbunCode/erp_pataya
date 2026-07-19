<?php

return [
    'new'   => 'ToDo Baru',
    'title' => 'ToDo',
    'add'   => 'ToDo Baru',
    'name'  => 'ToDo',
    'edit'  => 'Edit ToDo',

    'columns' => [
        'description'  => 'Deskripsi',
        'reference'    => 'Referensi',
        'allocated_to' => 'Ditugaskan Ke',
        'priority'     => 'Prioritas',
        'status'       => 'Status',
        'date'         => 'Tanggal',
        'due_date'     => 'Tenggat',
        'assigned_by'  => 'Ditugaskan Oleh',
    ],

    'priority' => [
        'options' => [
            'low'    => 'Rendah',
            'medium' => 'Sedang',
            'high'   => 'Tinggi',
        ],
    ],

    'reference_deleted' => 'Referensi sudah tidak tersedia.',

    'scope' => [
        'all'   => 'Semua',
        'mine'  => 'Ditugaskan ke Saya',
        'by_me' => 'Ditugaskan oleh Saya',
    ],
];
