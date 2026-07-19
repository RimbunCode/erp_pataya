<?php

return [
    'approval' => [
        'approved' => [
            'title'   => 'Dokumen Disetujui',
            'message' => 'Dokumen :document telah disetujui.',
        ],
        'rejected' => [
            'title'   => 'Dokumen Ditolak',
            'message' => 'Dokumen :document telah ditolak.',
        ],
        'pending' => [
            'title'   => 'Menunggu Persetujuan Anda',
            'message' => 'Dokumen :document menunggu keputusan Anda.',
        ],
        'canceled' => [
            'title'   => 'Dokumen Dibatalkan',
            'message' => 'Dokumen :document telah dibatalkan, tidak perlu ditinjau lagi.',
        ],
    ],
    'document_submitted' => [
        'title'   => 'Dokumen Baru',
        'message' => ':document baru dari :creator perlu diproses.',
    ],
    'todo_assigned' => [
        'title'   => 'ToDo Baru Ditugaskan',
        'message' => ':assigner menugaskan Anda sebuah ToDo: :document',
    ],
    'user_invited' => [
        'subject'  => 'Anda Diundang ke Sistem',
        'greeting' => 'Halo :name,',
        'line'     => 'Anda telah diundang untuk bergabung. Silakan lengkapi pengaturan akun Anda.',
        'action'   => 'Lengkapi Akun',
    ],
    'panel' => [
        'title'            => 'Notifikasi',
        'mark_all_as_read' => 'Tandai semua telah dibaca',
        'empty'            => [
            'title'    => 'Belum Ada Notifikasi',
            'subtitle' => 'Notifikasi baru akan muncul di sini.',
        ],
    ],
];
