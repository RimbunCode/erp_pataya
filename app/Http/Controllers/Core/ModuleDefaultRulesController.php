<?php

namespace App\Http\Controllers\Core;

use App\Http\Requests\Core\ModuleDefaultRulesRequest;
use App\Services\Core\Setting\ModuleDefaultRulesService;
use Illuminate\Http\RedirectResponse;

class ModuleDefaultRulesController {
    public function update(ModuleDefaultRulesRequest $request, string $moduleKey, ModuleDefaultRulesService $rules): RedirectResponse {
        abort_unless(in_array($moduleKey, ['purchase', 'sales'], true), 404);
        $data = $request->validated();
        $rules->replace($moduleKey, $data, $data['rules_version']);

        return back();
    }
}
