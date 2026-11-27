<?php

namespace App\Services\Finances\Tax;

use JsonException;

/**
 * Hasil perhitungan pajak yang dapat dijelaskan dan diverifikasi ulang (Finance Fase 3, Requirement 4.2 dan 4.6).
 * Satu komponen per pasangan (baris, pajak); pengelompokan per `(tax_id, rule_version_id)` untuk jurnal adalah
 * tanggung jawab pabrik konteks dokumen. Dapat diserialisasi ke JSON (`tax_breakdown`) dan dibaca kembali.
 */
final readonly class TaxResult {
    /**
     * @param  list<TaxComponent>  $components
     * @param  list<array<string, mixed>>  $explanation  langkah terstruktur (`key` + parameter) yang dapat dirender UI
     */
    public function __construct(
        public array $components,
        public string $totalAdditive,
        public string $totalWithholding,
        public array $explanation,
        public int $minorUnit = 2,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array {
        return [
            'minor_unit'        => $this->minorUnit,
            'components'        => array_map(fn (TaxComponent $component): array => $component->toArray(), $this->components),
            'total_additive'    => $this->totalAdditive,
            'total_withholding' => $this->totalWithholding,
            'explanation'       => $this->explanation,
        ];
    }

    /**
     * @throws JsonException
     */
    public function toJson(): string {
        return json_encode($this->toArray(), JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public static function fromArray(array $data): self {
        return new self(
            components: array_values(array_map(fn (array $row): TaxComponent => TaxComponent::fromArray($row), $data['components'] ?? [])),
            totalAdditive: (string) ($data['total_additive'] ?? '0'),
            totalWithholding: (string) ($data['total_withholding'] ?? '0'),
            explanation: array_values($data['explanation'] ?? []),
            minorUnit: (int) ($data['minor_unit'] ?? 2),
        );
    }

    /**
     * @throws JsonException
     */
    public static function fromJson(string $json): self {
        $data = json_decode($json, true, 512, JSON_THROW_ON_ERROR);
        if (! \is_array($data)) {
            throw new JsonException('Tax result JSON must decode to an object.');
        }

        return self::fromArray($data);
    }

    /** @return list<string> kode peringatan dari seluruh komponen (tanpa duplikat) */
    public function warnings(): array {
        return array_values(array_unique(array_merge(...array_map(fn (TaxComponent $c): array => $c->warnings, $this->components) ?: [[]])));
    }
}
