<?php

namespace Database\Factories\Core;

use App\Enums\DeskType;
use App\Enums\Domain;
use App\Models\Core\Desk;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Desk>
 */
class DeskFactory extends Factory {
    protected $model = Desk::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array {
        return [
            'name'   => fake()->unique()->words(2, true),
            'icon'   => 'LayoutDashboard',
            'color'  => fake()->safeColorName(),
            'domain' => null,
            'type'   => DeskType::Custom,
        ];
    }

    public function system(Domain $domain): static {
        return $this->state([
            'type'   => DeskType::System,
            'domain' => $domain,
        ]);
    }

    public function personal(string $ownerId): static {
        return $this->state([
            'type'     => DeskType::Custom,
            'owner_id' => $ownerId,
        ]);
    }
}
