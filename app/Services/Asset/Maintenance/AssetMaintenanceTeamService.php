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
            $data = $this->flattenRelationFields($data);
            $team = AssetMaintenanceTeam::create(Arr::only($data, ['team_name', 'manager_id', 'branch_id']));

            foreach ($data['members'] ?? [] as $member) {
                $team->members()->create(Arr::only($this->flattenMemberFields($member), ['user_id']));
            }

            return $team;
        });
    }

    public function update(Model $model, array $data): Model {
        return DB::transaction(function () use ($model, $data) {
            $data = $this->flattenRelationFields($data);
            $model->update(Arr::only($data, ['team_name', 'manager_id', 'branch_id']));

            if (array_key_exists('members', $data)) {
                $data['members'] = array_map($this->flattenMemberFields(...), $data['members']);
                $model->syncRelationData('members', $data);
            }

            return $model;
        });
    }

    public function delete(Model $model): void {
        $model->delete();
    }

    /**
     * Frontend mengirim relasi (manager, branch) sebagai objek LinkModel utuh
     * ({id, ...}), bukan string id flat. Ekstrak `.id` ke key `_id` yang
     * dikonsumsi Arr::only() di atas, sama seperti pola
     * PurchaseOrderService::fillItemRelations() / AssetService::flattenRelationFields().
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function flattenRelationFields(array $data): array {
        if (isset($data['manager']['id'])) {
            $data['manager_id'] = $data['manager']['id'];
        }
        if (isset($data['branch']['id'])) {
            $data['branch_id'] = $data['branch']['id'];
        }

        return $data;
    }

    /**
     * Sama seperti flattenRelationFields(), tapi untuk baris `members` —
     * frontend mengirim `user` sebagai objek LinkModel utuh via UserLinkModel
     * di kolom FormTable, bukan `user_id` string flat.
     *
     * @param  array<string, mixed>  $member
     * @return array<string, mixed>
     */
    private function flattenMemberFields(array $member): array {
        if (isset($member['user']['id'])) {
            $member['user_id'] = $member['user']['id'];
        }

        return $member;
    }
}
