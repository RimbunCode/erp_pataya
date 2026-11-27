<?php

return [
    'title' => 'Rincian Pajak',

    'columns' => [
        'line'                => 'Baris',
        'tax'                 => 'Pajak',
        'base_amount'         => 'Basis',
        'dpp_factor'          => 'Faktor DPP',
        'dpp_amount'          => 'DPP',
        'rate'                => 'Tarif (%)',
        'tax_amount'          => 'Jumlah Pajak',
        'rounding_adjustment' => 'Sisa Pembulatan',
        'version'             => 'Versi Aturan',
        'warnings'            => 'Peringatan',
    ],

    'states' => [
        'snapshot' => 'Rincian dari snapshot yang disimpan saat dokumen disetujui.',
        'legacy'   => 'Dokumen ini dibuat sebelum versi aturan pajak ada. Rincian dijelaskan dari nilai yang tersimpan pada baris dokumen (legacy), bukan dari versi aturan.',
        'pending'  => 'Dokumen belum disetujui. Snapshot rincian dibuat saat dokumen disetujui; yang tampil adalah nilai tersimpan saat ini.',
        'none'     => 'Dokumen ini tidak memiliki baris berpajak.',
        'error'    => 'Rincian pajak tidak dapat ditampilkan saat ini.',
        'new'      => 'Rincian pajak tampil setelah dokumen disimpan.',
    ],

    'version' => [
        'label'   => 'Versi :number',
        'legacy'  => 'Legacy',
        'missing' => 'Versi tidak tersedia',
    ],

    'totals' => [
        'additive'    => 'Total pajak yang menambah',
        'withholding' => 'Total pajak yang dipotong',
    ],

    'warnings' => [
        'snapshot_build_failed'        => 'Rincian pajak gagal dibangun saat dokumen disetujui; angka dokumen tidak terpengaruh.',
        'persisted_vs_engine_mismatch' => 'Nilai tersimpan berbeda lebih dari satu satuan terkecil dari perhitungan aturan.',
        'unknown'                      => 'Peringatan: :code',
    ],
];
