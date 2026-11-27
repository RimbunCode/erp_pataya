<?php

namespace App\Services\Finances\Accounting;

use App\Enums\AccountRole;
use App\Exceptions\Finances\UnmappedWithholdingRoleException;
use App\Services\Finances\Posting\AccountRoleResolver;
use Carbon\CarbonInterface;

/**
 * Pemeriksaan saat approve invoice (sebelum commit): dokumen yang memuat pajak potong butuh peran
 * `withholding_receivable` (penjualan) / `withholding_payable` (pembelian) terpetakan pada Posting Profile yang
 * berlaku (Finance Fase 3, Bagian B; keputusan pemilik produk 28 November 2026). Tanpa ini posting gagal setelah
 * dokumen sudah berstatus approved.
 */
final class WithholdingRoleGuard {
    public function __construct(private readonly AccountRoleResolver $roles) {}

    /**
     * @throws UnmappedWithholdingRoleException
     */
    public function assertMapped(AccountRole $role, float $withholdingTotal, CarbonInterface $at): void {
        if ($withholdingTotal <= 0.0) {
            return;
        }

        if (! $this->roles->isMappedOnProfile($role, $at)) {
            throw new UnmappedWithholdingRoleException($role->value, number_format($withholdingTotal, 2, '.', ''), $at->toDateString());
        }
    }
}
