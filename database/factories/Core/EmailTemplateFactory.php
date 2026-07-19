<?php

namespace Database\Factories\Core;

use App\Models\Core\EmailTemplate;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<EmailTemplate>
 */
class EmailTemplateFactory extends Factory {
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array {
        return [
            'name'       => fake()->unique()->words(3, true),
            'name_model' => 'TestModel',
            'model'      => null,
            'subject'    => fake()->sentence(),
            'body_html'  => '<p>' . fake()->paragraph() . '</p>',
            'body_json'  => null,
            'is_default' => false,
        ];
    }
}
