<?php

namespace Database\Seeders;

use App\Models\Core\GlPostingStatus;
use App\Models\User\Permission;
use App\Models\User\Role;
use App\Models\User\RolePermission;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class GlPostingStatusPermissionSeeder extends Seeder {
    /**
     * Run the database seeds.
     */
    public function run(): void {
        DB::transaction(function (): void {
            $permission = Permission::withTrashed()->updateOrCreate(
                ['model' => GlPostingStatus::class],
                [
                    'module'             => 'Core',
                    'name'               => 'GL Posting Statuses',
                    'route'              => 'gl-posting-statuses',
                    'permissions'        => ['select', 'read', 'write'],
                    'is_submitable'      => false,
                    'allow_only_creator' => false,
                    'ignore_permission'  => false,
                    'deleted_at'         => null,
                ],
            );
            $role = Role::where('name', 'System Manager')->first();
            if (! $role) {
                return;
            }

            RolePermission::withTrashed()->updateOrCreate(
                [
                    'role_id'       => $role->id,
                    'permission_id' => $permission->id,
                    'level'         => 0,
                    'only_creator'  => false,
                ],
                [
                    'module'        => 'Core',
                    'name'          => $permission->name,
                    'model'         => GlPostingStatus::class,
                    'is_submitable' => false,
                    'permissions'   => ['select' => true, 'read' => true, 'write' => true],
                    'deleted_at'    => null,
                ],
            );
        });
    }
}
