<?php

namespace App\Services\Finances;

use App\FormStatus;
use App\Models\Core\Preference;
use App\Models\Finances\SalesInvoice;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\Stock;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Session;
use Symfony\Component\Uid\Ulid;

class SalesInvoiceService
{
  private function fillRelations(array $data)
  {

    $data['customer_id'] = $data['customer']['id'];
    $data['customer_name'] = $data['customer']['name'];


    // relasi cabang customer
    $data['customer_branch_id'] = $data['customer_branch']['id'];
    $data['customer_branch_name'] = $data['customer_branch']['name'];


    // optional branch
    if (isset($data['branch'])) {
      $data['branch_id'] = $data['branch']['id'];
    }

    $defaultCurrency = Preference::find('default_currency_id')->value;
    $data['currency_code'] = !isset($data['currency']) ? $defaultCurrency : $data['currency']['code'];
    $data['base_currency_code'] = $defaultCurrency;
    return $data;
  }

  private function fillPaymentScheduleRelations(array $data, SalesInvoice $salesInvoice)
  {
    $data['for_internal'] = false;
    $data['currency_code'] = $salesInvoice->currency_code;
    $data['base_currency_code'] = $salesInvoice->base_currency_code;
    $data['exchange_rate'] = $salesInvoice->exchange_rate;

    if (isset($data['payment_term'])) {
      $data['payment_term_id'] = $data['payment_term']['id'];
    }
    if (isset($data['payment_method'])) {
      $data['payment_method_id'] = $data['payment_method']['id'];
    }
    return $data;
  }

  public function create(array $data)
  {
    $salesInvoice = SalesInvoice::create($this->fillRelations($data));

    foreach ($data['payment_schedules'] ?? [] as $payment_schedule) {
      $payment_schedule = $this->fillPaymentScheduleRelations($payment_schedule, $salesInvoice);
      $salesInvoice->paymentSchedules()->create($payment_schedule);
    }
    $salesInvoice->logForCreated();
    return $salesInvoice;
  }

  public function update(SalesInvoice $salesInvoice, array $data)
  {
    $salesInvoice->fillForUpdate($this->fillRelations($data));

    $salesInvoice->items()
      ->whereNotIn('id', array_column($data['items'], 'id'))
      ->delete();

    // dd($data);
    $salesInvoice->paymentSchedules()
      ->whereNotIn('id', array_column($data['payment_schedules'], 'id'))
      ->delete();
    foreach ($data['payment_schedules'] as $payment_schedule) {
      $payment_schedule = $this->fillPaymentScheduleRelations($payment_schedule, $salesInvoice);
      if (Ulid::isValid($payment_schedule['id'])) {
        $salesInvoice->paymentSchedules()->find($payment_schedule['id'])->update($payment_schedule);
        continue;
      }
      $salesInvoice->paymentSchedules()->create($payment_schedule);
    }
    $salesInvoice->logForUpdated();
    return $salesInvoice;
  }


  public function submit(SalesInvoice $salesInvoice)
  {
    DB::beginTransaction();

    $salesInvoice->update([
      'status' => FormStatus::TO_DELIVER_AND_BILL,
    ]);

    $items = $salesInvoice->items()->get();
    $errorItems = [];
    foreach ($items as $item) {
      $stock = Stock::where('item_variant_id', $item->item_id)
        ->where('warehouse_id', $item->source_warehouse_id)
        ->lockForUpdate()
        ->first();

      if (!$stock) {
        $errorItems[] = "Item {$item->item->name} is not in {$item->sourceWarehouse->name} stock";
        continue;
      }

      $quantity = $item->quantity * $item->conversion_factor / $stock->conversion_factor;
      if ($stock->ready_quantity < $quantity) {
        $errorItems[] = "Item {$item->item->name} in {$stock->warehouse->name} stock is {$stock->ready_quantity} but you need {$quantity}";
        continue;
      }

      $stock->update([
        'reserved_quantity' => $stock->reserved_quantity + $quantity,
      ]);
    }

    if (count($errorItems) > 0) {
      DB::rollBack();
      Session::flash('errorItems', $errorItems);
      return $salesInvoice;
    }

    if ($salesInvoice->paymentSchedules()->count() === 0) {
      $salesInvoice->paymentSchedules()->create([
        'payment_scheduleable_type' => SalesInvoice::class,
        'payment_scheduleable_id' => $salesInvoice->id,
        'payment_amount' => $salesInvoice->amount,
        'paid_amount' => 0,
        'for_internal' => false,
        'due_date' => now()->addDays(30),
        'exchange_rate' => $salesInvoice->exchange_rate ?? 1,
        'currency_code' => $salesInvoice->currency_code,
        'base_currency_code' => $salesInvoice->base_currency_code,
        'description' => "Auto generated from Sales Invoice {$salesInvoice->code}",
      ]);
    }

    $salesInvoice->logForSubmitted();

    DB::commit();

    return $salesInvoice;
  }
}
