<?php

namespace App\Services\Finances;

use App\Contracts\SubmitableService;
use App\Enums\FormStatus;
use App\Events\Core\DocumentSubmitted;
use App\Events\Finances\PaymentApplied;
use App\Models\Core\FormatingSeries;
use App\Models\Core\Preference;
use App\Models\Finances\PaymentEntry;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Finances\SalesInvoice;
use App\Models\Model;
use App\Models\Purchase\Supplier;
use App\Models\Sales\Customer;
use App\Traits\HasDefaultDelete;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PaymentEntryService implements SubmitableService {
    use HasDefaultDelete;

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

    public function create(array $data): Model {
        DB::beginTransaction();
        $data['code'] = FormatingSeries::generate(PaymentEntry::class, $data, true);
        $paymentEntry = PaymentEntry::create($this->fillRelations($data));
        DB::commit();

        return $paymentEntry;
    }

    public function update(Model $paymentEntry, array $data): Model {
        DB::beginTransaction();
        $paymentEntry->fillForUpdate($this->fillRelations($data));
        DB::commit();

        return $paymentEntry;
    }

    public function submit(Model $paymentEntry): mixed {
        $paymentEntry->update([
            'code' => FormatingSeries::generate(PaymentEntry::class, $paymentEntry),
        ]);
        event(new DocumentSubmitted($paymentEntry, $paymentEntry->paymentable));
        $paymentEntry->checkApproval();

        return $paymentEntry;
    }

    public function onApproved(Model $paymentEntry): mixed {
        DB::beginTransaction();

        $paymentEntry->load([
            'accountPaidFrom',
            'accountPaidTo',
        ]);

        $paymentableClass = $paymentEntry->paymentable_type;
        $paymentable      = $paymentableClass::where('id', $paymentEntry->paymentable_id)
            ->lockForUpdate()
            ->firstOrFail();
        $paymentable->load('paymentSchedules');

        $paymentSchedules = $paymentable->paymentSchedules;

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

        $newPaidAmount = $paymentable->paid_amount + $totalPaid;
        event(new PaymentApplied($paymentable, $newPaidAmount));

        $paymentEntry->update([
            'status' => [
                FormStatus::PAID,
            ],
        ]);

        $debitAccount    = $paymentEntry->accountPaidFrom;
        $creditAccount   = $paymentEntry->accountPaidTo;
        $transactionDate = $paymentEntry->date ?? now();

        // Credit stock account
        $creditAccount->generalLedgerEntries()->create([
            'against_account_id' => $debitAccount->id,
            'credit'             => $paymentable->paid_amount,
            'debit'              => 0,
            'transaction_date'   => $transactionDate,
            'referenceable_type' => PaymentEntry::class,
            'referenceable_id'   => $paymentEntry->id,
        ]);

        // Debit income account
        $debitAccount->generalLedgerEntries()->create([
            'against_account_id' => $creditAccount->id,
            'credit'             => 0,
            'debit'              => $paymentable->paid_amount,
            'transaction_date'   => $transactionDate,
            'referenceable_type' => PaymentEntry::class,
            'referenceable_id'   => $paymentEntry->id,
        ]);

        DB::commit();

        return $paymentEntry;
    }

    public function onRejected(Model $paymentEntry): mixed {
        DB::beginTransaction();
        $paymentEntry->update([
            'status' => [
                FormStatus::REJECTED,
            ],
        ]);

        DB::commit();

        return $paymentEntry;
    }

    public function cancel(Model $paymentEntry): mixed {
        $paymentEntry->update([
            'status' => [
                FormStatus::CANCELED,
            ],
        ]);

        return $paymentEntry;
    }

    public function amend(Model $model): mixed {
        return $model;
    }
}
