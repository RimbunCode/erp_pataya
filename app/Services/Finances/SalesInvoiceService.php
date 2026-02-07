<?php

namespace App\Services\Finances;

use App\FormStatus;
use App\Models\Core\ModelConnection;
use App\Models\Core\Preference;
use App\Models\Finances\Account;
use App\Models\Finances\SalesInvoice;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\Stock;
use App\Models\Sales\SalesOrder;
use App\Utils;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Session;
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

    if (isset($data['branch'])) {
      $data['branch_id'] = $data['branch']['id'];
    }

    $defaultCurrency            = Preference::find('default_currency_id')->value;
    $data['currency_code']      = ! isset($data['currency']) ? $defaultCurrency : $data['currency']['code'];
    $data['base_currency_code'] = $defaultCurrency;

    $data['return_against_id'] = $data['return_against']['id'] ?? null;

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
    $basicAmount  = 0;
    $taxAmount    = 0;
    foreach ($data['items'] as $item) {
      $item = $this->fillItemRelations($item, $salesInvoice);
      $item = $salesInvoice->items()->create($item);

      $item->refresh();
      $basicAmount += $item->basic_amount;
      $taxAmount   += $item->tax_amount;
    }

    $totalAmount = Utils::countAmount($basicAmount, $taxAmount, $salesInvoice->discount_on, $salesInvoice->discount_amount);
    $salesInvoice->update([
      'amount' => $totalAmount,
    ]);
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
    $salesInvoice->fillForUpdate($this->fillRelations($data), true);
    $basicAmount = 0;
    $taxAmount   = 0;
    $salesInvoice->items()
      ->whereNotIn('id', array_column($data['items'], 'id'))
      ->delete();
    foreach ($data['items'] as $item) {
      $item = $this->fillItemRelations($item, $salesInvoice);

      if (Ulid::isValid($item['id'])) {
        $item = $salesInvoice->items()
          ->find($item['id'])
          ->fill($item);
        $item->save();
      } else {
        $item = $salesInvoice->items()->create($item);
      }
      $item->refresh();
      $basicAmount += $item->basic_amount;
      $taxAmount   += $item->tax_amount;
    }
    $totalAmount = Utils::countAmount($basicAmount, $taxAmount, $salesInvoice->discount_on, $salesInvoice->discount_amount);

    $salesInvoice->fill([
      'amount' => $totalAmount,
    ]);
    $salesInvoice->save();

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
    DB::beginTransaction();

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
        throw \Illuminate\Validation\ValidationException::withMessages([
          'invoice_portion' => "Total invoice portion must be 100%",
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
      $returnAgainst = $salesInvoice->returnAgainst;
      $items         = $salesInvoice->items()
        ->with(['returnAgainstItem', 'salesOrderItem'])
        ->get();

      $basicAmount = 0;
      $taxAmount   = 0;

      foreach ($items as $item) {
        $basicAmount += $item->basic_amount;
        $taxAmount   += $item->tax_amount;
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

      $salesOrder         = $salesInvoice->salesOrder;
      $unbilledItems      = $salesOrder->items()->select(['unbilled_quantity', 'quantity'])->get();
      $countUnbilledItems = $unbilledItems->sum('unbilled_quantity');
      $sumQuantity        = $unbilledItems->sum('quantity');
      if ($countUnbilledItems == $sumQuantity) {
        $status = Utils::replaceStatus(
          $salesOrder->status,
          [FormStatus::BILLED, FormStatus::PARTIALLY_BILLED],
          FormStatus::TO_BILL,
        );
      } else if ($countUnbilledItems > 0) {
        $status = Utils::replaceStatus(
          $salesOrder->status,
          FormStatus::TO_BILL,
          FormStatus::PARTIALLY_BILLED,
        );
      } else {
        $status = Utils::replaceStatus(
          $salesOrder->status,
          [FormStatus::TO_BILL, FormStatus::PARTIALLY_BILLED],
          FormStatus::BILLED,
        );
      }
      $salesOrder->update([
        'status' => $status,
      ]);

      $salesInvoice->update([
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
        } else if ($countReturnedItems > 0) {
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
