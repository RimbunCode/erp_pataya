<?php

return [
    'title'   => 'Number Card',
    'add'     => 'Tambah Number Card',
    'new'     => 'Buat Number Card',
    'details' => 'Detail',
    'sharing' => 'Berbagi',
    'columns' => [
        'label'                       => 'Label',
        'icon'                        => 'Icon',
        'description'                 => 'Deskripsi',
        'filters'                     => 'Filter',
        'function'                    => 'Fungsi',
        'model'                       => 'Model',
        'model.placeholder'           => 'Pilih model',
        'created_at'                  => 'Dibuat Pada',
        'source_type'                 => 'Sumber',
        'aggregate_function_based_on' => 'Kolom Agregat',
        'stats_time_interval'         => 'Bandingkan Dengan',
        'currency'                    => 'Mata Uang',
        'color'                       => 'Warna',
        'background_color'            => 'Warna Latar',
        'show_full_number'            => 'Tampilkan Angka Penuh',
        'show_percentage_stats'       => 'Tampilkan Statistik Persentase',
        'is_shared_all'               => 'Bagikan ke semua User/Role',
    ],
    'descriptions' => [
        'show_full_number'      => 'Tampilkan angka lengkap dengan pemisah ribuan (mis. 1.234.567). Jika nonaktif, angka disingkat (mis. 1,2 jt).',
        'show_percentage_stats' => 'Tampilkan badge persentase perubahan (naik/turun) dibandingkan periode sebelumnya sesuai interval "Bandingkan Dengan".',
        'is_shared_all'         => 'Number Card ini terlihat oleh SEMUA user, berapa pun permission-nya ke model target. Ini tambahan, bukan pengganti — user yang punya permission Select ke model target tetap bisa melihat Number Card ini meski opsi ini nonaktif.',
    ],

    'source_types' => [
        'document_type' => 'Tipe Dokumen',
        'custom'        => 'Custom',
    ],
    'functions' => [
        'count'   => 'Jumlah',
        'sum'     => 'Total',
        'average' => 'Rata-rata',
        'minimum' => 'Minimum',
        'maximum' => 'Maksimum',
    ],
    'stats_time_intervals' => [
        'daily'   => 'Kemarin',
        'weekly'  => 'Minggu Lalu',
        'monthly' => 'Bulan Lalu',
        'yearly'  => 'Tahun Lalu',
    ],
];
