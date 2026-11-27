<?php

namespace App\Services\Finances\Tax;

use App\Exceptions\Finances\NoEffectiveTaxRuleException;
use App\Models\Finances\Tax;
use App\Models\Finances\TaxRuleVersion;
use Carbon\CarbonInterface;

/**
 * Memilih versi aturan pajak yang berlaku pada tanggal transaksi (Finance Fase 3, Requirement 3).
 *
 * Deterministik: versi `active` dengan `effective_from <= tanggal <= effective_to (atau tanpa batas akhir)`,
 * terurut `effective_from` menurun (versi `active` tidak pernah beririsan, jadi paling banyak satu hasil; urutan
 * hanya pengaman). Tidak ada versi berlaku → `NoEffectiveTaxRuleException` (gagal tertutup, tanpa tarif tebakan).
 *
 * Hasil di-cache per `(tax_id, tanggal)` selama satu request/job (instans ini didaftarkan `scoped`). Perubahan
 * status versi lewat `TaxRuleVersionService` memanggil `flush()`.
 *
 * Tanggal yang dipakai pemanggil untuk invoice adalah tanggal dokumen, bukan `now()` (Requirement 3.4); resolver
 * hanya memakai tanggal kalender dari `$date` apa adanya.
 */
final class TaxRuleResolver {
    /** @var array<string, TaxRuleVersion> */
    private array $cache = [];

    /** @var array<string, bool> */
    private array $hasVersions = [];

    /** @var array<string, TaxRuleVersion|null> */
    private array $versionsById = [];

    /** @var array<string, Tax|null> */
    private array $taxesById = [];

    /**
     * @throws NoEffectiveTaxRuleException
     */
    public function resolve(Tax|string $tax, CarbonInterface $date): TaxRuleVersion {
        $taxId = $tax instanceof Tax ? (string) $tax->getKey() : $tax;
        $day   = $date->toDateString();
        $key   = $taxId . '|' . $day;

        if (isset($this->cache[$key])) {
            return $this->cache[$key];
        }

        $version = TaxRuleVersion::query()
            ->where('tax_id', $taxId)
            ->where('status', TaxRuleVersion::STATUS_ACTIVE)
            ->whereDate('effective_from', '<=', $day)
            ->where(fn ($query) => $query->whereNull('effective_to')->orWhereDate('effective_to', '>=', $day))
            ->orderByDesc('effective_from')
            ->with(['tax' => fn ($query) => $query->withTrashed()])
            ->first();

        if ($version === null) {
            $name = $tax instanceof Tax ? $tax->name : (string) Tax::query()->withTrashed()->whereKey($taxId)->value('name');

            throw new NoEffectiveTaxRuleException($taxId, $name !== '' ? $name : $taxId, $day);
        }

        return $this->cache[$taxId . '|' . $day] = $version;
    }

    /**
     * Apakah pajak punya versi aturan apa pun (status berapa pun). Dipakai untuk membedakan "belum pernah
     * dibackfill" dari "tidak ada versi berlaku pada tanggal itu".
     */
    public function hasAnyVersion(Tax|string $tax): bool {
        $taxId = $tax instanceof Tax ? (string) $tax->getKey() : $tax;

        return $this->hasVersions[$taxId] ??= TaxRuleVersion::query()->where('tax_id', $taxId)->exists();
    }

    /**
     * Versi menurut id (status berapa pun), untuk memverifikasi/menjelaskan snapshot dokumen lama. Null bila versi
     * tidak ada lagi. Pajak induk dimuat termasuk yang terhapus lunak.
     */
    public function findVersion(string $versionId): ?TaxRuleVersion {
        if (! \array_key_exists($versionId, $this->versionsById)) {
            $this->versionsById[$versionId] = TaxRuleVersion::query()
                ->with(['tax' => fn ($query) => $query->withTrashed()])
                ->find($versionId);
        }

        return $this->versionsById[$versionId];
    }

    /**
     * Pajak menurut id termasuk yang terhapus lunak (dokumen lama masih merujuknya).
     */
    public function findTax(string $taxId): ?Tax {
        if (! \array_key_exists($taxId, $this->taxesById)) {
            $this->taxesById[$taxId] = Tax::query()->withTrashed()->find($taxId);
        }

        return $this->taxesById[$taxId];
    }

    /**
     * Membuang cache (dipanggil setelah versi diaktifkan/dipensiunkan/diubah dalam request yang sama).
     */
    public function flush(): void {
        $this->cache        = [];
        $this->hasVersions  = [];
        $this->versionsById = [];
        $this->taxesById    = [];
    }
}
