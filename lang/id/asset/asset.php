<?php

return [
    'title'              => 'Aset',
    'add'                => 'Tambah Aset',
    'new'                => 'Aset Baru',
    'delete'             => 'Hapus Aset',
    'delete.description' => 'Apakah Anda yakin ingin menghapus aset ini?',
    'delete.confirm'     => 'Hapus',
    'cancel'             => 'Batal',

    'sell_not_implemented'          => 'Jual Aset belum tersedia, akan diimplementasikan pada Fase 4.',
    'cannot_cancel'                 => 'Aset tidak dapat dibatalkan.',
    'ownership_field_must_be_empty' => 'Field :field harus kosong untuk jenis kepemilikan yang dipilih.',
    'rentable_must_be_single_unit'  => 'Aset dengan kategori yang dapat disewakan harus memiliki kuantitas 1.',
    'cannot_transition_status'      => 'Aset tidak dapat bertransisi ke status :to dari status saat ini.',
    'location'                      => [
        'cannot_delete_has_assets' => 'Lokasi tidak dapat dihapus karena masih memiliki aset di dalamnya atau di sub-lokasinya.',
    ],

    'actions' => [
        'submit'             => 'Ajukan',
        'scrap'              => 'Hapuskan (Scrap)',
        'sell'               => 'Jual',
        'set_in_maintenance' => 'Jadwalkan Perawatan',
        'set_out_of_order'   => 'Tandai Rusak',
        'reactivate'         => 'Aktifkan Kembali',
    ],

    'columns' => [
        'asset_name'         => 'Nama Aset',
        'code'               => 'Kode',
        'asset_category_id'  => 'Kategori Aset',
        'asset_location_id'  => 'Lokasi Aset',
        'asset_type'         => 'Tipe Aset',
        'asset_type.options' => [
            'existing_asset'      => 'Aset Existing',
            'composite_asset'     => 'Aset Komposit',
            'composite_component' => 'Komponen Komposit',
        ],
        'item_id'        => 'Item Terkait',
        'asset_quantity' => 'Kuantitas',

        'ownership_type'         => 'Jenis Kepemilikan',
        'ownership_type.options' => [
            'company'  => 'Perusahaan',
            'supplier' => 'Pemasok',
            'customer' => 'Pelanggan',
        ],
        'ownership_company_id'  => 'Perusahaan',
        'ownership_supplier_id' => 'Pemasok',
        'ownership_customer_id' => 'Pelanggan',

        'custodian_id' => 'Penanggung Jawab',

        'purchase_date'          => 'Tanggal Pembelian',
        'available_for_use_date' => 'Tanggal Tersedia Digunakan',
        'disposal_date'          => 'Tanggal Pelepasan',
        'net_purchase_amount'    => 'Nilai Pembelian Bersih',
        'gross_purchase_amount'  => 'Nilai Perolehan',
        'additional_asset_cost'  => 'Biaya Tambahan',
        'total_asset_cost'       => 'Total Biaya Aset',

        'calculate_depreciation'                 => 'Hitung Penyusutan',
        'is_depreciable'                         => 'Dapat Disusutkan',
        'opening_accumulated_depreciation'       => 'Akumulasi Penyusutan Awal',
        'opening_number_of_booked_depreciations' => 'Jumlah Penyusutan Awal',
        'depreciation_method'                    => 'Metode Penyusutan',
        'depreciation_method.options'            => [
            'straight_line'            => 'Garis Lurus',
            'double_declining_balance' => 'Saldo Menurun Ganda',
            'written_down_value'       => 'Nilai Buku Menurun',
            'manual'                   => 'Manual',
        ],
        'frequency_of_depreciation'        => 'Frekuensi Penyusutan (Bulan)',
        'total_number_of_depreciations'    => 'Total Jumlah Penyusutan',
        'next_depreciation_date'           => 'Tanggal Penyusutan Berikutnya',
        'expected_value_after_useful_life' => 'Nilai Sisa (Salvage Value)',
        'salvage_value_percentage'         => 'Persentase Nilai Sisa',
        'rate_of_depreciation'             => 'Tarif Penyusutan',
        'daily_prorata_based'              => 'Berdasarkan Pro-rata Harian',

        'insurance_policy_number' => 'Nomor Polis Asuransi',
        'insurance_insurer'       => 'Perusahaan Asuransi',
        'insurance_insured_value' => 'Nilai Pertanggungan',
        'insurance_start_date'    => 'Tanggal Mulai Asuransi',
        'insurance_end_date'      => 'Tanggal Berakhir Asuransi',
        'insurance_comprehensive' => 'Asuransi Komprehensif',

        'maintenance_required' => 'Perlu Perawatan',
        'status'               => 'Status',
    ],

    'sections' => [
        'identity'  => 'Identitas & Lokasi',
        'ownership' => 'Kepemilikan',
        'purchase'  => 'Pembelian & Penyusutan',
        'insurance' => 'Asuransi',
    ],
];
