<?php

namespace Database\Seeders;

use App\Models\Core\Branch;
use App\Models\User\Permission;
use App\Models\User\Role;
use App\Models\User\RolePermission;
use App\Models\User\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class AdministratorSeeder extends Seeder {
    /**
     * Run the database seeds.
     */
    public function run(): void {
        if (Permission::query()->doesntExist()) {
            $this->call(PermissionSeeder::class);
        }

        DB::beginTransaction();
        $defaultBranch = Branch::where('is_main_branch', true)
            ->whereNull('branchable_type')
            ->whereNull('branchable_id')
            ->firstOrFail();

        $permissions = Permission::query()
            ->orderBy('module')
            ->orderBy('name')
            ->get();

        $adminUser = User::updateOrCreate(
            ['username' => 'admin'],
            [
                'name'              => 'Administrator',
                'email'             => 'test@example.com',
                'email_verified_at' => now(),
                'password'          => bcrypt('admin'),
                'default_branch_id' => $defaultBranch->id,
                'remember_token'    => Str::random(10),
            ],
        );

        foreach ($this->defaultRoles() as $roleDefinition) {
            $role = Role::updateOrCreate(
                ['name' => $roleDefinition['name']],
                [
                    'description' => $roleDefinition['description'] ?? null,
                    'is_disabled' => $roleDefinition['is_disabled'] ?? false,
                ],
            );

            $profileRole            = $roleDefinition['profile'];
            $profileOnlyCreatorRole = $roleDefinition['profile_only_creator'] ?? false;
            $registerPermission     = collect([]);
            if ($roleDefinition['modules'] == "*") {
                $filteredModels = $permissions;
                if ($profileOnlyCreatorRole) {
                    $registerPermission->push(...$filteredModels->map(function ($model) use ($profileOnlyCreatorRole) {
                        $allowOnlyCreator    = $model->allow_only_creator;
                        $permissionFlags     = $this->resolvePermissionFlags((array) $model->permissions, $profileOnlyCreatorRole);
                        $model->level        = 0;
                        $model->only_creator = $allowOnlyCreator;
                        $model->permissions  = $permissionFlags;

                        return $model;
                    }));
                }
                $isLevel = ! \is_string($profileRole) && \array_any($profileRole, function ($profile) {
                    return \is_array($profile) || \in_array($profile, ['full', 'read_only']);
                });
                if (! $isLevel) {
                    $registerPermission->push(...$filteredModels->map(function ($model) use ($profileRole) {
                        $permissionFlags     = $this->resolvePermissionFlags((array) $model->permissions, $profileRole);
                        $model->level        = 0;
                        $model->only_creator = false;
                        $model->permissions  = $permissionFlags;

                        return $model;
                    }));
                } else {
                    foreach ($filteredModels as $model) {
                        $isValidOnZeroLevel = true;
                        foreach ($profileRole as $level => $profile) {
                            if (! $isValidOnZeroLevel) break;

                            $permissionFlags = $this->resolvePermissionFlags((array) $model->permissions, $profile, $level > 0);
                            $isValid         = \array_any($permissionFlags, fn ($f) => $f == true);
                            if ($level == 0) {
                                $isValidOnZeroLevel = $isValid;
                            }
                            if (! $isValid) continue;

                            $model->level        = $level;
                            $model->only_creator = false;
                            $model->permissions  = $permissionFlags;

                            $registerPermission->push(clone $model);
                        }
                    }
                }
            } else {
                foreach ($roleDefinition['modules'] as $module => $configModule) {
                    if (\is_int($module)) {
                        // if()
                    } else {

                    }
                }
            }

            $selectedPermissions = $this->resolvePermissionsForRole($permissions, $roleDefinition['modules']);
            $this->syncRolePermissions($role, $selectedPermissions, $roleDefinition['profile']);

            if ($role->name === 'System Manager') {
                $systemManagerRoleId = $role->id;
            }
        }

        if ($systemManagerRoleId !== null) {
            $adminUser->roles()->sync([$systemManagerRoleId]);
        }

        $adminUser->branches()->syncWithoutDetaching([$defaultBranch->id]);
        DB::commit();
    }

    /**
     * @phpstan-type PermissionProfile string|array<int, string>|array<int, string|array<int, string>>
     * @phpstan-type ModelDefinition string|array{
     *     profile: PermissionProfile,
     *     profile_only_creator: null|string|array<int, string>
     * }
     * @phpstan-type ModuleDefinition string|array{
     *     profile: PermissionProfile,
     *     profile_only_creator: null|string|array<int, string>,
     *     models: '*'|array<int|string, ModelDefinition>
     * }
     * @phpstan-type RoleDefinition array{
     *     name: string,
     *     description: string,
     *     modules: '*'|array<int|string, ModuleDefinition>,
     *     profile: PermissionProfile,
     *     profile_only_creator: null|string|array<int, string>
     * }
     *
     * @return array<int, RoleDefinition>
     */
    private function defaultRoles(): array {
        return [
            [
                'name'        => 'System Manager',
                'description' => 'Manage core data and global ERP configuration.',
                'modules'     => '*',
                'profile'     => ['full', 'read_only', 'create'],
            ],
            [
                'name'        => 'User & Access Administrator',
                'description' => 'Manage users, roles, and access configuration.',
                'modules'     => ['User'],
                'profile'     => 'full',
            ],
            [
                'name'        => 'Master Data Administrator',
                'description' => 'Manage core data and global ERP configuration.',
                'modules'     => ['Core'],
            ],
            [
                'name'        => 'Sales Officer',
                'description' => 'Handle day-to-day sales transactions.',
                'modules'     => ['Sales', 'Inventory' => ['Items', 'Categories', 'Units', 'Attributes']],
            ],
            [
                'name'        => 'Purchasing Officer',
                'description' => 'Handle day-to-day purchasing transactions.',
                'modules'     => ['Purchase'],
            ],
            [
                'name'        => 'Item Master',
                'description' => 'Manage item master data.',
                'modules'     => [
                    'Inventory' => [
                        'only_creator' => 'true',
                        'models'       => ['Items', 'Categories', 'Units', 'Attributes'],
                    ],
                ],
            ],
            [
                'name'        => 'Warehouse Officer',
                'description' => 'Manage inventory and warehouse operations.',
                'modules'     => ['Inventory', 'Service'],
            ],
            [
                'name'        => 'Finance Officer',
                'description' => 'Manage accounting and financial transactions.',
                'modules'     => ['Finances'],
            ],
            [
                'name'        => 'Approver',
                'description' => 'Review and approve operational documents.',
                'modules'     => ['Core', 'Sales', 'Purchase', 'Inventory', 'Service', 'Finances'],
            ],
            [
                'name'        => 'Auditor',
                'description' => 'Read-only access across all ERP modules.',
                'modules'     => ['*'],
            ],
        ];
    }

    /**
     * @param  Collection<int, Permission>  $permissions
     * @param  array<int, string>  $modules
     * @return Collection<int, Permission>
     */
    private function resolvePermissionsForRole(Collection $permissions, array $modules): Collection {
        if (\in_array('*', $modules, true)) {
            return $permissions;
        }

        return $permissions->whereIn('module', $modules)->values();
    }

    /**
     * @param  Collection<int, Permission>  $permissions
     */
    private function syncRolePermissions(Role $role, Collection $permissions, string $profile): void {
        $permissionIds = $permissions->pluck('id')->all();
        if (! empty($permissionIds)) {
            $role->rules()
                ->whereNotIn('permission_id', $permissionIds)
                ->delete();
        }

        foreach ($permissions as $permission) {
            $permissionFlags = $this->resolvePermissionFlags((array) $permission->permissions, $profile);

            RolePermission::updateOrCreate([
                'role_id'       => $role->id,
                'permission_id' => $permission->id,
            ], [
                'name'          => $permission->name,
                'module'        => $permission->module,
                'model'         => $permission->model,
                'is_submitable' => $permission->is_submitable,
                'level'         => 0,
                'only_creator'  => false,
                'permissions'   => $permissionFlags,
            ]);
        }
    }

    /**
     * @param  array<int, string>  $permissionKeys
     * @return array<string, bool>
     */
    private function resolvePermissionFlags(array $permissionKeys, array|string $profile, bool $notZeroLevel = false): array {
        $permissionFlags = array_fill_keys($notZeroLevel ? ['read', 'write'] : $permissionKeys, false);

        $enabledKeys = (\is_array($profile)) ? $profile : match ($profile) {
            'full'      => $permissionKeys,
            'read_only' => ['select', 'read', 'print', 'export'],
            default     => [],
        };

        foreach ($enabledKeys as $key) {
            if (\array_key_exists($key, $permissionFlags)) {
                $permissionFlags[$key] = true;
            }
        }

        return $permissionFlags;
    }
}
