<?php

namespace App\Services\Finances;

use App\Enums\FormStatus;
use App\Models\Finances\Tax;
use App\Services\Core\Setting\CurrencyMatcher;
use Closure;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\ValidationException;

/**
 * Basis nilai untuk toleransi penagihan berlebih (spec module-defaults-and-controls,
 * Requirement 7.2) agar sama di semua titik pemeriksaan (simpan dan approve, Purchase dan Sales).
 *
 * Basis yang dipakai adalah nilai NETO baris: `basic_amount - discount_amount` (setelah alokasi
 * diskon header). Nilai sumber (PO/SO Item) memakai basis yang sama.
 *
 * Mata uang: bila dokumen sumber dan invoice bermata uang SAMA, nilai dibandingkan apa adanya dalam
 * mata uang dokumen (tanpa kurs, sehingga selisih kurs bukan over-billing). Bila berbeda, nilai
 * dikonversi ke mata uang dasar (nilai x kurs invoicenya). Lihat `billedValues()` untuk akumulasi.
 */
class InvoiceBilledValueResolver {
    /**
     * Nilai neto per baris request (belum dikali kurs): `quantity x harga`, dikurangi bagian diskon
     * header yang dialokasikan memakai `DocumentDiscountCalculator` seperti saat dokumen disimpan,
     * sehingga sama dengan `basic_amount - discount_amount` yang tersimpan.
     *
     * @param  array<int|string, array<string, mixed>>  $rows
     * @param  Closure(array<string, mixed>): float  $priceOf
     * @return array<int|string, float>
     */
    public function netValues(array $rows, Closure $priceOf, mixed $discountOn, mixed $discountRate, mixed $discountAmount, float $dppFactor): array {
        $gross = [];
        foreach ($rows as $index => $row) {
            $gross[$index] = (float) ($row['quantity'] ?? 0) * $priceOf($row);
        }

        if (! \in_array($discountOn, [DocumentDiscountCalculator::BASIS_NET_TOTAL, DocumentDiscountCalculator::BASIS_GRAND_TOTAL], true) || $gross === []) {
            return $gross;
        }

        $taxIds   = collect($rows)->pluck('tax.id')->filter()->unique()->all();
        $taxRates = $taxIds === [] ? collect() : Tax::whereIn('id', $taxIds)->pluck('rate', 'id');
        $indexes  = array_keys($rows);
        $lines    = [];
        foreach ($indexes as $position => $index) {
            $lines[$position] = [
                'basic_amount' => $gross[$index],
                'tax_rate'     => (float) ($taxRates[data_get($rows[$index], 'tax.id')] ?? 0),
            ];
        }

        try {
            $allocated = DocumentDiscountCalculator::allocate($lines, $discountOn, (float) ($discountRate ?? 0), (float) ($discountAmount ?? 0), 'discount_amount', $dppFactor);
        } catch (ValidationException) {
            // Diskon melebihi basis ditolak oleh service saat disimpan; di sini cukup tanpa diskon.
            return $gross;
        }

        $net = [];
        foreach ($indexes as $position => $index) {
            $net[$index] = (float) $allocated[$position]['basic_amount'];
        }

        return $net;
    }

    /**
     * Query baris invoice yang dihitung sebagai tertagih (lihat `billedValues()`).
     *
     * @param  class-string<Model>  $itemClass
     * @param  list<string>  $sourceIds
     * @return Builder<Model>
     */
    public function billedItemsQuery(string $itemClass, string $invoiceRelation, string $sourceColumn, array $sourceIds, ?string $excludeInvoiceId = null, bool $lock = false): Builder {
        return $itemClass::query()
            ->whereIn($sourceColumn, $sourceIds)
            ->whereHas($invoiceRelation, function (Builder $invoice) use ($excludeInvoiceId, $lock): void {
                $invoice
                    ->when($excludeInvoiceId, fn (Builder $query) => $query->whereKeyNot($excludeInvoiceId))
                    ->where(function (Builder $scope): void {
                        $scope->where(function (Builder $billed): void {
                            $billed->whereNull('return_against_id')->where(function (Builder $status): void {
                                $status->whereJsonContains('status', FormStatus::UNPAID->value)
                                    ->orWhereJsonContains('status', FormStatus::PARTIALLY_PAID->value)
                                    ->orWhereJsonContains('status', FormStatus::PAID->value);
                            });
                        })->orWhere(function (Builder $returned): void {
                            $returned->whereNotNull('return_against_id')->whereJsonContains('status', FormStatus::RETURNED->value);
                        });
                    })
                    ->when($lock, fn (Builder $query) => $query->lockForUpdate());
            })
            ->with($invoiceRelation)
            ->when($lock, fn (Builder $query) => $query->lockForUpdate());
    }

    /**
     * Nilai neto yang sudah benar-benar ditagih per baris sumber: baris invoice yang sudah
     * di-approve (status unpaid/partially_paid/paid; draft dan canceled tidak ikut), dikurangi
     * baris retur invoice (status returned) seperti `billed_quantity`.
     *
     * Satuan nilai mengikuti `$sources[sourceId]['in_source_currency']`: true = mata uang dokumen
     * sumber (invoice bermata uang sama dihitung apa adanya; yang berbeda dikonversi lewat mata
     * uang dasar dengan `exchange_rate` sumber), false = mata uang dasar (nilai x kurs invoicenya).
     *
     * `$lock` true dipakai di titik approve (di bawah lock baris sumber). Pada MySQL REPEATABLE READ,
     * SELECT biasa membaca snapshot yang sudah terbentuk sebelum menunggu lock baris sumber, sehingga
     * invoice lain yang baru saja di-approve tidak terlihat dan dua invoice bisa sama-sama lolos
     * melampaui batas nilai. `FOR UPDATE` membaca data terkini. Klausa itu dipasang pada query item
     * DAN pada subquery `whereHas` invoice, karena MySQL tidak mengunci tabel subquery bersarang
     * tanpa klausa locking sendiri. Jalur simpan (request) memanggil tanpa lock.
     *
     * @param  class-string<Model>  $itemClass
     * @param  array<string, array{currency: ?string, exchange_rate: float, in_source_currency: bool}>  $sources
     * @return array<string, float>
     */
    public function billedValues(string $itemClass, string $invoiceRelation, string $sourceColumn, array $sources, ?string $excludeInvoiceId = null, bool $lock = false): array {
        if ($sources === []) {
            return [];
        }

        $items = $this->billedItemsQuery($itemClass, $invoiceRelation, $sourceColumn, array_keys($sources), $excludeInvoiceId, $lock)->get();

        $currencies = app(CurrencyMatcher::class);
        $totals     = [];
        foreach ($items as $item) {
            $invoice  = $item->{$invoiceRelation};
            $sourceId = $item->{$sourceColumn};
            $source   = $sources[$sourceId];
            $sign     = $invoice->return_against_id ? -1 : 1;
            $net      = (float) $item->basic_amount - (float) $item->discount_amount;
            $base     = $net * (float) ($invoice->exchange_rate ?: 1);

            $value = match (true) {
                ! $source['in_source_currency']                                 => $base,
                $currencies->same($source['currency'], $invoice->currency_code) => $net,
                default                                                         => $base / max((float) $source['exchange_rate'], 0.0000001),
            };

            $totals[$sourceId] = ($totals[$sourceId] ?? 0.0) + $sign * $value;
        }

        return $totals;
    }
}
