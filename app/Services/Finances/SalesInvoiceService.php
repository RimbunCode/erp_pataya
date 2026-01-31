<?php

namespace App\Services\Finances;

use App\FormStatus;
use App\Models\Core\Preference;
use App\Models\Finances\Account;
use App\Models\Finances\SalesInvoice;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\Stock;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Session;
use Symfony\Component\Uid\Ulid;

class SalesInvoiceService {
  private function fillRelations(array $data) {
    $data['sales_order_id'] = $data['sales_order']['id'];
    $data['customer_id']    = $data['customer']['id'];
    $data['customer_name']  = $data['customer']['name'];

    // relasi cabang customer
    $data['customer_branch_id']   = $data['customer_branch']['id'];
    $data['customer_branch_name'] = $data['customer_branch']['name'];

    if (isset($data['branch'])) {
      $data['branch_id'] = $data['branch']['id'];
    }

    $defaultCurrency            = Preference::find('default_currency_id')->value;
    $data['currency_code']      = !isset($data['currency']) ? $defaultCurrency : $data['currency']['code'];
    $data['base_currency_code'] = $defaultCurrency;

    return $data;
  }

  private function fillItemRelations(array $data, SalesInvoice $salesInvoice) {
    $data['item_id']             = $data['item']['id'];
    $data['unit_id']             = $data['unit']['id'];
    $data['conversion_factor']   = ItemUnit::getConversionFactor($data["item"]["item_id"], $data['unit_id']);
    $data['tax_id']              = $data['tax']['id'];
    $data['tax_rate']            = $data['tax']['rate'];
    $data['currency_code']       = $salesInvoice->currency_code;
    $data['base_currency_code']  = $salesInvoice->base_currency_code;
    $data['exchange_rate']       = $salesInvoice->exchange_rate;
    $data['price']               = $data['price'] ?? 0;
    $data['price_base_currency'] = 0;
    return $data;
  }

  private function fillPaymentScheduleRelations(array $data, SalesInvoice $salesInvoice) {
    $data['currency_code']      = $salesInvoice->currency_code;
    $data['base_currency_code'] = $salesInvoice->base_currency_code;
    $data['exchange_rate']      = $salesInvoice->exchange_rate;

    if (isset($data['payment_term'])) {
      $data['payment_term_id'] = $data['payment_term']['id'];
    }
    if (isset($data['payment_method'])) {
      $data['payment_method_id'] = $data['payment_method']['id'];
    }
    return $data;
  }

  public function create(array $data) {
    $salesInvoice = SalesInvoice::create($this->fillRelations($data));
    foreach ($data['items'] as $item) {
      $item = $this->fillItemRelations($item, $salesInvoice);
      $salesInvoice->items()->create($item);
    }
    foreach ($data['payment_schedules'] ?? [] as $payment_schedule) {
      $payment_schedule = $this->fillPaymentScheduleRelations($payment_schedule, $salesInvoice);
      $salesInvoice->paymentSchedules()->create(attributes: [
        ...$payment_schedule,
        'for_internal' => false,
      ]);
    }
    $salesInvoice->logForCreated();
    return $salesInvoice;
  }

  public function update(SalesInvoice $salesInvoice, array $data) {
    $salesInvoice->fillForUpdate($this->fillRelations($data));

    $salesInvoice->items()
      ->whereNotIn('id', array_column($data['items'], 'id'))
      ->delete();
    foreach ($data['items'] as $item) {
      $item = $this->fillItemRelations($item, $salesInvoice);

      if (Ulid::isValid($item['id'])) {
        $salesInvoice->items()
          ->find($item['id'])
          ->update($item);
        continue;
      }

      $salesInvoice->items()->create($item);
    }

    $salesInvoice->paymentSchedules()
      ->whereNotIn('id', array_column($data['payment_schedules'], 'id'))
      ->delete();
    foreach ($data['payment_schedules'] as $payment_schedule) {
      $payment_schedule = $this->fillPaymentScheduleRelations($payment_schedule, $salesInvoice);
      if (Ulid::isValid($payment_schedule['id'])) {
        $salesInvoice->paymentSchedules()->find($payment_schedule['id'])->update($payment_schedule);
        continue;
      }
      $salesInvoice->paymentSchedules()->create(attributes: [
        ...$payment_schedule,
        'for_internal' => false,
      ]);
    }
    $salesInvoice->logForUpdated();
    return $salesInvoice;
  }

  public function submit(SalesInvoice $salesInvoice) {
    $salesInvoice->checkApproval();
    return $salesInvoice;
  }

  public function onApproved(SalesInvoice $salesInvoice) {
    DB::beginTransaction();

    try {
      $salesInvoice->update([
        'status' => FormStatus::UNPAID,
      ]);

      $items = $salesInvoice->items()->get();

      if ($salesInvoice->paymentSchedules()->count() === 0) {
        $salesInvoice->paymentSchedules()->create([
          'payment_scheduleable_type' => SalesInvoice::class,
          'payment_scheduleable_id'   => $salesInvoice->id,
          'payment_amount'            => $salesInvoice->amount,
          'paid_amount'               => 0,
          'for_internal'              => false,
          'due_date'                  => now()->addDays(30),
          'exchange_rate'             => $salesInvoice->exchange_rate ?? 1,
          'currency_code'             => $salesInvoice->currency_code,
          'base_currency_code'        => $salesInvoice->base_currency_code,
          'description'               => "Auto generated from Sales Invoice {$salesInvoice->code}",
        ]);
      }

      // Calculate total amount from items or use invoice amount
      $amountPicked = $salesInvoice->amount;

      $debitAccount  = Account::lockForUpdate()
        ->where('root_type', 'asset')
        ->where('account_type', 'receivable')
        ->firstOrFail();
      $creditAccount = Account::lockForUpdate()
        ->where('root_type', 'income')
        ->where('account_type', 'income_account')
        ->firstOrFail();

      // Credit stock account (reducing inventory)
      $creditAccount->generalLedgerEntries()->create([
        'against_account_id' => $debitAccount->id,
        'credit'             => $amountPicked,
        'debit'              => 0,
        'referenceable_type' => SalesInvoice::class,
        'referenceable_id'   => $salesInvoice->id,
      ]);

      // Debit income account (recording revenue)
      $debitAccount->generalLedgerEntries()->create([
        'against_account_id' => $creditAccount->id,
        'credit'             => 0,
        'debit'              => $amountPicked,
        'referenceable_type' => SalesInvoice::class,
        'referenceable_id'   => $salesInvoice->id,
      ]);

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
