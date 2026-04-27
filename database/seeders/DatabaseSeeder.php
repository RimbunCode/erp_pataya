<?php

namespace Database\Seeders;

use App\Models\Core\Tag;
// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder {
    /**
     * Seed the application's database.
     */
    public function run(): void {
        $this->call(ErrorLensConfigurationSeeder::class);
        $this->call(PreferenceSeeder::class);
        $this->call(RoleSeeder::class);
        $this->call(UserSeeder::class);
        // Create Random Tags
        if (config('app.debug')) {
            Tag::factory(50)->create();
        }
    }
}
