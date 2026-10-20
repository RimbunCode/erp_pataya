<?php

namespace App\Http\Requests\Core;

use App\Models\Core\ModuleSetting;
use App\Services\Core\Setting\SettingsRegistry;
use Illuminate\Foundation\Http\FormRequest;

class ModuleSettingRequest extends FormRequest {
    public function authorize(): bool {
        return true;
    }

    public function rules(): array {
        $config     = SettingsRegistry::get((string) $this->route('moduleKey'));
        $modelClass = $config['model'] ?? null;

        abort_unless($modelClass && is_subclass_of($modelClass, ModuleSetting::class), 404);

        $rules = $modelClass::rules();
        foreach ($modelClass::readonlyColumns() as $column) {
            $rules[$column] = ['prohibited'];
        }

        return $rules;
    }
}
