<?php

namespace Database\Seeders;

use App\Enums\FormStatus;
use App\Models\Core\Branch;
use App\Models\User\Permission;
use App\Models\User\Role;
use App\Models\User\RolePermission;
use App\Models\User\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Seeder khusus staging: mendefinisikan ulang role operasional (nama sama
 * seperti di `AdministratorSeeder`) dengan tambahan akses View Only
 * (select+read) ke seluruh module DI LUAR scope masing-masing role, kecuali
 * module `User` (data user/role/permission tetap tertutup). Tujuannya agar
 * karyawan lintas divisi bisa saling memantau status dokumen tanpa bisa
 * mengubah data divisi lain.
 *
 * PERINGATAN: karena role di-resolve berdasarkan `name`, menjalankan seeder
 * ini akan MENIMPA role dengan nama sama yang dibuat `AdministratorSeeder`.
 * Hanya jalankan di database staging, jangan di production.
 */
class StagingRoleSeeder extends Seeder {
    /** Module yang tidak diberikan akses View Only lintas-role (tetap privat). */
    private const EXCLUDED_VIEW_ONLY_MODULES = ['User'];

    public function run(): void {
        DB::transaction(function (): void {
            $defaultBranch = Branch::query()
                ->where('is_main_branch', true)
                ->whereNull('branchable_type')
                ->whereNull('branchable_id')
                ->firstOrFail();

            $permissions = Permission::query()
                ->orderBy('module')
                ->orderBy('name')
                ->get();

            $allModules = $permissions->pluck('module')->unique()->values();

            foreach ($this->stagingRoles() as $roleDefinition) {
                $role = Role::updateOrCreate(
                    ['name' => $roleDefinition['name']],
                    [
                        'description' => $roleDefinition['description'],
                        'is_disabled' => false,
                    ],
                );

                $ownModules = $this->normalizeModules($roleDefinition['modules'], $allModules);

                $payloads = $this->buildOwnScopePayloads($permissions, $ownModules, $roleDefinition['profile']);

                $viewOnlyModules = $allModules
                    ->diff($ownModules)
                    ->diff(self::EXCLUDED_VIEW_ONLY_MODULES);

                $payloads = $payloads->union(
                    $this->buildViewOnlyPayloads($permissions, $viewOnlyModules),
                );

                $this->syncRolePermissions($role, $payloads);

                $user = User::withoutGlobalScope('exclude_example_data')->firstOrCreate(
                    ['username' => $roleDefinition['username']],
                    [
                        'name'              => $roleDefinition['name'],
                        'email'             => $roleDefinition['username'] . '@staging.test',
                        'email_verified_at' => now(),
                        'password'          => bcrypt('password'),
                        'default_branch_id' => $defaultBranch->id,
                        'remember_token'    => Str::random(10),
                        'status'            => FormStatus::ACTIVE,
                    ],
                );
                $user->update([
                    'default_branch_id' => $defaultBranch->id,
                    'status'            => FormStatus::ACTIVE,
                ]);
                $user->roles()->sync([$role->id]);
                $user->branches()->syncWithoutDetaching([$defaultBranch->id]);
            }
        });
    }

    /**
     * @phpstan-type StagingRoleDefinition array{
     *     name: string,
     *     username: string,
     *     description: string,
     *     modules: '*'|array<int, string>,
     *     profile: string,
     * }
     *
     * @return array<int, StagingRoleDefinition>
     */
    private function stagingRoles(): array {
        return [
            [
                'name'        => 'System Manager',
                'username'    => 'system_manager',
                'description' => 'Manage core data and global ERP configuration. Semua module lain: View Only.',
                'modules'     => '*',
                'profile'     => 'full',
            ],
            [
                'name'        => 'Sales Officer',
                'username'    => 'sales_officer',
                'description' => 'Handle day-to-day sales transactions. Module lain: View Only.',
                'modules'     => ['Sales', 'Inventory'],
                'profile'     => 'operator',
            ],
            [
                'name'        => 'Purchasing Officer',
                'username'    => 'purchasing_officer',
                'description' => 'Handle day-to-day purchasing transactions. Module lain: View Only.',
                'modules'     => ['Purchase'],
                'profile'     => 'operator',
            ],
            [
                'name'        => 'Warehouse Officer',
                'username'    => 'warehouse_officer',
                'description' => 'Manage inventory and warehouse operations. Module lain: View Only.',
                'modules'     => ['Inventory', 'Service'],
                'profile'     => 'operator',
            ],
            [
                'name'        => 'Finance Officer',
                'username'    => 'finance_officer',
                'description' => 'Manage accounting and financial transactions. Module lain: View Only.',
                'modules'     => ['Finances'],
                'profile'     => 'operator',
            ],
            [
                'name'        => 'CRM Officer',
                'username'    => 'crm_officer',
                'description' => 'Handle leads, opportunities, and quotations. Module lain: View Only.',
                'modules'     => ['CRM'],
                'profile'     => 'operator',
            ],
            [
                'name'        => 'Helpdesk Officer',
                'username'    => 'helpdesk_officer',
                'description' => 'Handle customer support tickets. Module lain: View Only.',
                'modules'     => ['Helpdesk'],
                'profile'     => 'operator',
            ],
            [
                'name'        => 'Approver',
                'username'    => 'approver',
                'description' => 'Review and approve operational documents. Module lain: View Only.',
                'modules'     => ['Core', 'Sales', 'Purchase', 'Inventory', 'Service', 'Finances', 'CRM', 'Helpdesk'],
                'profile'     => 'approval',
            ],
        ];
    }

    /**
     * @param  Collection<int, string>  $allModules
     * @return Collection<int, string>
     */
    private function normalizeModules(string|array $modules, Collection $allModules): Collection {
        if ($modules === '*') {
            return $allModules;
        }

        return collect($modules)->values();
    }

    /**
     * Bangun payload permission penuh (sesuai profile) untuk module yang
     * memang jadi scope utama role.
     *
     * @param  Collection<int, Permission>  $permissions
     * @param  Collection<int, string>  $ownModules
     * @return Collection<string, array<string, mixed>>
     */
    private function buildOwnScopePayloads(Collection $permissions, Collection $ownModules, string $profile): Collection {
        $scopedPermissions = $permissions->whereIn('module', $ownModules->all());

        $payloads = [];
        foreach ($scopedPermissions as $permission) {
            $flags = $this->resolvePermissionFlags((array) $permission->permissions, $profile);
            if (! \in_array(true, $flags, true)) {
                continue;
            }

            $payload                                         = $this->toPermissionPayload($permission, $flags);
            $payloads[$this->permissionPayloadKey($payload)] = $payload;
        }

        return collect($payloads);
    }

    /**
     * Bangun payload View Only (select+read) untuk module di luar scope role.
     *
     * @param  Collection<int, Permission>  $permissions
     * @param  Collection<int, string>  $viewOnlyModules
     * @return Collection<string, array<string, mixed>>
     */
    private function buildViewOnlyPayloads(Collection $permissions, Collection $viewOnlyModules): Collection {
        $scopedPermissions = $permissions->whereIn('module', $viewOnlyModules->all());

        $payloads = [];
        foreach ($scopedPermissions as $permission) {
            $flags = $this->resolvePermissionFlags((array) $permission->permissions, 'read_only');
            if (! \in_array(true, $flags, true)) {
                continue;
            }

            $payload                                         = $this->toPermissionPayload($permission, $flags);
            $payloads[$this->permissionPayloadKey($payload)] = $payload;
        }

        return collect($payloads);
    }

    /**
     * @param  array<int, string>  $permissionKeys
     * @return array<string, bool>
     */
    private function resolvePermissionFlags(array $permissionKeys, string $profile): array {
        $permissionFlags = array_fill_keys($permissionKeys, false);

        $enabledKeys = match ($profile) {
            'full'      => $permissionKeys,
            'operator'  => ['select', 'read', 'write', 'create', 'submit', 'print', 'import', 'export', 'share'],
            'approval'  => ['select', 'read', 'submit', 'cancel', 'amend', 'print'],
            'read_only' => ['select', 'read'],
            default     => [],
        };

        foreach ($enabledKeys as $key) {
            if (\array_key_exists($key, $permissionFlags)) {
                $permissionFlags[$key] = true;
            }
        }

        return $permissionFlags;
    }

    /**
     * @param  array<string, bool>  $permissionFlags
     * @return array{permission_id: string, name: string, module: string, model: string, is_submitable: bool, permissions: array<string, bool>}
     */
    private function toPermissionPayload(Permission $permission, array $permissionFlags): array {
        return [
            'permission_id' => (string) $permission->id,
            'name'          => (string) $permission->name,
            'module'        => (string) $permission->module,
            'model'         => (string) $permission->model,
            'is_submitable' => (bool) $permission->is_submitable,
            'permissions'   => $permissionFlags,
        ];
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function permissionPayloadKey(array $payload): string {
        return $payload['permission_id'];
    }

    /**
     * @param  Collection<string, array<string, mixed>>  $permissionPayloads
     */
    private function syncRolePermissions(Role $role, Collection $permissionPayloads): void {
        $targetKeys = $permissionPayloads->keys()->flip();

        $rulesToDelete = $role->rules()
            ->where('level', 0)
            ->where('only_creator', false)
            ->get(['id', 'permission_id'])
            ->filter(fn (RolePermission $rolePermission): bool => ! $targetKeys->has((string) $rolePermission->permission_id))
            ->pluck('id');

        if ($rulesToDelete->isNotEmpty()) {
            RolePermission::query()->whereIn('id', $rulesToDelete->all())->delete();
        }

        foreach ($permissionPayloads as $payload) {
            RolePermission::updateOrCreate([
                'role_id'       => $role->id,
                'permission_id' => $payload['permission_id'],
                'level'         => 0,
                'only_creator'  => false,
            ], [
                'name'          => $payload['name'],
                'module'        => $payload['module'],
                'model'         => $payload['model'],
                'is_submitable' => $payload['is_submitable'],
                'permissions'   => $payload['permissions'],
            ]);
        }
    }
}
