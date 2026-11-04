<?php

namespace App\Services\Finances\Ledger;

/**
 * Draft yang lolos validasi struktur dan keseimbangan. `totalMinor` = Σdebit = Σkredit dalam minor unit.
 */
final readonly class NormalizedJournal {
    /**
     * @param  list<NormalizedLine>  $lines
     */
    public function __construct(
        public array $lines,
        public int $totalMinor,
        public int $minorUnit,
    ) {}

    /**
     * @return list<string>
     */
    public function accountIds(): array {
        return array_values(array_unique(array_map(fn (NormalizedLine $line) => $line->draft->accountId, $this->lines)));
    }
}
