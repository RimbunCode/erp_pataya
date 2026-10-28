<?php

namespace Database\Factories\Asset;

use App\Models\Asset\AssetSetting;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<AssetSetting>
 */
class AssetSettingFactory extends Factory {
    protected $model = AssetSetting::class;

    public function definition(): array {
        return [
            'singleton'                             => true,
            'default_depreciation_method'           => null,
            'default_frequency_of_depreciation'     => null,
            'default_total_number_of_depreciations' => null,
        ];
    }
}
