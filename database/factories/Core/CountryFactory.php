<?php

namespace Database\Factories\Core;

use App\Models\Core\Country;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Country>
 */
class CountryFactory extends Factory {
    public function definition(): array {
        $code = strtoupper(fake()->unique()->lexify('??'));

        return [
            'code'      => $code,
            'name'      => fake()->country(),
            'lang_code' => fake()->languageCode(),
            'url_flag'  => null,
            'timezones' => null,
        ];
    }
}
