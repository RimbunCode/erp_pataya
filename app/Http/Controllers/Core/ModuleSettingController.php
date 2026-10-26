<?php

namespace App\Http\Controllers\Core;

use App\Http\Controllers\Controller;
use App\Http\Requests\Core\ModuleSettingRequest;
use App\Services\Core\Setting\CurrentRolePermissionChecker;
use App\Services\Core\Setting\ModuleDefaultRulesService;
use App\Services\Core\Setting\SettingsService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Inertia\Inertia;
use Inertia\Response;

abstract class ModuleSettingController extends Controller {
    abstract protected function settingKey(): string;

    abstract protected function modelClass(): string;

    protected function authorizeCurrentSettingsPermission(Request $request, string $action): void {
        if (! in_array($this->settingKey(), ['purchase', 'sales'], true)) {
            return;
        }

        abort_unless(
            app(CurrentRolePermissionChecker::class)->allows($request->user(), $this->modelClass(), [$action]),
            403,
        );
    }

    protected function enforcePermission($method) {
        return match ($method) {
            'show'   => 'read',
            'update' => 'write',
            default  => null,
        };
    }

    public function __construct(Request $request) {
        parent::__construct($request, $this->modelClass());
    }

    public function show(Request $request, SettingsService $settings): Response {
        $config = config('settings.pages.' . $this->settingKey());
        abort_unless($config, 404);
        $this->setBreadcrumbs();

        return Inertia::render($config['page'], [
            'setting'  => $settings->get($this->modelClass())->only(array_keys($this->modelClass()::rules())),
            'canWrite' => $this->modelClass()::hasPermission('write'),
        ]);
    }

    public function update(ModuleSettingRequest $request, SettingsService $settings, ModuleDefaultRulesService $defaultRules): RedirectResponse {
        $data = $request->validated();
        if (in_array($this->settingKey(), ['purchase', 'sales'], true) && array_key_exists('tax_rules', $data)) {
            $defaultRules->updateSettings(
                $this->settingKey(),
                Arr::except($data, ['tax_rules', 'warehouse_rules', 'rules_version']),
                Arr::only($data, ['tax_rules', 'warehouse_rules']),
                $data['rules_version'],
            );
        } else {
            $settings->update($this->modelClass(), $data);
        }

        return back();
    }
}
