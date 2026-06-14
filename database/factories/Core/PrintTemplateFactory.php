<?php

namespace Database\Factories\Core;

use App\Models\Core\PrintTemplate;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PrintTemplate>
 */
class PrintTemplateFactory extends Factory {
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array {
        return [
            'name'                 => fake()->unique()->words(3, true),
            'name_model'           => 'TestModel',
            'model'                => null,
            'template'             => ['components' => []],
            'used_relations'       => null,
            'is_default'           => false,
            'is_letter_head'       => false,
            'show_absolute_values' => false,
            'orientation'          => 'portrait',
        ];
    }
}
