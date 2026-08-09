<?php

namespace Database\Factories\Asset;

use App\Models\Asset\AssetLocation;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * @extends Factory<AssetLocation>
 */
class AssetLocationFactory extends Factory {
    protected $model = AssetLocation::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array {
        $locationName = fake()->randomElement([
            'Head Office',
            'Warehouse',
            'Production Floor',
            'Parking Lot',
            'Server Room',
            'Meeting Room',
        ]);

        return [
            'location_name' => $locationName . ' ' . fake()->unique()->numerify('##'),
            'branch_id'     => self::ensureBranch(),
            'is_group'      => false,
        ];
    }

    private static function ensureBranch(): string {
        // ponytail: branch lookup via DB, not HasFactory — Branch model doesn't have factory
        $exists = DB::table('branches')->first();
        if ($exists) {
            return $exists->id;
        }

        $id = (string) Str::ulid();
        DB::table('branches')->insert([
            'id'             => $id,
            'name'           => 'Main Branch',
            'is_main_branch' => true,
            'created_at'     => now(),
            'updated_at'     => now(),
        ]);

        return $id;
    }

    public function asGroup(): static {
        return $this->state(fn (array $attributes) => [
            'is_group' => true,
        ]);
    }

    public function withParent(AssetLocation $parent): static {
        return $this->state(fn (array $attributes) => [
            'parent_id' => $parent->id,
            'branch_id' => $parent->branch_id,
        ]);
    }
}
