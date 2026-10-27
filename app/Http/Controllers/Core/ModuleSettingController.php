<?php

namespace App\Http\Controllers\Core;

use App\Enums\DefaultsDocumentType;
use App\Http\Controllers\Controller;
use App\Http\Requests\Core\ModuleSettingRequest;
use App\Models\Inventory\Category;
use App\Models\Inventory\Warehouse;
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

    /**
     * Setting bersifat global (D-S2): gudang default dimuat tanpa scope cabang agar pengguna
     * di cabang lain tetap melihat nilainya. Hanya satu baris yang dirujuk setting yang dimuat.
     */
    protected function defaultWarehouse(?string $warehouseId): ?Warehouse {
        return $warehouseId === null ? null : Warehouse::withoutBranch()->with('branch')->find($warehouseId);
    }

    /**
     * Pilihan untuk form aturan default: jenis barang (`items.type`, label terlokalisasi) dan
     * jenis dokumen modul yang punya pajak per baris.
     *
     * @return array{itemTypeOptions: list<array{value: string, label: string}>, taxDocumentTypes: list<string>}
     */
    protected function defaultRuleOptions(): array {
        return [
            'itemTypeOptions' => array_map(
                fn (string $type): array => ['value' => $type, 'label' => __("inventory/category.types.{$type}")],
                Category::TYPES,
            ),
            'taxDocumentTypes' => array_values(array_map(
                fn (DefaultsDocumentType $type): string => $type->value,
                array_filter(
                    DefaultsDocumentType::cases(),
                    fn (DefaultsDocumentType $type): bool => $type->module() === $this->settingKey() && $type->supportsTaxDefault(),
                ),
            )),
        ];
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
