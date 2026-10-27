<?php

namespace App\Http\Controllers\Finances;

use App\Http\Controllers\Core\ModuleSettingController;
use App\Models\Finances\FinanceSetting;

class FinanceSettingController extends ModuleSettingController {
    protected function settingKey(): string {
        return 'finance';
    }

    protected function modelClass(): string {
        return FinanceSetting::class;
    }
}
