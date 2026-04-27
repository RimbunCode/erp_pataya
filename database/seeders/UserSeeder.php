<?php

namespace Database\Seeders;

use App\FormStatus;
use App\Models\User\Role;
use App\Models\User\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

// ← tambah ini

class UserSeeder extends Seeder {
    public function run(): void {
        $studentRole      = Role::where('name', 'student')->first();
        $instructorRole   = Role::where('name', 'instructor')->first();
        $organizationRole = Role::where('name', 'organization')->first();
        $adminRole        = Role::where('name', 'admin')->first();

        $student = User::create([
            'id'                => Str::ulid(),
            'name'              => 'Ahmad Faisal',
            'username'          => 'ahmad.faisal',
            'email'             => 'student@inkindo.test',
            'password'          => Hash::make('password'),
            'status'            => FormStatus::ACTIVE, // ← ganti
            'email_verified_at' => now(),
        ]);

        $instructor = User::create([
            'id'                => Str::ulid(),
            'name'              => 'Ir. Ahmad Sudirman',
            'username'          => 'ahmad.sudirman',
            'email'             => 'instructor@inkindo.test',
            'password'          => Hash::make('password'),
            'status'            => FormStatus::ACTIVE, // ← ganti
            'email_verified_at' => now(),
        ]);

        $org = User::create([
            'id'                => Str::ulid(),
            'name'              => 'PT. Konstruksi Jaya',
            'username'          => 'pt.konstruksi',
            'email'             => 'org@inkindo.test',
            'password'          => Hash::make('password'),
            'status'            => FormStatus::ACTIVE, // ← ganti
            'email_verified_at' => now(),
        ]);

        $admin = User::create([
            'id'                => Str::ulid(),
            'name'              => 'Administrator',
            'username'          => 'admin',
            'email'             => 'admin@inkindo.test',
            'password'          => Hash::make('password'),
            'status'            => FormStatus::ACTIVE, // ← ganti
            'email_verified_at' => now(),
        ]);

        $multi = User::create([
            'id'                => Str::ulid(),
            'name'              => 'Budi Santoso',
            'username'          => 'budi.santoso',
            'email'             => 'multi@inkindo.test',
            'password'          => Hash::make('password'),
            'status'            => FormStatus::ACTIVE, // ← ganti
            'email_verified_at' => now(),
        ]);

        // Attach roles
        DB::table('user_role')->insert([
            ['user_id' => $student->id, 'role_id' => $studentRole->id, 'created_at' => now(), 'updated_at' => now()],
            ['user_id' => $instructor->id, 'role_id' => $instructorRole->id, 'created_at' => now(), 'updated_at' => now()],
            ['user_id' => $org->id, 'role_id' => $organizationRole->id, 'created_at' => now(), 'updated_at' => now()],
            ['user_id' => $admin->id, 'role_id' => $adminRole->id, 'created_at' => now(), 'updated_at' => now()],
            ['user_id' => $multi->id, 'role_id' => $studentRole->id, 'created_at' => now(), 'updated_at' => now()],
            ['user_id' => $multi->id, 'role_id' => $instructorRole->id, 'created_at' => now(), 'updated_at' => now()],
        ]);
    }
}