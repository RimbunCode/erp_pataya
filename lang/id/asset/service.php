<?php

return [
    'title'              => 'Work Orders',
    'add'                => 'Tambah Work Order',
    'new'                => 'Work Order Baru',
    'delete'             => 'Hapus Work Order',
    'delete.description' => 'Apakah Anda yakin ingin menghapus work order ini?',
    'delete.confirm'     => 'Hapus',
    'cancel'             => 'Batal',

    'checklist_not_complete'          => 'Semua item checklist aktivitas harus ditandai selesai sebelum menyelesaikan servis ini.',
    'asset_status_terminal'           => 'Aset berstatus terminal dan tidak dapat diperbaiki.',
    'activity_requires_approval'      => 'Activity log hanya dapat diisi setelah servis ini disubmit dan disetujui.',
    'not_currently_rented'            => 'Aset ini sedang tidak disewakan, sehingga tidak bisa ditagih ke penyewa.',
    'consumed_item_quantity_exceeded' => 'Kuantitas yang diserahkan tidak boleh melebihi kuantitas consumed item yang dipakai untuk servis ini.',

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
        'unit'                   => 'Unit',
        'quantity'               => 'Kuantitas',
        'valuation_rate'         => 'Harga Satuan',
        'bill_to_renter'         => 'Tagih ke Penyewa',
        'customer'               => 'Pelanggan',
        'customer_branch'        => 'Cabang Pelanggan',
    ],

    'actions' => [
        'create_pr' => 'Buat Purchase Request',
        'create_po' => 'Buat Purchase Order',
        'create_so' => 'Buat Sales Order',
        'create_io' => 'Buat Internal Order',
    ],
];
