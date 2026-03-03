<?php

namespace App\Services\Finances;

use App\FormStatus;
use App\Models\Core\FormatingSeries;
use App\Models\Core\Preference;
use App\Models\Finances\PaymentEntry;
use App\Models\Finances\PaymentSchedule;
use Illuminate\Support\Facades\DB;

class PaymentEntryService {
  private function fillRelations(array $data) {
    $data['default_account_id']   = $data['default_account']['id'] ?? null;
    $defaultCurrency              = Preference::find('default_currency_id')->value;
    $data['currency_code']        = $data['currency']['code'] ?? $defaultCurrency;
    $data['base_currency_code']   = $defaultCurrency;
    $data['partyable_id']         = $data['partyable']['id'];
    $data['partyable_type']       = $data['payment_type'] == 'pay' ? \App\Models\Purchase\Supplier::class : \App\Models\Sales\Customer::class;
    $data['paymentable_id']       = $data['paymentable']['id'];
    $data['paymentable_type']     = $data['payment_type'] == 'pay' ? \App\Models\Finances\PurchaseInvoice::class : \App\Models\Finances\SalesInvoice::class;
    $data['payment_method_id']    = $data['payment_method']['id'] ?? null;
    $data['account_paid_to_id']   = $data['account_paid_to']['id'];
    $data['account_paid_from_id'] = $data['account_paid_from']['id'];

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

  public function onApproved(PaymentEntry $paymentEntry) {
    DB::beginTransaction();

    try {
      $paymentEntry->load('paymentable');

      if ($paymentEntry->status === FormStatus::SUBMITTED) {
        return back()->with('error', 'Payment Entry sudah disubmit sebelumnya.');
      }

      // Kalau payment_entry ini terhubung ke PaymentSchedule
      if ($paymentEntry->paymentable_type === PaymentSchedule::class) {
        /** @var PaymentSchedule $paymentSchedule */
        $paymentSchedule = $paymentEntry->paymentable;

        // Validasi overpayment
        $totalPaid = $paymentSchedule->paid_amount + $paymentEntry->paid_amount;
        if ($totalPaid > $paymentSchedule->payment_amount) {
          DB::rollBack();
          throw \Illuminate\Validation\ValidationException::withMessages([
            'invalidAmount' => 'Jumlah pembayaran melebihi total yang harus dibayar.',
          ]);
        }

        // Update jumlah paid & tanggal pembayaran
        $paymentSchedule->update([
          'paid_amount'      => $totalPaid,
          'base_paid_amount' => $paymentSchedule->base_paid_amount + $paymentEntry->based_paid_amount,
          'payment_date'     => now(),
          'submitted_at'     => now(),
        ]);
      }

      // Log aktivitas
      $paymentEntry->logForSubmitted();

      DB::commit();

      return redirect()
        ->route('paymentEntries.show', $paymentEntry)
        ->with('success', 'Payment Entry berhasil disubmit.');
    } catch (\Throwable $th) {
      DB::rollBack();
      report($th);
      return back()->with('error', 'Terjadi kesalahan saat submit Payment Entry.');
    }
  }

  public function submit(PaymentEntry $paymentEntry) {
    $paymentEntry->update([
      'code' => FormatingSeries::generate(PaymentEntry::class, $paymentEntry),
    ]);
    $paymentEntry->checkApproval();
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
