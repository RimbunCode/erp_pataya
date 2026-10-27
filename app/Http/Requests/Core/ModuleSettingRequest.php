<?php

namespace App\Http\Requests\Core;

use App\Models\Core\ModuleSetting;
use App\Models\Purchase\PurchaseSetting;
use App\Models\Sales\SalesSetting;
use App\Services\Core\Setting\CurrentRolePermissionChecker;
use App\Services\Core\Setting\SettingsRegistry;
use Illuminate\Foundation\Http\FormRequest;

class ModuleSettingRequest extends FormRequest {
    public function authorize(): bool {
        if (! in_array($this->route('moduleKey'), ['purchase', 'sales'], true)) {
            return true;
        }

        $settingsClass = match ($this->route('moduleKey')) {
            'purchase' => PurchaseSetting::class,
            'sales'    => SalesSetting::class,
            default    => null,
        };

        if ($settingsClass === null) {
            return false;
        }

        return app(CurrentRolePermissionChecker::class)->allows($this->user(), $settingsClass, ['write']);
    }

    public function rules(): array {
        $config     = SettingsRegistry::get((string) $this->route('moduleKey'));
        $modelClass = $config['model'] ?? null;

        abort_unless($modelClass && is_subclass_of($modelClass, ModuleSetting::class), 404);

        $rules = $modelClass::rules();
        foreach ($modelClass::readonlyColumns() as $column) {
            $rules[$column] = ['prohibited'];
        }

        if (in_array($this->route('moduleKey'), ['purchase', 'sales'], true)
            && ($this->exists('tax_rules') || $this->exists('warehouse_rules'))) {
            $rules = array_merge($rules, ModuleDefaultRulesRequest::createFrom($this)->rules());
        }

        return $rules;
    }
}
