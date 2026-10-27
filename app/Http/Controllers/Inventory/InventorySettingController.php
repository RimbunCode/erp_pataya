<?php

namespace App\Http\Controllers\Inventory;

use App\Http\Controllers\Core\ModuleSettingController;
use App\Models\Inventory\InventorySetting;
use App\Services\Core\Setting\SettingsService;
use Illuminate\Http\Request;
use Inertia\Response;

class InventorySettingController extends ModuleSettingController {
    public function show(Request $request, SettingsService $settings): Response {
        $setting = $settings->get(InventorySetting::class);

        return parent::show($request, $settings)
            ->with('defaultWarehouse', $this->defaultWarehouse($setting->default_warehouse_id));
    }

    protected function settingKey(): string {
        return 'inventory';
    }

    protected function modelClass(): string {
        return InventorySetting::class;
    }
}
