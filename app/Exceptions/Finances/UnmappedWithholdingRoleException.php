<?php

namespace App\Exceptions\Finances;

use RuntimeException;

/**
 * Dokumen memuat pajak potong (withholding) tetapi peran `withholding_receivable`/`withholding_payable` belum
 * dipetakan pada Posting Profile yang berlaku (Finance Fase 3, Bagian B; keputusan pemilik produk 28 November 2026).
 * Approve ditolak sebelum commit supaya dokumen tidak berakhir dengan posting gagal.
 */
class UnmappedWithholdingRoleException extends RuntimeException {
    public function __construct(public readonly string $role, public readonly string $amount, public readonly string $date) {
        parent::__construct(__('finances/posting.errors.withholding_role_unmapped', ['role' => $role, 'amount' => $amount, 'date' => $date]));
    }
}
