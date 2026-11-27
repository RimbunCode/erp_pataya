<?php

namespace App\Services\Finances\Tax;

/**
 * Satu komponen hasil perhitungan pajak untuk satu baris (Finance Fase 3, Requirement 4.2). Angka bertipe string
 * desimal agar serialisasi stabil dan bebas drift floating point. `ruleVersionId` null berarti komponen legacy
 * (invoice yang dibuat sebelum fase ini, Requirement 5.5).
 *
 * Tax Engine tidak mengetahui akun: `roleOutput`/`roleInput` adalah kunci peran Posting Profile yang dipetakan
 * Posting Engine (Requirement 4.5).
 */
final readonly class TaxComponent {
    /**
     * @param  list<string>  $warnings  kode peringatan (mis. `persisted_vs_engine_mismatch`)
     */
    public function __construct(
        public string $taxId,
        public string $taxName,
        public string $category,
        public string $behavior,
        public ?string $ruleVersionId,
        public string $baseAmount,
        public string $dppFactor,
        public string $dppAmount,
        public string $rate,
        public string $taxAmount,
        public string $roleOutput,
        public string $roleInput,
        public bool $isCreditable,
        public string $roundingAdjustment = '0',
        public array $warnings = [],
        public ?string $lineRef = null,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array {
        return [
            'tax_id'              => $this->taxId,
            'tax_name'            => $this->taxName,
            'category'            => $this->category,
            'behavior'            => $this->behavior,
            'rule_version_id'     => $this->ruleVersionId,
            'base_amount'         => $this->baseAmount,
            'dpp_factor'          => $this->dppFactor,
            'dpp_amount'          => $this->dppAmount,
            'rate'                => $this->rate,
            'tax_amount'          => $this->taxAmount,
            'role_output'         => $this->roleOutput,
            'role_input'          => $this->roleInput,
            'is_creditable'       => $this->isCreditable,
            'rounding_adjustment' => $this->roundingAdjustment,
            'warnings'            => $this->warnings,
            'line_ref'            => $this->lineRef,
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public static function fromArray(array $data): self {
        return new self(
            taxId: (string) $data['tax_id'],
            taxName: (string) $data['tax_name'],
            category: (string) $data['category'],
            behavior: (string) $data['behavior'],
            ruleVersionId: isset($data['rule_version_id']) ? (string) $data['rule_version_id'] : null,
            baseAmount: (string) $data['base_amount'],
            dppFactor: (string) $data['dpp_factor'],
            dppAmount: (string) $data['dpp_amount'],
            rate: (string) $data['rate'],
            taxAmount: (string) $data['tax_amount'],
            roleOutput: (string) $data['role_output'],
            roleInput: (string) $data['role_input'],
            isCreditable: (bool) $data['is_creditable'],
            roundingAdjustment: (string) ($data['rounding_adjustment'] ?? '0'),
            warnings: array_values(array_map('strval', $data['warnings'] ?? [])),
            lineRef: isset($data['line_ref']) ? (string) $data['line_ref'] : null,
        );
    }

    /**
     * Salinan dengan jumlah pajak dan sisa pembulatan baru (DTO immutable).
     */
    public function withTaxAmount(string $taxAmount, string $roundingAdjustment): self {
        return new self(
            $this->taxId,
            $this->taxName,
            $this->category,
            $this->behavior,
            $this->ruleVersionId,
            $this->baseAmount,
            $this->dppFactor,
            $this->dppAmount,
            $this->rate,
            $taxAmount,
            $this->roleOutput,
            $this->roleInput,
            $this->isCreditable,
            $roundingAdjustment,
            $this->warnings,
            $this->lineRef,
        );
    }

    /**
     * @param  list<string>  $warnings
     */
    public function withWarnings(array $warnings): self {
        return new self(
            $this->taxId,
            $this->taxName,
            $this->category,
            $this->behavior,
            $this->ruleVersionId,
            $this->baseAmount,
            $this->dppFactor,
            $this->dppAmount,
            $this->rate,
            $this->taxAmount,
            $this->roleOutput,
            $this->roleInput,
            $this->isCreditable,
            $this->roundingAdjustment,
            $warnings,
            $this->lineRef,
        );
    }

    /** Komponen legacy: dibangun dari nilai tersimpan tanpa versi aturan. */
    public function isLegacy(): bool {
        return $this->ruleVersionId === null;
    }
}
