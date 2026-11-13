<?php

namespace App\Services\Finances\Posting;

/**
 * Hasil `ParityComparator::compare()` (Finance Fase 2, Requirement 6.5-6.6): `status` memakai nilai
 * `PostingParityLog::STATUS_*`; `legacy`/`engine` adalah representasi kanonik per `purpose`; `diff` memuat rincian
 * perbedaan (kosong bila `match`).
 */
final readonly class ParityResult {
    /**
     * @param  array<string, array{date: string, lines: list<array{account_id: string, debit: int, credit: int}>}>  $legacy
     * @param  array<string, array{date: string, lines: list<array{account_id: string, debit: int, credit: int}>}>  $engine
     * @param  array<string, mixed>  $diff
     */
    public function __construct(
        public string $status,
        public array $legacy,
        public array $engine,
        public array $diff = [],
    ) {}
}
