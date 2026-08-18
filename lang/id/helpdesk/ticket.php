<?php

return [
    'title' => 'Tiket Helpdesk',
    'add'   => 'Ticket Baru',
    'name'  => 'Ticket',
    'new'   => 'Ticket Baru',
    'edit'  => 'Edit Ticket',

    'columns' => [
        'code'       => 'Kode',
        'type'       => 'Tipe',
        'priority'   => 'Prioritas',
        'subject'    => 'Subjek',
        'content'    => 'Konten',
        'status'     => 'Status',
        'progress'   => 'Progres',
        'assign_to'  => 'Ditugaskan Ke',
        'created_by' => 'Dibuat Oleh',
        'start_date' => 'Tanggal Mulai',
        'due_date'   => 'Batas Waktu',
        'end_date'   => 'Tanggal Selesai',
    ],

    'type' => [
        'options' => [
            'bug_problem' => 'Bug / Masalah',
            'task'        => 'Tugas',
            'question'    => 'Pertanyaan',
            'other'       => 'Lainnya',
        ],
    ],

    'priority' => [
        'options' => [
            'low'      => 'Rendah',
            'medium'   => 'Sedang',
            'high'     => 'Tinggi',
            'critical' => 'Kritis',
        ],
    ],

    'status' => [
        'options' => [
            'new'         => 'Baru',
            'in_progress' => 'Sedang Dikerjakan',
            'on_hold'     => 'Ditunda',
            'resolved'    => 'Terselesaikan',
            'done'        => 'Selesai',
        ],
    ],

    'actions' => [
        'mark_done'         => 'Tandai Selesai',
        'update_ticket'     => 'Update Ticket',
        'assign_to_creator' => 'Tugaskan ke Pembuat',
    ],

    'mark_done_dialog' => [
        'title'       => 'Tandai Sebagai Selesai',
        'description' => 'Status akan diubah ke Selesai, progres ke 100%, dan tanggal penyelesaian dicatat. Tindakan ini tidak dapat dibatalkan.',
        'confirm'     => 'Tandai Selesai',
    ],

    'update_dialog' => [
        'title'       => 'Update Ticket',
        'description' => 'Tambahkan balasan atau pembaruan untuk ticket ini. Perubahan pada Ditugaskan Ke, Status, dan Progres akan diterapkan ke ticket.',
        'confirm'     => 'Simpan Pembaruan',
    ],

    'responses' => [
        'title' => 'Riwayat Tickets',
        'empty' => 'Belum ada.',
    ],
];
