<?php

namespace App\Services\Finances;

use App\Enums\FormStatus;
use App\Models\Core\FormatingSeries;
use App\Models\Core\ModelConnection;
use App\Models\Core\Preference;
use App\Models\Finances\PaymentEntry;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Finances\SalesInvoice;
use App\Models\Purchase\Supplier;
use App\Models\Sales\Customer;
use App\Utils;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PaymentEntryService {
    private function fillRelations(array $data) {
        $data['default_account_id'] = $data['default_account']['id'] ?? null;
        $defaultCurrency            = Preference::find('default_currency_id')?->value;
        $data['currency_code']      = $data['currency']['code'] ?? $defaultCurrency;
        $data['base_currency_code'] = $defaultCurrency;

        if ($data['currency_code'] != $defaultCurrency && empty($data['exchange_rate'])) {
            throw ValidationException::withMessages(['exchange_rate' => 'Exchange rate is required for non-default currency.']);
        }

        $data['exchange_rate']        = $data['currency_code'] == $defaultCurrency ? 1 : $data['exchange_rate'];
        $data['partyable_id']         = $data['partyable']['id'];
        $data['partyable_type']       = $data['payment_type'] == 'pay' ? Supplier::class : Customer::class;
        $data['paymentable_id']       = $data['paymentable']['id'];
        $data['paymentable_type']     = $data['payment_type'] == 'pay' ? PurchaseInvoice::class : SalesInvoice::class;
        $data['payment_method_id']    = $data['payment_method']['id'] ?? null;
        $data['account_paid_to_id']   = $data['account_paid_to']['id'];
        $data['account_paid_from_id'] = $data['account_paid_from']['id'];
        $data['exchange_rate']        = $data['exchange_rate'] ?? 1;

        return $data;
    }

    public function create(array $data) {
        DB::beginTransaction();
        $data['code'] = FormatingSeries::generate(PaymentEntry::class, $data, true);
        $paymentEntry = PaymentEntry::create($this->fillRelations($data));
        $paymentEntry->logForCreated();
        DB::commit();

        return $paymentEntry;
    }

    public function update(PaymentEntry $paymentEntry, array $data) {
        DB::beginTransaction();
        $paymentEntry->fillForUpdate($this->fillRelations($data));
        $paymentEntry->logForUpdated();
        DB::commit();

        return $paymentEntry;
    }

    public function submit(PaymentEntry $paymentEntry) {
        $paymentEntry->update([
            'code' => FormatingSeries::generate(PaymentEntry::class, $paymentEntry),
        ]);
        ModelConnection::create([
            'model_id'       => $paymentEntry->id,
            'model_type'     => PaymentEntry::class,
            'reference_id'   => $paymentEntry->paymentable_id,
            'reference_type' => $paymentEntry->paymentable_type,
        ]);
        $paymentEntry->checkApproval();

        return $paymentEntry;
    }

    public function onApproved(PaymentEntry $paymentEntry) {
        DB::beginTransaction();

        $paymentEntry->load([
            'paymentable',
            'paymentable.paymentSchedules',
            'accountPaidFrom',
            'accountPaidTo',
        ]);

        $paymentable      = $paymentEntry->paymentable;
        $paymentSchedules = $paymentEntry->paymentable->paymentSchedules;

        $totalPaid         = $paymentEntry->paid_amount;
        $outstandingAmount = $totalPaid;
        foreach ($paymentSchedules as $paymentSchedule) {
            $paymentAmount = $paymentSchedule->outstanding_amount;
            if ($outstandingAmount >= $paymentAmount) {
                $paymentSchedule->update([
                    'paid_amount' => $paymentAmount,
                ]);
                $outstandingAmount -= $paymentAmount;
            } else {
                $paymentSchedule->update([
                    'paid_amount' => $outstandingAmount,
                ]);
                $outstandingAmount = 0;
            }
        }

        $paymentable->paid_amount += $totalPaid;

        if ($paymentable->paid_amount >= $paymentable->amount) {
            $status = Utils::replaceStatus(
                $paymentable->status,
                [FormStatus::UNPAID, FormStatus::PARTIALLY_PAID],
                FormStatus::PAID,
            );
        } elseif ($paymentable->paid_amount > 0) {
            $status = Utils::replaceStatus(
                $paymentable->status,
                [FormStatus::UNPAID, FormStatus::PAID],
                FormStatus::PARTIALLY_PAID,
            );
        } else {
            $status = Utils::replaceStatus(
                $paymentable->status,
                [FormStatus::UNPAID, FormStatus::PARTIALLY_PAID],
                FormStatus::PARTIALLY_PAID,
            );
        }
        $paymentable->status = $status;
        $paymentable->save();

        $paymentEntry->update([
            'status' => [
                FormStatus::PAID,
            ],
        ]);

        $debitAccount  = $paymentEntry->accountPaidFrom;
        $creditAccount = $paymentEntry->accountPaidTo;

        // Credit stock account
        $creditAccount->generalLedgerEntries()->create([
            'against_account_id' => $debitAccount->id,
            'credit'             => $paymentable->paid_amount,
            'debit'              => 0,
            'referenceable_type' => PaymentEntry::class,
            'referenceable_id'   => $paymentEntry->id,
        ]);

        // Debit income account
        $debitAccount->generalLedgerEntries()->create([
            'against_account_id' => $creditAccount->id,
            'credit'             => 0,
            'debit'              => $paymentable->paid_amount,
            'referenceable_type' => PaymentEntry::class,
            'referenceable_id'   => $paymentEntry->id,
        ]);

        DB::commit();

        return $paymentEntry;
    }

    public function onRejected(PaymentEntry $paymentEntry) {
        DB::beginTransaction();
        $paymentEntry->update([
            'status' => [
                FormStatus::REJECTED,
            ],
        ]);

        DB::commit();

        return $paymentEntry;
    }

    public function cancel(PaymentEntry $paymentEntry) {
        $paymentEntry->update([
            'status' => [
                FormStatus::CANCELED,
            ],
        ]);

        return $paymentEntry;
    }
}
