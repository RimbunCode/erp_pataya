<?php

return [
    'title'                          => 'Pengaturan Pembelian',
    'default'                        => ['title' => 'Default'],
    'transaction'                    => ['title' => 'Transaksi'],
    'default_tax'                    => 'Pajak Default',
    'default_target_warehouse'       => 'Gudang Tujuan Default',
    'default_payment_term_template'  => 'Template Termin Pembayaran Default',
    'over_receipt_tolerance_percent' => 'Toleransi Kelebihan Penerimaan',
    'over_billing_tolerance_percent' => 'Toleransi Kelebihan Penagihan',
    'over_receipt_tolerance_help'    => 'Mengizinkan penerimaan hingga persentase ini di atas sisa kuantitas pada item Purchase Order.',
    'over_billing_tolerance_help'    => 'Mengizinkan penagihan hingga persentase ini di atas sisa kuantitas atau nilai pada item sumber.',
    'reference_unavailable'          => 'Referensi default ini sudah tidak aktif. Pilih data aktif atau kosongkan pengaturan ini.',
    'rate_change_action'             => 'Perubahan Tarif Antar Dokumen',
    'rate_change_action_help'        => 'Bandingkan tarif Purchase Invoice dengan tarif Purchase Order yang ditautkan. Tidak berlaku untuk baris yang hanya bersumber dari penerimaan tanpa tarif sumber.',
    'actions'                        => ['none' => 'Abaikan', 'warn' => 'Beri peringatan dan izinkan', 'stop' => 'Blokir'],
];
