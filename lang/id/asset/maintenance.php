<?php

return [
    'title'              => 'Maintenance Aset',
    'add'                => 'Tambah Maintenance',
    'new'                => 'Maintenance Baru',
    'delete'             => 'Hapus Maintenance',
    'delete.description' => 'Apakah Anda yakin ingin menghapus data maintenance ini?',
    'delete.confirm'     => 'Hapus',
    'cancel'             => 'Batal',

    'columns' => [
        'asset'            => 'Aset',
        'maintenanceTeam'  => 'Tim Maintenance',
        'maintenance_team' => 'Tim Maintenance',
    ],

    'task' => [
        'columns' => [
            'task_name'            => 'Nama Tugas',
            'maintenance_type'     => 'Jenis Maintenance',
            'periodicity'          => 'Periode (hari)',
            'next_due_date'        => 'Tanggal Jatuh Tempo Berikutnya',
            'last_completion_date' => 'Tanggal Selesai Terakhir',
            'assign_to'            => 'Ditugaskan Ke',
            'certificate_required' => 'Butuh Sertifikat',
            'description'          => 'Deskripsi',
        ],
    ],

    'team' => [
        'title'              => 'Tim Maintenance',
        'add'                => 'Tambah Tim',
        'new'                => 'Tim Baru',
        'delete'             => 'Hapus Tim',
        'delete.description' => 'Apakah Anda yakin ingin menghapus tim ini?',
        'delete.confirm'     => 'Hapus',
        'cancel'             => 'Batal',

        'columns' => [
            'team_name' => 'Nama Tim',
            'manager'   => 'Manajer',
            'branch'    => 'Cabang',
        ],
    ],
];
