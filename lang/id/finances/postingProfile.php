<?php

return [
    'title'      => 'Posting Profile',
    'name'       => 'Posting Profile',
    'open_ended' => 'tanpa batas akhir',
    'accounts'   => 'Akun Default Peran',
    'rules'      => 'Aturan Akun Bersyarat',

    'columns' => [
        'name'           => 'Nama',
        'effective_from' => 'Berlaku Dari',
        'effective_to'   => 'Berlaku Sampai',
        'status'         => 'Status',
        'status.options' => [
            'draft'   => 'Draft',
            'active'  => 'Aktif',
            'retired' => 'Dipensiunkan',
        ],
        'version'          => 'Versi',
        'notes'            => 'Catatan',
        'previous_profile' => 'Versi Sebelumnya',
        'role'             => 'Peran',
        'account'          => 'Akun',
        'document_type'    => 'Jenis Dokumen',
        'variant'          => 'Varian',
        'variant.options'  => [
            'normal' => 'Normal',
            'return' => 'Retur',
        ],
        'item_type'     => 'Tipe Barang',
        'is_stock_item' => 'Barang Stok',
        'item_category' => 'Kategori Barang',
        'priority'      => 'Prioritas',
    ],

    'errors' => [
        'invalid_range'                  => 'Tanggal berlaku akhir harus sama dengan atau setelah tanggal berlaku awal.',
        'overlap'                        => 'Profil aktif ":name" (:from sampai :to) tumpang-tindih dengan rentang berlaku profil ini.',
        'not_draft'                      => 'Profil berstatus :status tidak dapat diubah; buat versi baru.',
        'not_active'                     => 'Hanya profil aktif yang dapat dipensiunkan (status saat ini: :status).',
        'role_required'                  => 'Peran tidak boleh kosong.',
        'account_problem'                => 'Akun :account untuk peran ":role" tidak dapat dipakai: :reason.',
        'rule_duplicate'                 => 'Aturan dengan kondisi yang sama untuk peran ":role" sudah ada pada profil ini.',
        'rule_item_condition_role'       => 'Peran ":role" bukan peran peka-barang; kondisi atribut barang hanya boleh untuk peran peka-barang.',
        'rule_unknown_document_type'     => 'Jenis dokumen ":type" tidak dikenal.',
        'rule_invalid_variant'           => 'Varian ":variant" tidak valid; gunakan normal atau return.',
        'version_starts_before_previous' => 'Tanggal berlaku versi baru harus setelah tanggal berlaku profil sebelumnya (:from).',
        'version_ends_before_previous'   => 'Tanggal berakhir versi baru tidak boleh lebih awal dari tanggal berakhir profil sebelumnya (:to); selisihnya menjadi celah tanpa profil aktif.',
        'field_too_long'                 => 'Isian :field melebihi :max karakter.',
        'delete_referenced'              => 'Profil draft ini menjadi dasar versi baru lain dan tidak dapat dihapus; hapus versi barunya lebih dulu.',
        'rule_negative_priority'         => 'Prioritas tidak boleh negatif.',
        'rule_priority_too_large'        => 'Prioritas tidak boleh melebihi :max.',
        'version_not_contiguous'         => 'Versi baru harus mulai pada :from, sehari setelah profil sebelumnya berakhir, agar tidak ada tanggal tanpa profil aktif.',
        'rule_invalid_item_type'         => 'Tipe barang ":type" tidak dikenal; gunakan salah satu dari :allowed.',
        'rule_unknown_category'          => 'Kategori barang pada aturan tidak ditemukan.',
        'unknown_input'                  => 'Isian ":field" tidak dikenal dan ditolak.',
        'unknown_role'                   => 'Peran ":role" tidak ada dalam katalog peran akun.',
        'copy_draft'                     => 'Profil draft tidak dapat disalin; ubah draft tersebut langsung atau aktifkan lebih dulu.',
    ],

    'warnings' => [
        'retire_gap' => 'Setelah profil ini dipensiunkan, tidak ada profil aktif untuk :from s.d. :to; posting pada tanggal itu akan gagal sampai profil lain diaktifkan.',
    ],

    'new' => 'Profil Baru',

    'list' => [
        'empty'    => 'Belum ada Posting Profile.',
        'add'      => 'Profil Baru',
        'range'    => ':from s.d. :to',
        'mapped'   => ':count peran terpetakan',
        'open'     => 'Buka',
        'subtitle' => 'Akun default per peran untuk seluruh perusahaan, berlaku pada rentang tanggal.',
    ],

    'form' => [
        'general'                  => 'Informasi Profil',
        'roles_description'        => 'Pilih akun default untuk tiap peran. Hanya akun non-grup yang aktif yang dapat dipilih.',
        'role_master_hint'         => 'Biasanya disuplai akun master; akun di sini hanya cadangan.',
        'role_line_sensitive_hint' => 'Dievaluasi per baris barang; dapat dikecualikan oleh aturan bersyarat.',
        'account_placeholder'      => 'Pilih akun',
        'rules_read_only'          => 'Aturan ditampilkan baca-saja. Salin versi untuk membawa aturan ke versi baru.',
        'rules_empty'              => 'Belum ada aturan akun bersyarat.',
        'any'                      => 'Semua',
        'yes'                      => 'Ya',
        'no'                       => 'Tidak',
        'read_only'                => 'Profil berstatus :status tidak dapat diubah. Buat versi baru untuk mengubah akun.',
        'view_only'                => 'Anda tidak memiliki izin untuk mengubah profil ini.',
        'save'                     => 'Simpan',
        'create'                   => 'Buat Draft',
        'back'                     => 'Kembali ke Daftar',
        'unmapped_cell'            => 'Belum dipetakan',
    ],

    'actions' => [
        'new_version' => 'Buat Versi Baru',
        'activate'    => 'Aktifkan',
        'retire'      => 'Pensiunkan',
        'discard'     => 'Hapus Draft',
    ],

    'new_version' => [
        'title'          => 'Buat Versi Baru',
        'description'    => 'Menyalin akun default dan aturan menjadi draft versi baru. Tanggal berlaku harus bersambung dengan profil sebelumnya.',
        'effective_from' => 'Berlaku Dari',
        'effective_to'   => 'Berlaku Sampai (opsional)',
        'name'           => 'Nama (opsional)',
        'confirm'        => 'Buat Versi',
        'cancel'         => 'Batal',
    ],

    'confirm' => [
        'activate' => [
            'title'       => 'Aktifkan Profil',
            'description' => 'Profil ":name" akan dipakai resolver akun untuk tanggal dalam rentang berlakunya.',
            'confirm'     => 'Aktifkan',
        ],
        'retire' => [
            'title'       => 'Pensiunkan Profil',
            'description' => 'Profil ":name" tidak lagi dipilih resolver. Posting pada tanggal yang tidak dicakup profil aktif lain akan gagal.',
            'confirm'     => 'Pensiunkan',
        ],
        'discard' => [
            'title'       => 'Hapus Draft',
            'description' => 'Draft ":name" beserta akun dan aturannya akan dihapus permanen.',
            'confirm'     => 'Hapus',
        ],
        'cancel' => 'Batal',
    ],

    'unmapped' => [
        'title'   => 'Peran wajib belum terpetakan',
        'note'    => 'Pemeriksaan hanya melihat akun default profil; aturan akun bersyarat tidak dihitung.',
        'message' => ':document: :roles',
    ],

    'retire_warning_title' => 'Peringatan celah tanggal',

    'messages' => [
        'created'         => 'Draft profil ":name" dibuat.',
        'updated'         => 'Profil ":name" disimpan.',
        'discarded'       => 'Draft profil ":name" dihapus.',
        'version_created' => 'Draft versi :version dibuat.',
        'activated'       => 'Profil ":name" diaktifkan.',
        'retired'         => 'Profil ":name" dipensiunkan.',
    ],
];
