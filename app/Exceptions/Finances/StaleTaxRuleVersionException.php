<?php

namespace App\Exceptions\Finances;

use RuntimeException;

/**
 * Versi aturan pajak yang berlaku pada tanggal dokumen berbeda dari versi yang tersimpan pada item invoice
 * (Finance Fase 3, Bagian B; keputusan pemilik produk 28 November 2026). Approve ditolak sebelum commit; pengguna
 * menyimpan ulang draft agar angka dihitung dengan versi yang berlaku.
 */
class StaleTaxRuleVersionException extends RuntimeException {
    public function __construct(public readonly string $taxName, public readonly string $date) {
        parent::__construct(__('finances/taxRuleVersion.errors.stale_rule_version', ['tax' => $taxName, 'date' => $date]));
    }
}
