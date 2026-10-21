<?php

namespace App\Http\Controllers\Purchase;

use App\Http\Controllers\Core\ModuleSettingController;
use App\Models\Purchase\PurchaseSetting;
use App\Services\Core\Setting\SettingsService;
use Illuminate\Http\Request;
use Inertia\Response;

class PurchaseSettingController extends ModuleSettingController {
    public function show(Request $request, SettingsService $settings): Response {
        $setting = $settings->get(PurchaseSetting::class);

        return parent::show($request, $settings)
            ->with('defaultTax', $setting->defaultTax)
            ->with('defaultTargetWarehouse', $setting->defaultTargetWarehouse)
            ->with('defaultPaymentTermTemplate', $setting->defaultPaymentTermTemplate);
    }

    protected function settingKey(): string {
        return 'purchase';
    }

    protected function modelClass(): string {
        return PurchaseSetting::class;
    }
}
