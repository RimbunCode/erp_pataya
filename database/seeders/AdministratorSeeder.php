<?php

namespace Database\Seeders;

use App\Models\Core\Branch;
use App\Models\User\Permission;
use App\Models\User\Role;
use App\Models\User\RolePermission;
use App\Models\User\User;
use Illuminate\Database\Seeder;

class AdministratorSeeder extends Seeder {
    /**
     * Run the database seeds.
     */
    public function run(): void {
        $this->call(PermissionSeeder::class);

        $defaultBranch = Branch::where('is_main_branch', true)
            ->whereNull('branchable_type')
            ->whereNull('branchable_id')
            ->first();

        // Create Admin User
        $adminUser = User::factory()->create([
            'name'              => 'Administrator',
            'username'          => 'admin',
            'email'             => 'test@example.com',
            'password'          => bcrypt('admin'),
            'default_branch_id' => $defaultBranch->id,
        ]);

        // Create Role For Admin
        $roleAdmin = Role::create([
            'name' => 'System Manager',
        ]);

        // Attach Admin User To Admin Role
        $adminUser->roles()->attach($roleAdmin->id);
        $adminUser->branches()->attach($defaultBranch->id);

        // Create Role Permission For Admin
        $rules = [
            [
                'id'            => '01jmmcs994vb016dp2y2wy0w6p',
                'permission_id' => '01jmmcget6fvq76zx13wsy3gc3',
                'name'          => 'Manage Users',
                'model'         => User::class,
                'role_id'       => '01jmmcgn4ks9c7wxzk07jx42r7',
                'level'         => 0,
                'only_creator'  => 0,
                'permissions'   => [
                    'select' => true,
                    'read'   => true,
                    'write'  => true,
                    'create' => true,
                    'delete' => true,
                    'print'  => true,
                    'import' => true,
                    'export' => true,
                    'share'  => true,
                ],
                'created_at' => '2025-02-21T13:57:35.000000Z',
                'updated_at' => '2025-02-21T13:59:10.000000Z',
                'deleted_at' => null,
            ],
            [
                'id'            => '01jmmcs9973gkmrdba36jre63f',
                'permission_id' => '01jmmcgetkfgf9j80phwc3aga2',
                'name'          => 'Roles',
                'model'         => Role::class,
                'role_id'       => '01jmmcgn4ks9c7wxzk07jx42r7',
                'level'         => 0,
                'only_creator'  => 0,
                'permissions'   => [
                    'select' => true,
                    'read'   => true,
                    'write'  => true,
                    'create' => true,
                    'delete' => true,
                    'print'  => true,
                ],
                'created_at' => '2025-02-21T13:57:35.000000Z',
                'updated_at' => '2025-02-21T13:59:10.000000Z',
                'deleted_at' => null,
            ],
        ];
        $permissions = array_map(fn ($permission) => $permission['model'], $rules);
        $permissions = Permission::whereIn('model', $permissions)->get()
            ->mapWithKeys(fn ($permission) => [$permission->model => $permission]);

        foreach ($rules as $rule) {
            $permission = $permissions[$rule['model']];
            RolePermission::updateOrCreate([
                'role_id'       => $roleAdmin->id,
                'permission_id' => $permission->id,
            ], values: [
                'name'          => $permission->name,
                'model'         => $permission->model,
                'is_submitable' => $permission->is_submitable,
                'level'         => $permission->is_submitable ? $rule['level'] : 0,
                'only_creator'  => $permission->is_submitable ? $rule['only_creator'] : false,
                'permissions'   => collect($permission->permissions)->mapWithKeys(function ($permission) use ($rule) {
                    return [$permission => $rule['permissions'][$permission] ?? false];
                }),
            ]);
        }
    }
}
