<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Role tujuan Ticket laporan masalah
    |--------------------------------------------------------------------------
    |
    | Ticket dari tombol "Laporkan masalah ini" di-assign ke role ini dan
    | notifikasinya dikirim ke seluruh anggotanya. Nama role harus sama persis
    | dengan kolom `roles.name`. Default "System Manager" (belum ada role
    | bernama "IT" di database); ganti lewat REPORT_ISSUE_ROLE bila perlu.
    */
    'issue_role' => env('REPORT_ISSUE_ROLE', 'System Manager'),
];
