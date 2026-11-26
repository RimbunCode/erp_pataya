<?php

namespace App\Services\Finances\Posting\AccountPanel;

/**
 * Satu akun yang tercatat pada dokumen (kolom catatan akun), untuk panel "Akun pencatatan" (Finance Fase 2, Task 12.4).
 * `lines` = jumlah baris dokumen yang memakai akun itu (0 untuk peran tingkat dokumen).
 */
final readonly class RecordedAccount {
    public function __construct(
        public string $role,
        public string $accountId,
        public int $lines = 0,
    ) {}
}
