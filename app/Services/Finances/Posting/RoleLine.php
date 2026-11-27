<?php

namespace App\Services\Finances\Posting;

use App\Enums\AccountRole;
use App\Services\Finances\Posting\Contexts\LineAttributes;

/**
 * Satu baris jurnal berperan (Finance Fase 2, Requirement 4.2): peran + sisi + jumlah, bukan akun. Retur ditangani
 * Posting Rule dengan menukar `side`, bukan oleh pemanggil.
 *
 * `$line` diisi untuk peran peka-barang: resolver mengevaluasi aturan akun bersyarat terhadap atribut barang baris
 * itu, lalu `PostingService` menggabungkan baris dengan akun dan sisi yang sama (Requirement 12.4).
 *
 * `$taxRuleVersionId` (Finance Fase 3, Requirement 5.4 dan 7.4) diisi pada baris pajak terpisah dan diteruskan ke
 * `general_ledgers.tax_rule_version_id`; baris dengan versi berbeda tidak digabung walau akunnya sama.
 */
final readonly class RoleLine {
    public const DEBIT  = 'debit';
    public const CREDIT = 'credit';

    public function __construct(
        public AccountRole|string $role,
        public string $side,
        public float|int|string $amount,
        public ?string $description = null,
        public ?LineAttributes $line = null,
        public ?string $taxRuleVersionId = null,
    ) {}

    public static function debit(AccountRole|string $role, float|int|string $amount, ?string $description = null, ?LineAttributes $line = null, ?string $taxRuleVersionId = null): self {
        return new self($role, self::DEBIT, $amount, $description, $line, $taxRuleVersionId);
    }

    public static function credit(AccountRole|string $role, float|int|string $amount, ?string $description = null, ?LineAttributes $line = null, ?string $taxRuleVersionId = null): self {
        return new self($role, self::CREDIT, $amount, $description, $line, $taxRuleVersionId);
    }

    public function roleValue(): string {
        return $this->role instanceof AccountRole ? $this->role->value : $this->role;
    }
}
