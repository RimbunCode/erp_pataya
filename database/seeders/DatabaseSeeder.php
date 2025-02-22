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
    $this->call(ErrorLensConfigurationSeeder::class);
    $this->call(PreferenceSeeder::class);
    $this->call(CurrencySeeder::class);
    $this->call(CountrySeeder::class);
    $this->call(AdministratorSeeder::class);
    // Create Random Tags
    Tag::factory(50)->create();
  }
}
