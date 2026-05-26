<?php

namespace Database\Seeders;

use App\FormStatus;
use App\Models\User\Role;
use App\Models\User\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class UserSeeder extends Seeder {
    public function run(): void {
        $roleIdsByName = Role::query()
            ->whereIn('name', ['student', 'instructor', 'organization', 'admin'])
            ->pluck('id', 'name');

        if ($roleIdsByName->count() < 4) {
            $this->command?->error('Required roles are missing. Run RoleSeeder first.');

            return;
        }

        $student = $this->seedUser([
            'name'     => 'Ahmad Faisal',
            'username' => 'faisal',
            'email'    => 'student@inkindo.test',
        ]);

        $instructor = $this->seedUser([
            'name'     => 'Ir. Ahmad Sudirman',
            'username' => 'sudirman',
            'email'    => 'instructor@inkindo.test',
        ]);

        $superAdmin = $this->seedUser([
            'name'     => 'Administrator',
            'username' => 'admin',
            'email'    => 'admin@inkindo.test',
        ]);

        $financeAdmin = $this->seedUser([
            'name'     => 'Finance Admin',
            'username' => 'finance',
            'email'    => 'finance.admin@inkindo.test',
        ]);

        $courseAdmin = $this->seedUser([
            'name'     => 'Course Admin',
            'username' => 'course',
            'email'    => 'course.admin@inkindo.test',
        ]);

        $userAdmin = $this->seedUser([
            'name'     => 'User Admin',
            'username' => 'admin.user',
            'email'    => 'user.admin@inkindo.test',
        ]);

        $contentAdmin = $this->seedUser([
            'name'     => 'Content Admin',
            'username' => 'content',
            'email'    => 'content.admin@inkindo.test',
        ]);

        $multiRoleUser = $this->seedUser([
            'name'     => 'Budi Santoso',
            'username' => 'multi',
            'email'    => 'multi@inkindo.test',
        ]);

        $this->attachRole($student, (string) $roleIdsByName['student']);
        $this->attachRole($instructor, (string) $roleIdsByName['instructor']);

        foreach ([$superAdmin, $financeAdmin, $courseAdmin, $userAdmin, $contentAdmin] as $adminUser) {
            $this->attachRole($adminUser, (string) $roleIdsByName['admin']);
        }

        $this->attachRole($multiRoleUser, (string) $roleIdsByName['student']);
        $this->attachRole($multiRoleUser, (string) $roleIdsByName['instructor']);

        $this->assignAdminPermission($superAdmin, 'super_admin');
        $this->assignAdminPermission($financeAdmin, 'finance_admin');
        $this->assignAdminPermission($courseAdmin, 'course_admin');
        $this->assignAdminPermission($userAdmin, 'user_admin');
        $this->assignAdminPermission($contentAdmin, 'content_admin');
    }

    /**
     * @param  array{name: string, username: string, email: string}  $attributes
     */
    private function seedUser(array $attributes): User {
        return User::query()->updateOrCreate(
            ['email' => $attributes['email']],
            [
                'name'              => $attributes['name'],
                'username'          => $attributes['username'],
                'password'          => Hash::make('password'),
                'status'            => FormStatus::ACTIVE,
                'email_verified_at' => now(),
            ],
        );
    }

    private function attachRole(User $user, string $roleId): void {
        $user->roles()->syncWithoutDetaching([$roleId]);
    }

    private function assignAdminPermission(User $user, string $permissionName): void {
        if (! Schema::hasTable('admin_user_permissions') || ! Schema::hasTable('permissions')) {
            return;
        }

        $permissionId = DB::table('permissions')
            ->where('name', $permissionName)
            ->whereNull('deleted_at')
            ->value('id');

        if (! is_string($permissionId) || $permissionId === '') {
            $permissionId = (string) Str::ulid();

            DB::table('permissions')->insert([
                'id'          => $permissionId,
                'module'      => 'lms',
                'name'        => $permissionName,
                'model'       => User::class,
                'route'       => 'admin.*',
                'permissions' => json_encode(['view']),
                'created_at'  => now(),
                'updated_at'  => now(),
            ]);
        }

        $exists = DB::table('admin_user_permissions')
            ->where('user_id', $user->id)
            ->where('permission_id', $permissionId)
            ->whereNull('deleted_at')
            ->exists();

        if ($exists) {
            return;
        }

        DB::table('admin_user_permissions')->insert([
            'id'            => (string) Str::ulid(),
            'user_id'       => $user->id,
            'permission_id' => $permissionId,
            'created_at'    => now(),
            'updated_at'    => now(),
            'deleted_at'    => null,
        ]);
    }
}
