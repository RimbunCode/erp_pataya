<?php

namespace App\Exceptions\Finances;

use RuntimeException;

/**
 * Tidak ada versi aturan pajak `active` yang berlaku untuk sebuah pajak pada tanggal tertentu (Finance Fase 3,
 * Requirement 3.2). Resolver gagal tertutup: tidak ada tarif tebakan. Pesan menyebut pajak dan tanggal.
 */
class NoEffectiveTaxRuleException extends RuntimeException {
    public function __construct(public readonly string $taxId, public readonly string $taxName, public readonly string $date) {
        parent::__construct(__('finances/taxRuleVersion.errors.no_effective_rule', ['tax' => $taxName, 'date' => $date]));
    }
}
