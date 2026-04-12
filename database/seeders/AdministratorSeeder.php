<?php

namespace Database\Seeders;

use App\Models\Core\Branch;
use App\Models\User\Permission;
use App\Models\User\Role;
use App\Models\User\RolePermission;
use App\Models\User\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class AdministratorSeeder extends Seeder {
    /**
     * Run the database seeds.
     */
    public function run(): void {
        if (Permission::query()->doesntExist()) {
            $this->call(PermissionSeeder::class);
        }

        $defaultBranch = Branch::where('is_main_branch', true)
            ->whereNull('branchable_type')
            ->whereNull('branchable_id')
            ->firstOrFail();

        $permissions = Permission::query()
            ->orderBy('module')
            ->orderBy('name')
            ->get();

<<<<<<< HEAD
        $adminUser = User::updateOrCreate(
            ['username' => 'admin'],
=======
        // Create Role For Admin
        $roleAdmin = Role::create([
            'name' => 'System Manager',
        ]);

        // Attach Admin User To Admin Role
        $adminUser->roles()->attach($roleAdmin->id);
        $adminUser->branches()->attach($defaultBranch->id);

        // Create Role Permission For Admin
        $rules = [
>>>>>>> 82dfe776c7b126fbdf38c59ef1c2a5f2f4baad4e
            [
                'name'              => 'Administrator',
                'email'             => 'test@example.com',
                'email_verified_at' => now(),
                'password'          => bcrypt('admin'),
                'default_branch_id' => $defaultBranch->id,
                'remember_token'    => Str::random(10),
            ],
        );

        $systemManagerRoleId = null;
        foreach ($this->defaultRoles() as $roleDefinition) {
            $role = Role::updateOrCreate(
                ['name' => $roleDefinition['name']],
                [
                    'description' => $roleDefinition['description'] ?? null,
                    'is_disabled' => $roleDefinition['is_disabled'] ?? false,
                ],
            );

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
    }

    /**
     * @return array<int, array{name: string, description: string, modules: array<int, string>, profile: string}>
     */
    private function defaultRoles(): array {
        return [
            [
                'name'        => 'System Manager',
                'description' => 'Full access to all ERP modules and settings.',
                'modules'     => ['*'],
                'profile'     => 'full',
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
                'modules'     => ['Sales'],
                'profile'     => 'operator',
            ],
            [
                'name'        => 'Purchasing Officer',
                'description' => 'Handle day-to-day purchasing transactions.',
                'modules'     => ['Purchase'],
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
                'modules'     => ['*'],
                'profile'     => 'read_only',
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
    private function resolvePermissionFlags(array $permissionKeys, string $profile): array {
        $permissionFlags = array_fill_keys($permissionKeys, false);

        $enabledKeys = match ($profile) {
            'full'      => $permissionKeys,
            'operator'  => ['select', 'read', 'write', 'create', 'submit', 'cancel', 'amend', 'print', 'import', 'export', 'share'],
            'approval'  => ['select', 'read', 'submit', 'cancel', 'amend', 'print', 'export'],
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
