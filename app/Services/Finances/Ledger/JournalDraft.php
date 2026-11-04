<?php

namespace App\Services\Finances\Ledger;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;

/**
 * Draft jurnal yang diposting `JournalService::post()` (Requirement 2). `source` adalah dokumen sumber; bila null
 * (jurnal manual, Requirement 12), baris jurnal merujuk jurnal itu sendiri sebagai `referenceable`. `postingKey`
 * (`{source_type}:{source_id}:{purpose}`) membuat posting idempoten (Requirement 3).
 *
 * `sourceType`/`sourceId` adalah representasi mentah sumber untuk jalur yang tidak memegang modelnya (reversal yang
 * menyalin sumber jurnal asal, termasuk dokumen yang sudah di-soft-delete); `source` didahulukan bila keduanya diisi.
 */
final readonly class JournalDraft {
    /**
     * @param  list<JournalLineDraft>  $lines
     */
    public function __construct(
        public CarbonInterface $transactionDate,
        public array $lines,
        public ?Model $source = null,
        public ?string $postingKey = null,
        public ?string $branchId = null,
        public ?string $description = null,
        public ?string $sourceType = null,
        public ?string $sourceId = null,
    ) {}

    /**
     * Salinan draft dengan `transactionDate` lain; semua field lain dibawa apa adanya (field baru pada DTO ini
     * hanya perlu ditambahkan di sini, bukan di pemakai).
     */
    public function withTransactionDate(CarbonInterface $transactionDate): self {
        return new self(
            transactionDate: $transactionDate,
            lines: $this->lines,
            source: $this->source,
            postingKey: $this->postingKey,
            branchId: $this->branchId,
            description: $this->description,
            sourceType: $this->sourceType,
            sourceId: $this->sourceId,
        );
    }
}
