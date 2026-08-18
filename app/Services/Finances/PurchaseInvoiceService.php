<?php

namespace App\Services\Finances;

use App\Contracts\SubmitableService;
use App\Enums\FormStatus;
use App\Events\Asset\FixedAssetItemApproved;
use App\Events\Core\DocumentSubmitted;
use App\Events\Finances\PurchaseInvoiceGeneralLedgerPostingRequested;
use App\Events\Purchase\Invoice\PurchaseInvoiceReturnStatusChanged;
use App\Events\Purchase\Invoice\PurchaseOrderItemBillingChanged;
use App\Events\Purchase\Order\PurchaseOrderBillStatusRecalculationRequested;
use App\Models\Core\FormatingSeries;
use App\Models\Core\GlPostingStatus;
use App\Models\Core\ModelConnection;
use App\Models\Core\Preference;
use App\Models\Finances\Account;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Finances\Tax;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\Stock;
use App\Models\Inventory\StockLedgerEntry;
use App\Models\Model;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\PurchaseOrderItem;
use App\Models\Purchase\PurchaseReceipt;
use App\Models\Purchase\Supplier;
use App\Traits\HasDefaultDelete;
use App\Utils;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\Uid\Ulid;

class PurchaseInvoiceService implements SubmitableService {
    use HasDefaultDelete;

    /**
     * Faktor DPP Nilai Lain PPN 12% (tarif efektif 11%) -- lihat migration
     * add_dpp_amount_to_purchase_invoice_items_table, spec invoice-dpp-adjustment.
     */
    private const float DPP_FACTOR = 11 / 12;

    private function fillRelations(array $data) {
        $data['purchase_order_id'] = $data['purchase_order']['id'];
        $data['supplier_id']       = $data['supplier']['id'];
        $data['supplier_name']     = Supplier::find($data['supplier']['id'])?->name;

        // account relations
        $data['credit_account_id']       = $data['credit_account']['id'] ?? null;
        $data['expanse_head_account_id'] = $data['expense_head_account']['id'] ?? null;
        $data['return_against_id']       = $data['return_against']['id'] ?? null;

        $defaultCurrency            = Preference::find('default_currency_id')?->value;
        $data['currency_code']      = $data['currency']['code'] ?? $defaultCurrency;
        $data['base_currency_code'] = $defaultCurrency;

        if ($data['currency_code'] != $defaultCurrency && empty($data['exchange_rate'])) {
            throw ValidationException::withMessages(['exchange_rate' => 'Exchange rate is required for non-default currency.']);
        }

        $data['exchange_rate'] = $data['currency_code'] == $defaultCurrency ? 1 : $data['exchange_rate'];

        return $data;
    }

    private function fillItemRelations(array $data, PurchaseInvoice $purchaseInvoice, array $units = [], array $taxes = [], array $purchaseOrderItems = []) {
        $unit                           = $units[$data['unit']['id']] ?? null;
        $tax                            = $taxes[$data['tax']['id'] ?? ''] ?? null;
        $data['purchase_order_item_id'] = $data['purchase_order_item']['id'];
        $data['item_id']                = $purchaseOrderItems[$data['purchase_order_item_id']]->item_id;
        $data['item_unit_id']           = $data['unit']['id'];
        $data['conversion_factor']      = $unit?->conversion_factor ?? 1;
        $data['exchange_rate']          = $purchaseInvoice->exchange_rate;
        $data['tax_id']                 = $data['tax']['id'];
        $data['tax_rate']               = $tax?->rate ?? 0;

        return $data;
    }

    private function batchLoadPurchaseOrderItems(array $data): array {
        $ids = collect($data['items'])->pluck('purchase_order_item.id')->filter()->unique()->values();

        return PurchaseOrderItem::whereIn('id', $ids)->get()->keyBy('id')->all();
    }

    private function batchLoadUnits(array $data): array {
        $unitIds = collect($data['items'])->pluck('unit.id')->filter()->unique()->values();

        return ItemUnit::whereIn('item_units.id', $unitIds)->get()->keyBy('id')->all();
    }

    private function batchLoadTaxes(array $data): array {
        $taxIds = collect($data['items'])->pluck('tax.id')->filter()->unique()->values();

        return Tax::whereIn('id', $taxIds)->get()->keyBy('id')->all();
    }

    private function fillPaymentScheduleRelations(array $data, PurchaseInvoice $purchaseInvoice) {
        $data['payment_amount']     = $purchaseInvoice->amount * ($data['invoice_portion'] / 100);
        $data['currency_code']      = $purchaseInvoice->currency_code;
        $data['base_currency_code'] = $purchaseInvoice->base_currency_code;
        $data['exchange_rate']      = $purchaseInvoice->exchange_rate;
        $data['for_internal']       = $purchaseInvoice->return_against_id === null ? false : true;
        $data['payment_method_id']  = $data['payment_method']['id'] ?? null;

        return $data;
    }

    public function create(array $data): Model {
        $data['code']    = FormatingSeries::generate(PurchaseInvoice::class, $data, true);
        $purchaseInvoice = PurchaseInvoice::create($this->fillRelations($data));

        $units              = $this->batchLoadUnits($data);
        $taxes              = $this->batchLoadTaxes($data);
        $purchaseOrderItems = $this->batchLoadPurchaseOrderItems($data);

        $items = collect();
        foreach ($data['items'] as $item) {
            $item      = $this->fillItemRelations($item, $purchaseInvoice, $units, $taxes, $purchaseOrderItems);
            $itemModel = $purchaseInvoice->items()->create($item);
            // basic_amount generated column (quantity * rate) -- belum terisi di object
            // sampai di-refresh dari DB.
            $itemModel->refresh();
            $items->push($itemModel);
        }

        $totals = DocumentDiscountCalculator::applyDiscountColumnToItems($purchaseInvoice, $items, self::DPP_FACTOR);
        $purchaseInvoice->update([
            'amount' => $totals['basic_amount'] + $totals['tax_amount'],
        ]);

        foreach ($data['payment_schedules'] ?? [] as $payment_schedule) {
            $payment_schedule = $this->fillPaymentScheduleRelations($payment_schedule, $purchaseInvoice);
            $purchaseInvoice->paymentSchedules()->create($payment_schedule);
        }

        return $purchaseInvoice;
    }

    public function update(Model $purchaseInvoice, array $data): Model {
        $purchaseInvoice->fillForUpdate($this->fillRelations($data));

        $purchaseInvoice->items()
            ->whereNotIn('id', array_column($data['items'], 'id'))
            ->delete();
        $itemIds = collect($data['items'])
            ->pluck('id')
            ->filter(fn ($id) => Ulid::isValid((string) $id))
            ->values()
            ->all();
        $existingItems = $purchaseInvoice->items()
            ->whereIn('id', $itemIds)
            ->get()
            ->keyBy('id');

        $units              = $this->batchLoadUnits($data);
        $taxes              = $this->batchLoadTaxes($data);
        $purchaseOrderItems = $this->batchLoadPurchaseOrderItems($data);

        $items = collect();
        foreach ($data['items'] as $item) {
            $item = $this->fillItemRelations($item, $purchaseInvoice, $units, $taxes, $purchaseOrderItems);

            if (Ulid::isValid($item['id'])) {
                $itemModel = $existingItems->get($item['id']);
                if ($itemModel) {
                    $itemModel->fill($item);
                    $itemModel->save();
                } else {
                    $itemModel = $purchaseInvoice->items()->create($item);
                }
            } else {
                $itemModel = $purchaseInvoice->items()->create($item);
            }

            // basic_amount generated column -- refresh supaya nilai terbaru (quantity/rate
            // baru) terbaca sebelum dialokasikan diskon.
            $itemModel->refresh();
            $items->push($itemModel);
        }

        $totals = DocumentDiscountCalculator::applyDiscountColumnToItems($purchaseInvoice, $items, self::DPP_FACTOR);
        $purchaseInvoice->update([
            'amount' => $totals['basic_amount'] + $totals['tax_amount'],
        ]);

        $paymentSchedules = $data['payment_schedules'] ?? [];
        $purchaseInvoice->paymentSchedules()
            ->whereNotIn('id', array_column($paymentSchedules, 'id'))
            ->delete();
        $paymentScheduleIds = collect($paymentSchedules)
            ->pluck('id')
            ->filter(fn ($id) => Ulid::isValid((string) $id))
            ->values()
            ->all();
        $existingPaymentSchedules = $purchaseInvoice->paymentSchedules()
            ->whereIn('id', $paymentScheduleIds)
            ->get()
            ->keyBy('id');
        foreach ($paymentSchedules as $payment_schedule) {
            $payment_schedule = $this->fillPaymentScheduleRelations($payment_schedule, $purchaseInvoice);
            if (Ulid::isValid($payment_schedule['id'])) {
                $existingPaymentSchedules->get($payment_schedule['id'])?->update($payment_schedule);

                continue;
            }
            $purchaseInvoice->paymentSchedules()->create($payment_schedule);
        }

        return $purchaseInvoice;
    }

    public function submit(Model $purchaseInvoice): mixed {
        DB::beginTransaction();

        $purchaseInvoice->update([
            'code' => FormatingSeries::generate(PurchaseInvoice::class, $purchaseInvoice),
        ]);
        if ($purchaseInvoice->paymentSchedules()->count() === 0) {
            $purchaseInvoice->paymentSchedules()->create([
                'payment_scheduleable_type' => PurchaseInvoice::class,
                'payment_scheduleable_id'   => $purchaseInvoice->id,
                'payment_amount'            => $purchaseInvoice->amount,
                'invoice_portion'           => 100,
                'paid_amount'               => 0,
                'for_internal'              => false,
                'due_date'                  => now()->addDays(30),
                'exchange_rate'             => $purchaseInvoice->exchange_rate ?? 1,
                'currency_code'             => $purchaseInvoice->currency_code,
                'base_currency_code'        => $purchaseInvoice->base_currency_code,
                'description'               => "Auto generated from Purchase Invoice {$purchaseInvoice->code}",
            ]);
        } else {
            $totalInvoicePortion = $purchaseInvoice->paymentSchedules()->sum('invoice_portion');
            if ($totalInvoicePortion != 100) {
                DB::rollBack();
                throw ValidationException::withMessages([
                    'invoice_portion' => 'Total invoice portion must be 100%',
                ]);
            }
        }
        event(new DocumentSubmitted($purchaseInvoice, $purchaseInvoice->purchaseOrder));

        DB::commit();

        $purchaseInvoice->checkApproval();

        return $purchaseInvoice;
    }

    public function onApproved(Model $purchaseInvoice): mixed {
        DB::beginTransaction();

        try {
            $purchaseInvoice->load([
                'expenseHeadAccount',
                'creditAccount',
                'purchaseOrder',
                'returnAgainst',
                'items.returnAgainstItem',
                'items.purchaseOrderItem',
                'items.item',
                'items.item.item',
            ]);

            $returnAgainst = $purchaseInvoice->returnAgainst;
            $items         = $purchaseInvoice->items;
            $purchaseOrder = $purchaseInvoice->purchaseOrder;

            $basicAmount  = 0;
            $taxAmount    = 0;
            $totalStockGL = 0; // Untuk GL Stock/SRNB (ALUR-1)

            foreach ($items as $item) {
                $basicAmount += $item->basic_amount - $item->discount_amount;
                $taxAmount += $item->tax_amount;

                $poItem = $item->purchaseOrderItem;
                $qty    = $item->quantity;
                $rate   = $item->rate;

                event(new PurchaseOrderItemBillingChanged(
                    $poItem,
                    $qty,
                    $returnAgainst ? 'decrement' : 'increment',
                    $returnAgainst ? $item->returnAgainstItem : null,
                ));

                if (! $returnAgainst) {
                    // === ALUR-1: Receipt sudah ada duluan → update SLE pending ===
                    $isAlreadyReceived = $poItem->received_quantity > 0;

                    if ($isAlreadyReceived) {
                        $stockGLForItem = $this->updatePendingSLEs($poItem, $purchaseOrder, $qty, $rate, $purchaseInvoice);
                        $totalStockGL += $stockGLForItem;
                    }
                    // ALUR-2: Receipt belum ada → tidak ada SLE pending, skip
                }
            }

            // basic_amount/tax_amount item sudah net (dikurangi discount_amount) sejak
            // create()/update() -- di sini murni sum, bukan alokasi ulang diskon.
            $totalAmount = $basicAmount + $taxAmount;

            // === GL posting dipindah ke queued Job (Stock/SRNB + Expense/Credit digabung 1 event) ===
            GlPostingStatus::create([
                'referenceable_type' => PurchaseInvoice::class,
                'referenceable_id'   => $purchaseInvoice->id,
                'status'             => FormStatus::PENDING,
            ]);
            event(new PurchaseInvoiceGeneralLedgerPostingRequested(
                $purchaseInvoice,
                $totalStockGL,
                $totalAmount,
                (bool) $returnAgainst,
                now(),
                $purchaseInvoice->expenseHeadAccount->id,
                $purchaseInvoice->creditAccount->id,
            ));

            // === UPDATE STATUS PO ===
            event(new PurchaseOrderBillStatusRecalculationRequested($purchaseOrder, $returnAgainst));

            $purchaseInvoice->update([
                'amount' => $totalAmount,
                'status' => $returnAgainst ? FormStatus::RETURNED : FormStatus::UNPAID,
            ]);

            if ($returnAgainst) {
                // Lock returnAgainst (PurchaseInvoice asal) untuk kalkulasi status retur (Req 1.6)
                $returnAgainst      = PurchaseInvoice::where('id', $returnAgainst->id)->lockForUpdate()->first();
                $unbilledItems      = $returnAgainst->items()->select(['returned_quantity', 'quantity'])->get();
                $countReturnedItems = $unbilledItems->sum('returned_quantity');
                $sumQuantity        = $unbilledItems->sum('quantity');

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
                event(new PurchaseInvoiceReturnStatusChanged($returnAgainst, $status));
            }

            DB::commit();

            // Dispatch FixedAssetItemApproved for each fixed-asset item
            foreach ($items as $item) {
                $variant = $item->item;
                if (! $variant || ! $variant->item || ! $variant->item->is_fixed_asset) {
                    continue;
                }
                FixedAssetItemApproved::dispatch($purchaseInvoice, $item, $variant->item);
            }

            return $purchaseInvoice;
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Update SLE pending (is_valuated=false) untuk ALUR-1.
     * Pecah SLE jika qty invoice < qty SLE, isi change_in_stock_value dan valuation_rate.
     * Return total nilai untuk GL Stock/SRNB.
     */
    private function updatePendingSLEs($poItem, PurchaseOrder $purchaseOrder, float $qty, float $rate, PurchaseInvoice $purchaseInvoice): float {
        // Cari receipt IDs yang terkait dengan PO ini
        $receiptIds = ModelConnection::where('model_type', PurchaseOrder::class)
            ->where('model_id', $purchaseOrder->id)
            ->where('reference_type', PurchaseReceipt::class)
            ->pluck('reference_id');

        // Cari SLE pending yang berasal dari Receipt items untuk PO item ini
        $pendingSLEs = StockLedgerEntry::where('is_valuated', false)
            ->where('referenceable_type', PurchaseReceipt::class)
            ->whereIn('referenceable_id', $receiptIds)
            ->whereHasMorph('referenceable', [PurchaseReceipt::class], function ($q) use ($poItem) {
                $q->whereHas('items', fn ($q2) => $q2->where('purchase_order_item_id', $poItem->id));
            })
            ->orderBy('created_at') // FIFO
            ->lockForUpdate()
            ->get();

        $remainingQty = $qty;
        $totalValue   = 0;

        // Pre-load stock untuk koreksi queue (keyed by item_id-warehouse_id)
        $stocks = Stock::whereIn('item_variant_id', $pendingSLEs->pluck('item_id')->unique())
            ->whereIn('warehouse_id', $pendingSLEs->pluck('warehouse_id')->unique())
            ->lockForUpdate()
            ->get()
            ->keyBy(fn ($s) => "{$s->item_variant_id}-{$s->warehouse_id}");

        foreach ($pendingSLEs as $sle) {
            if ($remainingQty <= 0) {
                break;
            }

            $sleQty      = $sle->quantity_change;
            $allocateQty = min($sleQty, $remainingQty);

            if ($allocateQty < $sleQty) {
                // SLE perlu dipecah: buat SLE baru untuk porsi yang tervaluasi
                $newSle                        = $sle->replicate();
                $newSle->quantity_change       = $allocateQty;
                $newSle->change_in_stock_value = $rate * $allocateQty;
                $newSle->valuation_rate        = $rate;
                $newSle->balance_stock_value   = $rate * $allocateQty;
                $newSle->is_valuated           = true;
                $newSle->save();

                // Kurangi SLE lama
                $sle->update(['quantity_change' => $sleQty - $allocateQty]);
            } else {
                // Update SLE secara keseluruhan
                $sle->update([
                    'change_in_stock_value' => $rate * $allocateQty,
                    'valuation_rate'        => $rate,
                    'balance_stock_value'   => $rate * $allocateQty,
                    'is_valuated'           => true,
                ]);
            }

            // Koreksi stock_queue di Stock: lookup by sle_id → update rate + is_valuated
            $sleIdToFind = $allocateQty < $sleQty ? $newSle->id : $sle->id;
            $stockKey    = "{$sle->item_id}-{$sle->warehouse_id}";
            $stock       = $stocks->get($stockKey);
            if ($stock) {
                $queue   = $stock->stock_queue ?? [];
                $updated = false;

                foreach ($queue as &$entry) {
                    if (($entry['sle_id'] ?? null) === $sleIdToFind) {
                        $entry['rate']        = $rate;
                        $entry['is_valuated'] = true;
                        $updated              = true;
                        break;
                    }
                }
                unset($entry);

                if ($updated) {
                    $stock->update(['stock_queue' => $queue]);
                    $stock->refresh();
                    $stocks->put($stockKey, $stock);
                }
            }

            $totalValue += $rate * $allocateQty;
            $remainingQty -= $allocateQty;
        }

        // Sisa qty over-bill: SLE baru tanpa valuasi (pending)
        if ($remainingQty > 0) {
            StockLedgerEntry::create([
                'item_id'                    => $pendingSLEs->first()?->item_id ?? $poItem->item_id,
                'warehouse_id'               => $pendingSLEs->first()?->warehouse_id,
                'unit_id'                    => $pendingSLEs->first()?->unit_id,
                'item_unit_id'               => $pendingSLEs->first()?->item_unit_id,
                'conversion_factor'          => $pendingSLEs->first()?->conversion_factor ?? 1,
                'quantity_change'            => $remainingQty,
                'quantity_after_transaction' => 0,
                'valuation_rate'             => 0,
                'balance_stock_value'        => 0,
                'change_in_stock_value'      => 0,
                'stock_queue'                => $pendingSLEs->first()?->stock_queue ?? [],
                'referenceable_type'         => PurchaseInvoice::class,
                'referenceable_id'           => $purchaseInvoice->id,
                'is_valuated'                => false,
            ]);
        }

        return $totalValue;
    }

    /**
     * Update status PO untuk billed quantity (termasuk OVER_BILLED)
     */
    public function onRejected(Model $purchaseInvoice): mixed {
        DB::beginTransaction();
        $purchaseInvoice->update([
            'status' => FormStatus::REJECTED,
        ]);

        DB::commit();

        return $purchaseInvoice;
    }

    public function cancel(Model $purchaseInvoice): mixed {
        $purchaseInvoice->update([
            'status' => FormStatus::CANCELED,
        ]);

        return $purchaseInvoice;
    }

    public function amend(Model $model): mixed {
        return $model;
    }

    /**
     * Catat data Faktur Pajak Masukan yang diterima dari supplier & simpan breakdown
     * DPP/PPN. Beda dengan SalesInvoiceService::assignTaxInvoice() -- nomor seri di
     * sini DITRANSKRIP dari dokumen supplier (bukan dialokasikan dari range sendiri),
     * karena Faktur Pajak Masukan diterbitkan pihak lain, bukan sistem ini.
     *
     * PPnBM belum didukung (Requirement 4 belum diimplementasi di spec ini), tax_invoice_ppnbm_amount tetap 0.
     *
     * @param  string  $transactionCode  salah satu dari TaxInvoiceSerialAllocator::TRANSACTION_CODES
     */
    public function recordTaxInvoice(PurchaseInvoice $purchaseInvoice, string $transactionCode, string $serialNumber, \DateTimeInterface $taxInvoiceDate): PurchaseInvoice {
        if (! \in_array($transactionCode, TaxInvoiceSerialAllocator::TRANSACTION_CODES, true)) {
            throw ValidationException::withMessages([
                'tax_invoice_transaction_code' => 'Kode transaksi Faktur Pajak tidak valid.',
            ]);
        }

        $purchaseInvoice->loadMissing('items');

        $purchaseInvoice->update([
            'tax_invoice_transaction_code' => $transactionCode,
            'tax_invoice_serial_number'    => $serialNumber,
            'tax_invoice_date'             => $taxInvoiceDate,
            'tax_invoice_dpp_amount'       => $purchaseInvoice->items->sum('dpp_amount'),
            'tax_invoice_ppn_amount'       => $purchaseInvoice->items->sum('tax_amount'),
        ]);

        return $purchaseInvoice;
    }
}
