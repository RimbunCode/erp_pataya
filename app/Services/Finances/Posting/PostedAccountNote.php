<?php

namespace App\Services\Finances\Posting;

/**
 * Satu catatan akun yang dipakai engine saat me-resolve peran (Finance Fase 2, Requirement 13.2, Task 12.1): peran,
 * akun hasil resolve, dan baris dokumen sumber bila perannya per baris. Dicatat per baris peran SEBELUM baris
 * digabung per sisi dan akun, sehingga akun tiap baris dokumen tetap dapat ditulis balik.
 */
final readonly class PostedAccountNote {
    public function __construct(
        public string $purpose,
        public string $role,
        public string $accountId,
        public ?string $lineId = null,
    ) {}
}
