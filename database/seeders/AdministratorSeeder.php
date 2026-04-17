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

            $roleIds = [];
            foreach ($this->defaultRoles() as $roleDefinition) {
                $normalizedRoleDefinition = $this->normalizeRoleDefinition($roleDefinition);

                $role      = Role::updateOrCreate(
                    ['name' => $normalizedRoleDefinition['name']],
                    [
                        'description' => $normalizedRoleDefinition['description'],
                        'is_disabled' => $normalizedRoleDefinition['is_disabled'] ?? false,
                    ],
                );
                $roleIds[] = $role->id;

                $permissionPayloads = $this->buildRolePermissionPayloads($permissions, $normalizedRoleDefinition);
                $this->syncRolePermissions($role, $permissionPayloads);
            }

            $adminUser->roles()->sync($roleIds);
            $adminUser->branches()->syncWithoutDetaching([$defaultBranch->id]);
        });
    }

    /**
     * @phpstan-type PermissionProfile string|array<int, string>|array<int, string|array<int, string>>
     * @phpstan-type ProfileOnlyCreator null|string|array<int, string>
     * @phpstan-type ModelDefinition string|array{
     *     profile?: PermissionProfile,
     *     profile_only_creator?: ProfileOnlyCreator,
     * }
     * @phpstan-type ModuleDefinition string|array<int|string, ModelDefinition>|array{
     *     profile?: PermissionProfile,
     *     profile_only_creator?: ProfileOnlyCreator,
     *     models?: '*'|array<int|string, ModelDefinition>
     * }
     * @phpstan-type RoleDefinition array{
     *     name: string,
     *     description: string,
     *     modules: '*'|array<int|string, ModuleDefinition>,
     *     profile?: PermissionProfile,
     *     profile_only_creator?: ProfileOnlyCreator,
     *     is_disabled?: bool
     * }
     * @phpstan-type PermissionScope array{
     *     module: '*'|string,
     *     model: null|string,
     *     profile: PermissionProfile,
     *     profile_only_creator: ProfileOnlyCreator,
     * }
     * @phpstan-type PermissionPayload array{
     *     permission_id: string,
     *     name: string,
     *     module: string,
     *     model: string,
     *     is_submitable: bool,
     *     level: int,
     *     only_creator: bool,
     *     permissions: array<string, bool>
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
                'profile'     => 'full',
            ],
            [
                'name'        => 'Sales Officer',
                'description' => 'Handle day-to-day sales transactions.',
                'modules'     => [
                    'Sales',
                    'Inventory' => [
                        'models' => ['Items', 'Categories', 'Units', 'Attributes'],
                    ],
                ],
                'profile'     => 'operator',
            ],
            [
                'name'        => 'Purchasing Officer',
                'description' => 'Handle day-to-day purchasing transactions.',
                'modules'     => ['Purchase'],
                'profile'     => 'operator',
            ],
            [
                'name'        => 'Item Master',
                'description' => 'Manage item master data.',
                'modules'     => [
                    'Inventory' => [
                        'only_creator' => true,
                        'models'       => ['Items', 'Categories', 'Units', 'Attributes'],
                    ],
                ],
                'profile'     => 'operator',
            ],
            [
                'name'        => 'Warehouse Officer',
                'description' => 'Manage inventory and warehouse operations.',
                'modules'     => ['Inventory', 'Service'],
                'profile'     => 'operator',
            ],
            [
                'name'        => 'Finance Officer',
                'description' => 'Manage accounting and financial transactions.',
                'modules'     => ['Finances'],
                'profile'     => 'operator',
            ],
            [
                'name'        => 'Approver',
                'description' => 'Review and approve operational documents.',
                'modules'     => ['Core', 'Sales', 'Purchase', 'Inventory', 'Service', 'Finances'],
                'profile'     => 'approval',
            ],
            [
                'name'        => 'Auditor',
                'description' => 'Read-only access across all ERP modules.',
                'modules'     => '*',
                'profile'     => 'read_only',
            ],
        ];
    }

    /**
     * @param  RoleDefinition  $roleDefinition
     * @return RoleDefinition
     */
    private function normalizeRoleDefinition(mixed $roleDefinition) {
        $modules = $roleDefinition['modules'] ?? '*';
        if (\is_array($modules) && $modules === ['*']) {
            $modules = '*';
        }
        $roleDefinition['modules']              = $modules;
        $roleDefinition['profile']              = $roleDefinition['profile'] ?? 'read_only';
        $roleDefinition['profile_only_creator'] = $roleDefinition['profile_only_creator'] ?? null;

        return $roleDefinition;
    }

    /**
     * @param  Collection<int, Permission>  $permissions
     * @param  RoleDefinition  $roleDefinition
     * @return Collection<string, PermissionPayload>
     */
    private function buildRolePermissionPayloads(Collection $permissions, $roleDefinition) {
        $payloadsByKey = [];

        foreach ($this->resolvePermissionScopes($roleDefinition) as $scope) {
            $scopedPermissions = $this->filterPermissionsByScope($permissions, $scope['module'], $scope['model']);

            foreach ($scopedPermissions as $permission) {
                foreach (
                    $this->buildPermissionPayloads(
                        $permission,
                        $scope['profile'],
                        $scope['profile_only_creator'],
                    ) as $payload
                ) {
                    $payloadKey                 = $this->permissionPayloadKey((array) $payload);
                    $payloadsByKey[$payloadKey] = $payload;
                }
            }
        }

        return collect($payloadsByKey);
    }

    /**
     * @param  RoleDefinition  $roleDefinition
     * @return array<int, PermissionScope>
     */
    private function resolvePermissionScopes(array $roleDefinition): array {
        $roleProfile            = $roleDefinition['profile'];
        $roleProfileOnlyCreator = $roleDefinition['profile_only_creator'] ?? null;
        $modules                = $roleDefinition['modules'];

        if ($modules === '*') {
            return [
                $this->makeScope('*', null, $roleProfile, $roleProfileOnlyCreator),
            ];
        }

        $scopes = [];
        foreach ($modules as $moduleKey => $moduleDefinition) {
            if (\is_int($moduleKey)) {
                $moduleName = (string) $moduleDefinition;
                $scopes[]   = $this->makeScope($moduleName, null, $roleProfile, $roleProfileOnlyCreator);

                continue;
            }

            foreach (
                $this->resolveModuleScopes(
                    (string) $moduleKey,
                    $moduleDefinition,
                    $roleProfile,
                    $roleProfileOnlyCreator,
                ) as $scope
            ) {
                $scopes[] = $scope;
            }
        }

        return $scopes;
    }

    /**
     * @param  PermissionProfile  $roleProfile
     * @param  ProfileOnlyCreator  $roleProfileOnlyCreator
     * @return array<int, PermissionScope>
     */
    private function resolveModuleScopes(
        string $moduleName,
        mixed $moduleDefinition,
        array|string $roleProfile,
        array|string|null $roleProfileOnlyCreator,
    ): array {
        if (\is_string($moduleDefinition)) {
            return [
                $this->makeScope($moduleName, null, $moduleDefinition, $roleProfileOnlyCreator),
            ];
        }

        if (! \is_array($moduleDefinition)) {
            return [
                $this->makeScope($moduleName, null, $roleProfile, $roleProfileOnlyCreator),
            ];
        }

        if (! $this->hasAnyConfigKey($moduleDefinition, ['profile', 'profile_only_creator', 'only_creator', 'models'])) {
            return $this->resolveModelScopes($moduleName, $moduleDefinition, $roleProfile, $roleProfileOnlyCreator);
        }

        $moduleProfile            = $moduleDefinition['profile'] ?? $roleProfile;
        $moduleProfileOnlyCreator = $moduleDefinition['profile_only_creator'] ?? $roleProfileOnlyCreator;
        $moduleModels             = $moduleDefinition['models'] ?? '*';

        if ($moduleModels === '*') {
            return [
                $this->makeScope($moduleName, null, $moduleProfile, $moduleProfileOnlyCreator),
            ];
        }

        if (\is_string($moduleModels)) {
            return [
                $this->makeScope($moduleName, $moduleModels, $moduleProfile, $moduleProfileOnlyCreator),
            ];
        }

        if (! \is_array($moduleModels)) {
            return [
                $this->makeScope($moduleName, null, $moduleProfile, $moduleProfileOnlyCreator),
            ];
        }

        return $this->resolveModelScopes($moduleName, $moduleModels, $moduleProfile, $moduleProfileOnlyCreator);
    }

    /**
     * @param  array<int|string, ModelDefinition>  $modelDefinitions
     * @param  PermissionProfile  $baseProfile
     * @param  ProfileOnlyCreator  $baseProfileOnlyCreator
     * @return array<int, PermissionScope>
     */
    private function resolveModelScopes(
        string $moduleName,
        array $modelDefinitions,
        array|string $baseProfile,
        array|string|null $baseProfileOnlyCreator,
    ): array {
        $scopes = [];

        foreach ($modelDefinitions as $modelKey => $modelDefinition) {
            if (\is_int($modelKey)) {
                if (! \is_string($modelDefinition)) {
                    continue;
                }

                $scopes[] = $this->makeScope($moduleName, $modelDefinition, $baseProfile, $baseProfileOnlyCreator);

                continue;
            }

            $modelProfile            = $baseProfile;
            $modelProfileOnlyCreator = $baseProfileOnlyCreator;
            $modelName               = (string) $modelKey;

            if (\is_string($modelDefinition)) {
                $modelProfile = $modelDefinition;
            } elseif (\is_array($modelDefinition)) {
                if ($this->hasAnyConfigKey($modelDefinition, ['profile', 'profile_only_creator', 'only_creator'])) {
                    $modelProfile            = $modelDefinition['profile'] ?? $baseProfile;
                    $modelProfileOnlyCreator = $modelDefinition['profile_only_creator'] ?? $baseProfileOnlyCreator;
                } else {
                    $modelProfile = $modelDefinition;
                }
            }

            $scopes[] = $this->makeScope($moduleName, $modelName, $modelProfile, $modelProfileOnlyCreator);
        }

        return $scopes;
    }

    /**
     * @param  PermissionProfile  $profile
     * @param  ProfileOnlyCreator  $profileOnlyCreator
     * @return PermissionScope
     */
    private function makeScope(
        string $module,
        ?string $model,
        array|string $profile,
        array|string|null $profileOnlyCreator,
    ): array {
        return [
            'module'               => $module,
            'model'                => $model,
            'profile'              => $profile,
            'profile_only_creator' => $profileOnlyCreator,
        ];
    }

    /**
     * @param  Collection<int, Permission>  $permissions
     * @return Collection<int, Permission>
     */
    private function filterPermissionsByScope(Collection $permissions, string $module, ?string $modelName): Collection {
        $filteredPermissions = ($module === '*')
            ? $permissions
            : $permissions->where('module', $module);

        if ($modelName !== null) {
            $filteredPermissions = $filteredPermissions->where('name', $modelName);
        }

        return $filteredPermissions->values();
    }

    /**
     * @param  ProfileOnlyCreator  $profileOnlyCreator
     * @return array<int, PermissionPayload>
     */
    private function buildPermissionPayloads(
        Permission $permission,
        array|string $profile,
        array|string|null $profileOnlyCreator,
    ): array {
        $permissionKeys = (array) $permission->permissions;
        $payloads       = [];

        if ($profileOnlyCreator !== null && $permission->allow_only_creator) {
            $permissionFlags = $this->resolvePermissionFlags($permissionKeys, false);
            if ($this->hasAnyAllowedPermission($permissionFlags)) {
                $payloads[] = $this->toPermissionPayload(
                    $permission,
                    0,
                    true,
                    $permissionFlags,
                );
            }
        }

        if ($this->isLeveledProfile($profile)) {
            $isValidOnZeroLevel = true;

            foreach ($profile as $level => $profileAtLevel) {
                if (! $isValidOnZeroLevel) {
                    break;
                }

                if (! \is_int($level) || (! \is_string($profileAtLevel) && ! \is_array($profileAtLevel))) {
                    continue;
                }

                $permissionFlags = $this->resolvePermissionFlags($permissionKeys, $profileAtLevel, $level > 0);
                $isValid         = $this->hasAnyAllowedPermission($permissionFlags);

                if ($level === 0) {
                    $isValidOnZeroLevel = $isValid;
                } else if (! $permission->is_submitable) {
                    break;
                }

                if (! $isValid) {
                    continue;
                }

                $payloads[] = $this->toPermissionPayload($permission, $level, false, $permissionFlags);
            }

            return $payloads;
        }

        $permissionFlags = $this->resolvePermissionFlags($permissionKeys, $profile);
        if ($this->hasAnyAllowedPermission($permissionFlags)) {
            $payloads[] = $this->toPermissionPayload($permission, 0, false, $permissionFlags);
        }

        return $payloads;
    }

    /**
     * @param  PermissionProfile  $profile
     */
    private function isLeveledProfile(array|string $profile): bool {
        if (\is_string($profile)) {
            return false;
        }

        foreach ($profile as $profileItem) {
            if (\is_array($profileItem)) {
                return true;
            }

            if (\is_string($profileItem) && \in_array($profileItem, ['full', 'read_only', 'operator', 'approval'], true)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  array<mixed>  $definition
     * @param  array<int, string>  $keys
     */
    private function hasAnyConfigKey(array $definition, array $keys): bool {
        foreach ($keys as $key) {
            if (\array_key_exists($key, $definition)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  array<string, bool>  $permissionFlags
     */
    private function hasAnyAllowedPermission(array $permissionFlags): bool {
        return \in_array(true, $permissionFlags, true);
    }

    /**
     * @param  array<string, bool>  $permissionFlags
     * @return PermissionPayload
     */
    private function toPermissionPayload(
        Permission $permission,
        int $level,
        bool $onlyCreator,
        array $permissionFlags,
    ): array {
        return [
            'permission_id' => (string) $permission->id,
            'name'          => (string) $permission->name,
            'module'        => (string) $permission->module,
            'model'         => (string) $permission->model,
            'is_submitable' => (bool) $permission->is_submitable,
            'level'         => $level,
            'only_creator'  => $onlyCreator,
            'permissions'   => $permissionFlags,
        ];
    }

    private function permissionPayloadKey(array $payload): string {
        return $payload['permission_id'] . '|' . $payload['level'] . '|' . ($payload['only_creator'] ? '1' : '0');
    }

    /**
     * @param  Collection<int, PermissionPayload>  $permissionPayloads
     */
    private function syncRolePermissions(Role $role, Collection $permissionPayloads): void {
        $targetKeys = $permissionPayloads->keys()->flip();

        $rulesToDelete = $role->rules()
            ->get(['id', 'permission_id', 'level', 'only_creator'])
            ->filter(function (RolePermission $rolePermission) use ($targetKeys): bool {
                $payloadKey = $this->permissionPayloadKey($rolePermission->toArray());

                return ! $targetKeys->has($payloadKey);
            })
            ->pluck('id');

        if ($rulesToDelete->isNotEmpty()) {
            RolePermission::query()->whereIn('id', $rulesToDelete->all())->delete();
        }

        foreach ($permissionPayloads as $payload) {
            RolePermission::updateOrCreate([
                'role_id'       => $role->id,
                'permission_id' => $payload['permission_id'],
                'level'         => $payload['level'],
                'only_creator'  => $payload['only_creator'],
            ], [
                'name'          => $payload['name'],
                'module'        => $payload['module'],
                'model'         => $payload['model'],
                'is_submitable' => $payload['is_submitable'],
                'permissions'   => $payload['permissions'],
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
            'operator'  => ['select', 'read', 'write', 'create', 'submit', 'print', 'import', 'export', 'share'],
            'approval'  => ['select', 'read', 'submit', 'cancel', 'amend', 'print'],
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
