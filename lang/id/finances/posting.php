<?php

return [
    'errors' => [
        'unresolved_role'           => 'Peran akun ":role" tidak dapat ditentukan untuk dokumen :document (varian :variant) pada tanggal :date. Lapis yang diperiksa: :layers. Lengkapi Posting Profile atau akun master terkait.',
        'unresolved_role_account'   => 'Akun untuk peran ":role" (dokumen :document, varian :variant, tanggal :date) tidak dapat dipakai: :reason (:account). Sumber akun: :layer.',
        'unresolved_role_ambiguous' => 'Peran akun ":role" (dokumen :document, varian :variant, tanggal :date) ambigu pada fallback legacy: :candidates akun cocok dengan :root/:type dan tidak ada yang dipilih. Petakan peran ini pada Posting Profile.',
        'unknown_document_type'     => 'Jenis dokumen posting ":type" tidak memiliki aturan posting terdaftar.',
        'switch_mode_forbidden'     => 'Anda tidak memiliki izin untuk mengubah mode posting engine.',
        'partial_posting'           => 'Posting sebagian untuk :source: jurnal :existing sudah ada, :missing belum ada. Diperlukan intervensi manual.',
    ],

    'layers' => [
        'master'               => 'akun master',
        'rules'                => 'aturan akun bersyarat',
        'profile'              => 'akun default profil',
        'legacy'               => 'fallback legacy',
        'master_none'          => 'akun master: tidak ada',
        'rules_none'           => 'aturan akun bersyarat: tidak ada yang cocok',
        'profile_none'         => 'akun default profil: tidak ada profil aktif pada tanggal itu',
        'profile_role_missing' => 'akun default profil ":profile": peran belum dipetakan',
        'legacy_off'           => 'fallback legacy: dimatikan',
        'legacy_no_pair'       => 'fallback legacy: peran tidak memiliki padanan',
        'legacy_no_account'    => 'fallback legacy: tidak ada akun :root/:type',
    ],

    'account_problems' => [
        'not_found' => 'akun tidak ditemukan',
        'deleted'   => 'akun sudah dihapus',
        'group'     => 'akun grup tidak dapat diposting',
        'disabled'  => 'akun dinonaktifkan',
    ],
];
