<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder {
    /**
     * Seed the application's database.
     */
    public function run(): void {
        $this->call(ErrorLensConfigurationSeeder::class);
        $this->call(PermissionSeeder::class);
        $this->call(UnitSeeder::class);
        $this->call(PreferenceSeeder::class);
        $this->call(AdministratorSeeder::class);
        $this->call(CurrencySeeder::class);
        $this->call(AccountSeeder::class);
        $this->call(CountrySeeder::class);

        if (config('app.debug')) {
            $this->call(DataTableNonSubmitableSeeder::class);
            $this->call(ExampleDataSeeder::class);
        }
    }
}
