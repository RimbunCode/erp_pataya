<?php

namespace App\Services\Purchase;

use App\FormStatus;
use App\Models\Core\FormatingSeries;
use App\Models\Core\ModelConnection;
use App\Models\Purchase\PurchaseRequest;
use App\Models\Purchase\PurchaseRequestItem;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Uid\Ulid;

class PurchaseRequestService {
    private function fillRelations(array $data) {
        return $data;
    }

    private function fillItemRelations(array $data) {
        $data['item_variant_id']   = $data['item']['id'];
        $data['item_name']         = $data['item']['sku'];
        $data['unit_id']           = $data['unit']['id'];
        $data['unit_name']         = $data['unit']['name'];
        $data['conversion_factor'] = $data['unit']['conversion_factor'];

        return $data;
    }

    public function create(array $data) {
        $data['code'] = FormatingSeries::generate(PurchaseRequest::class, $data, true);
        $pr           = PurchaseRequest::create($this->fillRelations($data));

        foreach ($data['items'] as $item) {
            $item = $this->fillItemRelations($item);
            $pr->items()->create($item);
        }
        $pr->logForCreated();

        return $pr;
    }

    public function update(PurchaseRequest $purchaseRequest, array $data) {
        $purchaseRequest->fillForUpdate($this->fillRelations($data));

        $purchaseRequest->items()
            ->whereNotIn('id', array_column($data['items'], 'id'))
            ->update(['deleted_at' => now()]);

        foreach ($data['items'] as $item) {
            $item = $this->fillItemRelations($item);

            if (Ulid::isValid($item['id'])) {
                $purchaseRequest->items()->find($item['id'])?->update($item);

                continue;
            }
            $purchaseRequest->items()->create($item);
        }
        $purchaseRequest->logForUpdated();

        return $purchaseRequest;
    }

    public function submit(PurchaseRequest $purchaseRequest) {
        $purchaseRequest->update([
            'code' => FormatingSeries::generate(PurchaseRequest::class, $purchaseRequest),
        ]);
        $purchaseRequest->checkApproval();

        return $purchaseRequest;
    }

    public function onApproved(PurchaseRequest $purchaseRequest) {
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

    public function onRejected(PurchaseRequest $purchaseRequest) {
        $purchaseRequest->update([
            'status' => FormStatus::REJECTED,
        ]);

        return $purchaseRequest;
    }

    public function cancel(PurchaseRequest $purchaseRequest) {
        $purchaseRequest->update([
            'status' => FormStatus::CANCELED,
        ]);

        return $purchaseRequest;
    }
}
