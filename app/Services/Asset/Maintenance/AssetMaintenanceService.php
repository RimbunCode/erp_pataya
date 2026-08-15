<?php

namespace App\Services\Asset\Maintenance;

use App\Contracts\CrudService;
use App\Models\Asset\Maintenance\AssetMaintenance;
use App\Models\Asset\Maintenance\AssetMaintenanceTask;
use App\Models\Model;
use App\Services\Asset\AssetServiceService;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

class AssetMaintenanceService implements CrudService {
    /**
     * Get-or-create AssetMaintenance by asset_id (Requirement 2.4).
     */
    public function create(array $data): Model {
        return AssetMaintenance::firstOrCreate(
            ['asset_id' => $data['asset_id']],
            Arr::only($data, ['maintenance_team_id']),
        );
    }

    public function update(Model $model, array $data): Model {
        $model->update(Arr::only($data, ['maintenance_team_id']));

        return $model;
    }

    public function delete(Model $model): void {
        $model->delete();
    }

    /**
     * Get-or-create AssetMaintenance for the given asset, then create a
     * nested AssetMaintenanceTask and immediately generate its first
     * AssetService (Requirement 3.4).
     */
    public function createTaskForAsset(string $assetId, array $data): AssetMaintenanceTask {
        $maintenance = AssetMaintenance::firstOrCreate(
            ['asset_id' => $assetId],
            Arr::only($data, ['maintenance_team_id']),
        );

        return $this->createTask($maintenance, $data);
    }

    public function createTask(AssetMaintenance $assetMaintenance, array $data): AssetMaintenanceTask {
        return DB::transaction(function () use ($assetMaintenance, $data) {
            $task = $assetMaintenance->tasks()->create(Arr::only($data, [
                'task_name', 'maintenance_type', 'periodicity', 'next_due_date',
                'assign_to_id', 'certificate_required', 'description',
            ]));

            app(AssetServiceService::class)->generateForTask($task);

            return $task;
        });
    }

    public function updateTask(AssetMaintenanceTask $task, array $data): AssetMaintenanceTask {
        $task->update(Arr::only($data, [
            'task_name', 'maintenance_type', 'periodicity', 'next_due_date',
            'assign_to_id', 'certificate_required', 'description',
        ]));

        return $task;
    }

    public function deleteTask(AssetMaintenanceTask $task): void {
        $task->delete();
    }
}
