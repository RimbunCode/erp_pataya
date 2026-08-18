<?php

namespace App\Services\Asset\Maintenance;

use App\Contracts\CrudService;
use App\Models\Asset\Maintenance\AssetMaintenanceTeam;
use App\Models\Model;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

class AssetMaintenanceTeamService implements CrudService {
    public function create(array $data): Model {
        return DB::transaction(function () use ($data) {
            $team = AssetMaintenanceTeam::create(Arr::only($data, ['team_name', 'manager_id', 'branch_id']));

            foreach ($data['members'] ?? [] as $member) {
                $team->members()->create(Arr::only($member, ['user_id']));
            }

            return $team;
        });
    }

    public function update(Model $model, array $data): Model {
        return DB::transaction(function () use ($model, $data) {
            $model->update(Arr::only($data, ['team_name', 'manager_id', 'branch_id']));

            if (array_key_exists('members', $data)) {
                $model->syncRelationData('members', $data);
            }

            return $model;
        });
    }

    public function delete(Model $model): void {
        $model->delete();
    }
}
