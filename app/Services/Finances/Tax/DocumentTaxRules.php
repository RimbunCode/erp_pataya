<?php

namespace App\Services\Finances\Tax;

use App\Exceptions\Finances\NoEffectiveTaxRuleException;
use App\Exceptions\Finances\StaleTaxRuleVersionException;
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
     * @param  iterable<int|string, array<string, mixed>>  $rows  baris request; pajaknya di `taxes.*.id` (atau `tax.id` tunggal, dinormalisasi `ItemTaxSelection::rowTaxes()`)
     * @param  array<string, Tax>  $taxes  pajak yang termuat per id (pajak yang tak termuat tidak punya versi)
     * @param  mixed  $date  tanggal dokumen (string, `DateTimeInterface`) atau null untuk hari ini
     * @return array<string, TaxRuleVersion> versi berlaku per `tax_id`
     *
     * @throws ValidationException bila sebuah pajak tak punya versi berlaku pada tanggal dokumen (kunci `items.{i}.taxes.{j}`).
     *                             Versi SEMUA pajak semua baris di-resolve lebih dulu, sebelum penulis memulai apa pun.
     */
    public function resolveForRows(iterable $rows, array $taxes, mixed $date): array {
        $day = $date instanceof CarbonInterface ? $date : CarbonImmutable::parse($date ?? 'now');

        $rules = [];
        foreach ($rows as $index => $row) {
            foreach (ItemTaxSelection::rowTaxIds((array) $row) as $position => $taxId) {
                if (isset($rules[$taxId]) || ! isset($taxes[$taxId])) {
                    continue;
                }

                try {
                    $rules[$taxId] = $this->resolver->resolve($taxes[$taxId], $day);
                } catch (NoEffectiveTaxRuleException $e) {
                    throw ValidationException::withMessages(["items.{$index}.taxes.{$position}" => $e->getMessage()]);
                }
            }
        }

        return $rules;
    }

    /**
     * Parameter hitung per pajak untuk alokasi diskon dokumen: tarif dan faktor DPP dari versi aturan, serta apakah
     * pajak menambah total (`additive`) atau dipotong (`withholding`, Requirement 12.4). Faktor dan tarif TIDAK
     * pernah konstanta pada jalur simpan: bila `$rules` tak memuat pajak itu (hanya terjadi pada validasi pra-simpan
     * lewat `resolveForRowsLeniently()`), tarif jatuh ke `taxes.rate` dan faktor ke 11/12 agar pemeriksaan toleransi
     * tidak gagal karena aturan pajak; service menggagalkan permintaan sebelum sampai sini (Q-P3-5).
     *
     * @param  array<string, TaxRuleVersion>  $rules  hasil `resolveForRows()`
     * @param  array<string, Tax>  $taxes
     * @return array<string, array{rate: float, dpp_factor: float, additive: bool}>
     */
    public function lineParameters(array $rules, array $taxes): array {
        $parameters = [];
        foreach ($taxes as $taxId => $tax) {
            $rule = $rules[$taxId] ?? null;

            $parameters[$taxId] = [
                'rate'       => $rule !== null ? (float) $rule->rate : (float) $tax->rate,
                'dpp_factor' => $rule !== null
                    ? (int) $rule->dpp_numerator / max(1, (int) $rule->dpp_denominator)
                    : TaxRuleVersion::LEGACY_DPP_NUMERATOR / TaxRuleVersion::LEGACY_DPP_DENOMINATOR,
                'additive' => $tax->behavior !== Tax::BEHAVIOR_WITHHOLDING,
            ];
        }

        return $parameters;
    }

    /**
     * Versi berlaku per pajak untuk baris request, tanpa melempar: pajak tanpa versi berlaku dilewati. Dipakai
     * pemeriksaan pra-simpan (toleransi penagihan) yang tidak boleh gagal karena aturan pajak; kegagalan sebenarnya
     * ditegakkan service saat menyimpan.
     *
     * @param  iterable<int|string, array<string, mixed>>  $rows
     * @param  array<string, Tax>  $taxes
     * @return array<string, TaxRuleVersion>
     */
    public function resolveForRowsLeniently(iterable $rows, array $taxes, mixed $date): array {
        $day = $date instanceof CarbonInterface ? $date : CarbonImmutable::parse($date ?? 'now');

        $rules = [];
        foreach ($rows as $row) {
            foreach (ItemTaxSelection::rowTaxIds((array) $row) as $taxId) {
                if (isset($rules[$taxId]) || ! isset($taxes[$taxId])) {
                    continue;
                }

                try {
                    $rules[$taxId] = $this->resolver->resolve($taxes[$taxId], $day);
                } catch (NoEffectiveTaxRuleException) {
                    continue;
                }
            }
        }

        return $rules;
    }

    /**
     * Versi aturan (active dan retired) untuk form invoice di klien: pratinjau dan keputusan menampilkan kolom DPP
     * (Requirement 12.8) memakai faktor/tarif/perilaku dari sini, bukan konstanta klien. Versi `retired` ikut dikirim
     * karena dokumen yang sudah disimpan menampilkan versi yang dipakainya; pajak yang sudah dihapus tetap terbaca.
     *
     * @return list<array{id: string, tax_id: string, status: string, effective_from: string, effective_to: string|null, rate: float, dpp_numerator: int, dpp_denominator: int, behavior: string}>
     */
    public function versionsForClient(): array {
        return TaxRuleVersion::query()
            ->whereIn('status', [TaxRuleVersion::STATUS_ACTIVE, TaxRuleVersion::STATUS_RETIRED])
            ->with(['tax' => fn ($query) => $query->withTrashed()])
            ->get()
            ->map(fn (TaxRuleVersion $version): array => [
                'id'              => $version->getKey(),
                'tax_id'          => $version->tax_id,
                'status'          => $version->status,
                'effective_from'  => $version->effective_from->toDateString(),
                'effective_to'    => $version->effective_to?->toDateString(),
                'rate'            => (float) $version->rate,
                'dpp_numerator'   => (int) $version->dpp_numerator,
                'dpp_denominator' => (int) $version->dpp_denominator,
                'behavior'        => $version->tax?->behavior ?? Tax::BEHAVIOR_ADDITIVE,
            ])
            ->values()
            ->all();
    }

    /**
     * Approve ditolak bila versi aturan yang berlaku pada tanggal dokumen berbeda dari versi tersimpan pada item
     * (keputusan pemilik produk 28 November 2026): angka item dihitung saat simpan dan tidak dihitung ulang saat
     * approve, jadi dokumen harus disimpan ulang dulu. Item tanpa `tax_rule_version_id` (data legacy Bagian A) dilewati.
     *
     * Pajak majemuk: SEMUA baris pajak item (relasi `taxLines`) diperiksa, bukan hanya Pajak Utama. Item tanpa baris
     * pivot (data sebelum migrasi backfill) memakai kolom item `tax_id`/`tax_rule_version_id`.
     *
     * @param  iterable<int|string, object>  $items  objek dengan `tax_id` dan `tax_rule_version_id` (model item: juga `taxLines`)
     *
     * @throws StaleTaxRuleVersionException
     */
    public function assertStoredVersionsCurrent(iterable $items, mixed $date): void {
        $day = $date instanceof CarbonInterface ? $date : CarbonImmutable::parse($date ?? 'now');

        $pairs = [];
        foreach ($items as $item) {
            foreach (InvoiceItemTaxLines::of($item) as $line) {
                $pairs[] = [$line['tax_id'], $line['tax_rule_version_id']];
            }
        }

        $checked = [];
        foreach ($pairs as [$taxId, $versionId]) {
            if (! filled($taxId) || ! filled($versionId) || isset($checked[$taxId . '|' . $versionId])) {
                continue;
            }
            $checked[$taxId . '|' . $versionId] = true;

            $name = (string) Tax::query()->withTrashed()->whereKey($taxId)->value('name');

            try {
                $effective = $this->resolver->resolve((string) $taxId, $day);
            } catch (NoEffectiveTaxRuleException) {
                throw new StaleTaxRuleVersionException($name !== '' ? $name : (string) $taxId, $day->toDateString());
            }

            if ((string) $effective->getKey() !== (string) $versionId) {
                throw new StaleTaxRuleVersionException($name !== '' ? $name : (string) $taxId, $day->toDateString());
            }
        }
    }
}
