<?php

return [
    'title'      => 'Versi Aturan Pajak',
    'name'       => 'Versi Aturan Pajak',
    'open_ended' => 'tanpa batas akhir',

    'columns' => [
        'tax'                   => 'Pajak',
        'version'               => 'Versi',
        'effective_from'        => 'Berlaku Dari',
        'effective_to'          => 'Berlaku Sampai',
        'rate'                  => 'Tarif (%)',
        'dpp_factor'            => 'Faktor DPP',
        'dpp_numerator'         => 'Faktor DPP: Pembilang',
        'dpp_denominator'       => 'Faktor DPP: Penyebut',
        'rounding_mode'         => 'Pembulatan',
        'rounding_mode.options' => [
            'per_line'     => 'Per Baris',
            'per_document' => 'Per Dokumen',
        ],
        'output_role'    => 'Peran Pajak Keluaran',
        'input_role'     => 'Peran Pajak Masukan',
        'status'         => 'Status',
        'status.options' => [
            'draft'   => 'Draft',
            'active'  => 'Aktif',
            'retired' => 'Dipensiunkan',
        ],
        'notes' => 'Catatan',
    ],

    'errors' => [
        'invalid_range'                  => 'Tanggal berlaku akhir harus sama dengan atau setelah tanggal berlaku awal.',
        'overlap'                        => 'Versi aktif :version (:from sampai :to) untuk pajak ini tumpang-tindih dengan rentang berlaku versi ini.',
        'not_draft'                      => 'Versi berstatus :status tidak dapat diubah; buat versi baru.',
        'not_active'                     => 'Hanya versi aktif yang dapat dipensiunkan (status saat ini: :status).',
        'invalid_rate'                   => 'Tarif harus antara 0 dan 100.',
        'invalid_dpp_factor'             => 'Faktor DPP tidak valid: pembilang dan penyebut harus bilangan bulat positif.',
        'dpp_factor_locked'              => 'Faktor DPP :factor belum dapat diaktifkan: kolom hitung dokumen invoice masih memakai 11/12 tetap, sehingga aturan berfaktor lain akan menyimpang dari angka dokumen.',
        'invalid_rounding'               => 'Mode pembulatan ":mode" tidak dikenal; gunakan per_line atau per_document.',
        'invalid_role'                   => 'Peran ":role" tidak valid; gunakan kunci peran Posting Profile.',
        'version_starts_before_previous' => 'Tanggal berlaku versi baru harus setelah tanggal berlaku versi sebelumnya (:from).',
        'version_ends_before_previous'   => 'Tanggal berakhir versi baru tidak boleh lebih awal dari tanggal berakhir versi sebelumnya (:to); selisihnya menjadi tanggal tanpa aturan berlaku.',
        'unknown_attribute'              => 'Isian ":field" tidak dikenal dan ditolak.',
        'unknown_tax'                    => 'Pajak tidak ditemukan.',
        'delete_not_draft'               => 'Hanya versi draft yang dapat dihapus.',
        'no_effective_rule'              => 'Tidak ada versi aturan pajak yang berlaku untuk ":tax" pada tanggal :date.',
        'stale_rule_version'             => 'Versi aturan pajak ":tax" yang berlaku pada tanggal dokumen (:date) berbeda dari versi yang tersimpan pada item. Simpan ulang draft dokumen agar pajak dihitung dengan versi yang berlaku, lalu setujui kembali.',
    ],

    'messages' => [
        'created'   => 'Versi :version berhasil dibuat sebagai draft.',
        'updated'   => 'Versi :version berhasil diperbarui.',
        'discarded' => 'Draft versi :version berhasil dihapus.',
        'activated' => 'Versi :version diaktifkan.',
        'retired'   => 'Versi :version dipensiunkan.',
    ],

    'tab' => [
        'title'           => 'Versi Aturan',
        'empty'           => 'Belum ada versi aturan untuk pajak ini.',
        'no_active'       => 'Pajak ini belum punya versi aturan aktif sehingga belum dapat dipakai pada invoice. Buat versi baru lalu aktifkan.',
        'dpp_hint'        => 'Selama kolom hitung dokumen belum dikonversi, hanya faktor DPP 11/12 yang dapat diaktifkan.',
        'created_by'      => 'Dibuat oleh',
        'add'             => 'Versi Baru',
        'read_only_notes' => 'Versi aktif dan pensiun tidak dapat diubah; buat versi baru dengan tanggal berlaku baru.',
        'actions'         => [
            'edit'     => 'Ubah',
            'activate' => 'Aktifkan',
            'retire'   => 'Pensiunkan',
            'discard'  => 'Hapus Draft',
        ],
        'form' => [
            'new_title'  => 'Versi Aturan Baru',
            'edit_title' => 'Ubah Draft Versi :version',
            'save'       => 'Simpan Draft',
            'cancel'     => 'Batal',
        ],
        'confirm' => [
            'cancel'   => 'Batal',
            'activate' => [
                'title'       => 'Aktifkan versi aturan?',
                'description' => 'Versi :version mulai dipakai untuk dokumen bertanggal pada rentang berlakunya. Versi aktif tidak dapat diubah lagi.',
                'confirm'     => 'Aktifkan',
            ],
            'retire' => [
                'title'       => 'Pensiunkan versi aturan?',
                'description' => 'Versi :version tidak lagi dipilih untuk dokumen baru. Dokumen yang sudah ada tidak berubah, tetapi tanggal yang tidak tercakup versi aktif lain akan gagal saat dokumen dibuat.',
                'confirm'     => 'Pensiunkan',
            ],
            'discard' => [
                'title'       => 'Hapus draft?',
                'description' => 'Draft versi :version akan dihapus.',
                'confirm'     => 'Hapus',
            ],
        ],
    ],
];
