<?php

namespace App\Services\Purchase;

use App\FormStatus;
use App\Models\Core\FormatingSeries;
use App\Models\Core\ModelConnection;
use App\Models\Core\Preference;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\Stock;
use App\Models\Purchase\PurchaseOrder;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Uid\Ulid;

class PurchaseOrderService {
  private function fillRelations(array $data) {
    $data['supplier_id']   = $data['supplier']['id'];
    $data['supplier_name'] = $data['supplier']['name'];

    $data['branch_id'] = $data['branch']['id'];

    $defaultCurrency              = Preference::find('default_currency_id')->value;
    $data['currency_code']        = $data['currency']['code'] ?? $defaultCurrency;
    $data['base_currency_code']   = $defaultCurrency;
    $data['exchange_rate']      ??= 1;

    return $data;
  }

  private function fillItemRelations(array $data, PurchaseOrder $purchaseOrder) {
    $data['item_id']             = $data['item']['id'];
    $data['unit_id']             = $data['unit']['id'];
    $data['conversion_factor']   = ItemUnit::getConversionFactor($data["item"]["item_id"], $data['unit_id']);
    $data['exchange_rate']       = $purchaseOrder->exchange_rate;
    $data['tax_id']              = $data['tax']['id'];
    $data['tax_rate']            = $data['tax']['rate'] ?? 0;
    $data['target_warehouse_id'] = $data['target_warehouse']['id'];

    return $data;
  }

  private function fillPaymentScheduleRelations(array $data, PurchaseOrder $purchaseOrder) {
    $data['currency_code']      = $purchaseOrder->currency_code;
    $data['base_currency_code'] = $purchaseOrder->base_currency_code;
    $data['exchange_rate']      = $purchaseOrder->exchange_rate;
    $data['for_internal']       = true;
    $data['payment_term_id']    = $data['payment_term']['id'] ?? null;
    $data['payment_method_id']  = $data['payment_method']['id'] ?? null;
    return $data;
  }

  public function create(array $data) {
    $data['code']  = FormatingSeries::generate(PurchaseOrder::class, $data, true);
    $purchaseOrder = PurchaseOrder::create($this->fillRelations($data));

    $basicAmount = 0;
    $taxAmount   = 0;

    foreach ($data['items'] as $item) {
      $item = $this->fillItemRelations($item, $purchaseOrder);
      $item = $purchaseOrder->items()->create($item);
      $item->refresh();
      $basicAmount += $item->basic_amount;
      $taxAmount   += $item->tax_amount;
    }

    $totalAmount = \App\Utils::countAmount($basicAmount, $taxAmount, $purchaseOrder->discount_on, $purchaseOrder->discount_amount);
    $purchaseOrder->update([
      'total_amount'               => $totalAmount,
      'total_amount_base_currency' => $totalAmount * ($purchaseOrder->exchange_rate ?? 1),
    ]);

    foreach ($data['payment_schedules'] ?? [] as $payment_schedule) {
      $payment_schedule = $this->fillPaymentScheduleRelations($payment_schedule, $purchaseOrder);
      $purchaseOrder->paymentSchedules()->create([
        ...$payment_schedule,
      ]);
    }
    $purchaseOrder->logForCreated();
    return $purchaseOrder;
  }

  public function update(PurchaseOrder $purchaseOrder, array $data) {
    $purchaseOrder->fillForUpdate($this->fillRelations($data));

    $basicAmount = 0;
    $taxAmount   = 0;

    $purchaseOrder->items()
      ->whereNotIn('id', array_column($data['items'], 'id'))
      ->delete();
    foreach ($data['items'] as $item) {
      $item = $this->fillItemRelations($item, $purchaseOrder);

      if (Ulid::isValid($item['id'])) {
        $itemModel = $purchaseOrder->items()->find($item['id']);
        $itemModel->fill($item);
        $itemModel->save();
        $itemModel->refresh();
      } else {
        $itemModel = $purchaseOrder->items()->create($item);
        $itemModel->refresh();
      }

      $basicAmount += $itemModel->basic_amount;
      $taxAmount   += $itemModel->tax_amount;
    }

    $totalAmount = \App\Utils::countAmount($basicAmount, $taxAmount, $purchaseOrder->discount_on, $purchaseOrder->discount_amount);
    $purchaseOrder->update([
      'total_amount'               => $totalAmount,
      'total_amount_base_currency' => $totalAmount * ($purchaseOrder->exchange_rate ?? 1),
    ]);

    if (\array_key_exists('payment_schedules', $data)) {

      $purchaseOrder->paymentSchedules()
        ->whereNotIn('id', array_column($data['payment_schedules'], 'id'))
        ->delete();
      foreach ($data['payment_schedules'] as $payment_schedule) {
        $payment_schedule = $this->fillPaymentScheduleRelations($payment_schedule, $purchaseOrder);
        if (Ulid::isValid($payment_schedule['id'])) {
          $purchaseOrder->paymentSchedules()->find($payment_schedule['id'])->update([
            ...$payment_schedule,
          ]);
          continue;
        }
        $purchaseOrder->paymentSchedules()->create([
          ...$payment_schedule,
        ]);
      }
    }

    $purchaseOrder->logForUpdated();
    return $purchaseOrder;
  }

  public function submit(PurchaseOrder $purchaseOrder) {
    DB::beginTransaction();

    // ensure payment schedule portions valid when provided
    if ($purchaseOrder->paymentSchedules()->exists()) {
      $totalInvoicePortion = $purchaseOrder->paymentSchedules()->sum('invoice_portion');
      if ($totalInvoicePortion != 100) {
        DB::rollBack();
        throw \Illuminate\Validation\ValidationException::withMessages([
          'invoice_portion' => "Total invoice portion must be 100%",
        ]);
      }
    }

    $purchaseOrder->update([
      'code' => FormatingSeries::generate(PurchaseOrder::class, $purchaseOrder),
    ]);

    $items = $purchaseOrder->items()
      ->with(['item'])
      ->get();

    /** @var \Illuminate\Support\Collection<string, Stock> $stocks */
    $stocks = Stock::whereIn('item_variant_id', $items->pluck('item_id'))
      ->whereIn('warehouse_id', $items->pluck('target_warehouse_id'))
      ->lockForUpdate()
      ->get()
      ->keyBy(fn ($stock) => "{$stock->item_variant_id}-{$stock->warehouse_id}");

    foreach ($items as $item) {
      if (! $item->item->is_stock_item) continue;

      $stockKey = "{$item->item_id}-{$item->target_warehouse_id}";
      /** @var Stock|null $stock */
      $stock = $stocks->get($stockKey);
      if (! $stock) continue;

      $quantity = $item->quantity * $item->conversion_factor / $stock->conversion_factor;
      $stock->updateDetails('increment', 'incomings', $purchaseOrder->code, $quantity);
    }

    DB::commit();
    $purchaseOrder->checkApproval();

    return $purchaseOrder;
  }

  public function onApproved(PurchaseOrder $purchaseOrder) {
    DB::beginTransaction();
    $purchaseOrder->update([
      'status' => [FormStatus::TO_RECEIVE, FormStatus::TO_BILL],
    ]);

    $items = $purchaseOrder->items()
      ->whereNotNull('referenceable_type')
      ->whereNotNull('referenceable_id')
      ->with([
        'referenceable',
      ])
      ->get();

    $modelConnections = [];
    foreach ($items as $item) {
      // Update ordered_quantity from source item
      $sourceItem = $item->referenceable;
      $orderedQty = $sourceItem->ordered_quantity + $item->quantity;
      $sourceItem->update([
        'ordered_quantity' => $orderedQty > $sourceItem->quantity ? $sourceItem->quantity : $orderedQty,
      ]);

      $parentRelation     = $sourceItem->parentRelation();
      $parentRelationKey  = $parentRelation->getForeignKeyName();
      $modelConnections[] = [
        'model_type' => \get_class($parentRelation->getRelated()),
        'model_id'   => $sourceItem->$parentRelationKey,
      ];
    }
    $modelConnections = \collect($modelConnections)->unique('model_id')->toArray();

    // Create ModelConnection for each item
    foreach ($modelConnections as $modelConnection) {
      ModelConnection::create([
        'model_type'     => $modelConnection['model_type'],
        'model_id'       => $modelConnection['model_id'],
        'reference_type' => PurchaseOrder::class,
        'reference_id'   => $purchaseOrder->id,
      ]);
    }

    DB::commit();
    return $purchaseOrder;
  }

  private function rolllbackItems(PurchaseOrder $purchaseOrder) {
    $items = $purchaseOrder->items()
      ->get();
    foreach ($items as $item) {
      $stock = Stock::lockForUpdate()
        ->where('item_variant_id', $item->item_id)
        ->where('warehouse_id', $item->target_warehouse_id)
        ->lockForUpdate()
        ->first();

      $quantity = $item->quantity * $item->conversion_factor / $stock->conversion_factor;
      $stock->updateDetails('decrement', 'incomings', $purchaseOrder->code, $quantity);
    }
  }

  public function onRejected(PurchaseOrder $purchaseOrder) {
    DB::beginTransaction();
    $purchaseOrder->update([
      'status' => [
        FormStatus::REJECTED,
      ],
    ]);

    $this->rolllbackItems($purchaseOrder);

    DB::commit();
    return $purchaseOrder;
  }

  public function cancel(PurchaseOrder $purchaseOrder) {
    DB::beginTransaction();
    $purchaseOrder->update([
      'status' => [
        FormStatus::CANCELED,
      ],
    ]);

    $this->rolllbackItems($purchaseOrder);

    DB::commit();
    return $purchaseOrder;
  }
}
