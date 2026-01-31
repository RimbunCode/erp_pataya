<?php

namespace App\Services\Finances;

use App\FormStatus;
use App\Models\Core\ModelConnection;
use App\Models\Core\Preference;
use App\Models\Finances\Account;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Inventory\ItemUnit;
use App\Models\Purchase\PurchaseOrder;
use DB;
use Symfony\Component\Uid\Ulid;

class PurchaseInvoiceService {
  /**
   * Create a new class instance.
   */
  private function fillRelations(array $data) {
    $data['purchase_order_id'] = $data['purchase_order']['id'];
    $data['supplier_id']       = $data['supplier']['id'];

    if (isset($data['branch'])) {
      $data['branch_id'] = $data['branch']['id'];
    }

    $defaultCurrency            = Preference::find('default_currency_id')->value;
    $data['currency_code']      = !isset($data['currency']) ? $defaultCurrency : $data['currency']['code'];
    $data['base_currency_code'] = $defaultCurrency;

    return $data;
  }

  private function fillItemRelations(array $data, PurchaseInvoice $purchaseInvoice) {
    $data['item_id']             = $data['item']['id'];
    $data['unit_id']             = $data['unit']['id'];
    $data['conversion_factor']   = ItemUnit::getConversionFactor($data["item"]["item_id"], $data['unit_id']);
    $data['exchange_rate']       = $purchaseInvoice->exchange_rate;
    $data['tax_id']              = $data['tax']['id'];
    $data['tax_rate']            = $data['tax']['rate'] ?? 0;
    $data['target_warehouse_id'] = $data['target_warehouse']['id'];
    return $data;
  }

  private function fillPaymentScheduleRelations(array $data, PurchaseInvoice $purchaseInvoice) {
    $data['currency_code']      = $purchaseInvoice->currency_code;
    $data['base_currency_code'] = $purchaseInvoice->base_currency_code;
    $data['exchange_rate']      = $purchaseInvoice->exchange_rate;
    $data['for_internal']       = true;

    if (isset($data['payment_term'])) {
      $data['payment_term_id'] = $data['payment_term']['id'];
    }
    if (isset($data['payment_method'])) {
      $data['payment_method_id'] = $data['payment_method']['id'];
    }
    return $data;
  }

  public function create(array $data) {
    $purchaseInvoice = PurchaseInvoice::create($this->fillRelations($data));

    foreach ($data['items'] as $item) {
      $item = $this->fillItemRelations($item, $purchaseInvoice);
      $purchaseInvoice->items()->create($item);
    }

    foreach ($data['payment_schedules'] ?? [] as $payment_schedule) {
      $payment_schedule = $this->fillPaymentScheduleRelations($payment_schedule, $purchaseInvoice);
      $purchaseInvoice->paymentSchedules()->create($payment_schedule);
    }
    $purchaseInvoice->logForCreated();
    return $purchaseInvoice;
  }

  public function update(PurchaseInvoice $purchaseInvoice, array $data) {
    $purchaseInvoice->fillForUpdate($this->fillRelations($data));

    $purchaseInvoice->items()
      ->whereNotIn('id', array_column($data['items'], 'id'))
      ->delete();

    foreach ($data['items'] as $item) {
      $item = $this->fillItemRelations($item, $purchaseInvoice);

      if (Ulid::isValid($item['id'])) {
        $purchaseInvoice->items()
          ->find($item['id'])
          ->update($item);
        continue;
      }

      $purchaseInvoice->items()->create($item);
    }

    $purchaseInvoice->paymentSchedules()
      ->whereNotIn('id', array_column($data['payment_schedules'], 'id'))
      ->delete();
    foreach ($data['payment_schedules'] as $payment_schedule) {
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
    $purchaseInvoice->checkApproval();
    return $purchaseInvoice;

  }

  public function onApproved(PurchaseInvoice $purchaseInvoice) {
    DB::beginTransaction();

    try {
      $purchaseInvoice->update([
        'status' => FormStatus::UNPAID,
      ]);

      // Create payment schedule if needed
      if ($purchaseInvoice->paymentSchedules()->count() === 0) {
        $purchaseInvoice->paymentSchedules()->create([
          'payment_scheduleable_type' => PurchaseInvoice::class,
          'payment_scheduleable_id'   => $purchaseInvoice->id,
          'payment_amount'            => $purchaseInvoice->amount,
          'paid_amount'               => 0,
          'for_internal'              => true,
          'due_date'                  => now()->addDays(30),
          'exchange_rate'             => $purchaseInvoice->exchange_rate ?? 1,
          'currency_code'             => $purchaseInvoice->currency_code,
          'base_currency_code'        => $purchaseInvoice->base_currency_code,
          'description'               => "Auto generated from Purchase Invoice {$purchaseInvoice->code}",
        ]);
      }

      $amount = $purchaseInvoice->amount;

      // Account untuk Debit (Stock/Expense)
      $debitAccount = Account::lockForUpdate()
        ->where('root_type', 'asset')
        ->where('account_type', 'stock')
        ->firstOrFail();

      // Account untuk Credit (Hutang ke supplier)
      $creditAccount = Account::lockForUpdate()
        ->where('root_type', 'liability')
        ->where('account_type', 'payable')
        ->firstOrFail();

      // Entry 1: DEBIT Stock
      $debitAccount->generalLedgerEntries()->create([
        'against_account_id' => $creditAccount->id,
        'debit'              => $amount,
        'credit'             => 0,
        'referenceable_type' => PurchaseInvoice::class,
        'referenceable_id'   => $purchaseInvoice->id,
      ]);

      // Entry 2: CREDIT Accounts Payable
      $creditAccount->generalLedgerEntries()->create([
        'against_account_id' => $debitAccount->id,
        'debit'              => 0,
        'credit'             => $amount,
        'referenceable_type' => PurchaseInvoice::class,
        'referenceable_id'   => $purchaseInvoice->id,
      ]);

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
      'status' => [
        FormStatus::REJECTED,
      ],
    ]);

    DB::commit();
    return $purchaseInvoice;
  }

  public function cancel(PurchaseInvoice $purchaseInvoice) {
    $purchaseInvoice->update([
      'status' => [
        FormStatus::CANCELED,
      ],
    ]);
    return $purchaseInvoice;
  }
}
