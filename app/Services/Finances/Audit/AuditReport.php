<?php

namespace App\Services\Finances\Audit;

/**
 * Hasil `GeneralLedgerAuditor::run()`: struktur laporan yang dirender ke konsol dan/atau JSON.
 */
final class AuditReport {
    /**
     * @param  array<string, mixed>  $totals
     * @param  array<string, array<string, mixed>>  $sections
     * @param  list<array<string, mixed>>  $coverage
     */
    public function __construct(
        public readonly string $generatedAt,
        public readonly array $totals,
        public readonly array $sections,
        public readonly array $coverage,
    ) {}

    /**
     * @return array{generated_at: string, totals: array<string, mixed>, sections: array<string, array<string, mixed>>, coverage: list<array<string, mixed>>}
     */
    public function toArray(): array {
        return [
            'generated_at' => $this->generatedAt,
            'totals'       => $this->totals,
            'sections'     => $this->sections,
            'coverage'     => $this->coverage,
        ];
    }

    public function toJson(): string {
        return json_encode($this->toArray(), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    }
}
