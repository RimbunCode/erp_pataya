<?php

namespace Database\Factories\Asset;

use App\Models\Asset\AssetCategory;
use App\Models\Asset\AssetCategoryAccount;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * @extends Factory<AssetCategoryAccount>
 */
class AssetCategoryAccountFactory extends Factory {
    protected $model = AssetCategoryAccount::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array {
        return [
            'asset_category_id' => AssetCategory::factory(),
            'branch_id'         => self::ensureBranch(),
        ];
    }

    private static function ensureBranch(): string {
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
}
