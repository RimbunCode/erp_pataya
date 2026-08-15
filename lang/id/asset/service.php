<?php

return [
    'title'              => 'Servis Aset',
    'add'                => 'Tambah Servis',
    'new'                => 'Servis Baru',
    'delete'             => 'Hapus Servis',
    'delete.description' => 'Apakah Anda yakin ingin menghapus servis ini?',
    'delete.confirm'     => 'Hapus',
    'cancel'             => 'Batal',

    'checklist_not_complete'     => 'Semua item checklist aktivitas harus ditandai selesai sebelum menyelesaikan servis ini.',
    'asset_status_terminal'      => 'Aset berstatus terminal dan tidak dapat diperbaiki.',
    'activity_requires_approval' => 'Activity log hanya dapat diisi setelah servis ini disubmit dan disetujui.',

    'type' => [
        'maintenance_task' => 'Tugas Maintenance',
        'repair'           => 'Perbaikan',
    ],

    'activity' => [
        'title'                        => 'Log Aktivitas',
        'add'                          => 'Tambah Aktivitas',
        'edit'                         => 'Edit Aktivitas',
        'pic'                          => 'PIC',
        'description'                  => 'Deskripsi',
        'is_done'                      => 'Selesai',
        'save'                         => 'Simpan',
        'empty'                        => 'Belum ada aktivitas tercatat.',
        'mark_complete'                => 'Tandai Servis Selesai',
        'confirm_complete'             => 'Selesaikan servis ini?',
        'confirm_complete_description' => 'Semua item checklist aktivitas sudah selesai. Konfirmasi untuk menyelesaikan servis ini dan mengaktifkan kembali aset.',
        'confirm_complete_action'      => 'Konfirmasi',
    ],

    'columns' => [
        'code'                   => 'Kode',
        'type'                   => 'Tipe',
        'status'                 => 'Status',
        'failure_date'           => 'Tanggal Kerusakan',
        'completion_date'        => 'Tanggal Selesai',
        'capitalize_repair_cost' => 'Kapitalisasi Biaya Perbaikan',
        'increase_in_asset_life' => 'Penambahan Usia Aset (bulan)',
        'description'            => 'Deskripsi',
        'item'                   => 'Item',
        'quantity'               => 'Kuantitas',
        'valuation_rate'         => 'Harga Satuan',
    ],
];
