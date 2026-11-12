<?php

namespace App\Services\Finances\Posting\Rules;

use App\Enums\AccountRole;
use App\Services\Finances\Posting\RoleJournalDraft;
use App\Services\Finances\Posting\RoleLine;

/**
 * Dasar `PostingRule` Finance Fase 2: pembantu murni (tanpa DB) untuk jurnal dua sisi yang meniru `postPair()` Fase 1.
 * Jumlah nol tidak menghasilkan jurnal (Fase 1 Requirement 2.10); pembulatan ke minor unit dan pembuangan jurnal yang
 * nol setelah pembulatan dilakukan `PostingService`, yang mengetahui mata uang dasar.
 */
abstract class BasePostingRule implements PostingRule {
    /**
     * Ambang nol pada tingkat rule: jumlah yang tepat nol (atau derau float). Sisa pembulatan sub-minor-unit ditangani
     * `PostingService`.
     */
    protected const ZERO = 1e-9;

    protected static function isZero(float $amount): bool {
        return abs($amount) < self::ZERO;
    }

    /**
     * Jurnal dua baris: debit `$debit` dan kredit `$credit` sebesar `$amount`; `$swap` menukar sisi (retur). Null bila
     * jumlah nol.
     */
    protected static function pair(string $purpose, AccountRole $debit, AccountRole $credit, float $amount, bool $swap = false): ?RoleJournalDraft {
        if (self::isZero($amount)) {
            return null;
        }

        if ($swap) {
            [$debit, $credit] = [$credit, $debit];
        }

        return new RoleJournalDraft($purpose, [
            RoleLine::debit($debit, $amount),
            RoleLine::credit($credit, $amount),
        ]);
    }

    /**
     * @param  list<RoleJournalDraft|null>  $drafts
     * @return list<RoleJournalDraft>
     */
    protected static function compact(array $drafts): array {
        return array_values(array_filter($drafts));
    }
}
