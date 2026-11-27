<?php

namespace App\Services\Finances\Tax;

use App\Exceptions\Finances\NoEffectiveTaxRuleException;
use App\Models\Finances\Tax;
use App\Models\Finances\TaxRuleVersion;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Validation\ValidationException;

/**
 * Versi aturan pajak yang berlaku pada tanggal sebuah dokumen, untuk setiap pajak yang dipakai baris-barisnya
 * (Finance Fase 3, Requirement 3.4 dan 5.2). Dipanggil service dokumen SEBELUM menulis apa pun, supaya pajak tanpa
 * versi berlaku (Q-P3-5: selalu gagal tertutup) menggagalkan permintaan tanpa meninggalkan dokumen setengah jadi.
 *
 * Tidak mengenal model dokumen: pemanggil menyerahkan baris request (`tax.id`), pajak yang sudah dimuat, dan
 * tanggal dokumen.
 */
final class DocumentTaxRules {
    public function __construct(private readonly TaxRuleResolver $resolver) {}

    /**
     * @param  iterable<int|string, array<string, mixed>>  $rows  baris request; pajaknya di `tax.id`
     * @param  array<string, Tax>  $taxes  pajak yang termuat per id (pajak yang tak termuat tidak punya versi)
     * @param  mixed  $date  tanggal dokumen (string, `DateTimeInterface`) atau null untuk hari ini
     * @return array<string, TaxRuleVersion> versi berlaku per `tax_id`
     *
     * @throws ValidationException bila sebuah pajak tak punya versi berlaku pada tanggal dokumen (kunci `items.{i}.tax`)
     */
    public function resolveForRows(iterable $rows, array $taxes, mixed $date): array {
        $day = $date instanceof CarbonInterface ? $date : CarbonImmutable::parse($date ?? 'now');

        $rules = [];
        foreach ($rows as $index => $row) {
            $taxId = $row['tax']['id'] ?? null;
            if (! filled($taxId) || isset($rules[$taxId]) || ! isset($taxes[$taxId])) {
                continue;
            }

            try {
                $rules[$taxId] = $this->resolver->resolve($taxes[$taxId], $day);
            } catch (NoEffectiveTaxRuleException $e) {
                throw ValidationException::withMessages(["items.{$index}.tax" => $e->getMessage()]);
            }
        }

        return $rules;
    }
}
