<?php

namespace App\Services\Sales;

use App\FormStatus;
use App\Models\Core\ModelConnection;
use App\Models\Core\Preference;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\Stock;
use App\Models\ItemReserved;
use App\Models\Sales\SalesOrder;
use App\Utils;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Session;
use Inertia\Inertia;
use Symfony\Component\Uid\Ulid;

class SalesOrderService {
  private function fillRelations(array $data) {
    $data['customer_id']   = $data['customer']['id'];
    $data['customer_name'] = $data['customer']['name'];

    // relasi cabang customer
    $data['customer_branch_id']   = $data['customer_branch']['id'];
    $data['customer_branch_name'] = $data['customer_branch']['name'];

    // optional branch
    if (isset($data['branch'])) {
      $data['branch_id'] = $data['branch']['id'];
    }

    $defaultCurrency            = Preference::find('default_currency_id')->value;
    $data['currency_code']      = ! isset($data['currency']) ? $defaultCurrency : $data['currency']['code'];
    $data['base_currency_code'] = $defaultCurrency;

    return $data;
  }

  private function fillItemRelations(array $data, SalesOrder $salesOrder) {
    // dd($data);
    $data['item_id']             = $data['item']['id'];
    $data['unit_id']             = $data['unit']['id'];
    $data['conversion_factor']   = ItemUnit::getConversionFactor($data["item"]["item_id"], $data['unit_id']);
    $data['tax_id']              = $data['tax']['id'];
    $data['tax_rate']            = $data['tax']['rate'];
    $data['currency_code']       = $salesOrder->currency_code;
    $data['base_currency_code']  = $salesOrder->base_currency_code;
    $data['exchange_rate']       = $salesOrder->exchange_rate;
    $data['source_warehouse_id'] = $data['source_warehouse']['id'];
    $data['price']               = $data['price'] ?? 0;
    $data['price_base_currency'] = 0;

    return $data;
  }

  private function fillPaymentScheduleRelations(array $data, SalesOrder $salesOrder) {
    $data['for_internal']       = false;
    $data['currency_code']      = $salesOrder->currency_code;
    $data['base_currency_code'] = $salesOrder->base_currency_code;
    $data['exchange_rate']      = $salesOrder->exchange_rate;

    if (isset($data['payment_term'])) {
      $data['payment_term_id'] = $data['payment_term']['id'];
    }
    if (isset($data['payment_method'])) {
      $data['payment_method_id'] = $data['payment_method']['id'];
    }
    return $data;
  }

  public function create(array $data) {
    $salesOrder = SalesOrder::create($this->fillRelations($data));
    foreach ($data['items'] as $item) {
      $item = $this->fillItemRelations($item, $salesOrder);
      $salesOrder->items()->create($item);
    }
    foreach ($data['payment_schedules'] ?? [] as $payment_schedule) {
      $payment_schedule = $this->fillPaymentScheduleRelations($payment_schedule, $salesOrder);
      $salesOrder->paymentSchedules()->create($payment_schedule);
    }
    $salesOrder->logForCreated();
    return $salesOrder;
  }

  public function update(SalesOrder $salesOrder, array $data) {
    $salesOrder->fillForUpdate($this->fillRelations($data));

    $salesOrder->items()
      ->whereNotIn('id', array_column($data['items'], 'id'))
      ->delete();
    foreach ($data['items'] as $item) {
      $item = $this->fillItemRelations($item, $salesOrder);

      if (Ulid::isValid($item['id'])) {
        $salesOrder->items()
          ->find($item['id'])
          ->update($item);
        continue;
      }

      $salesOrder->items()->create($item);
    }
    // dd($data);
    $salesOrder->paymentSchedules()
      ->whereNotIn('id', array_column($data['payment_schedules'], 'id'))
      ->delete();
    foreach ($data['payment_schedules'] as $payment_schedule) {
      $payment_schedule = $this->fillPaymentScheduleRelations($payment_schedule, $salesOrder);
      if (Ulid::isValid($payment_schedule['id'])) {
        $salesOrder->paymentSchedules()->find($payment_schedule['id'])->update($payment_schedule);
        continue;
      }
      $salesOrder->paymentSchedules()->create($payment_schedule);
    }

    $salesOrder->logForUpdated();
    return $salesOrder;
  }

  public function submit(SalesOrder $salesOrder) {
    DB::beginTransaction();

    if ($salesOrder->referenceable_type && $salesOrder->referenceable_id) {
      ModelConnection::create([
        'model_type'     => $salesOrder->referenceable_type,
        'model_id'       => $salesOrder->referenceable_id,
        'reference_type' => SalesOrder::class,
        'reference_id'   => $salesOrder->id,
      ]);
      SalesOrder::where('referenceable_type', $salesOrder->referenceable_type)
        ->where('referenceable_id', $salesOrder->referenceable_id)
        ->where('status', 'draft')
        ->whereNot('created_by', Auth::user()->id)
        ->update(['status' => 'canceled']);
    }
    $items      = $salesOrder->items()
      ->get();
    $errorItems = [];
    foreach ($items as $item) {
      $stock = Stock::lockForUpdate()
        ->where('item_variant_id', $item->item_id)
        ->where('warehouse_id', $item->source_warehouse_id)
        ->lockForUpdate()
        ->first();
      if (! $stock) {
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
    if (\count($errorItems) > 0) {
      DB::rollBack();
      Session::flash('errorItems', $errorItems);
      return $salesOrder;
    }

    DB::commit();
    $salesOrder->checkApproval();

    return $salesOrder;
  }

  public function onApproved(SalesOrder $salesOrder) {
    $salesOrder->update([
      'status' => [
        FormStatus::TO_DELIVER,
        FormStatus::TO_BILL,
      ],
    ]);
    return $salesOrder;
  }

  private function rolllbackItems(SalesOrder $salesOrder) {
    $items = $salesOrder->items()
      ->get();
    foreach ($items as $item) {
      $stock = Stock::lockForUpdate()
        ->where('item_variant_id', $item->item_id)
        ->where('warehouse_id', $item->source_warehouse_id)
        ->lockForUpdate()
        ->first();

      $quantity = $item->quantity * $item->conversion_factor / $stock->conversion_factor;
      $stock->update([
        'reserved_quantity' => $stock->reserved_quantity - $quantity,
      ]);
    }
  }

  public function onRejected(SalesOrder $salesOrder) {
    return DB::transaction(function () use ($salesOrder) {
      $salesOrder->update([
        'status' => [
          FormStatus::REJECTED,
        ],
      ]);

      $this->rolllbackItems($salesOrder);

      return $salesOrder;
    });
  }

  public function cancel(SalesOrder $salesOrder) {
    return DB::transaction(function () use ($salesOrder) {
      $salesOrder->update([
        'status' => [
          FormStatus::CANCELED,
        ],
      ]);

      $this->rolllbackItems($salesOrder);

      return $salesOrder;
    });
  }
}
