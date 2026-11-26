<?php

namespace App\Services\Finances;

use App\Contracts\SubmitableService;
use App\Enums\FormStatus;
use App\Enums\JournalStatus;
use App\Events\Asset\AssetSoldViaInvoice;
use App\Events\Core\DocumentSubmitted;
use App\Events\Finances\SalesInvoiceGeneralLedgerPostingRequested;
use App\Events\Sales\Invoice\SalesInvoiceReturnStatusChanged;
use App\Events\Sales\Invoice\SalesOrderItemBillingChanged;
use App\Events\Sales\Order\DocumentDeliveryStatusRecalculationRequested;
use App\Http\Requests\Finances\Rules\ReturnAgainstItemRules;
use App\Models\Asset\Asset;
use App\Models\Core\Branch;
use App\Models\Core\CoreSetting;
use App\Models\Core\FormatingSeries;
use App\Models\Core\GlPostingStatus;
use App\Models\Finances\GeneralLedger;
use App\Models\Finances\Journal;
use App\Models\Finances\SalesInvoice;
use App\Models\Finances\SalesInvoiceItem;
use App\Models\Finances\Tax;
use App\Models\Inventory\DeliveryNoteItem;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Stock;
use App\Models\Model;
use App\Models\Sales\Customer;
use App\Models\Sales\SalesOrderItem;
use App\Models\Sales\SalesSetting;
use App\Services\Core\PermissionChecker;
use App\Services\Core\Setting\CurrencyMatcher;
use App\Services\Core\Setting\RateChangeComparator;
use App\Services\Core\Setting\SettingsService;
use App\Services\Core\Setting\ToleranceCalculator;
use App\Services\Finances\Ledger\JournalReversalService;
use App\Traits\HasDefaultDelete;
use App\Utils;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\Uid\Ulid;

class SalesInvoiceService implements SubmitableService {
    use HasDefaultDelete;

    /**
     * Faktor DPP Nilai Lain PPN 12% (tarif efektif 11%) -- lihat migration
     * add_dpp_amount_to_sales_invoice_items_table, spec invoice-dpp-adjustment.
     */
    public const float DPP_FACTOR = 11 / 12;

    private function fillRelations(array $data) {
        $data['sales_order_id'] = $data['sales_order']['id'] ?? null;
        $data['customer_id']    = $data['customer']['id'];
        $data['customer_name']  = Customer::find($data['customer']['id'])?->name;
        // Akun tidak diterima dari input (Q-P2-23, 2026-11-22): engine yang menentukan akun, kolom dokumen dikosongkan
        // pada create dan update draft sampai engine mencatatnya (Task 12.1).
        $data['income_account_id'] = null;
        $data['debit_account_id']  = null;

        // relasi cabang customer
        $data['customer_branch_id']   = $data['customer_branch']['id'];
        $data['customer_branch_name'] = Branch::find($data['customer_branch']['id'])?->name;

        $defaultCurrency            = app(SettingsService::class)->get(CoreSetting::class)->default_currency_id;
        $data['currency_code']      = $data['currency']['code'] ?? $defaultCurrency;
        $data['base_currency_code'] = $defaultCurrency;

        if ($data['currency_code'] != $defaultCurrency && empty($data['exchange_rate'])) {
            throw ValidationException::withMessages(['exchange_rate' => 'Exchange rate is required for non-default currency.']);
        }

        $data['exchange_rate'] = $data['currency_code'] == $defaultCurrency ? 1 : $data['exchange_rate'];

        $data['return_against_id'] = $data['return_against']['id'] ?? null;

        return $data;
    }

    private function fillItemRelations(array $data, SalesInvoice $salesInvoice, array $units = [], array $taxes = [], array $salesOrderItems = []) {
        // Baris SO mengambil identitas dari baris sumber; baris bebas (spec
        // delivery-note-sales-invoice-off-source-items) dari `item.id` (ItemVariant)
        // atau `asset.id` -- prioritas sumber > item > asset.
        $source                      = filled($data['sales_order_item']['id'] ?? null) ? $salesOrderItems[$data['sales_order_item']['id']] : null;
        $data['sales_order_item_id'] = $source?->id;
        $data['item_id']             = $source ? $source->item_id : ($data['item']['id'] ?? null);
        $data['asset_id']            = $source ? $source->asset_id : (($data['item']['id'] ?? null) ? null : ($data['asset']['id'] ?? null));

        $unitId                     = $data['asset_id'] ? null : ($data['unit']['id'] ?? null);
        $unit                       = $units[$unitId] ?? null;
        $tax                        = $taxes[$data['tax']['id'] ?? ''] ?? null;
        $data['item_unit_id']       = $unitId;
        $data['conversion_factor']  = $unit?->conversion_factor ?? 1;
        $data['tax_id']             = $data['tax']['id'] ?? null;
        $data['tax_rate']           = $tax?->rate ?? 0;
        $data['currency_code']      = $salesInvoice->currency_code;
        $data['base_currency_code'] = $salesInvoice->base_currency_code;
        $data['exchange_rate']      = $salesInvoice->exchange_rate;
        $data['price'] ??= 0;
        $data['price_base_currency'] = 0;
        // Akun baris dicatat engine saat approve (Task 12.1); create dan update draft mengosongkannya (Q-P2-24).
        $data['posted_account_id'] = null;

        return $data;
    }

    private function batchLoadSalesOrderItems(array $data): array {
        $ids = collect($data['items'])->pluck('sales_order_item.id')->filter()->unique()->values();

        return SalesOrderItem::whereIn('id', $ids)->get()->keyBy('id')->all();
    }

    private function batchLoadUnits(array $data): array {
        $unitIds = collect($data['items'])->pluck('unit.id')->filter()->unique()->values();

        return ItemUnit::whereIn('item_units.id', $unitIds)->get()->keyBy('id')->all();
    }

    private function batchLoadTaxes(array $data): array {
        $taxIds = collect($data['items'])->pluck('tax.id')->filter()->unique()->values();

        return Tax::whereIn('id', $taxIds)->get()->keyBy('id')->all();
    }

    private function fillPaymentScheduleRelations(array $data, SalesInvoice $salesInvoice) {
        $data['payment_amount']     = $salesInvoice->amount * ($data['invoice_portion'] / 100);
        $data['currency_code']      = $salesInvoice->currency_code;
        $data['base_currency_code'] = $salesInvoice->base_currency_code;
        $data['exchange_rate']      = $salesInvoice->exchange_rate;
        $data['for_internal']       = $salesInvoice->return_against_id === null ? true : false;
        $data['payment_method_id']  = $data['payment_method']['id'] ?? null;

        return $data;
    }

    public function create(array $data): Model {
        $data['code'] = FormatingSeries::generate(SalesInvoice::class, $data, true);
        $salesInvoice = SalesInvoice::create($this->fillRelations($data));

        $units           = $this->batchLoadUnits($data);
        $taxes           = $this->batchLoadTaxes($data);
        $salesOrderItems = $this->batchLoadSalesOrderItems($data);

        $items = collect();
        foreach ($data['items'] as $item) {
            $item      = $this->fillItemRelations($item, $salesInvoice, $units, $taxes, $salesOrderItems);
            $itemModel = $salesInvoice->items()->create($item);
            // basic_amount generated column (quantity * price) -- belum terisi di object
            // sampai di-refresh dari DB.
            $itemModel->refresh();
            $items->push($itemModel);
        }

        $totals = DocumentDiscountCalculator::applyDiscountColumnToItems($salesInvoice, $items, self::DPP_FACTOR);
        $salesInvoice->update([
            'amount' => $totals['basic_amount'] + $totals['tax_amount'],
        ]);
        foreach ($data['payment_schedules'] ?? [] as $payment_schedule) {
            $payment_schedule = $this->fillPaymentScheduleRelations($payment_schedule, $salesInvoice);
            $salesInvoice->paymentSchedules()->create(attributes: [
                ...$payment_schedule,
            ]);
        }

        return $salesInvoice;
    }

    public function update(Model $salesInvoice, array $data): Model {
        $salesInvoice->fillForUpdate($this->fillRelations($data), true);
        $salesInvoice->items()
            ->whereNotIn('id', array_column($data['items'], 'id'))
            ->delete();
        $itemIds = collect($data['items'])
            ->pluck('id')
            ->filter(fn ($id) => Ulid::isValid((string) $id))
            ->values()
            ->all();
        $existingItems = $salesInvoice->items()
            ->whereIn('id', $itemIds)
            ->get()
            ->keyBy('id');

        $units           = $this->batchLoadUnits($data);
        $taxes           = $this->batchLoadTaxes($data);
        $salesOrderItems = $this->batchLoadSalesOrderItems($data);

        $items = collect();
        foreach ($data['items'] as $item) {
            $item = $this->fillItemRelations($item, $salesInvoice, $units, $taxes, $salesOrderItems);

            if (Ulid::isValid($item['id'])) {
                $itemModel = $existingItems->get($item['id']);
                if ($itemModel) {
                    $itemModel->fill($item);
                    $itemModel->save();
                } else {
                    $itemModel = $salesInvoice->items()->create($item);
                }
            } else {
                $itemModel = $salesInvoice->items()->create($item);
            }

            // basic_amount generated column -- refresh supaya nilai terbaru (quantity/price
            // baru) terbaca sebelum dialokasikan diskon.
            $itemModel->refresh();
            $items->push($itemModel);
        }

        $totals = DocumentDiscountCalculator::applyDiscountColumnToItems($salesInvoice, $items, self::DPP_FACTOR);
        $salesInvoice->fill([
            'amount' => $totals['basic_amount'] + $totals['tax_amount'],
        ]);
        $salesInvoice->save();

        $salesInvoice->paymentSchedules()
            ->whereNotIn('id', array_column($data['payment_schedules'], 'id'))
            ->delete();
        $paymentScheduleIds = collect($data['payment_schedules'])
            ->pluck('id')
            ->filter(fn ($id) => Ulid::isValid((string) $id))
            ->values()
            ->all();
        $existingPaymentSchedules = $salesInvoice->paymentSchedules()
            ->whereIn('id', $paymentScheduleIds)
            ->get()
            ->keyBy('id');
        foreach ($data['payment_schedules'] as $payment_schedule) {
            $payment_schedule = $this->fillPaymentScheduleRelations($payment_schedule, $salesInvoice);
            if (Ulid::isValid($payment_schedule['id'])) {
                $existingPaymentSchedules->get($payment_schedule['id'])?->update($payment_schedule);

                continue;
            }
            $salesInvoice->paymentSchedules()->create(attributes: [
                ...$payment_schedule,
            ]);
        }

        return $salesInvoice;
    }

    public function submit(Model $salesInvoice): mixed {
        DB::beginTransaction();

        $salesInvoice->update([
            'code' => FormatingSeries::generate(SalesInvoice::class, $salesInvoice),
        ]);

        if ($salesInvoice->paymentSchedules()->count() === 0) {
            $salesInvoice->paymentSchedules()->create([
                'payment_scheduleable_type' => SalesInvoice::class,
                'payment_scheduleable_id'   => $salesInvoice->id,
                'payment_amount'            => $salesInvoice->amount,
                'invoice_portion'           => 100,
                'paid_amount'               => 0,
                'for_internal'              => false,
                'due_date'                  => now()->addDays(30),
                'exchange_rate'             => $salesInvoice->exchange_rate ?? 1,
                'currency_code'             => $salesInvoice->currency_code,
                'base_currency_code'        => $salesInvoice->base_currency_code,
                'description'               => "Auto generated from Sales Invoice {$salesInvoice->code}",
            ]);
        } else {
            // check sum of invoice portion must be 100%
            $totalInvoicePortion = $salesInvoice->paymentSchedules()->sum('invoice_portion');
            if ($totalInvoicePortion != 100) {
                DB::rollBack();
                throw ValidationException::withMessages([
                    'invoice_portion' => 'Total invoice portion must be 100%',
                ]);
            }
        }
        event(new DocumentSubmitted($salesInvoice, $salesInvoice->salesOrder));

        DB::commit();

        $salesInvoice->checkApproval();

        return $salesInvoice;
    }

    public function onApproved(Model $salesInvoice): mixed {
        DB::beginTransaction();

        // Satu waktu approve untuk jurnal Sales Invoice dan event pelepasan aset (bentuk jurnal pelepasan mengikuti tanggal ini).
        $approvedAt = now();

        try {
            $salesInvoice->load([
                'debitAccount',
                'incomeAccount',
                'salesOrder',
                'returnAgainst',
                'items.returnAgainstItem',
                'items.salesOrderItem',
                'items.asset',
            ]);

            $returnAgainst = $salesInvoice->returnAgainst;
            $items         = $salesInvoice->items;

            if (! $returnAgainst) {
                $this->assertRateChanges($salesInvoice, $items);
                $this->assertBelowCost($salesInvoice, $items);
                $this->assertBillingTolerance($salesInvoice, $items);
            }

            $basicAmount = 0;
            $taxAmount   = 0;

            foreach ($items as $item) {
                if ($returnAgainst && $item->return_against_item_id) {
                    ReturnAgainstItemRules::assertRemainingOnApprove('sales_invoice_items', $item->return_against_item_id, (float) $item->quantity);
                }
                $basicAmount += $item->basic_amount - $item->discount_amount;
                $taxAmount += $item->tax_amount;
                // Baris bebas (tanpa baris SO) tidak mengubah tagihan SO mana pun.
                if ($item->salesOrderItem) {
                    event(new SalesOrderItemBillingChanged(
                        $item->salesOrderItem,
                        $item->quantity,
                        $returnAgainst ? 'decrement' : 'increment',
                        $returnAgainst ? $item->returnAgainstItem : null,
                    ));
                } elseif ($returnAgainst && $item->returnAgainstItem) {
                    // Retur baris bebas: tak ada SO Item, tapi jumlah retur baris asal tetap dicatat.
                    $item->returnAgainstItem->increment('returned_quantity', $item->quantity);
                }

                if ($item->asset_id) {
                    // Asset bebas: cek ulang di bawah lock bahwa masih `active` (bisa berubah sejak validasi).
                    if (! $returnAgainst && ! $item->salesOrderItem
                        && ! Asset::where('id', $item->asset_id)->whereJsonContains('status', FormStatus::ACTIVE->value)->lockForUpdate()->exists()) {
                        throw new \LogicException(__('sales/offSource.asset_not_active'));
                    }
                    event(new AssetSoldViaInvoice($item, $approvedAt));
                }
            }
            // basic_amount/tax_amount item sudah net (dikurangi discount_amount) sejak
            // create()/update() -- di sini murni sum, bukan alokasi ulang diskon.
            $totalAmount = $basicAmount + $taxAmount;

            $debitAccount  = $salesInvoice->debitAccount;
            $creditAccount = $salesInvoice->incomeAccount;

            // === GL posting dipindah ke queued Job (pola sama PurchaseInvoiceService) ===
            GlPostingStatus::create([
                'referenceable_type' => SalesInvoice::class,
                'referenceable_id'   => $salesInvoice->id,
                'status'             => FormStatus::PENDING,
            ]);
            event(new SalesInvoiceGeneralLedgerPostingRequested(
                $salesInvoice,
                $totalAmount,
                (bool) $returnAgainst,
                $approvedAt,
                $debitAccount?->id,
                $creditAccount?->id,
            ));

            $salesOrder = $salesInvoice->salesOrder;
            if ($salesOrder) {
                event(new DocumentDeliveryStatusRecalculationRequested($salesOrder));
            }

            $salesInvoice->update([
                'amount' => $totalAmount,
                'status' => $returnAgainst ? FormStatus::RETURNED : FormStatus::UNPAID,
            ]);

            if ($returnAgainst) {
                $returnedItems      = $returnAgainst->items()->select(['returned_quantity', 'quantity'])->get();
                $countReturnedItems = $returnedItems->sum('returned_quantity');
                $sumQuantity        = $returnedItems->sum('quantity');

                if ($countReturnedItems == $sumQuantity) {
                    $status = Utils::replaceStatus(
                        $returnAgainst->status,
                        [FormStatus::UNPAID, FormStatus::PARTIALLY_PAID],
                        FormStatus::PAID,
                    );
                } elseif ($countReturnedItems > 0) {
                    $status = Utils::replaceStatus(
                        $returnAgainst->status,
                        FormStatus::UNPAID,
                        $returnAgainst->outstanding_amount <= 0 ? FormStatus::PAID : FormStatus::PARTIALLY_PAID,
                    );
                } else {
                    $status = $returnAgainst->status;
                }
                event(new SalesInvoiceReturnStatusChanged($returnAgainst, $status));
            }

            DB::commit();

            return $salesInvoice;
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    private function assertBillingTolerance(SalesInvoice $salesInvoice, $items): void {
        $tolerance = SalesSetting::current()->over_billing_tolerance_percent;
        if ($tolerance === null) {
            return;
        }

        $groupedItems = $items->filter(fn ($item) => $item->sales_order_item_id)->groupBy('sales_order_item_id');
        if ($groupedItems->isEmpty()) {
            return;
        }

        $sourceItems = SalesOrderItem::query()
            ->with('salesOrder:id,exchange_rate,currency_code')
            ->whereIn('id', $groupedItems->keys())
            ->lockForUpdate()
            ->get()
            ->keyBy('id');
        $calculator = app(ToleranceCalculator::class);
        // Mata uang sama dengan SO: nilai dibandingkan apa adanya dalam mata uang dokumen (tanpa kurs).
        $currencies = app(CurrencyMatcher::class);
        $sourceInfo = [];
        foreach ($sourceItems as $sourceId => $source) {
            $sourceInfo[$sourceId] = [
                'currency'           => $source->salesOrder?->currency_code,
                'exchange_rate'      => (float) ($source->exchange_rate ?: ($source->salesOrder?->exchange_rate ?: 1)),
                'in_source_currency' => $currencies->same($source->salesOrder?->currency_code, $salesInvoice->currency_code),
            ];
        }
        $billedValues = app(InvoiceBilledValueResolver::class)->billedValues(
            SalesInvoiceItem::class,
            'salesInvoice',
            'sales_order_item_id',
            $sourceInfo,
            $salesInvoice->id,
            lock: true,
        );

        foreach ($groupedItems as $sourceId => $invoiceItems) {
            $source = $sourceItems->get($sourceId);
            if (! $source) {
                continue;
            }

            $requestedQuantity = (float) $invoiceItems->sum('quantity');
            $inSourceCurrency  = $sourceInfo[$sourceId]['in_source_currency'];
            $requestedValue    = (float) $invoiceItems->sum(fn ($item) => ($item->basic_amount - $item->discount_amount) * ($inSourceCurrency ? 1 : (float) ($salesInvoice->exchange_rate ?: 1)));
            $sourceValue       = $inSourceCurrency
                ? (float) $source->basic_amount - (float) $source->discount_amount
                : (float) $source->basic_amount_base_currency;
            $alreadyBilledValue = (float) ($billedValues[$sourceId] ?? 0);

            if ($calculator->exceeds($requestedQuantity, (float) $source->quantity, (float) $source->billed_quantity, $tolerance)) {
                throw ValidationException::withMessages([
                    'items' => __('finances/salesInvoice.validation.over_billing_tolerance_exceeded', [
                        'remaining' => max(0, (float) $source->quantity - (float) $source->billed_quantity),
                        'tolerance' => $tolerance,
                    ]),
                ]);
            }

            if ($calculator->exceedsValue($requestedValue, $sourceValue, $alreadyBilledValue, $tolerance)) {
                throw ValidationException::withMessages([
                    'items' => __('finances/salesInvoice.validation.over_billing_value_tolerance_exceeded', [
                        'remaining' => round(max(0, $sourceValue - $alreadyBilledValue), 2),
                        'tolerance' => $tolerance,
                    ]),
                ]);
            }
        }
    }

    private function assertRateChanges(SalesInvoice $salesInvoice, Collection $items): void {
        $action = SalesSetting::current()->rate_change_action;
        if ($action === 'none') {
            return;
        }

        $groupedItems = $items->filter(fn ($item) => $item->sales_order_item_id)->groupBy('sales_order_item_id');
        $sourceItems  = $groupedItems->isEmpty()
            ? collect()
            : SalesOrderItem::query()
                ->with('salesOrder:id,exchange_rate,currency_code')
                ->whereIn('id', $groupedItems->keys())
                ->lockForUpdate()
                ->get()
                ->keyBy('id');
        $comparator = app(RateChangeComparator::class);
        $currencies = app(CurrencyMatcher::class);
        $warnings   = [];

        foreach ($groupedItems as $sourceId => $invoiceItems) {
            $source = $sourceItems->get($sourceId);
            if (! $source) {
                continue;
            }

            foreach ($invoiceItems as $item) {
                if (! $comparator->hasChanged(
                    (float) $source->price,
                    (float) ($source->salesOrder?->exchange_rate ?: 1),
                    (float) ($source->conversion_factor ?: 1),
                    (float) $item->price,
                    (float) ($salesInvoice->exchange_rate ?: 1),
                    (float) ($item->conversion_factor ?: 1),
                    $currencies->same($source->salesOrder?->currency_code, $salesInvoice->currency_code),
                )) {
                    continue;
                }

                $message = __('finances/salesInvoice.validation.rate_changed', [
                    'source'   => $source->price,
                    'document' => $item->price,
                ]);
                if ($action === 'stop') {
                    throw ValidationException::withMessages(['items' => $message]);
                }
                $warnings[] = $message;
            }
        }

        $this->flashPriceWarnings($warnings);
    }

    private function assertBelowCost(SalesInvoice $salesInvoice, Collection $items): void {
        $action = SalesSetting::current()->below_cost_action;
        if ($action === 'none') {
            return;
        }

        $sourceIds   = $items->filter(fn ($item) => $item->sales_order_item_id)->pluck('sales_order_item_id')->unique();
        $sourceItems = $sourceIds->isEmpty()
            ? collect()
            : SalesOrderItem::query()->whereIn('id', $sourceIds)->lockForUpdate()->get()->keyBy('id');
        $eligibleItems = $items->filter(fn ($item) => $item->item_id && ! $item->asset_id && $sourceItems->get($item->sales_order_item_id)?->source_warehouse_id);
        if ($eligibleItems->isEmpty()) {
            return;
        }

        $variants = ItemVariant::query()
            ->whereIn('id', $eligibleItems->pluck('item_id')->unique())
            ->where('is_stock_item', true)
            ->get()
            ->keyBy('id');
        $eligibleItems = $eligibleItems->filter(fn ($item) => $variants->has($item->item_id));
        if ($eligibleItems->isEmpty()) {
            return;
        }

        $warehouseIds = $eligibleItems->map(fn ($item) => $sourceItems->get($item->sales_order_item_id)?->source_warehouse_id)->filter()->unique();
        $stocks       = Stock::query()
            ->whereIn('item_variant_id', $eligibleItems->pluck('item_id')->unique())
            ->whereIn('warehouse_id', $warehouseIds)
            ->lockForUpdate()
            ->get()
            ->keyBy(fn (Stock $stock) => "{$stock->item_variant_id}-{$stock->warehouse_id}");
        $warnings   = [];
        $canSeeCost = PermissionChecker::forUser(request())->satisfies(Stock::VALUATION_RATE_VISIBILITY);

        foreach ($eligibleItems as $item) {
            $source = $sourceItems->get($item->sales_order_item_id);
            $stock  = $stocks->get("{$item->item_id}-{$source->source_warehouse_id}");
            if (! $stock || $stock->valuation_rate <= 0) {
                continue;
            }

            $quantity     = max((float) $item->quantity, 0.0000001);
            $unitFactor   = max((float) ($item->conversion_factor ?: 1), 0.0000001);
            $stockFactor  = max((float) ($stock->conversion_factor ?: 1), 0.0000001);
            $netSalesRate = (($item->basic_amount - $item->discount_amount) / $quantity)
                * (float) ($salesInvoice->exchange_rate ?: 1)
                / $unitFactor;
            $valuationRate = (float) $stock->valuation_rate / $stockFactor;
            if ($netSalesRate + 0.000001 >= $valuationRate) {
                continue;
            }

            // HPP (valuation rate) hanya boleh dilihat pemegang izin write/create StockEntry.
            $message = $canSeeCost
                ? __('finances/salesInvoice.validation.below_cost', [
                    'sales' => $netSalesRate,
                    'cost'  => $valuationRate,
                ])
                : __('finances/salesInvoice.validation.below_cost_hidden', ['sales' => $netSalesRate]);
            if ($action === 'stop') {
                throw ValidationException::withMessages(['items' => $message]);
            }
            $warnings[] = $message;
        }

        $this->flashPriceWarnings($warnings);
    }

    /** @param list<string> $warnings */
    private function flashPriceWarnings(array $warnings): void {
        if ($warnings === [] || ! request()->hasSession()) {
            return;
        }

        $existingWarnings = request()->session()->get('priceWarnings', []);
        request()->session()->flash('priceWarnings', array_values(array_unique([...$existingWarnings, ...$warnings])));
    }

    public function onRejected(Model $salesInvoice): mixed {
        $salesInvoice->update([
            'status' => FormStatus::REJECTED,
        ]);

        return $salesInvoice;
    }

    public function cancel(Model $salesInvoice): mixed {
        DB::transaction(function () use ($salesInvoice): void {
            $assetLines = $this->assetLinesOf($salesInvoice);

            // Kunci baris aset (urut id agar tidak deadlock) sebelum membaca status apa pun: handler posting pelepasan
            // mengunci aset yang sama, sehingga cancel dan posting berjalan bergantian, bukan bersamaan.
            $this->lockAssets($assetLines);

            $this->assertNoApprovedAssetDelivery($salesInvoice, $assetLines);

            $salesInvoice->update([
                'status' => FormStatus::CANCELED,
            ]);

            $this->voidAssetDisposalJournals($assetLines);
            $this->restoreAssetDepreciationSchedules($salesInvoice, $assetLines);
        });

        return $salesInvoice;
    }

    /**
     * Pembatalan Sales Invoice yang memuat baris aset ditolak selama aset itu sudah dikirim lewat Delivery Note penjualan
     * yang masih berlaku (belum dibatalkan, bukan retur, bukan sewa): pengiriman adalah kenyataan fisik yang tidak boleh
     * hilang diam-diam karena invoice dibatalkan (`sold_quantity`/status aset berasal dari Delivery Note, bukan dari
     * invoice). Batalkan Delivery Note-nya lebih dulu. Tidak mengubah data apa pun.
     *
     * Penanda "sudah terkirim" adalah `delivery_note_items.processed_at`: hanya diisi `MarkAssetSoldFromDelivery` (sinkron,
     * di transaksi persetujuan Delivery Note) tepat saat `sold_quantity` aset bertambah. `submitted_at` tidak dipakai karena
     * juga terisi untuk Delivery Note yang masih menunggu persetujuan atau ditolak (aset belum bergerak).
     *
     * Aset non-bulk (satu unit): pengiriman mana pun atas aset itu memblokir. Aset bulk (`allow_bulk_quantity`, dijual
     * sebagian ke beberapa pelanggan): hanya pengiriman milik invoice ini yang memblokir, dikenali dari baris Sales Order
     * yang sama (`sales_invoice_items.sales_order_item_id` = `delivery_note_items.referenceable_id`). Pengiriman tanpa
     * Sales Order (bebas) tidak bisa dikaitkan ke invoice mana pun, jadi dipakai pencocokan kuantitas: memblokir hanya bila
     * total qty terkirim melebihi qty aset dikurangi qty baris invoice yang dibatalkan (artinya sebagian unit invoice ini
     * pasti sudah ikut terkirim).
     *
     * @param  Collection<int, SalesInvoiceItem>  $assetLines
     */
    private function assertNoApprovedAssetDelivery(Model $salesInvoice, Collection $assetLines): void {
        if ($salesInvoice->return_against_id !== null) {
            return;
        }

        $assetIds = $assetLines->pluck('asset_id')->unique()->all();
        if ($assetIds === []) {
            return;
        }

        $delivered = DeliveryNoteItem::query()
            ->whereIn('asset_id', $assetIds)
            ->whereNotNull('processed_at')
            ->whereHas('deliveryNote', fn ($query) => $query
                ->whereNull('canceled_at')
                ->whereNull('return_against_id'))
            ->with('referenceable.salesOrder')
            ->get()
            ->reject(fn (DeliveryNoteItem $item): bool => $item->referenceable instanceof SalesOrderItem
                && (bool) ($item->referenceable->salesOrder?->is_rent ?? false));

        if ($delivered->isEmpty()) {
            return;
        }

        $assets = Asset::query()->whereIn('id', $assetIds)->get()->keyBy('id');

        foreach ($assetLines->groupBy('asset_id') as $assetId => $lines) {
            $items = $delivered->where('asset_id', $assetId);
            if ($items->isEmpty()) {
                continue;
            }

            if (! (bool) $assets->get($assetId)?->allow_bulk_quantity || $this->bulkDeliveryBelongsToInvoice($assets->get($assetId), $lines, $items)) {
                throw ValidationException::withMessages(['asset' => __('finances/salesInvoice.validation.asset_already_delivered')]);
            }
        }
    }

    /**
     * Apakah pengiriman aset bulk menyangkut baris invoice yang dibatalkan (lihat `assertNoApprovedAssetDelivery`).
     *
     * @param  Collection<int, SalesInvoiceItem>  $lines  baris invoice untuk aset ini
     * @param  Collection<int, DeliveryNoteItem>  $items  baris Delivery Note terkirim untuk aset ini
     */
    private function bulkDeliveryBelongsToInvoice(Asset $asset, Collection $lines, Collection $items): bool {
        $orderItemIds = $lines->pluck('sales_order_item_id')->filter()->all();

        $linked = $items->contains(fn (DeliveryNoteItem $item): bool => $item->referenceable instanceof SalesOrderItem
            && \in_array($item->referenceable_id, $orderItemIds, true));
        if ($linked) {
            return true;
        }

        $hasUnlinked = $items->contains(fn (DeliveryNoteItem $item): bool => ! ($item->referenceable instanceof SalesOrderItem));
        if (! $hasUnlinked) {
            return false;
        }

        return (float) $items->sum('quantity') > (float) $asset->asset_quantity - (float) $lines->sum('quantity') + 0.000001;
    }

    /**
     * Pulihkan jadwal penyusutan aset baris invoice yang dihentikan saat aset terjual habis (kebalikan penghentian di
     * `PostAssetDisposalGainLoss`/`Asset::addSoldQuantity`). Hanya bila aset tidak lagi terjual habis (jurnal pelepasan
     * lain atau `sold_quantity`) dan tidak berstatus scrap (jadwal aset scrap sengaja dihentikan dan tidak dipulihkan).
     * Jadwal yang sudah terposting tidak pernah dihapus sehingga tidak tersentuh. Idempoten, dan harus dipanggil setelah
     * status posting baris ditandai `skipped`.
     *
     * @param  Collection<int, SalesInvoiceItem>  $assetLines
     */
    private function restoreAssetDepreciationSchedules(Model $salesInvoice, Collection $assetLines): void {
        if ($salesInvoice->return_against_id !== null) {
            return;
        }

        $assetIds = $assetLines->pluck('asset_id')->unique()->all();

        foreach (Asset::query()->whereIn('id', $assetIds)->get() as $asset) {
            if ($asset->isFullySold() || \in_array(FormStatus::SCRAPPED, (array) $asset->status, true)) {
                continue;
            }

            $asset->depreciationSchedules()->onlyTrashed()->restore();
        }
    }

    /**
     * Kunci baris Asset milik baris invoice, urut id agar dua pembatalan bersamaan tidak saling menunggu (deadlock).
     *
     * @param  Collection<int, SalesInvoiceItem>  $assetLines
     */
    private function lockAssets(Collection $assetLines): void {
        $assetIds = $assetLines->pluck('asset_id')->unique()->sort()->values()->all();
        if ($assetIds === []) {
            return;
        }

        Asset::query()->whereIn('id', $assetIds)->orderBy('id')->lockForUpdate()->get(['id']);
    }

    /** @return Collection<int, SalesInvoiceItem> */
    private function assetLinesOf(Model $salesInvoice): Collection {
        return SalesInvoiceItem::query()
            ->where('sales_invoice_id', $salesInvoice->getKey())
            ->whereNotNull('asset_id')
            ->get(['id', 'asset_id', 'quantity', 'sales_order_item_id']);
    }

    /**
     * Jurnal pelepasan aset (`disposal:{sales_invoice_item_id}`) bersumber dari aset, bukan dari Sales Invoice, sehingga
     * tidak ikut di-void oleh hook pembatalan `Submitable` (yang hanya menyentuh jurnal ber-sumber dokumen yang dibatalkan).
     * Di sini baris GL-nya di-soft-delete dan jurnalnya ditandai `voided` dengan cara yang sama seperti jurnal Sales Invoice
     * sendiri, terbatas pada baris invoice ini. Idempoten: jurnal yang sudah `voided` tidak diproses ulang.
     *
     * @param  Collection<int, SalesInvoiceItem>  $lines
     */
    private function voidAssetDisposalJournals(Collection $lines): void {
        if ($lines->isEmpty()) {
            return;
        }

        $this->markAssetDisposalPostingSkipped($lines);

        // Jurnal pelepasan dan jurnal pembaliknya (JournalReversalService: key `<asli>:reversal`, `reverses_journal_id`)
        // sama-sama di-void agar GL tidak menyisakan kebalikan pelepasan saja.
        $keys = $lines
            ->map(fn (SalesInvoiceItem $line): string => (new Asset)->getMorphClass() . ":{$line->asset_id}:disposal:{$line->id}")
            ->all();

        $originalIds = Journal::query()->withoutGlobalScopes()->whereIn('posting_key', $keys)->pluck('id');

        $journalIds = Journal::query()->withoutGlobalScopes()
            ->where(function ($query) use ($keys, $originalIds): void {
                $query->whereIn('posting_key', [...$keys, ...array_map(fn (string $key): string => $key . ':' . JournalReversalService::REVERSAL_PURPOSE, $keys)])
                    ->orWhereIn('reverses_journal_id', $originalIds);
            })
            ->whereIn('status', [JournalStatus::Posted->value, JournalStatus::Reversed->value])
            ->pluck('id');

        if ($journalIds->isEmpty()) {
            return;
        }

        GeneralLedger::query()->whereIn('journal_id', $journalIds)->update(['deleted_at' => now()]);
        Journal::query()->withoutGlobalScopes()->whereIn('id', $journalIds)->update(['status' => JournalStatus::Voided->value]);
    }

    /**
     * Tandai status posting baris aset sebagai `skipped` (tidak aktif), konvensi dokumen dibatalkan (Q-P2-12/Q-P2-13:
     * `CanceledSourceGuard` dan listener posting). `processed_at` dibiarkan agar job lama tidak memposting ulang baris ini.
     */
    private function markAssetDisposalPostingSkipped(Collection $lines): void {
        GlPostingStatus::query()
            ->where('referenceable_type', SalesInvoiceItem::class)
            ->whereIn('referenceable_id', $lines->pluck('id'))
            ->where('status', '!=', FormStatus::SKIPPED->value)
            ->update(['status' => FormStatus::SKIPPED->value]);
    }

    public function amend(Model $model): mixed {
        return $model;
    }

    /**
     * Alokasikan nomor seri Faktur Pajak Keluaran & simpan breakdown DPP/PPN.
     * Bukan bagian create()/update() -- Faktur Pajak adalah data legal terpisah
     * yang di-assign eksplisit oleh user (mis. saat siap dilaporkan ke e-Faktur),
     * bukan otomatis tiap invoice disimpan.
     *
     * PPnBM belum didukung (data model kategori tax barang mewah -- Requirement 4 --
     * belum diimplementasi di spec ini), jadi tax_invoice_ppnbm_amount tetap 0.
     *
     * @param  string  $transactionCode  salah satu dari TaxInvoiceSerialAllocator::TRANSACTION_CODES
     */
    public function assignTaxInvoice(SalesInvoice $salesInvoice, string $transactionCode, string $statusCode = '0'): SalesInvoice {
        if (! \in_array($transactionCode, TaxInvoiceSerialAllocator::TRANSACTION_CODES, true)) {
            throw ValidationException::withMessages([
                'tax_invoice_transaction_code' => 'Kode transaksi Faktur Pajak tidak valid.',
            ]);
        }

        $salesInvoice->loadMissing('items');

        $serialNumber = app(TaxInvoiceSerialAllocator::class)->nextSerial($transactionCode, $statusCode);

        $salesInvoice->update([
            'tax_invoice_transaction_code' => $transactionCode,
            'tax_invoice_serial_number'    => $serialNumber,
            'tax_invoice_date'             => now(),
            'tax_invoice_dpp_amount'       => $salesInvoice->items->sum('dpp_amount'),
            'tax_invoice_ppn_amount'       => $salesInvoice->items->sum('tax_amount'),
        ]);

        return $salesInvoice;
    }
}
