<?php

namespace App\Services\Asset;

use App\Contracts\SubmitableService;
use App\Enums\AssetServiceType;
use App\Enums\FormStatus;
use App\Events\Asset\AssetServiceCompleted;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetService;
use App\Models\Asset\Maintenance\AssetMaintenanceTask;
use App\Models\Core\FormatingSeries;
use App\Models\Model;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use LogicException;
use Symfony\Component\Uid\Ulid;

class AssetServiceService implements SubmitableService {
    /**
     * Requirement 4.4: status Asset yang menghalangi repair submit.
     */
    private const TERMINAL_ASSET_STATUSES = [
        FormStatus::WORK_IN_PROGRESS,
        FormStatus::CAPITALIZED,
        FormStatus::FULLY_DEPRECIATED,
        FormStatus::SOLD,
        FormStatus::SCRAPPED,
        FormStatus::CANCELED,
    ];

    public function create(array $data): Model {
        return DB::transaction(function () use ($data) {
            $data         = $this->flattenRelationFields($data);
            $assetService = AssetService::create([
                'code' => FormatingSeries::generate(AssetService::class, $data, true),
                ...Arr::only($data, [
                    'type', 'asset_id', 'asset_maintenance_task_id', 'failure_date',
                    'capitalize_repair_cost', 'increase_in_asset_life', 'description', 'branch_id',
                ]),
            ]);

            $this->syncConsumedItems($assetService, $data['consumedItems'] ?? []);

            return $assetService;
        });
    }

    public function update(Model $model, array $data): Model {
        return DB::transaction(function () use ($model, $data) {
            $data = $this->flattenRelationFields($data);
            $model->update(Arr::only($data, [
                'type', 'asset_id', 'asset_maintenance_task_id', 'failure_date',
                'capitalize_repair_cost', 'increase_in_asset_life', 'description', 'branch_id',
            ]));

            if (array_key_exists('consumedItems', $data)) {
                $this->syncConsumedItems($model, $data['consumedItems']);
            }

            return $model;
        });
    }

    /**
     * Frontend mengirim relasi `asset` (repair only) sebagai objek LinkModel
     * utuh ({id, ...}), bukan string id flat. Ekstrak `.id` ke key `asset_id`
     * yang dikonsumsi Arr::only() di atas, sama seperti pola
     * PurchaseOrderService::fillItemRelations() / AssetService::flattenRelationFields().
     * `consumedItems.*.item`/`.unit` sudah di-flatten terpisah di syncConsumedItems().
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function flattenRelationFields(array $data): array {
        if (isset($data['asset']['id'])) {
            $data['asset_id'] = $data['asset']['id'];
        }

        return $data;
    }

    private function syncConsumedItems(AssetService $assetService, array $items): void {
        $itemIds = collect($items)
            ->pluck('id')
            ->filter(fn ($id) => Ulid::isValid((string) $id))
            ->values()
            ->all();

        $assetService->consumedItems()->whereNotIn('id', $itemIds)->delete();

        foreach ($items as $item) {
            $item['item_id']      = $item['item']['id'];
            $item['item_unit_id'] = $item['unit']['id'];
            $payload              = Arr::only($item, ['item_id', 'item_unit_id', 'quantity']);
            // TODO: valuation_rate di-hardcode 0 sementara -- form tidak lagi
            // minta input manual, dan AssetService belum punya konsep warehouse
            // utk auto-resolve dari Stock::valuation_rate (butuh field
            // warehouse_id baru + migration). Efeknya: kapitalisasi biaya
            // perbaikan (AssetService::totalRepairCost()) dan prefill
            // SalesOrderItem.price dari consumedItem (SalesOrderController
            // case 'assetService') sama-sama jadi 0 sampai ini diperbaiki.
            $payload['valuation_rate'] = 0;

            if (Ulid::isValid((string) ($item['id'] ?? null))) {
                $assetService->consumedItems()->where('id', $item['id'])->update($payload);

                continue;
            }
            $assetService->consumedItems()->create($payload);
        }
    }

    public function delete(Model $model): void {
        $model->delete();
    }

    public function submit(Model $model): mixed {
        /** @var AssetService $model */
        if ($model->type === AssetServiceType::REPAIR) {
            $this->validateAssetNotTerminal($model->asset);

            DB::beginTransaction();

            try {
                $model->update([
                    'code' => FormatingSeries::generate(AssetService::class, $model),
                ]);
                DB::commit();
            } catch (\Throwable $e) {
                DB::rollBack();

                throw $e;
            }

            return $model->checkApproval();
        }

        // type=maintenance_task: bypass checkApproval() sepenuhnya (Requirement 4.6)
        return DB::transaction(function () use ($model) {
            $model->update([
                'code'   => FormatingSeries::generate(AssetService::class, $model),
                'status' => [FormStatus::APPROVED],
            ]);

            $this->onApproved($model);

            return $model;
        });
    }

    public function cancel(Model $model): mixed {
        /** @var AssetService $model */
        // Rollback status Asset yang di-set onApproved() (setOutOfOrder()/
        // setInMaintenance()) -- reactivate() melempar LogicException kalau
        // Asset sudah bukan di salah satu status itu lagi (mis. sudah
        // direaktivasi manual atau di-scrap sejak approval); tangkap supaya
        // cancel dokumen ini tetap sukses walau tidak ada yang perlu
        // di-rollback.
        $asset = $model->resolvedAsset();
        if ($asset) {
            try {
                $asset->reactivate();
            } catch (LogicException) {
                // Asset sudah tidak di status yang di-set servis ini -- skip.
            }
        }

        $model->update(['status' => [FormStatus::CANCELED]]);

        return $model;
    }

    public function amend(Model $model): mixed {
        return $model->amend();
    }

    public function onApproved(Model $model): mixed {
        /** @var AssetService $model */
        $asset = $model->resolvedAsset();

        if ($model->type === AssetServiceType::REPAIR) {
            $asset->setOutOfOrder();
        } else {
            $asset->setInMaintenance();
        }

        // Repair: checkApproval() (lewat ApprovalService::check(), saat tidak ada
        // ApprovalScheme aktif) memanggil onApproved() LANGSUNG tanpa pernah
        // meng-update status $model sendiri -- beda dari cabang maintenance_task
        // di submit() yang sudah eksplisit set status APPROVED sebelum
        // onApproved() dipanggil. Tanpa baris ini, dokumen AssetService type
        // repair tetap "draft" walau submit()-nya sukses. APPROVED (bukan
        // SUBMITTED) supaya konsisten dengan status yang sudah di-set cabang
        // maintenance_task -- onApproved() dipanggil kedua cabang, jadi baris
        // ini idempoten untuk maintenance_task (status sudah APPROVED).
        $model->update(['status' => [FormStatus::APPROVED]]);

        return $model;
    }

    public function onRejected(Model $model): mixed {
        $model->update(['status' => [FormStatus::DRAFT]]);

        return $model;
    }

    /**
     * Requirement 5.3/5.4, 6.1-6.4: tandai AssetService selesai. Ditolak
     * (LogicException) jika checklist belum lengkap (Correctness Property 3).
     */
    public function complete(AssetService $assetService): AssetService {
        if (! $assetService->isFullyChecked()) {
            throw new LogicException(__('asset/service.checklist_not_complete'));
        }

        return DB::transaction(function () use ($assetService) {
            $assetService->update(['completion_date' => now()]);

            if ($assetService->type === AssetServiceType::REPAIR && $assetService->capitalize_repair_cost) {
                $asset                        = $assetService->asset;
                $asset->additional_asset_cost = (float) $asset->additional_asset_cost + $assetService->totalRepairCost();
                if ($assetService->increase_in_asset_life) {
                    $asset->increase_in_asset_life = (int) $asset->increase_in_asset_life + (int) $assetService->increase_in_asset_life;
                }
                $asset->save();
            }

            event(new AssetServiceCompleted($assetService));

            if ($assetService->type === AssetServiceType::MAINTENANCE_TASK) {
                $this->regenerateNextTask($assetService->assetMaintenanceTask);
            }

            return $assetService;
        });
    }

    /**
     * Requirement 6.3: update AssetMaintenanceTask.last_completion_date/
     * next_due_date, lalu generate AssetService siklus berikutnya.
     */
    private function regenerateNextTask(AssetMaintenanceTask $task): void {
        $lastCompletion = now();
        $task->update([
            'last_completion_date' => $lastCompletion,
            'next_due_date'        => $lastCompletion->clone()->addDays($task->periodicityInDays()),
        ]);

        $this->generateForTask($task->fresh());
    }

    /**
     * Requirement 3.4, 6.3: buat AssetService type=maintenance_task baru
     * tertaut ke $task, lalu langsung submit() (auto-approve, bypass
     * checkApproval()) — AssetService type=maintenance_task tidak pernah
     * terlihat user dalam status draft.
     */
    public function generateForTask(AssetMaintenanceTask $task): AssetService {
        $newService = AssetService::create([
            'code'                      => FormatingSeries::generate(AssetService::class, [], true),
            'type'                      => AssetServiceType::MAINTENANCE_TASK,
            'asset_maintenance_task_id' => $task->id,
        ]);

        $this->submit($newService);

        return $newService->fresh();
    }

    private function validateAssetNotTerminal(?Asset $asset): void {
        if (! $asset) {
            return;
        }

        $statusValues = array_map(fn (FormStatus $s) => $s->value, $asset->status ?? []);
        $terminal     = array_map(fn (FormStatus $s) => $s->value, self::TERMINAL_ASSET_STATUSES);

        if (array_intersect($statusValues, $terminal) !== []) {
            throw new LogicException(__('asset/service.asset_status_terminal'));
        }
    }
}
