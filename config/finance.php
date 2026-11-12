<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Ambang pengaman konversi presisi general_ledgers (Finance Fase 1, Task 8.3)
    |--------------------------------------------------------------------------
    |
    | Migration `convert_general_ledgers_amounts_to_decimal` menolak jalan bila ada baris dengan
    | |ROUND(x,4) - x| lebih besar dari ambang ini pada `debit` atau `credit` (konversi `double` ke
    | `decimal(20,4)` akan membulatkannya). Default 1e-9 setara `hit_ketat` pada
    | `finance:check-ledger-precision` (Requirement 13.1). Ambang yang lebih longgar (mis. 1e-5 = `hit_bermakna`,
    | untuk nilai sangat besar dengan derau double) hanya boleh ditetapkan oleh pemilik produk setelah meninjau
    | hasil pra-pemeriksaan.
    */
    'ledger_precision_guard_threshold' => (float) env('FINANCE_LEDGER_PRECISION_GUARD_THRESHOLD', 1e-9),

    /*
    |--------------------------------------------------------------------------
    | Posting Engine (Finance Fase 2)
    |--------------------------------------------------------------------------
    |
    | legacy_account_fallback: lapis terakhir `AccountRoleResolver` (Requirement 3.1.4): bila tidak ada akun master,
    | aturan bersyarat, maupun akun default profil, peran dicari lewat pasangan lama (root_type, account_type) dengan
    | peringatan log. Aktif selama transisi; dimatikan pada penutupan fase (Task 14.1).
    |
    | parity_retention_days: retensi `posting_parity_logs` untuk `finance:prune-parity-logs` (Requirement 11.4).
    */
    'posting' => [
        'legacy_account_fallback' => (bool) env('FINANCE_POSTING_LEGACY_ACCOUNT_FALLBACK', true),
        'parity_retention_days'   => (int) env('FINANCE_POSTING_PARITY_RETENTION_DAYS', 90),
    ],
];
