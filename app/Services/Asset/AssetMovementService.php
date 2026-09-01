<?php

namespace App\Services\Asset;

use App\Contracts\SubmitableService;
use App\Enums\AssetMovementPurpose;
use App\Enums\FormStatus;
use App\Events\Asset\AssetMovementApproved;
use App\Models\Asset\AssetMovement;
use App\Models\Core\FormatingSeries;
use App\Models\Inventory\DeliveryNote;
use App\Models\Inventory\DeliveryNoteItemAsset;
use App\Models\Model;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use LogicException;

class AssetMovementService implements SubmitableService {
    public function create(array $data): Model {
        DB::beginTransaction();

        try {
            $movement = AssetMovement::create([
                'code' => FormatingSeries::generate(AssetMovement::class, $data, true),
                ...Arr::only($data, ['purpose', 'transaction_date', 'branch_id', 'reference_type', 'reference_id']),
            ]);

            foreach ($data['items'] ?? [] as $item) {
                $movement->items()->create(Arr::only($this->flattenItemRelations($item), [
                    'asset_id', 'source_location_id', 'target_location_id',
                    'from_custodian_id', 'to_custodian_id',
                ]));
            }
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();

            throw $e;
        }

        return $movement;
    }

    public function update(Model $model, array $data): Model {
        DB::beginTransaction();

        try {
            $model->update(Arr::only($data, ['purpose', 'transaction_date', 'branch_id', 'reference_type', 'reference_id']));

            if (array_key_exists('items', $data)) {
                $model->items()->delete();
                foreach ($data['items'] as $item) {
                    $model->items()->create(Arr::only($this->flattenItemRelations($item), [
                        'asset_id', 'source_location_id', 'target_location_id',
                        'from_custodian_id', 'to_custodian_id',
                    ]));
                }
            }
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();

            throw $e;
        }

        return $model;
    }

    public function delete(Model $model): void {
        $model->delete();
    }

    /**
     * Frontend mengirim relasi item (asset, source_location, target_location,
     * to_custodian) sebagai objek LinkModel utuh ({id, ...}), bukan string id
     * flat. Ekstrak `.id` ke key `_id` yang dikonsumsi Arr::only() di atas,
     * sama seperti pola PurchaseOrderService::fillItemRelations().
     *
     * @param  array<string, mixed>  $item
     * @return array<string, mixed>
     */
    private function flattenItemRelations(array $item): array {
        if (isset($item['asset']['id'])) {
            $item['asset_id'] = $item['asset']['id'];
        }
        if (isset($item['source_location']['id'])) {
            $item['source_location_id'] = $item['source_location']['id'];
        }
        if (isset($item['target_location']['id'])) {
            $item['target_location_id'] = $item['target_location']['id'];
        }
        if (isset($item['to_custodian']['id'])) {
            $item['to_custodian_id'] = $item['to_custodian']['id'];
        }

        return $item;
    }

    public function submit(Model $model): mixed {
        $this->validateItems($model);

        DB::beginTransaction();

        try {
            $model->update([
                'code' => FormatingSeries::generate(AssetMovement::class, $model),
            ]);
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();

            throw $e;
        }

        return $model->checkApproval();
    }

    public function cancel(Model $model): mixed {
        $model->update(['status' => [FormStatus::CANCELED]]);

        return $model;
    }

    public function amend(Model $model): mixed {
        return $model->amend();
    }

    public function onApproved(Model $model): mixed {
        $statusValues   = array_map(fn (FormStatus $s) => $s->value, $model->status ?? []);
        $statusValues   = array_values(array_diff($statusValues, [FormStatus::DRAFT->value]));
        $statusValues[] = FormStatus::SUBMITTED->value;

        $model->update(['status' => array_map(fn (string $v) => FormStatus::from($v), $statusValues)]);

        event(new AssetMovementApproved($model));

        return null;
    }

    public function onRejected(Model $model): mixed {
        $model->update(['status' => [FormStatus::DRAFT]]);

        return $model;
    }

    /**
     * Requirement 2, spec asset-service-billing: AssetMovement rental/sale dibuat
     * OTOMATIS (status APPROVED langsung, bypass approval chain) saat DeliveryNote
     * yang mengandung baris rental/sale di-approve — DeliveryNote adalah gate-nya,
     * bukan AssetMovement ini. Dipanggil dari listener Spec 6 (SetAssetInRent dst).
     */
    public function createFromRentalSale(DeliveryNoteItemAsset $line, AssetMovementPurpose $purpose): AssetMovement {
        $deliveryNote = $line->deliveryNoteItem->deliveryNote;

        $movement = AssetMovement::create([
            'code'             => FormatingSeries::generate(AssetMovement::class, [], true),
            'purpose'          => $purpose,
            'transaction_date' => now(),
            'status'           => [FormStatus::APPROVED],
            'reference_type'   => DeliveryNote::class,
            'reference_id'     => $deliveryNote->id,
        ]);

        $movement->items()->create([
            'asset_id'           => $line->asset_id,
            'quantity'           => $line->quantity,
            'customer_id'        => $deliveryNote->customer_id,
            'customer_branch_id' => $deliveryNote->customer_branch_id,
        ]);

        return $movement;
    }

    /**
     * Requirement 2: validasi field lokasi wajib per purpose, konsistensi
     * source_location dengan lokasi Asset saat ini, dan status Asset ACTIVE.
     */
    private function validateItems(AssetMovement $model): void {
        $purpose = $model->purpose;

        foreach ($model->items as $item) {
            $asset = $item->asset;

            if (! $asset || ! in_array(FormStatus::ACTIVE, $asset->status ?? [], true)) {
                throw new LogicException(__('asset/movement.asset_must_be_active', ['code' => $asset?->code]));
            }

            if (in_array($purpose, [AssetMovementPurpose::TRANSFER, AssetMovementPurpose::TRANSFER_AND_ISSUE], true)) {
                if (! $item->source_location_id || ! $item->target_location_id) {
                    throw new LogicException(__('asset/movement.transfer_requires_both_locations'));
                }
            }

            if ($purpose === AssetMovementPurpose::ISSUE && ! $item->target_location_id) {
                throw new LogicException(__('asset/movement.issue_requires_target_location'));
            }

            if ($purpose === AssetMovementPurpose::RECEIPT && ! $item->source_location_id) {
                throw new LogicException(__('asset/movement.receipt_requires_source_location'));
            }

            if ($item->source_location_id && $item->source_location_id !== $asset->asset_location_id) {
                throw new LogicException(__('asset/movement.source_location_mismatch', ['code' => $asset->code]));
            }
        }
    }
}
