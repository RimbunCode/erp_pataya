<?php

namespace App\Services\Inventory;

use App\Contracts\SubmitableService;
use App\Enums\FormStatus;
use App\Events\Asset\AssetRentalDeliveryApproved;
use App\Events\Asset\AssetRentalReturnApproved;
use App\Events\Asset\AssetSoldViaDelivery;
use App\Events\Core\DocumentSubmitted;
use App\Events\Inventory\DeliveryNoteGeneralLedgerPostingRequested;
use App\Events\Sales\Order\DocumentDeliveryStatusRecalculationRequested;
use App\Models\Asset\AssetService;
use App\Models\Core\FormatingSeries;
use App\Models\Core\GlPostingStatus;
use App\Models\Inventory\DeliveryNote;
use App\Models\Inventory\DeliveryNoteItem;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\Stock;
use App\Models\Inventory\StockLedgerEntry;
use App\Models\Model;
use App\Models\Sales\InternalOrderItem;
use App\Models\Sales\SalesOrderItem;
use App\Traits\HasDefaultDelete;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use LogicException;
use Symfony\Component\Uid\Ulid;

class DeliveryNoteService implements SubmitableService {
    use HasDefaultDelete;

    /**
     * Create a new class instance.
     */
    public function fillRelations(array $data) {
        $data['customer_id']        = $data['customer']['id'] ?? null;
        $data['customer_branch_id'] = $data['customer_branch']['id'];
        $data['return_against_id']  = $data['return_against']['id'] ?? null;
        $data['reference_to_id']    = $data['reference_to']['id'];

        return $data;
    }

    private function fillItemRelations(array $item, array $units = [], array $referenceableItems = []) {
        // item_id diambil dari referenceable (SalesOrderItem/InternalOrderItem) — tidak trust FE
        $item['item_id'] = $referenceableItems[$item['referenceable_id']]->item_id;

        $item['item_unit_id']        = $item['unit']['id'];
        $item['source_warehouse_id'] = $item['source_warehouse']['id'] ?? null;
        $unit                        = $units[$item['unit']['id']] ?? null;
        $item['conversion_factor']   = $unit?->conversion_factor ?? 1;
        $item['quantity'] ??= 0;
        $item['valuation_rates']        = [];
        $item['return_against_item_id'] = $item['return_against_item']['id'] ?? null;

        return $item;
    }

    private function batchLoadReferenceableItems(array $data): array {
        $grouped = collect($data['items'])
            ->groupBy('referenceable_type')
            ->map(fn ($items, $type) => [
                'type' => $type,
                'ids'  => $items->pluck('referenceable_id')->filter()->unique()->values()->all(),
            ]);

        $result = [];
        foreach ($grouped as $group) {
            $models = $group['type']::whereIn('id', $group['ids'])->get()->keyBy('id');
            foreach ($models as $id => $model) {
                $result[$id] = $model;
            }
        }

        return $result;
    }

    private function batchLoadUnits(array $data): array {
        $unitIds = collect($data['items'])->pluck('unit.id')->filter()->unique()->values();

        return ItemUnit::whereIn('item_units.id', $unitIds)->get()->keyBy('id')->all();
    }

    public function create(array $data): Model {
        $data['code'] = FormatingSeries::generate(DeliveryNote::class, $data, true);
        $deliveryNote = DeliveryNote::create($this->fillRelations($data));

        $units              = $this->batchLoadUnits($data);
        $referenceableItems = $this->batchLoadReferenceableItems($data);
        foreach ($data['items'] as $item) {
            $item       = $this->fillItemRelations($item, $units, $referenceableItems);
            $assetLines = $item['asset_lines'] ?? [];
            unset($item['asset_lines']);
            $deliveryNoteItem = $deliveryNote->items()->create($item);
            $this->syncAssetLines($deliveryNoteItem, $assetLines);
        }

        return $deliveryNote;
    }

    /**
     * Requirement 1.1, spec asset-rental-migration: persist child
     * DeliveryNoteItemAsset dari payload FE (dulu tidak pernah tersimpan sama
     * sekali — asset_lines terbuang di FormRequest::validated() karena tidak
     * dideklarasikan di rules()). Delete-and-recreate karena baris ini hanya
     * editable saat draft (sebelum submit/approve), tidak ada histori per-line
     * yang perlu dipertahankan.
     */
    private function syncAssetLines(DeliveryNoteItem $item, array $lines): void {
        $item->assetLines()->delete();
        foreach ($lines as $line) {
            $item->assetLines()->create([
                'asset_id' => data_get($line, 'asset.id'),
                'quantity' => data_get($line, 'quantity'),
            ]);
        }
    }

    public function update(Model $deliveryNote, array $data): Model {
        $deliveryNote->fillForUpdate($this->fillRelations($data));

        $deliveryNote->items()
            ->whereNotIn('id', array_column($data['items'], 'id'))
            ->delete();
        $itemIds = collect($data['items'])
            ->pluck('id')
            ->filter(fn ($id) => Ulid::isValid((string) $id))
            ->values()
            ->all();
        $existingItems = $deliveryNote->items()
            ->whereIn('id', $itemIds)
            ->get()
            ->keyBy('id');

        $units              = $this->batchLoadUnits($data);
        $referenceableItems = $this->batchLoadReferenceableItems($data);
        foreach ($data['items'] as $item) {
            $item       = $this->fillItemRelations($item, $units, $referenceableItems);
            $assetLines = $item['asset_lines'] ?? [];
            unset($item['asset_lines']);

            if (Ulid::isValid($item['id'])) {
                $existingItem = $existingItems->get($item['id']);
                $existingItem?->update($item);
                if ($existingItem) {
                    $this->syncAssetLines($existingItem, $assetLines);
                }

                continue;
            }

            $deliveryNoteItem = $deliveryNote->items()->create($item);
            $this->syncAssetLines($deliveryNoteItem, $assetLines);
        }

        return $deliveryNote;
    }

    // submit function for delivery note
    public function submit(Model $deliveryNote): mixed {
        DB::beginTransaction();

        $deliveryNote->update([
            'code' => FormatingSeries::generate(DeliveryNote::class, $deliveryNote),
        ]);

        event(new DocumentSubmitted($deliveryNote, $deliveryNote->referenceable));
        DeliveryNote::orWhere(function ($query) use ($deliveryNote) {
            $query->where(function ($query) use ($deliveryNote) {
                $query->where('referenceable_type', $deliveryNote->referenceable_type)
                    ->where('referenceable_id', $deliveryNote->referenceable_id);
            });
            $query->where('return_against_id', $deliveryNote->return_against_id);
        })->whereRaw('json_overlaps(`status`, ?)', [json_encode(['draft'])])
            ->whereNot('created_by_id', Auth::user()->id)
            ->update([
                'status'      => 'canceled',
                'canceled_at' => now(),
            ]);
        DB::commit();
        $deliveryNote->checkApproval();

        return $deliveryNote;
    }

    public function onApproved(Model $deliveryNote): mixed {
        DB::beginTransaction();
        $returnAgainst = $deliveryNote->returnAgainst;
        $deliveryNote->update([
            'status' => $returnAgainst ? FormStatus::RETURNED : FormStatus::DELIVERED,
        ]);

        $toReference = $deliveryNote->referenceable;
        $items       = $deliveryNote->items()
            ->with([
                'item',
                'item.item',
                'item.item.category',
                'referenceable',
                'returnAgainstItem',
                'sourceWarehouse',
                'unit',
            ])
            ->get();

        // Preload all needed stocks in one query to avoid N+1
        /** @var Collection<string, Stock> $stocks */
        $stocks = Stock::whereIn('item_variant_id', $items->pluck('item_id'))
            ->whereIn('warehouse_id', $items->pluck('source_warehouse_id'))
            ->with(['unit'])
            ->lockForUpdate()
            ->get()
            ->keyBy(fn ($stock) => "{$stock->item_variant_id}-{$stock->warehouse_id}");

        $errorItems  = [];
        $totalPicked = 0;
        foreach ($items as $item) {
            // update delivered quantity dari Sales Order Item
            if (! $item->referenceable) {
                throw new \RuntimeException("DeliveryNoteItem {$item->id} has no referenceable (type: {$item->referenceable_type}, id: {$item->referenceable_id})");
            }

            // Asset rental/jual-putus (Requirement 1, spec asset-rental-migration) — TIDAK PERNAH
            // menyentuh logic Stock/StockLedgerEntry apapun, di-skip total dari loop lama.
            if ($item->item?->item?->is_fixed_asset) {
                $item->referenceable->increment('delivered_quantity', $item->quantity);

                try {
                    $this->handleAssetDeliveryItem($item, $deliveryNote, (bool) $returnAgainst);
                } catch (LogicException $e) {
                    DB::rollBack();

                    throw $e;
                }

                continue;
            }

            // Requirement 8.4, spec asset-service-billing: baris jasa AssetService
            // (bukan part/consumed item) TIDAK PERNAH menyentuh Stock/StockLedgerEntry
            // — murni dokumentasi serah-terima, mirip pola is_fixed_asset di atas.
            // Requirement 3.2, spec asset-service-internal-order: diperluas ke
            // InternalOrderItem — baris jasa dari InternalOrder juga harus skip.
            if (($item->referenceable instanceof SalesOrderItem || $item->referenceable instanceof InternalOrderItem)
                && $item->referenceable->referenceable_type === AssetService::class) {
                $item->referenceable->increment('delivered_quantity', $item->quantity);

                continue;
            }

            // Requirement 1.4, spec asset-rental-migration: gate rental lama
            // ($item->item->type == 'vehicle') dihapus total — kelayakan rental
            // sekarang murni ditentukan Item.is_fixed_asset (branch di atas).
            if ($returnAgainst) {
                $item->referenceable->decrement('delivered_quantity', $item->quantity);
            } else {
                $item->referenceable->increment('delivered_quantity', $item->quantity);
            }
            if (! $item->item->is_stock_item) {
                continue;
            }

            // update stock
            $stockKey = "{$item->item_id}-{$item->source_warehouse_id}";
            /** @var Stock|null $stock */
            $stock     = $stocks->get($stockKey);
            $itemLabel = "{$item->item->code} - {$item->item->item_name}";

            if (! $stock) {
                $errorItems[] = "Item {$itemLabel} is not in {$item->sourceWarehouse->name} stock";

                continue;
            }
            $quantity = $item->quantity * $item->conversion_factor / $stock->conversion_factor;
            if ($stock->actual_quantity < $quantity) {
                $stockUnitName = $stock->unit?->name;
                $orderUnitName = $item->unit?->name;
                $errorItems[]  = "Item {$itemLabel} in {$item->sourceWarehouse->name} stock is {$stock->actual_quantity} {$stockUnitName} but you need {$quantity} {$stockUnitName} ({$item->quantity} {$orderUnitName})";

                continue;
            }
            $rentedQuantity  = $stock->rented_quantity ?? 0;
            $quantityRequest = $quantity;

            $queue          = $stock->stock_queue;
            $remainingQueue = [];
            $picked         = [];
            $amountPicked   = 0;

            $offset = $rentedQuantity;

            if ($returnAgainst) {
                $valuationRates = $item->returnAgainstItem->valuation_rates;
                $remainingQueue = [
                    ...$queue,
                    ...$valuationRates ?? [],
                ];
                $amountPicked = \array_sum(array_map(fn ($q) => $q['rate'] * $q['quantity'], $valuationRates ?? []));
                $totalPicked += $amountPicked;
                // Lock returnAgainstItem sebelum baca-modifikasi-tulis (Req 1.7)
                $returnAgainstItem = $item->returnAgainstItem()->lockForUpdate()->first();
                $returnAgainstItem->update([
                    'returned_quantity' => $returnAgainstItem->returned_quantity + $quantity,
                ]);
                $stock->fill([
                    'quantity'    => $stock->quantity + $quantity,
                    'stock_queue' => $remainingQueue,
                ]);
                $stock->updateDetails('increment', 'reservations', $toReference->code, $quantity);
                $stock->refresh();
                StockLedgerEntry::create([
                    'item_id'                    => $item->item_id,
                    'warehouse_id'               => $item->source_warehouse_id,
                    'item_unit_id'               => $stock->item_unit_id,
                    'conversion_factor'          => $stock->conversion_factor,
                    'quantity_change'            => $quantity,
                    'quantity_after_transaction' => $stock->actual_quantity,
                    'valuation_rate'             => $stock->valuation_rate,
                    'balance_stock_value'        => \array_sum(array_map(fn ($q) => $q['rate'] * $q['quantity'], $stock->stock_queue)),
                    'change_in_stock_value'      => $amountPicked,
                    'stock_queue'                => $stock->stock_queue,
                    'referenceable_type'         => DeliveryNote::class,
                    'referenceable_id'           => $deliveryNote->id,
                    'transaction_date'           => $deliveryNote->delivery_date,
                ]);
            } else {
                foreach ($queue as $q) {
                    // belum sampai batch target
                    if ($offset >= $q['quantity']) {
                        $offset -= $q['quantity'];

                        // batch tetap ada
                        if ($q['quantity'] > 0) {
                            $remainingQueue[] = $q;
                        }

                        continue;
                    }

                    // batch target
                    if ($offset >= 0) {
                        // ambil dari batch ini
                        $picked[] = [
                            'quantity' => $quantityRequest,
                            'rate'     => $q['rate'],
                        ];

                        $amountPicked += $quantityRequest * $q['rate'];

                        // kurangi qty
                        $q['quantity'] -= $quantityRequest;

                        // hanya masukkan jika masih ada sisa
                        if ($q['quantity'] > 0) {
                            $remainingQueue[] = $q;
                        }

                        // setelah batch target, sisanya copy apa adanya
                        $offset = -1;

                        continue;
                    }

                    // batch setelah target
                    if ($q['quantity'] > 0) {
                        $remainingQueue[] = $q;
                    }
                }
                $totalPicked += $amountPicked;
                $item->update([
                    'valuation_rates' => $picked,
                ]);
                $stock->fill([
                    'quantity'    => $stock->quantity - $quantity,
                    'stock_queue' => $remainingQueue,
                ]);
                $stock->updateDetails('decrement', 'reservations', $toReference->code, $quantity);
                $stock->refresh();
                StockLedgerEntry::create([
                    'item_id'                    => $item->item_id,
                    'warehouse_id'               => $item->source_warehouse_id,
                    'item_unit_id'               => $stock->item_unit_id,
                    'conversion_factor'          => $stock->conversion_factor,
                    'quantity_change'            => -$quantity,
                    'quantity_after_transaction' => $stock->actual_quantity,
                    'valuation_rate'             => $stock->valuation_rate,
                    'balance_stock_value'        => \array_sum(array_map(fn ($q) => $q['rate'] * $q['quantity'], $stock->stock_queue)),
                    'change_in_stock_value'      => -$amountPicked,
                    'stock_queue'                => $stock->stock_queue,
                    'referenceable_type'         => DeliveryNote::class,
                    'referenceable_id'           => $deliveryNote->id,
                    'transaction_date'           => $deliveryNote->delivery_date,
                ]);
            }
        }

        event(new DocumentDeliveryStatusRecalculationRequested($toReference));

        if ($totalPicked > 0) {
            GlPostingStatus::create([
                'referenceable_type' => DeliveryNote::class,
                'referenceable_id'   => $deliveryNote->id,
                'status'             => FormStatus::PENDING,
            ]);
            event(new DeliveryNoteGeneralLedgerPostingRequested(
                $deliveryNote,
                $totalPicked,
                (bool) $returnAgainst,
                now(),
            ));
        }

        DB::commit();

        return $deliveryNote;
    }

    /**
     * Requirement 1-3, spec asset-rental-migration: dispatch event per baris
     * DeliveryNoteItemAsset (rental/retur/jual-putus) — TIDAK menyentuh Stock.
     */
    private function handleAssetDeliveryItem(DeliveryNoteItem $item, DeliveryNote $deliveryNote, bool $returnAgainst): void {
        $lines = $item->assetLines()->with('asset.assetCategory')->get();

        if (abs((float) $lines->sum('quantity') - (float) $item->quantity) > 0.0001) {
            throw new LogicException(__('asset/asset.quantity_mismatch'));
        }

        $isRentSo = $item->referenceable instanceof SalesOrderItem
            ? (bool) ($item->referenceable->salesOrder?->is_rent ?? false)
            : false;

        foreach ($lines as $line) {
            $asset = $line->asset;
            if (! $asset->is_rentable) {
                throw new LogicException(__('asset/asset.asset_not_rentable'));
            }
            if ($asset->item_id !== $item->item?->item_id) {
                throw new LogicException(__('asset/asset.item_mismatch'));
            }

            if ($returnAgainst) {
                event(new AssetRentalReturnApproved($line));
            } elseif ($isRentSo) {
                event(new AssetRentalDeliveryApproved($line));
            } else {
                event(new AssetSoldViaDelivery($line));
            }
        }
    }

    public function onRejected(Model $deliveryNote): mixed {
        $deliveryNote->update([
            'status' => FormStatus::REJECTED,
        ]);

        return $deliveryNote;
    }

    public function cancel(Model $deliveryNote): mixed {
        $deliveryNote->update([
            'status' => FormStatus::CANCELED,
        ]);

        return $deliveryNote;
    }

    public function amend(Model $model): mixed {
        return $model;
    }
}
