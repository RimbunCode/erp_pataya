<?php

namespace App\Http\Controllers\Helpdesk;

use App\Http\Controllers\Core\ModuleSettingController;
use App\Models\Helpdesk\HelpdeskSetting;

class HelpdeskSettingController extends ModuleSettingController {
    protected function settingKey(): string {
        return 'helpdesk';
    }

    protected function modelClass(): string {
        return HelpdeskSetting::class;
    }
}
