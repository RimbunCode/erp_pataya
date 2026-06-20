<?php

namespace App\Services\Finances;

use App\Enums\FormStatus;
use App\Models\Core\FormatingSeries;
use App\Models\Core\ModelConnection;
use App\Models\Core\Preference;
use App\Models\Finances\Account;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Inventory\Stock;
use App\Models\Inventory\StockLedgerEntry;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\PurchaseReceipt;
use App\Utils;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\Uid\Ulid;

class PurchaseInvoiceService {
    private function fillRelations(array $data) {
        $data['purchase_order_id'] = $data['purchase_order']['id'];
        $data['supplier_id']       = $data['supplier']['id'];
        $data['supplier_name']     = $data['supplier']['name'] ?? null;

        // account relations
        $data['credit_account_id']       = $data['credit_account']['id'] ?? null;
        $data['expanse_head_account_id'] = $data['expense_head_account']['id'] ?? null;
        $data['return_against_id']       = $data['return_against']['id'] ?? null;

        $defaultCurrency              = Preference::find('default_currency_id')->value;
        $data['currency_code']        = $data['currency']['code'] ?? $defaultCurrency;
        $data['base_currency_code']   = $defaultCurrency;
        $data['exchange_rate']      ??= 1;

        return $data;
    }

    private function fillItemRelations(array $data, PurchaseInvoice $purchaseInvoice) {
        $data['item_id']           = $data['item']['id'];
        $data['item_unit_id']      = $data['unit']['id'];
        $data['conversion_factor'] = $data['unit']['conversion_factor'];
        $data['exchange_rate']     = $purchaseInvoice->exchange_rate;
        $data['tax_id']            = $data['tax']['id'];
        $data['tax_rate']          = $data['tax']['rate'] ?? 0;

        return $data;
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

    public function create(array $data) {
        $data['code']    = FormatingSeries::generate(PurchaseInvoice::class, $data, true);
        $purchaseInvoice = PurchaseInvoice::create($this->fillRelations($data));

        $basicAmount = 0;
        $taxAmount   = 0;

        foreach ($data['items'] as $item) {
            $item = $this->fillItemRelations($item, $purchaseInvoice);
            $item = $purchaseInvoice->items()->create($item);
            $item->refresh();
            $basicAmount += $item->basic_amount;
            $taxAmount   += $item->tax_amount;
        }

        $totalAmount = Utils::countAmount($basicAmount, $taxAmount, $purchaseInvoice->discount_on, $purchaseInvoice->discount_amount);
        $purchaseInvoice->update([
            'amount' => $totalAmount,
        ]);

        foreach ($data['payment_schedules'] ?? [] as $payment_schedule) {
            $payment_schedule = $this->fillPaymentScheduleRelations($payment_schedule, $purchaseInvoice);
            $purchaseInvoice->paymentSchedules()->create($payment_schedule);
        }
        $purchaseInvoice->logForCreated();

        return $purchaseInvoice;
    }

    public function update(PurchaseInvoice $purchaseInvoice, array $data) {
        $purchaseInvoice->fillForUpdate($this->fillRelations($data));

        $basicAmount = 0;
        $taxAmount   = 0;

        $purchaseInvoice->items()
            ->whereNotIn('id', array_column($data['items'], 'id'))
            ->delete();
        $itemIds       = collect($data['items'])
            ->pluck('id')
            ->filter(fn ($id) => Ulid::isValid((string) $id))
            ->values()
            ->all();
        $existingItems = $purchaseInvoice->items()
            ->whereIn('id', $itemIds)
            ->get()
            ->keyBy('id');

        foreach ($data['items'] as $item) {
            $item = $this->fillItemRelations($item, $purchaseInvoice);

            if (Ulid::isValid($item['id'])) {
                $itemModel = $existingItems->get($item['id']);
                if ($itemModel) {
                    $itemModel->fill($item);
                    $itemModel->save();
                    $itemModel->refresh();
                } else {
                    $itemModel = $purchaseInvoice->items()->create($item);
                    $itemModel->refresh();
                }
            } else {
                $itemModel = $purchaseInvoice->items()->create($item);
                $itemModel->refresh();
            }

            $basicAmount += $itemModel->basic_amount;
            $taxAmount   += $itemModel->tax_amount;
        }

        $totalAmount = Utils::countAmount($basicAmount, $taxAmount, $purchaseInvoice->discount_on, $purchaseInvoice->discount_amount);
        $purchaseInvoice->update([
            'amount' => $totalAmount,
        ]);

        $paymentSchedules = $data['payment_schedules'] ?? [];
        $purchaseInvoice->paymentSchedules()
            ->whereNotIn('id', array_column($paymentSchedules, 'id'))
            ->delete();
        $paymentScheduleIds       = collect($paymentSchedules)
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
        $purchaseInvoice->logForUpdated();

        return $purchaseInvoice;
    }

    public function submit(PurchaseInvoice $purchaseInvoice) {
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
        ModelConnection::create([
            'model_type'     => PurchaseOrder::class,
            'model_id'       => $purchaseInvoice->purchase_order_id,
            'reference_type' => PurchaseInvoice::class,
            'reference_id'   => $purchaseInvoice->id,
        ]);

        DB::commit();

        $purchaseInvoice->checkApproval();

        return $purchaseInvoice;
    }

    public function onApproved(PurchaseInvoice $purchaseInvoice) {
        DB::beginTransaction();

        try {
            $purchaseInvoice->load([
                'expenseHeadAccount',
                'creditAccount',
                'purchaseOrder',
                'returnAgainst',
                'items.returnAgainstItem',
                'items.purchaseOrderItem',
            ]);

            $returnAgainst = $purchaseInvoice->returnAgainst;
            $items         = $purchaseInvoice->items;
            $purchaseOrder = $purchaseInvoice->purchaseOrder;

            $basicAmount  = 0;
            $taxAmount    = 0;
            $totalStockGL = 0; // Untuk GL Stock/SRNB (ALUR-1)

            foreach ($items as $item) {
                $basicAmount += $item->basic_amount;
                $taxAmount   += $item->tax_amount;

                $poItem = $item->purchaseOrderItem;
                $qty    = $item->quantity;
                $rate   = $item->rate;

                if ($returnAgainst) {
                    $item->returnAgainstItem->increment('returned_quantity', $qty);
                    $poItem->decrement('billed_quantity', $qty);
                } else {
                    $poItem->increment('billed_quantity', $qty);

                    // === ALUR-1: Receipt sudah ada duluan → update SLE pending ===
                    $isAlreadyReceived = $poItem->received_quantity > 0;

                    if ($isAlreadyReceived) {
                        $stockGLForItem  = $this->updatePendingSLEs($poItem, $purchaseOrder, $qty, $rate, $purchaseInvoice);
                        $totalStockGL   += $stockGLForItem;
                    }
                    // ALUR-2: Receipt belum ada → tidak ada SLE pending, skip
                }
            }

            $totalAmount = Utils::countAmount($basicAmount, $taxAmount, $purchaseInvoice->discount_on, $purchaseInvoice->discount_amount);

            $debitAccount  = $purchaseInvoice->expenseHeadAccount;
            $creditAccount = $purchaseInvoice->creditAccount;

            // === GL Stock/SRNB untuk ALUR-1 ===
            if ($totalStockGL > 0 && ! $returnAgainst) {
                $stockAccount = Account::lockForUpdate()
                    ->where('root_type', 'asset')
                    ->where('account_type', 'stock')
                    ->latest()->first();

                $srnbAccount = Account::lockForUpdate()
                    ->where('root_type', 'liability')
                    ->where('account_type', 'stock_received_but_not_billed')
                    ->latest()->first();

                // Debit Stock Asset / Credit SRNB
                $stockAccount->generalLedgerEntries()->create([
                    'against_account_id' => $srnbAccount->id,
                    'debit'              => $totalStockGL,
                    'credit'             => 0,
                    'referenceable_type' => PurchaseInvoice::class,
                    'referenceable_id'   => $purchaseInvoice->id,
                ]);

                $srnbAccount->generalLedgerEntries()->create([
                    'against_account_id' => $stockAccount->id,
                    'debit'              => 0,
                    'credit'             => $totalStockGL,
                    'referenceable_type' => PurchaseInvoice::class,
                    'referenceable_id'   => $purchaseInvoice->id,
                ]);
            }

            // === GL SRNB/AP (kedua alur selalu dibuat) ===
            $debitAccount->generalLedgerEntries()->create([
                'against_account_id' => $creditAccount->id,
                'debit'              => $returnAgainst ? 0 : $totalAmount,
                'credit'             => $returnAgainst ? $totalAmount : 0,
                'referenceable_type' => PurchaseInvoice::class,
                'referenceable_id'   => $purchaseInvoice->id,
            ]);

            $creditAccount->generalLedgerEntries()->create([
                'against_account_id' => $debitAccount->id,
                'debit'              => $returnAgainst ? $totalAmount : 0,
                'credit'             => $returnAgainst ? 0 : $totalAmount,
                'referenceable_type' => PurchaseInvoice::class,
                'referenceable_id'   => $purchaseInvoice->id,
            ]);

            // === UPDATE STATUS PO ===
            $this->updatePurchaseOrderBillStatus($purchaseOrder, $returnAgainst);

            $purchaseInvoice->update([
                'amount' => $totalAmount,
                'status' => $returnAgainst ? FormStatus::RETURNED : FormStatus::UNPAID,
            ]);

            if ($returnAgainst) {
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
                $returnAgainst->update(['status' => $status]);
            }

            DB::commit();

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

            $totalValue   += $rate * $allocateQty;
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
    private function updatePurchaseOrderBillStatus(PurchaseOrder $purchaseOrder, $returnAgainst): void {
        $unbilledItems = $purchaseOrder->items()->select(['id', 'unbilled_quantity', 'quantity', 'billed_quantity'])->get();
        $totalQty      = $unbilledItems->sum('quantity');
        $totalBilled   = $unbilledItems->sum('billed_quantity');

        if ($totalBilled == 0) {
            $newStatus      = FormStatus::TO_BILL;
            $removeStatuses = [FormStatus::BILLED, FormStatus::PARTIALLY_BILLED, FormStatus::OVER_BILLED];
        } elseif ($totalBilled > $totalQty) {
            $newStatus      = FormStatus::OVER_BILLED;
            $removeStatuses = [FormStatus::TO_BILL, FormStatus::PARTIALLY_BILLED, FormStatus::BILLED];
        } elseif ($totalBilled < $totalQty) {
            $newStatus      = FormStatus::PARTIALLY_BILLED;
            $removeStatuses = [FormStatus::TO_BILL, FormStatus::BILLED, FormStatus::OVER_BILLED];
        } else {
            $newStatus      = FormStatus::BILLED;
            $removeStatuses = [FormStatus::TO_BILL, FormStatus::PARTIALLY_BILLED, FormStatus::OVER_BILLED];
        }

        $purchaseOrder->update([
            'status' => Utils::replaceStatus($purchaseOrder->status, $removeStatuses, $newStatus),
        ]);
    }

    public function onRejected(PurchaseInvoice $purchaseInvoice) {
        DB::beginTransaction();
        $purchaseInvoice->update([
            'status' => FormStatus::REJECTED,
        ]);

        DB::commit();

        return $purchaseInvoice;
    }

    public function cancel(PurchaseInvoice $purchaseInvoice) {
        $purchaseInvoice->update([
            'status' => FormStatus::CANCELED,
        ]);

        return $purchaseInvoice;
    }
}
