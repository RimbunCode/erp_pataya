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
        $this->call(UnitSeeder::class);
        $this->call(PreferenceSeeder::class);
        $this->call(CurrencySeeder::class);
        $this->call(CountrySeeder::class);
        $this->call(AdministratorSeeder::class);
        $this->call(AccountSeeder::class);
        // Create Random Tags
        if (config('app.debug')) {
            Tag::factory(50)->create();
        }
    }
}
