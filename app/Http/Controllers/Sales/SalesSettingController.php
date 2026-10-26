<?php

namespace App\Http\Controllers\Sales;

use App\Http\Controllers\Core\ModuleSettingController;
use App\Models\Finances\Tax;
use App\Models\Inventory\Category;
use App\Models\Inventory\Warehouse;
use App\Models\Sales\SalesSetting;
use App\Services\Core\Setting\ModuleDefaultRulesService;
use App\Services\Core\Setting\SettingsService;
use Illuminate\Http\Request;
use Inertia\Response;

class SalesSettingController extends ModuleSettingController {
    public function show(Request $request, SettingsService $settings): Response {
        $this->authorizeCurrentSettingsPermission($request, 'read');

        $setting                                                         = $settings->get(SalesSetting::class);
        [$defaultTaxRules, $defaultWarehouseRules, $defaultRulesVersion] = app(ModuleDefaultRulesService::class)->snapshotForModule('sales');

        return parent::show($request, $settings)
            ->with('defaultTax', $setting->defaultTax)
            ->with('defaultSourceWarehouse', $setting->defaultSourceWarehouse)
            ->with('defaultPaymentTermTemplate', $setting->defaultPaymentTermTemplate)
            ->with('defaultTaxRules', $defaultTaxRules)
            ->with('defaultWarehouseRules', $defaultWarehouseRules)
            ->with('defaultRulesVersion', $defaultRulesVersion)
            ->with('activeTaxes', Tax::query()->get(['id', 'name', 'rate']))
            ->with('activeWarehouses', Warehouse::withoutBranch()->with('branch')->get(['id', 'branch_id', 'name', 'code']))
            ->with('categories', Category::query()->get(['id', 'name', 'type']));
    }

    protected function settingKey(): string {
        return 'sales';
    }

    protected function modelClass(): string {
        return SalesSetting::class;
    }
}
