<?php

namespace App\Services\Finances;

use App\FormStatus;
use App\Models\Core\FormatingSeries;
use App\Models\Core\ModelConnection;
use App\Models\Core\Preference;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Purchase\PurchaseOrder;
use App\Utils;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\Uid\Ulid;

class PurchaseInvoiceService {
    /**
     * Create a new class instance.
     */
    private function fillRelations(array $data) {
        $data['purchase_order_id'] = $data['purchase_order']['id'];
        $data['supplier_id']       = $data['supplier']['id'];
        $data['supplier_name']     = $data['supplier']['name'] ?? null;

        // account relations
        $data['credit_account_id']       = $data['credit_account']['id'] ?? null;
        $data['expanse_head_account_id'] = $data['expense_head_account']['id'] ?? null;
        $data['return_against_id']       = $data['return_against']['id'] ?? null;

        $defaultCurrency            = Preference::find('default_currency_id')->value;
        $data['currency_code']      = $data['currency']['code'] ?? $defaultCurrency;
        $data['base_currency_code'] = $defaultCurrency;
        $data['exchange_rate'] ??= 1;

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
        $data['payment_term_id']    = $data['payment_term']['id'] ?? null;
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
            $taxAmount += $item->tax_amount;
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

        foreach ($data['items'] as $item) {
            $item = $this->fillItemRelations($item, $purchaseInvoice);

            if (Ulid::isValid($item['id'])) {
                $itemModel = $purchaseInvoice->items()->find($item['id']);
                $itemModel->fill($item);
                $itemModel->save();
                $itemModel->refresh();
            } else {
                $itemModel = $purchaseInvoice->items()->create($item);
                $itemModel->refresh();
            }

            $basicAmount += $itemModel->basic_amount;
            $taxAmount += $itemModel->tax_amount;
        }

        $totalAmount = Utils::countAmount($basicAmount, $taxAmount, $purchaseInvoice->discount_on, $purchaseInvoice->discount_amount);
        $purchaseInvoice->update([
            'amount' => $totalAmount,
        ]);

        $paymentSchedules = $data['payment_schedules'] ?? [];
        $purchaseInvoice->paymentSchedules()
            ->whereNotIn('id', array_column($paymentSchedules, 'id'))
            ->delete();
        foreach ($paymentSchedules as $payment_schedule) {
            $payment_schedule = $this->fillPaymentScheduleRelations($payment_schedule, $purchaseInvoice);
            if (Ulid::isValid($payment_schedule['id'])) {
                $purchaseInvoice->paymentSchedules()->find($payment_schedule['id'])->update($payment_schedule);

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
            // check sum of invoice portion must be 100%
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

            $basicAmount = 0;
            $taxAmount   = 0;

            foreach ($items as $item) {
                $basicAmount += $item->basic_amount;
                $taxAmount += $item->tax_amount;
                if ($returnAgainst) {
                    $item->returnAgainstItem->increment('returned_quantity', $item->quantity);
                    $item->purchaseOrderItem->decrement('billed_quantity', $item->quantity);
                } else {
                    $item->purchaseOrderItem->increment('billed_quantity', $item->quantity);
                }
            }
            $totalAmount = Utils::countAmount($basicAmount, $taxAmount, $purchaseInvoice->discount_on, $purchaseInvoice->discount_amount);

            $debitAccount  = $purchaseInvoice->expenseHeadAccount;
            $creditAccount = $purchaseInvoice->creditAccount;

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
            $purchaseOrder      = $purchaseInvoice->purchaseOrder;
            $unbilledItems      = $purchaseOrder->items()->select(['id', 'unbilled_quantity', 'quantity'])->get();
            $countUnbilledItems = $unbilledItems->sum('unbilled_quantity');
            $sumQuantity        = $unbilledItems->sum('quantity');
            if ($countUnbilledItems == $sumQuantity) {
                $status = Utils::replaceStatus(
                    $purchaseOrder->status,
                    [FormStatus::BILLED, FormStatus::PARTIALLY_BILLED],
                    FormStatus::TO_BILL,
                );
            } elseif ($countUnbilledItems > 0) {
                $status = Utils::replaceStatus(
                    $purchaseOrder->status,
                    FormStatus::TO_BILL,
                    FormStatus::PARTIALLY_BILLED,
                );
            } else {
                $status = Utils::replaceStatus(
                    $purchaseOrder->status,
                    [FormStatus::TO_BILL, FormStatus::PARTIALLY_BILLED],
                    FormStatus::BILLED,
                );
            }
            $purchaseOrder->update([
                'status' => $status,
            ]);
            $purchaseInvoice->update([
                'amount' => $totalAmount,
                'status' => $returnAgainst ? FormStatus::RETURNED : FormStatus::UNPAID,
            ]);
            if ($returnAgainst) {
                $returnedItems      = $returnAgainst->items()->select(['returned_quantity', 'quantity'])->get();
                $countReturnedItems = $returnedItems->sum('returned_quantity');
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
                $returnAgainst->update([
                    'status' => $status,
                ]);
            }
            DB::commit();

            return $purchaseInvoice;
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
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
