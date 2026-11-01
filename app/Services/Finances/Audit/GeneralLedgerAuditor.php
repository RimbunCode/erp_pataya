<?php

namespace App\Services\Finances\Audit;

use Illuminate\Database\Connection;
use Illuminate\Support\Facades\DB;

/**
 * Audit read-only integritas `general_ledgers` (Finance Fase 0). Hanya `SELECT`; tidak ada tulis ke database.
 */
final class GeneralLedgerAuditor {
    public function __construct(private float $tolerance = 0.005, private ?string $connection = null) {}

    /**
     * @param  array{limit?: int}  $options
     */
    public function run(array $options = []): AuditReport {
        $limit = max(1, (int) ($options['limit'] ?? 20));

        /** @var Connection $db */
        $db = DB::connection($this->connection);

        $integrity   = new IntegrityChecks($db, $this->tolerance);
        $reference   = new ReferenceChecks($db);
        $softDeleted = $reference->softDeleted($limit);

        return new AuditReport(
            generatedAt: now()->toIso8601String(),
            totals: $integrity->totals(),
            sections: [
                'unbalanced_groups'       => $integrity->unbalancedGroups($limit),
                'zero_or_negative'        => $integrity->zeroOrNegative($limit),
                'soft_deleted_expected'   => $softDeleted['expected'],
                'soft_deleted_unexpected' => $softDeleted['unexpected'],
                'dangling_account'        => $integrity->danglingAccounts($limit),
                'orphan_reference'        => $reference->orphanReferences($limit),
                'canceled_active_gl'      => $reference->canceledWithActiveLedger($limit),
                'duplicates'              => $integrity->duplicates($limit),
            ],
            coverage: (new DocumentCoverageMatrix($db))->build(),
        );
    }
}
