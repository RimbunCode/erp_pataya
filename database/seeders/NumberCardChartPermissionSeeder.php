<?php

namespace Database\Seeders;

use App\Models\User\Permission;
use App\Models\User\RolePermission;
use Illuminate\Database\Seeder;

/**
 * Registrasi `Permission` (config model-permissible) + grant `RolePermission`
 * ke tiap role yang SEBELUMNYA punya akses `App\Models\Core\Widget` —
 * levelnya disalin PERSIS (bukan asumsi full-access) supaya role dengan
 * akses terbatas (mis. read-only) tidak diam-diam jadi punya akses penuh
 * ke NumberCard/Chart. Idempotent (firstOrCreate) — aman dijalankan ulang.
 *
 * Baris `permissions`/`role_permissions` bukan schema (tidak di-manage
 * migration di app ini — dikonfirmasi tidak ada seeder existing yang
 * membuatnya, murni data provisioning manual/UI), makanya provisioning
 * data model baru lewat seeder terpisah ini, bukan migration.
 */
class NumberCardChartPermissionSeeder extends Seeder {
    public function run(): void {
        $widgetPermission = Permission::withTrashed()->where('model', 'App\\Models\\Core\\Widget')->first();

        foreach ([
            ['model' => 'App\\Models\\Core\\NumberCard', 'name' => 'Number Cards', 'route' => 'numberCards'],
            ['model' => 'App\\Models\\Core\\Chart', 'name' => 'Charts', 'route' => 'charts'],
        ] as $config) {
            $permission = Permission::firstOrCreate(
                ['model' => $config['model']],
                [
                    'module'             => 'Core',
                    'name'               => $config['name'],
                    'route'              => $config['route'],
                    'permissions'        => ['select', 'read', 'write', 'create', 'delete', 'import', 'export', 'share'],
                    'is_submitable'      => false,
                    'allow_only_creator' => false,
                    'ignore_permission'  => false,
                ],
            );

            if (! $widgetPermission) {
                continue;
            }

            $widgetGrants = RolePermission::where('permission_id', $widgetPermission->id)->get();
            foreach ($widgetGrants as $grant) {
                RolePermission::firstOrCreate(
                    ['permission_id' => $permission->id, 'role_id' => $grant->role_id, 'level' => $grant->level],
                    [
                        'module'        => 'Core',
                        'name'          => $config['name'],
                        'model'         => $config['model'],
                        'only_creator'  => $grant->only_creator,
                        'is_submitable' => false,
                        'permissions'   => $grant->permissions,
                    ],
                );
            }
        }
    }
}
