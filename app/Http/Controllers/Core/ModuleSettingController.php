<?php

namespace App\Http\Controllers\Core;

use App\Http\Controllers\Controller;
use App\Http\Requests\Core\ModuleSettingRequest;
use App\Services\Core\Setting\SettingsService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

abstract class ModuleSettingController extends Controller {
    abstract protected function settingKey(): string;

    abstract protected function modelClass(): string;

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

    public function update(ModuleSettingRequest $request, SettingsService $settings): RedirectResponse {
        $settings->update($this->modelClass(), $request->validated());

        return back();
    }
}
