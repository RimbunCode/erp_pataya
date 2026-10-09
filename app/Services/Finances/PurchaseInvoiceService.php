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
use App\Models\Finances\PurchaseInvoiceItem;
use App\Models\Finances\Tax;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\Stock;
use App\Models\Inventory\StockLedgerEntry;
use App\Models\Model;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\PurchaseOrderItem;
use App\Models\Purchase\PurchaseReceipt;
use App\Models\Purchase\PurchaseReceiptItem;
use App\Models\Purchase\Supplier;
use App\Traits\HasDefaultDelete;
use App\Utils;
use Illuminate\Support\Collection;
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

    private function fillItemRelations(array $data, PurchaseInvoice $purchaseInvoice, array $units = [], array $taxes = [], array $purchaseOrderItems = [], array $receiptItems = []) {
        $unit          = $units[$data['unit']['id']] ?? null;
        $tax           = $taxes[$data['tax']['id'] ?? ''] ?? null;
        $poItemId      = $data['purchase_order_item']['id'] ?? null;
        $receiptItemId = $data['purchase_receipt_item']['id'] ?? null;

        // Tiga sumber baris (spec purchase-invoice-off-po-items): PO Item (normal),
        // baris receipt di luar PO, atau item bebas (`item.id`).
        $data['purchase_order_item_id']   = $poItemId;
        $data['purchase_receipt_item_id'] = $receiptItemId;
        $data['item_id']                  = $poItemId
            ? $purchaseOrderItems[$poItemId]->item_id
            : ($receiptItemId ? $receiptItems[$receiptItemId]->item_id : $data['item']['id']);
        $data['item_unit_id']      = $data['unit']['id'];
        $data['conversion_factor'] = $unit?->conversion_factor ?? 1;
        $data['exchange_rate']     = $purchaseInvoice->exchange_rate;
        $data['tax_id']            = $data['tax']['id'] ?? null;
        $data['tax_rate']          = $tax?->rate ?? 0;

        return $data;
    }

    private function batchLoadPurchaseOrderItems(array $data): array {
        $ids = collect($data['items'])->pluck('purchase_order_item.id')->filter()->unique()->values();

        return PurchaseOrderItem::whereIn('id', $ids)->get()->keyBy('id')->all();
    }

    private function batchLoadReceiptItems(array $data): array {
        $ids = collect($data['items'])->pluck('purchase_receipt_item.id')->filter()->unique()->values();

        return PurchaseReceiptItem::whereIn('id', $ids)->get()->keyBy('id')->all();
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
        $receiptItems       = $this->batchLoadReceiptItems($data);

        $items = collect();
        foreach ($data['items'] as $item) {
            $item      = $this->fillItemRelations($item, $purchaseInvoice, $units, $taxes, $purchaseOrderItems, $receiptItems);
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
        $receiptItems       = $this->batchLoadReceiptItems($data);

        $items = collect();
        foreach ($data['items'] as $item) {
            $item = $this->fillItemRelations($item, $purchaseInvoice, $units, $taxes, $purchaseOrderItems, $receiptItems);

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
                'items.purchaseReceiptItem',
                'items.returnAgainstItem.purchaseReceiptItem',
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

                // Baris di luar PO (baris receipt / item bebas) tak punya PO Item:
                // status tagihan PO hanya menghitung PO Item (spec purchase-invoice-off-po-items).
                if ($poItem) {
                    event(new PurchaseOrderItemBillingChanged(
                        $poItem,
                        $qty,
                        $returnAgainst ? 'decrement' : 'increment',
                        $returnAgainst ? $item->returnAgainstItem : null,
                    ));
                }

                if (! $returnAgainst) {
                    if ($poItem) {
                        // === ALUR-1: Receipt sudah ada duluan → update SLE pending ===
                        $isAlreadyReceived = $poItem->received_quantity > 0;

                        if ($isAlreadyReceived) {
                            $stockGLForItem = $this->updatePendingSLEs($poItem, $purchaseOrder, $qty, $rate, $purchaseInvoice);
                            $totalStockGL += $stockGLForItem;
                        }
                        // ALUR-2: Receipt belum ada → tidak ada SLE pending, skip
                    } elseif ($item->purchase_receipt_item_id) {
                        $totalStockGL += $this->billReceiptRow($item->purchaseReceiptItem, $qty, $rate, $purchaseInvoice);
                    } else {
                        $totalStockGL += $this->billFreeItem($item, $purchaseOrder, $purchaseInvoice);
                    }
                } elseif (! $poItem) {
                    $this->reverseReceiptBilling($item, $qty);
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

        // Cari SLE pending yang berasal dari baris Receipt untuk PO item ini: baris
        // normal (`purchase_order_item_id`) ATAU baris pengganti di luar PO
        // (`replaces_purchase_order_item_id`, spec purchase-receipt-off-po-items).
        // SLE dicocokkan ke baris lewat item_id supaya baris lain di receipt yang
        // sama (mis. barang berdiri sendiri) tidak ikut dinilai invoice ini.
        $pendingSLEs = StockLedgerEntry::where('is_valuated', false)
            ->where('referenceable_type', PurchaseReceipt::class)
            ->whereIn('referenceable_id', $receiptIds)
            ->whereExists(function ($sub) use ($poItem) {
                $sub->select(DB::raw(1))
                    ->from('purchase_receipt_items as pri')
                    ->whereColumn('pri.purchase_receipt_id', 'stock_ledger_entries.referenceable_id')
                    ->whereColumn('pri.item_id', 'stock_ledger_entries.item_id')
                    ->whereNull('pri.deleted_at')
                    ->where(function ($match) use ($poItem) {
                        $match->where('pri.purchase_order_item_id', $poItem->id)
                            ->orWhere('pri.replaces_purchase_order_item_id', $poItem->id);
                    });
            })
            ->orderBy('transaction_date') // FIFO
            ->lockForUpdate()
            ->get();

        // Sisa porsi yang boleh dinilai per (receipt, item): null = tanpa batas (baris
        // normal); baris pengganti dibatasi `replaced_quantity` (selebihnya tetap pending).
        return $this->valuePendingSLEs(
            $pendingSLEs,
            $qty,
            $rate,
            $purchaseInvoice,
            fn (StockLedgerEntry $sle) => $this->eligibleQuantityForPoItem($sle, $poItem),
            ['item_id'                 => $poItem->item_id, 'warehouse_id' => $poItem->target_warehouse_id, 'item_unit_id' => $poItem->item_unit_id],
        );
    }

    /**
     * Inti penilaian SLE pending (dipakai jalur PO Item, baris receipt, item bebas):
     * alokasi FIFO `$qty` ke `$pendingSLEs` dengan `$rate`, memecah SLE bila perlu dan
     * mengoreksi stock_queue. `$eligibleFor($sle)` = batas porsi yang boleh dinilai per
     * (receipt, item) (null = tanpa batas). `$overBill` (item/gudang/satuan fallback)
     * non-null -> sisa qty over-bill menjadi SLE pending baru yang menunjuk invoice.
     *
     * @param  Collection<int, StockLedgerEntry>  $pendingSLEs
     * @param  array{item_id: string, warehouse_id: string|null, item_unit_id: string|null}|null  $overBill
     */
    private function valuePendingSLEs(Collection $pendingSLEs, float $qty, float $rate, PurchaseInvoice $purchaseInvoice, callable $eligibleFor, ?array $overBill): float {
        $eligibleLeft = [];

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

            $eligibleKey = "{$sle->referenceable_id}|{$sle->item_id}";
            if (! \array_key_exists($eligibleKey, $eligibleLeft)) {
                $eligibleLeft[$eligibleKey] = $eligibleFor($sle);
            }
            $eligible = $eligibleLeft[$eligibleKey];
            if ($eligible !== null && $eligible <= 0) {
                continue;
            }

            $sleQty      = $sle->quantity_change;
            $allocateQty = min($sleQty, $remainingQty, $eligible ?? $sleQty);

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
            if ($eligible !== null) {
                $eligibleLeft[$eligibleKey] = $eligible - $allocateQty;
            }
        }

        // Sisa qty over-bill: SLE baru tanpa valuasi (pending)
        if ($remainingQty > 0 && $overBill !== null) {
            StockLedgerEntry::create([
                'item_id'                    => $pendingSLEs->first()?->item_id ?? $overBill['item_id'],
                'warehouse_id'               => $pendingSLEs->first()?->warehouse_id ?? $overBill['warehouse_id'],
                'item_unit_id'               => $pendingSLEs->first()?->item_unit_id ?? $overBill['item_unit_id'],
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
                'transaction_date'           => $purchaseInvoice->date,
            ]);
        }

        return $totalValue;
    }

    /**
     * Nilai SLE pending milik SATU baris receipt di luar PO (receipt + item_id) sebanyak
     * `$qty` dengan `$rate`; porsi maksimal = sisa baris (`quantity − billed_quantity`).
     * `$withOverBill` true (baris receipt eksplisit): sisa qty jadi SLE pending baru.
     */
    private function valueReceiptRow(PurchaseReceiptItem $row, float $qty, float $rate, PurchaseInvoice $purchaseInvoice, bool $withOverBill): float {
        $pendingSLEs = StockLedgerEntry::where('is_valuated', false)
            ->where('referenceable_type', PurchaseReceipt::class)
            ->where('referenceable_id', $row->purchase_receipt_id)
            ->where('item_id', $row->item_id)
            ->orderBy('transaction_date') // FIFO
            ->lockForUpdate()
            ->get();

        $capacity = max(0.0, (float) $row->quantity - (float) $row->billed_quantity);

        return $this->valuePendingSLEs(
            $pendingSLEs,
            $qty,
            $rate,
            $purchaseInvoice,
            fn () => $capacity,
            $withOverBill
                ? ['item_id' => $row->item_id, 'warehouse_id' => $row->target_warehouse_id, 'item_unit_id' => $row->item_unit_id]
                : null,
        );
    }

    /**
     * Baris invoice yang menagih baris receipt di luar PO: nilai SLE pending baris itu,
     * over-bill diizinkan (sisa -> SLE pending), `billed_quantity` naik sebesar qty invoice.
     */
    private function billReceiptRow(PurchaseReceiptItem $row, float $qty, float $rate, PurchaseInvoice $purchaseInvoice): float {
        $row   = PurchaseReceiptItem::where('id', $row->id)->lockForUpdate()->first();
        $value = $this->valueReceiptRow($row, $qty, $rate, $purchaseInvoice, withOverBill: true);
        $row->increment('billed_quantity', $qty);

        return $value;
    }

    /**
     * Baris invoice item bebas: cocokkan baris receipt berdiri sendiri pada PO yang sama
     * dengan `item_id` sama (FIFO urut tanggal receipt, sisa `quantity − billed_quantity`)
     * dan nilai seperti baris receipt. Yang belum punya receipt menunggu; `allocated_qty`
     * mencatat porsi yang sudah dialokasikan (dipakai receipt yang datang kemudian).
     */
    private function billFreeItem(PurchaseInvoiceItem $item, ?PurchaseOrder $purchaseOrder, PurchaseInvoice $purchaseInvoice): float {
        if (! $purchaseOrder) {
            return 0;
        }

        $rows = PurchaseReceiptItem::query()
            ->whereNull('purchase_order_item_id')
            ->whereNull('replaces_purchase_order_item_id')
            ->where('item_id', $item->item_id)
            ->whereColumn('quantity', '>', 'billed_quantity')
            ->whereHas('purchaseReceipt', function ($q) use ($purchaseOrder) {
                $q->where('purchase_order_id', $purchaseOrder->id)
                    ->whereNull('return_against_id')
                    ->whereNotNull('submitted_at')
                    ->whereJsonContains('status', 'received');
            })
            ->with('purchaseReceipt')
            ->lockForUpdate()
            ->get()
            ->sortBy(fn ($row) => $row->purchaseReceipt->date);

        $remaining = (float) $item->quantity;
        $allocated = 0.0;
        $total     = 0.0;
        foreach ($rows as $row) {
            if ($remaining <= 0) {
                break;
            }
            $capacity = (float) $row->quantity - (float) $row->billed_quantity;
            $allocate = min($remaining, $capacity);
            if ($allocate <= 0) {
                continue;
            }

            $total += $this->valueReceiptRow($row, $allocate, (float) $item->rate, $purchaseInvoice, withOverBill: false);
            $row->increment('billed_quantity', $allocate);
            $remaining -= $allocate;
            $allocated += $allocate;
        }

        if ($allocated > 0) {
            $item->increment('allocated_qty', $allocated);
        }

        return $total;
    }

    /**
     * Retur invoice: baris receipt yang ditagih membalik `billed_quantity` (minimal 0).
     * Retur item bebas hanya membalik GL (SLE tidak dibalik, perilaku retur yang ada).
     */
    private function reverseReceiptBilling(PurchaseInvoiceItem $item, float $qty): void {
        $row = $item->returnAgainstItem?->purchaseReceiptItem ?? $item->purchaseReceiptItem;
        if (! $row) {
            return;
        }

        $row = PurchaseReceiptItem::where('id', $row->id)->lockForUpdate()->first();
        $row?->update(['billed_quantity' => max(0, (float) $row->billed_quantity - $qty)]);
    }

    /**
     * Porsi SLE pending yang boleh dinilai invoice PO Item ini: null bila SLE
     * berasal dari baris normal PO Item itu (seluruhnya); selain itu jumlah
     * `replaced_quantity` baris pengganti yang menunjuk PO Item ini.
     */
    private function eligibleQuantityForPoItem(StockLedgerEntry $sle, $poItem): ?float {
        $rows = PurchaseReceiptItem::where('purchase_receipt_id', $sle->referenceable_id)
            ->where('item_id', $sle->item_id)
            ->where(function ($q) use ($poItem) {
                $q->where('purchase_order_item_id', $poItem->id)
                    ->orWhere('replaces_purchase_order_item_id', $poItem->id);
            })
            ->get();

        if ($rows->contains(fn ($row) => $row->purchase_order_item_id === $poItem->id)) {
            return null;
        }

        return (float) $rows->sum('replaced_quantity');
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
