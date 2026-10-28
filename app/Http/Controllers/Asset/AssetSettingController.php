<?php

namespace App\Http\Controllers\Asset;

use App\Http\Controllers\Core\ModuleSettingController;
use App\Models\Asset\AssetSetting;

class AssetSettingController extends ModuleSettingController {
    protected function settingKey(): string {
        return 'asset';
    }

    protected function modelClass(): string {
        return AssetSetting::class;
    }
}
