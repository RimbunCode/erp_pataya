<?php

namespace App\Http\Controllers\Sales;

use App\Http\Controllers\Core\ModuleSettingController;
use App\Models\Sales\SalesSetting;
use App\Services\Core\Setting\SettingsService;
use Illuminate\Http\Request;
use Inertia\Response;

class SalesSettingController extends ModuleSettingController {
    public function show(Request $request, SettingsService $settings): Response {
        return parent::show($request, $settings)
            ->with('defaultTax', $settings->get(SalesSetting::class)->defaultTax);
    }

    protected function settingKey(): string {
        return 'sales';
    }

    protected function modelClass(): string {
        return SalesSetting::class;
    }
}
