<?php

namespace App\Services\Finances;

use App\FormStatus;
use App\Models\Core\FormatingSeries;
use App\Models\Core\ModelConnection;
use App\Models\Core\Preference;
use App\Models\Finances\SalesInvoice;
use App\Models\Sales\SalesOrder;
use App\Services\Sales\SalesOrderService;
use App\Utils;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\Uid\Ulid;

class SalesInvoiceService {
    private function fillRelations(array $data) {
        $data['sales_order_id']    = $data['sales_order']['id'];
        $data['customer_id']       = $data['customer']['id'];
        $data['customer_name']     = $data['customer']['name'];
        $data['income_account_id'] = $data['income_account']['id'];
        $data['debit_account_id']  = $data['debit_account']['id'];

        // relasi cabang customer
        $data['customer_branch_id']   = $data['customer_branch']['id'];
        $data['customer_branch_name'] = $data['customer_branch']['name'];

        $defaultCurrency            = Preference::find('default_currency_id')->value;
        $data['currency_code']      = $data['currency']['code'] ?? $defaultCurrency;
        $data['base_currency_code'] = $defaultCurrency;

        $data['return_against_id'] = $data['return_against']['id'] ?? null;

        return $data;
    }

    private function fillItemRelations(array $data, SalesInvoice $salesInvoice) {
        $data['item_id']            = $data['item']['id'];
        $data['item_unit_id']       = $data['unit']['id'];
        $data['conversion_factor']  = $data['unit']['conversion_factor'];
        $data['tax_id']             = $data['tax']['id'];
        $data['tax_rate']           = $data['tax']['rate'];
        $data['currency_code']      = $salesInvoice->currency_code;
        $data['base_currency_code'] = $salesInvoice->base_currency_code;
        $data['exchange_rate']      = $salesInvoice->exchange_rate;
        $data['price'] ??= 0;
        $data['price_base_currency'] = 0;

        return $data;
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

    public function create(array $data) {
        $data['code'] = FormatingSeries::generate(SalesInvoice::class, $data, true);
        $salesInvoice = SalesInvoice::create($this->fillRelations($data));
        $basicAmount  = 0;
        $taxAmount    = 0;
        foreach ($data['items'] as $item) {
            $item = $this->fillItemRelations($item, $salesInvoice);
            $item = $salesInvoice->items()->create($item);

            $item->refresh();
            $basicAmount += $item->basic_amount;
            $taxAmount += $item->tax_amount;
        }

        $totalAmount = Utils::countAmount($basicAmount, $taxAmount, $salesInvoice->discount_on, $salesInvoice->discount_amount);
        $salesInvoice->update([
            'amount' => $totalAmount,
        ]);
        foreach ($data['payment_schedules'] ?? [] as $payment_schedule) {
            $payment_schedule = $this->fillPaymentScheduleRelations($payment_schedule, $salesInvoice);
            $salesInvoice->paymentSchedules()->create(attributes: [
                ...$payment_schedule,
            ]);
        }
        $salesInvoice->logForCreated();

        return $salesInvoice;
    }

    public function update(SalesInvoice $salesInvoice, array $data) {
        $salesInvoice->fillForUpdate($this->fillRelations($data), true);
        $basicAmount = 0;
        $taxAmount   = 0;
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
        foreach ($data['items'] as $item) {
            $item = $this->fillItemRelations($item, $salesInvoice);

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
            $itemModel->refresh();
            $basicAmount += $itemModel->basic_amount;
            $taxAmount += $itemModel->tax_amount;
        }
        $totalAmount = Utils::countAmount($basicAmount, $taxAmount, $salesInvoice->discount_on, $salesInvoice->discount_amount);

        $salesInvoice->fill([
            'amount' => $totalAmount,
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
        $salesInvoice->logForUpdated();

        return $salesInvoice;
    }

    public function submit(SalesInvoice $salesInvoice) {
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
        ModelConnection::create([
            'model_type'     => SalesOrder::class,
            'model_id'       => $salesInvoice->sales_order_id,
            'reference_type' => SalesInvoice::class,
            'reference_id'   => $salesInvoice->id,
        ]);

        DB::commit();

        $salesInvoice->checkApproval();

        return $salesInvoice;
    }

    public function onApproved(SalesInvoice $salesInvoice) {
        DB::beginTransaction();

        try {
            $salesInvoice->load([
                'debitAccount',
                'incomeAccount',
                'salesOrder',
                'returnAgainst',
                'items.returnAgainstItem',
                'items.salesOrderItem',
            ]);

            $returnAgainst = $salesInvoice->returnAgainst;
            $items         = $salesInvoice->items;

            $basicAmount = 0;
            $taxAmount   = 0;

            foreach ($items as $item) {
                $basicAmount += $item->basic_amount;
                $taxAmount += $item->tax_amount;
                if ($returnAgainst) {
                    $item->returnAgainstItem->increment('returned_quantity', $item->quantity);
                    $item->salesOrderItem->decrement('billed_quantity', $item->quantity);
                } else {
                    $item->salesOrderItem->increment('billed_quantity', $item->quantity);
                }
            }
            $totalAmount = Utils::countAmount($basicAmount, $taxAmount, $salesInvoice->discount_on, $salesInvoice->discount_amount);

            $debitAccount  = $salesInvoice->debitAccount;
            $creditAccount = $salesInvoice->incomeAccount;

            // Credit stock account (reducing inventory)
            $creditAccount->generalLedgerEntries()->create([
                'against_account_id' => $debitAccount->id,
                'credit'             => $returnAgainst ? 0 : $totalAmount,
                'debit'              => $returnAgainst ? $totalAmount : 0,
                'referenceable_type' => SalesInvoice::class,
                'referenceable_id'   => $salesInvoice->id,
            ]);

            // Debit income account (recording revenue)
            $debitAccount->generalLedgerEntries()->create([
                'against_account_id' => $creditAccount->id,
                'credit'             => $returnAgainst ? $totalAmount : 0,
                'debit'              => $returnAgainst ? 0 : $totalAmount,
                'referenceable_type' => SalesInvoice::class,
                'referenceable_id'   => $salesInvoice->id,
            ]);

            $salesOrder = $salesInvoice->salesOrder;
            if ($salesOrder) {
                (new SalesOrderService)->updateSalesOrderStatus($salesOrder);
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
                $returnAgainst->update([
                    'status' => $status,
                ]);
            }

            DB::commit();

            return $salesInvoice;
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    public function onRejected(SalesInvoice $salesInvoice) {
        $salesInvoice->update([
            'status' => FormStatus::REJECTED,
        ]);

        return $salesInvoice;
    }

    public function cancel(SalesInvoice $salesInvoice) {
        $salesInvoice->update([
            'status' => FormStatus::CANCELED,
        ]);

        return $salesInvoice;
    }
}
