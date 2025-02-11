<?php

namespace Database\Seeders;

use App\Models\Core\Preference;
use App\Models\Core\Tag;
use App\Models\User\Role;
use App\Models\User\User;
// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder {
  /**
   * Seed the application's database.
   */
  public function run(): void {
    // Create Random Tags
    Tag::factory(50)->create();
    // User::factory(10)->create();
    Preference::create([
      'key' => 'num_per_page',
      'value' => 25,
    ]);
    Preference::create([
      'key' => 'per_page_options',
      'value' => json_encode([10, 25, 50, 100]),
    ]);
    // Create Admin User
    $adminUser = User::factory()->create([
      'name' => 'Administrator',
      'username' => 'admin',
      'email' => 'test@example.com',
      'password' => bcrypt('admin'),
    ]);

    // Create Role For Admin
    $roleAdmin = Role::create([
      'name' => 'Admin',
      'slug' => 'admin'
    ]);

    // Attach Admin User To Admin Role
    $adminUser->roles()->attach($roleAdmin->id);

    // Create Role Permission For Admin
  }
}
