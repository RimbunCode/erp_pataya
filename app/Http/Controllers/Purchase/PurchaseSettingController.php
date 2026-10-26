<?php

namespace App\Http\Controllers\Purchase;

use App\Http\Controllers\Core\ModuleSettingController;
use App\Models\Finances\Tax;
use App\Models\Inventory\Category;
use App\Models\Inventory\Warehouse;
use App\Models\Purchase\PurchaseSetting;
use App\Services\Core\Setting\ModuleDefaultRulesService;
use App\Services\Core\Setting\SettingsService;
use Illuminate\Http\Request;
use Inertia\Response;

class PurchaseSettingController extends ModuleSettingController {
    public function show(Request $request, SettingsService $settings): Response {
        $this->authorizeCurrentSettingsPermission($request, 'read');

        $setting                                                         = $settings->get(PurchaseSetting::class);
        [$defaultTaxRules, $defaultWarehouseRules, $defaultRulesVersion] = app(ModuleDefaultRulesService::class)->snapshotForModule('purchase');

        return parent::show($request, $settings)
            ->with('defaultTax', $setting->defaultTax)
            ->with('defaultTargetWarehouse', $setting->defaultTargetWarehouse)
            ->with('defaultPaymentTermTemplate', $setting->defaultPaymentTermTemplate)
            ->with('defaultTaxRules', $defaultTaxRules)
            ->with('defaultWarehouseRules', $defaultWarehouseRules)
            ->with('defaultRulesVersion', $defaultRulesVersion)
            ->with('activeTaxes', Tax::query()->get(['id', 'name', 'rate']))
            ->with('activeWarehouses', Warehouse::withoutBranch()->with('branch')->get(['id', 'branch_id', 'name', 'code']))
            ->with('categories', Category::query()->get(['id', 'name', 'type']));
    }

    protected function settingKey(): string {
        return 'purchase';
    }

    protected function modelClass(): string {
        return PurchaseSetting::class;
    }
}
