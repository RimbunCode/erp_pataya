<?php

namespace Database\Seeders;

use App\Models\User\Role;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class AdminPermissionSeeder extends Seeder {
    public function run(): void {
        $adminRole = Role::where('name', 'admin')->first();

        if (! $adminRole) {
            $this->command->error('Role "admin" not found. Run RoleSeeder first.');

            return;
        }

        $permissions = [
            [
                'module'      => 'lms',
                'name'        => 'finance_admin',
                'model'       => 'App\Models\Payment',
                'route'       => 'admin.finance.*',
                'permissions' => json_encode(['view', 'approve', 'reject']),
                'description' => 'Approve/reject enrollment payments',
            ],
            [
                'module'      => 'lms',
                'name'        => 'course_admin',
                'model'       => 'App\Models\Course',
                'route'       => 'admin.courses.*',
                'permissions' => json_encode(['view', 'create', 'edit', 'delete', 'approve', 'reject']),
                'description' => 'Manage courses and course content',
            ],
            [
                'module'      => 'lms',
                'name'        => 'user_admin',
                'model'       => 'App\Models\User',
                'route'       => 'admin.users.*',
                'permissions' => json_encode(['view', 'edit', 'suspend', 'approve_role']),
                'description' => 'Manage users, role requests, and organizations',
            ],
            [
                'module'      => 'lms',
                'name'        => 'super_admin',
                'model'       => 'App\Models\User',
                'route'       => 'admin.*',
                'permissions' => json_encode(['*']),
                'description' => 'Full access + manage admin permissions',
            ],
        ];

        foreach ($permissions as $perm) {
            // Hindari duplicate kalau seeder dijalankan ulang
            $existing = DB::table('permissions')
                ->where('module', $perm['module'])
                ->where('name', $perm['name'])
                ->whereNull('deleted_at')
                ->first();

            if ($existing) {
                $this->command->warn("Permission [{$perm['name']}] already exists, skipping.");
                continue;
            }

            $permId = Str::ulid();

            DB::table('permissions')->insert([
                'id'          => $permId,
                'module'      => $perm['module'],
                'name'        => $perm['name'],
                'model'       => $perm['model'],
                'route'       => $perm['route'],
                'permissions' => $perm['permissions'],
                'created_at'  => now(),
                'updated_at'  => now(),
            ]);

            DB::table('role_permissions')->insert([
                'id'            => Str::ulid(),
                'permission_id' => $permId,
                'module'        => $perm['module'],
                'name'          => $perm['name'],
                'model'         => $perm['model'],
                'role_id'       => $adminRole->id,
                'level'         => 0,
                'only_creator'  => false,
                'is_submitable' => false,
                'permissions'   => $perm['permissions'],
                'created_at'    => now(),
                'updated_at'    => now(),
            ]);

            $this->command->info("Permission [{$perm['name']}] created and assigned to admin.");
        }
    }
}