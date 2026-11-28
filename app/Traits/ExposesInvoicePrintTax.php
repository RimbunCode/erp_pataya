<?php

namespace App\Traits;

use App\Services\Finances\Tax\InvoicePrintTotals;

/**
 * Atribut tambahan untuk cetak invoice: `withholding_amount` (jumlah pajak potong) dan `printed_dpp_amount` (DPP baris
 * berfaktor selain 1/1, null bila tidak ada). Keduanya hanya terisi bila relasi `items` sudah dimuat.
 */
trait ExposesInvoicePrintTax {
    public function getWithholdingAmountAttribute(): ?float {
        if (! $this->relationLoaded('items')) {
            return null;
        }

        return app(InvoicePrintTotals::class)->withholding($this->items);
    }

    public function getPrintedDppAmountAttribute(): ?float {
        if (! $this->relationLoaded('items')) {
            return null;
        }

        // Baris pajak item (pajak majemuk) dibaca dari pivot; dimuat sekali agar tidak N+1.
        $this->items->loadMissing('taxLines');

        return app(InvoicePrintTotals::class)->dpp($this->items);
    }
}
