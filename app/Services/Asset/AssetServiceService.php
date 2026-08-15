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

    private function syncConsumedItems(AssetService $assetService, array $items): void {
        $itemIds = collect($items)
            ->pluck('id')
            ->filter(fn ($id) => Ulid::isValid((string) $id))
            ->values()
            ->all();

        $assetService->consumedItems()->whereNotIn('id', $itemIds)->delete();

        foreach ($items as $item) {
            $payload = Arr::only($item, ['item_id', 'quantity', 'valuation_rate']);

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
