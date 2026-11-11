<?php

return [
    'title'              => 'Voucher Jurnal',
    'add'                => 'Tambah Voucher Jurnal',
    'new'                => 'Voucher Jurnal Baru',
    'detail'             => 'Detail Voucher Jurnal',
    'items'              => 'Baris Jurnal',
    'delete'             => 'Hapus Voucher Jurnal',
    'delete.description' => 'Apakah Anda yakin ingin menghapus Voucher Jurnal ini?',
    'delete.confirm'     => 'Hapus',
    'cancel'             => 'Batal',
    'columns'            => [
        'code'                => 'Kode',
        'date'                => 'Tanggal',
        'description'         => 'Deskripsi',
        'status'              => 'Status',
        'items'               => 'Baris',
        'account'             => 'Akun',
        'account.placeholder' => 'Pilih akun',
        'item_description'    => 'Keterangan Baris',
        'debit'               => 'Debit',
        'credit'              => 'Kredit',
    ],
    'balance' => [
        'balanced'   => 'Seimbang',
        'unbalanced' => 'Tidak seimbang: selisih :difference',
        'too_few'    => 'Minimal 2 baris diperlukan',
    ],
    'errors' => [
        'update_not_draft' => 'Voucher Jurnal yang sudah diajukan tidak dapat diubah.',
        'submit_not_draft' => 'Voucher Jurnal yang sudah diajukan tidak dapat diajukan lagi.',
    ],
];
