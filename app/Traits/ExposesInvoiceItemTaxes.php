<?php

namespace App\Traits;

/**
 * Atribut cetak pajak majemuk per item invoice (`tax_names`, `tax_rates`; spek finance-multi-tax-per-item,
 * Requirement 11.3). Hanya terisi bila relasi `taxes` sudah dimuat (null bila belum, tanpa query tambahan, supaya
 * serialisasi item tidak memicu N+1). Item lama tanpa baris pivot jatuh ke relasi `tax` (Pajak Utama) bila dimuat.
 * Dipakai `SalesInvoiceItem` dan `PurchaseInvoiceItem`.
 */
trait ExposesInvoiceItemTaxes {
    /** Nama pajak dipisah koma menurut urutan (Pajak Utama lebih dulu). */
    public function getTaxNamesAttribute(): ?string {
        $rows = $this->taxDisplayRows();

        return $rows === null ? null : implode(', ', array_column($rows, 'name'));
    }

    /** Tarif pajak dipisah koma menurut urutan yang sama dengan `tax_names`, mis. `12%, 2%`. */
    public function getTaxRatesAttribute(): ?string {
        $rows = $this->taxDisplayRows();

        return $rows === null ? null : implode(', ', array_map(
            static fn (array $row): string => rtrim(rtrim(number_format((float) $row['rate'], 4, '.', ''), '0'), '.') . '%',
            $rows,
        ));
    }

    /**
     * @return list<array{name: string, rate: float}>|null
     */
    private function taxDisplayRows(): ?array {
        if ($this->relationLoaded('taxes') && $this->taxes->isNotEmpty()) {
            return $this->taxes->map(static fn ($tax): array => [
                'name' => (string) $tax->name,
                'rate' => (float) ($tax->pivot?->tax_rate ?? $tax->rate),
            ])->values()->all();
        }

        if ($this->relationLoaded('tax') && $this->tax !== null) {
            return [['name' => (string) $this->tax->name, 'rate' => (float) ($this->tax_rate ?: $this->tax->rate)]];
        }

        return $this->relationLoaded('taxes') ? [] : null;
    }
}
