<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class RoleSeeder extends Seeder {
    public function run(): void {
        $roles = [
            [
                'id'          => Str::ulid(),
                'name'        => 'student',
                'description' => 'Access courses, track progress, and get certified.',
                'is_disabled' => false,
                'created_at'  => now(),
                'updated_at'  => now(),
            ],
            [
                'id'          => Str::ulid(),
                'name'        => 'instructor',
                'description' => 'Create courses, manage students, and view earnings.',
                'is_disabled' => false,
                'created_at'  => now(),
                'updated_at'  => now(),
            ],
            [
                'id'          => Str::ulid(),
                'name'        => 'organization',
                'description' => 'Manage affiliate trainers and corporate training.',
                'is_disabled' => false,
                'created_at'  => now(),
                'updated_at'  => now(),
            ],
            [
                'id'          => Str::ulid(),
                'name'        => 'admin',
                'description' => 'System-wide management, approvals, and CMS.',
                'is_disabled' => false,
                'created_at'  => now(),
                'updated_at'  => now(),
            ],
        ];

        DB::table('roles')->insert($roles);
    }
}