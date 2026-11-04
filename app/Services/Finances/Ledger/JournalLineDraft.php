<?php

namespace App\Services\Finances\Ledger;

use Illuminate\Database\Eloquent\Model;

/**
 * Satu baris draft jurnal. Tepat satu dari `debit`/`credit` yang bernilai > 0 (Requirement 2.4). Nilai dapat berupa
 * float, integer, atau string numerik; `JournalService` membulatkannya ke minor unit mata uang dasar.
 *
 * `partyType`/`partyId` adalah representasi mentah pihak (`partyable_*`) untuk jalur yang tidak memegang modelnya,
 * mis. reversal yang menyalin baris jurnal asal; `party` didahulukan bila keduanya diisi.
 */
final readonly class JournalLineDraft {
    public function __construct(
        public string $accountId,
        public float|int|string $debit = 0,
        public float|int|string $credit = 0,
        public ?Model $party = null,
        public ?string $description = null,
        public ?string $againstAccountId = null,
        public ?string $partyType = null,
        public ?string $partyId = null,
    ) {}
}
