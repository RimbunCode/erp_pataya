<?php

namespace App\Services\Purchase;

use App\Contracts\SubmitableService;
use App\Enums\FormStatus;
use App\Models\Core\FormatingSeries;
use App\Models\Core\ModelConnection;
use App\Models\Inventory\ItemUnit;
use App\Models\Model;
use App\Models\Purchase\PurchaseRequest;
use App\Models\Purchase\PurchaseRequestItem;
use App\Traits\HasDefaultDelete;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Uid\Ulid;

class PurchaseRequestService implements SubmitableService {
    use HasDefaultDelete;

    private function fillRelations(array $data) {
        return $data;
    }

    private function fillItemRelations(array $data, array $units = []) {
        $unit                      = $units[$data['unit']['id']] ?? null;
        $data['item_variant_id']   = $data['item']['id'];
        $data['item_name']         = $data['item']['code'];
        $data['item_unit_id']      = $data['unit']['id'];
        $data['unit_name']         = $unit?->name ?? $data['unit']['name'] ?? null;
        $data['conversion_factor'] = $unit?->conversion_factor ?? 1;

        return $data;
    }

    private function batchLoadUnits(array $data): array {
        $unitIds = collect($data['items'])->pluck('unit.id')->filter()->unique()->values();

        return ItemUnit::with('unit')->whereIn('item_units.id', $unitIds)->get()->keyBy('id')->all();
    }

    public function create(array $data): Model {
        $data['code'] = FormatingSeries::generate(PurchaseRequest::class, $data, true);
        $pr           = PurchaseRequest::create($this->fillRelations($data));

        $units = $this->batchLoadUnits($data);
        foreach ($data['items'] as $item) {
            $item = $this->fillItemRelations($item, $units);
            $pr->items()->create($item);
        }

        return $pr;
    }

    public function update(Model $purchaseRequest, array $data): Model {
        $purchaseRequest->fillForUpdate($this->fillRelations($data));

        $purchaseRequest->items()
            ->whereNotIn('id', array_column($data['items'], 'id'))
            ->update(['deleted_at' => now()]);
        $itemIds = collect($data['items'])
            ->pluck('id')
            ->filter(fn ($id) => Ulid::isValid((string) $id))
            ->values()
            ->all();
        $existingItems = $purchaseRequest->items()
            ->whereIn('id', $itemIds)
            ->get()
            ->keyBy('id');

        $units = $this->batchLoadUnits($data);
        foreach ($data['items'] as $item) {
            $item = $this->fillItemRelations($item, $units);

            if (Ulid::isValid($item['id'])) {
                $existingItems->get($item['id'])?->update($item);

                continue;
            }
            $purchaseRequest->items()->create($item);
        }

        return $purchaseRequest;
    }

    public function submit(Model $purchaseRequest): mixed {
        $purchaseRequest->update([
            'code' => FormatingSeries::generate(PurchaseRequest::class, $purchaseRequest),
        ]);
        $purchaseRequest->checkApproval();

        return $purchaseRequest;
    }

    public function onApproved(Model $purchaseRequest): mixed {
        DB::beginTransaction();
        $purchaseRequest->update([
            'status' => FormStatus::TO_ORDER,
        ]);

        $items = $purchaseRequest->items()
            ->whereNotNull('referenceable_type')
            ->whereNotNull('referenceable_id')
            ->with([
                'referenceable',
            ])
            ->get();

        $modelConnections = [];
        foreach ($items as $item) {
            // Update ordered_quantity from source item
            $sourceItem         = $item->referenceable;
            $modelConnections[] = [
                'model'     => $item->referenceable,
                'reference' => $item,
                'data'      => [
                    'requested_quantity' => $item->quantity,
                ],
            ];

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
            $mType = isset($modelConnection['model']) ? \get_class($modelConnection['model']) : $modelConnection['model_type'];
            $mId   = isset($modelConnection['model']) ? $modelConnection['model']->id : $modelConnection['model_id'];
            $rType = isset($modelConnection['reference']) ? \get_class($modelConnection['reference']) : ($modelConnection['reference_type'] ?? PurchaseRequest::class);
            $rId   = isset($modelConnection['reference']) ? $modelConnection['reference']->id : ($modelConnection['reference_id'] ?? $purchaseRequest->id);

            ModelConnection::updateOrCreate(
                [
                    'model_type'     => $mType,
                    'model_id'       => $mId,
                    'reference_type' => $rType,
                    'reference_id'   => $rId,
                ],
                [
                    // Tetap pasang object ke dalam array payload agar
                    // event creating/updating pada model_display tetap berjalan.
                    ...(isset($modelConnection['model']) ? [
                        'model' => $modelConnection['model'],
                    ] : []),
                    ...(isset($modelConnection['reference']) ? [
                        'reference' => $modelConnection['reference'],
                    ] : []),
                    'data' => $modelConnection['data'] ?? null,
                ],
            );
        }

        $itemConnections = ModelConnection::with('reference')
            ->search(PurchaseRequestItem::class, $items->pluck('id')->toArray())
            ->get();

        foreach ($itemConnections->groupBy('reference_type') as $type => $connections) {
            $uniqueReference = $connections->unique('reference_id');
            $ids             = $uniqueReference->pluck('reference_id')->toArray();

            $sums = ModelConnection::search($type, $ids)
                ->get()
                ->groupBy('reference_id')
                ->map(fn ($group) => $group->sum('data.requested_quantity'));

            foreach ($uniqueReference as $reference) {
                $qty  = $sums->get($reference->id, 0);
                $item = $reference->reference;
                $item->update([
                    'requested_quantity' => $qty,
                ]);
            }
        }

        DB::commit();

        return $purchaseRequest;
    }

    public function onRejected(Model $purchaseRequest): mixed {
        $purchaseRequest->update([
            'status' => FormStatus::REJECTED,
        ]);

        return $purchaseRequest;
    }

    public function cancel(Model $purchaseRequest): mixed {
        $purchaseRequest->update([
            'status' => FormStatus::CANCELED,
        ]);

        return $purchaseRequest;
    }

    public function amend(Model $model): mixed {
        return $model;
    }
}
