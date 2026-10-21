<?php

namespace App\Http\Controllers\Sales;

use App\Http\Controllers\Core\ModuleSettingController;
use App\Models\Sales\SalesSetting;
use App\Services\Core\Setting\SettingsService;
use Illuminate\Http\Request;
use Inertia\Response;

class SalesSettingController extends ModuleSettingController {
    public function show(Request $request, SettingsService $settings): Response {
        $setting = $settings->get(SalesSetting::class);

        return parent::show($request, $settings)
            ->with('defaultTax', $setting->defaultTax)
            ->with('defaultSourceWarehouse', $setting->defaultSourceWarehouse)
            ->with('defaultPaymentTermTemplate', $setting->defaultPaymentTermTemplate);
    }

    protected function settingKey(): string {
        return 'sales';
    }

    protected function modelClass(): string {
        return SalesSetting::class;
    }
}
