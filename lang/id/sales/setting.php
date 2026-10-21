<?php

return [
    'title'   => 'Pengaturan Penjualan',
    'default' => [
        'title' => 'Default',
    ],
    'default_tax'                     => 'Pajak Default',
    'default_source_warehouse'        => 'Gudang Asal Default',
    'default_payment_term_template'   => 'Template Termin Pembayaran Default',
    'transaction'                     => ['title' => 'Transaksi'],
    'over_delivery_tolerance_percent' => 'Toleransi Kelebihan Pengiriman',
    'over_billing_tolerance_percent'  => 'Toleransi Kelebihan Penagihan',
    'over_delivery_tolerance_help'    => 'Mengizinkan pengiriman hingga persentase ini di atas sisa kuantitas pada item Sales Order.',
    'over_billing_tolerance_help'     => 'Mengizinkan penagihan hingga persentase ini di atas sisa kuantitas atau nilai pada item sumber.',
    'reference_unavailable'           => 'Referensi default ini sudah tidak aktif. Pilih data aktif atau kosongkan pengaturan ini.',
    'rate_change_action'              => 'Perubahan Tarif Antar Dokumen',
    'rate_change_action_help'         => 'Bandingkan tarif Sales Invoice dengan tarif Sales Order yang ditautkan.',
    'below_cost_action'               => 'Harga Jual di Bawah Biaya',
    'below_cost_action_help'          => 'Saat posting, bandingkan harga bersih per unit setiap baris stok Sales Invoice dengan nilai valuasi terkini di gudang asal. Item non-stok dan baris tanpa valuasi dilewati.',
    'actions'                         => ['none' => 'Abaikan', 'warn' => 'Beri peringatan dan izinkan', 'stop' => 'Blokir'],
];
