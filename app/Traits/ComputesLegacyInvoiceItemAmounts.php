<?php

namespace App\Traits;

use App\Models\Finances\Tax;
use App\Models\Finances\TaxRuleVersion;
use App\Services\Finances\Tax\TaxRuleResolver;

/**
 * Jaring pengaman legacy untuk `dpp_amount`/`tax_amount` (dan `amount` pada Purchase Invoice) item invoice
 * (Finance Fase 3, Bagian B, Requirement 12.2-12.3).
 *
 * Sebelum konversi kolom itu *generated* di database: setiap penulis (seeder, fixture tes, jalur lain) otomatis
 * mendapat `dpp = (basic - diskon) x faktor`, `tax = dpp x tarif / 100`, `amount = (basic - diskon) + tax`. Sesudah
 * konversi kolom itu biasa dan diisi `TaxEngine` oleh service invoice (yang menandai model dengan
 * `markAmountsComputed()` sehingga hook ini tidak menimpanya). Penulis lain yang tidak mengisi nilai itu secara
 * eksplisit tetap mendapat angka yang sama dengan perilaku generated lama (faktor 11/12 bila baris tak punya
 * `tax_rule_version_id`, faktor versi bila punya), tanpa pembulatan, supaya tidak ada nilai nol diam-diam.
 *
 * Selaras dengan service (keputusan pemilik 28 November 2026): baris tanpa `tax_id` menyimpan dpp/pajak 0, dan pajak
 * berperilaku `withholding` ditulis ke `withholding_amount` (bukan `tax_amount`).
 *
 * Hook hanya berjalan bila tidak ada nilai hitung yang diisi eksplisit dan salah satu masukannya (jumlah, harga,
 * diskon, tarif, versi) berubah atau baris baru.
 *
 * Model pengguna mendefinisikan konstanta `LEGACY_PRICE_COLUMN` (`price`/`rate`) dan `LEGACY_HAS_AMOUNT_COLUMN`.
 */
trait ComputesLegacyInvoiceItemAmounts {
    private bool $amountsComputedExternally = false;

    public static function bootComputesLegacyInvoiceItemAmounts(): void {
        static::saving(function (self $item): void {
            $item->fillLegacyAmounts();
        });
    }

    /**
     * Service yang mengisi nilai hitung lewat `TaxEngine` menandai model agar `saving` tidak menimpanya, juga ketika
     * nilai baru kebetulan sama dengan nilai lama (atribut tidak dirty).
     */
    public function markAmountsComputed(): static {
        $this->amountsComputedExternally = true;

        return $this;
    }

    private function fillLegacyAmounts(): void {
        if ($this->amountsComputedExternally) {
            $this->amountsComputedExternally = false;

            return;
        }

        $outputs = static::LEGACY_HAS_AMOUNT_COLUMN ? ['dpp_amount', 'tax_amount', 'amount', 'withholding_amount'] : ['dpp_amount', 'tax_amount', 'withholding_amount'];
        if ($this->isDirty($outputs)) {
            return;
        }

        $inputs = ['quantity', static::LEGACY_PRICE_COLUMN, 'discount_amount', 'tax_rate', 'tax_rule_version_id', 'tax_id'];
        if ($this->exists && ! $this->isDirty($inputs)) {
            return;
        }

        $basic     = (float) $this->getAttribute('quantity') * (float) $this->getAttribute(static::LEGACY_PRICE_COLUMN);
        $net       = $basic - (float) $this->getAttribute('discount_amount');
        $versionId = $this->getAttribute('tax_rule_version_id');
        $version   = blank($versionId) ? null : app(TaxRuleResolver::class)->findVersion((string) $versionId);
        $factor    = $version === null
            ? TaxRuleVersion::LEGACY_DPP_NUMERATOR / TaxRuleVersion::LEGACY_DPP_DENOMINATOR
            : (int) $version->dpp_numerator / max(1, (int) $version->dpp_denominator);

        $taxId = $this->getAttribute('tax_id');
        if (blank($taxId) && (float) $this->getAttribute('tax_rate') <= 0.0) {
            $dpp         = 0.0;
            $tax         = 0.0;
            $withholding = 0.0;
        } else {
            $dpp         = $net * $factor;
            $amount      = $dpp * (float) $this->getAttribute('tax_rate') / 100;
            $isWithheld  = filled($taxId) && Tax::withTrashed()->whereKey($taxId)->value('behavior') === Tax::BEHAVIOR_WITHHOLDING;
            $tax         = $isWithheld ? 0.0 : $amount;
            $withholding = $isWithheld ? $amount : 0.0;
        }

        $this->setAttribute('dpp_amount', $dpp);
        $this->setAttribute('tax_amount', $tax);
        $this->setAttribute('withholding_amount', $withholding);
        if (static::LEGACY_HAS_AMOUNT_COLUMN) {
            $this->setAttribute('amount', $net + $tax);
        }
    }
}
