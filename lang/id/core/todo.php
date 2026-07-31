<?php

return [
    'new'   => 'ToDo Baru',
    'title' => 'ToDo',
    'add'   => 'ToDo Baru',
    'name'  => 'ToDo',
    'edit'  => 'Edit ToDo',

    'columns' => [
        'code'               => 'Kode',
        'description'        => 'Deskripsi',
        'reference'          => 'Referensi',
        'allocated_to'       => 'Ditugaskan Ke',
        'type'               => 'Tipe',
        'priority'           => 'Prioritas',
        'status'             => 'Status',
        'date'               => 'Tanggal',
        'due_date'           => 'Tenggat',
        'reminder_lead_days' => 'Pengingat',
        'assigned_by'        => 'Ditugaskan Oleh',
    ],

    'priority' => [
        'options' => [
            'low'    => 'Rendah',
            'medium' => 'Sedang',
            'high'   => 'Tinggi',
        ],
    ],

    'type' => [
        'options' => [
            'task'     => 'Tugas',
            'event'    => 'Acara',
            'meeting'  => 'Rapat',
            'deadline' => 'Tenggat',
        ],
    ],

    'reminder_stage' => [
        'options' => [
            'lead'    => 'Akan Datang',
            'day_of'  => 'Hari Ini',
            'overdue' => 'Terlambat',
        ],
    ],

    'lead_days' => [
        'options' => [
            '1'  => 'H-1',
            '3'  => 'H-3',
            '7'  => 'H-7',
            '14' => 'H-14',
            '30' => 'H-30',
        ],
    ],

    'hints' => [
        'allocated_to_self'  => 'Kosongkan untuk menugaskan ke diri sendiri',
        'reminder_lead_days' => 'H-1 dan hari tenggat itu sendiri selalu diingatkan, terlepas dari pilihan di sini',
    ],

    'confirm' => [
        'reassign_to_self'             => 'Alihkan ToDo ini ke Anda?',
        'reassign_to_self_description' => 'Anda mengosongkan assignee. Melanjutkan akan mengalihkan ToDo ini ke Anda.',
    ],

    'reference_deleted' => 'Referensi sudah tidak tersedia.',

    'errors' => [
        'already_assigned' => 'User atau role ini sudah ditugaskan pada dokumen ini.',
    ],
];
