<?php

namespace App\Services\Core\Setting;

use App\Models\Core\DefaultRules\DefaultTaxRule;
use App\Models\Core\DefaultRules\DefaultWarehouseRule;
use App\Models\Core\ModuleSetting;
use App\Models\Purchase\PurchaseSetting;
use App\Models\Sales\SalesSetting;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Throwable;

class ModuleDefaultRulesService {
    public function __construct(private SettingsService $settings) {}

    public function version(string $module, bool $lock = false): string {
        $taxQuery       = DB::table('default_tax_rules')->where('module', $module)->orderBy('id');
        $warehouseQuery = DB::table('default_warehouse_rules')->where('module', $module)->orderBy('id');
        if ($lock) {
            $taxQuery->lockForUpdate();
            $warehouseQuery->lockForUpdate();
        }
        $taxRules       = $taxQuery->get()->toArray();
        $warehouseRules = $warehouseQuery->get()->toArray();

        return hash('sha256', json_encode([$taxRules, $warehouseRules], JSON_THROW_ON_ERROR));
    }

    /** @return array{0: Collection, 1: Collection, 2: string} */
    public function snapshotForModule(string $module): array {
        return DB::transaction(function () use ($module): array {
            $this->settings->lockedCurrent(match ($module) {
                'purchase' => PurchaseSetting::class,
                'sales'    => SalesSetting::class,
            });
            [$taxRules, $warehouseRules] = $this->forModule($module, true);

            return [$taxRules, $warehouseRules, $this->version($module, true)];
        });
    }

    /**
     * @param  array<string, mixed>  $attributes
     * @param  array{tax_rules: list<array<string, mixed>>, warehouse_rules: list<array<string, mixed>>}  $data
     */
    public function updateSettings(string $module, array $attributes, array $data, ?string $expectedVersion = null): ModuleSetting {
        $modelClass = match ($module) {
            'purchase' => PurchaseSetting::class,
            'sales'    => SalesSetting::class,
        };

        try {
            return DB::transaction(function () use ($module, $modelClass, $attributes, $data, $expectedVersion): ModuleSetting {
                $this->settings->lockedCurrent($modelClass);
                $this->assertCurrentVersion($module, $expectedVersion);
                $setting = $this->settings->update($modelClass, $attributes);
                $this->replace($module, $data);

                return $setting;
            });
        } catch (Throwable $exception) {
            $this->settings->forget($modelClass);

            throw $exception;
        }
    }

    /** @param array{tax_rules: list<array<string, mixed>>, warehouse_rules: list<array<string, mixed>>} $data */
    public function replace(string $module, array $data, ?string $expectedVersion = null): void {
        DB::transaction(function () use ($module, $data, $expectedVersion): void {
            $this->settings->lockedCurrent(match ($module) {
                'purchase' => PurchaseSetting::class,
                'sales'    => SalesSetting::class,
            });
            $this->assertCurrentVersion($module, $expectedVersion);
            $this->replaceRules(DefaultTaxRule::class, 'tax_rules', $module, $data['tax_rules']);
            $this->replaceRules(DefaultWarehouseRule::class, 'warehouse_rules', $module, $data['warehouse_rules']);
        });
    }

    private function assertCurrentVersion(string $module, ?string $expectedVersion): void {
        if ($expectedVersion !== null && ! hash_equals($this->version($module, true), $expectedVersion)) {
            throw new HttpException(409, __('core.errors.http.409'));
        }
    }

    /** @return array{0: Collection, 1: Collection} */
    public function forModule(string $module, bool $lock = false): array {
        $taxQuery = DefaultTaxRule::query()
            ->where('module', $module)
            ->with(['tax' => fn ($query) => $query->withTrashed(), 'itemCategory' => fn ($query) => $query->withTrashed()])
            ->orderBy('priority')
            ->orderBy('id');
        $warehouseQuery = DefaultWarehouseRule::query()
            ->where('module', $module)
            ->with([
                'warehouse'    => fn ($query) => $query->withoutBranch()->withTrashed()->with('branch'),
                'itemCategory' => fn ($query) => $query->withTrashed(),
            ])
            ->orderBy('priority')
            ->orderBy('id');
        if ($lock) {
            $taxQuery->lockForUpdate();
            $warehouseQuery->lockForUpdate();
        }
        $taxRules       = $taxQuery->get();
        $warehouseRules = $warehouseQuery->get();

        return [$taxRules, $warehouseRules];
    }

    /** @param class-string<DefaultTaxRule|DefaultWarehouseRule> $modelClass
     * @param  list<array<string, mixed>>  $incoming
     */
    private function replaceRules(string $modelClass, string $field, string $module, array $incoming): void {
        $hasTax         = $modelClass === DefaultTaxRule::class;
        $valueKey       = $hasTax ? 'tax_id' : 'warehouse_id';
        $categoryIds    = $this->canonicalIds('categories', array_column($incoming, 'item_category_id'));
        $referenceIds   = $this->canonicalIds($hasTax ? 'taxes' : 'warehouses', array_column($incoming, $valueKey));
        $existing       = $modelClass::query()->where('module', $module)->lockForUpdate()->get()->keyBy('id');
        $seenConditions = [];
        $retainedIds    = [];

        foreach ($incoming as $index => $attributes) {
            $attributes = Arr::only($attributes, [
                'id', 'document_type', 'item_type', 'is_stock_item', 'item_category_id', $valueKey, 'priority',
            ]);
            if (isset($attributes['item_category_id'])) {
                $categoryKey                    = strtolower((string) $attributes['item_category_id']);
                $attributes['item_category_id'] = $categoryIds[$categoryKey] ?? $attributes['item_category_id'];
            }
            if (isset($attributes[$valueKey])) {
                $referenceKey          = strtolower((string) $attributes[$valueKey]);
                $attributes[$valueKey] = $referenceIds[$referenceKey] ?? $attributes[$valueKey];
            }
            $attributes['module'] = $module;
            $attributes['priority'] ??= 0;
            $attributes['document_type'] ??= null;
            $attributes['item_type'] ??= null;
            $attributes['is_stock_item'] ??= null;
            $attributes['item_category_id'] ??= null;
            if ($attributes['is_stock_item'] !== null) {
                $attributes['is_stock_item'] = (bool) $attributes['is_stock_item'];
            }

            if ($attributes['document_type'] === null && $attributes['item_type'] === null
                && $attributes['is_stock_item'] === null && $attributes['item_category_id'] === null) {
                throw ValidationException::withMessages([
                    "{$field}.{$index}.item_type" => __("{$module}.setting.rules.server.condition_required"),
                ]);
            }
            if (! $hasTax && ($attributes['is_stock_item'] ?? null) === false) {
                throw ValidationException::withMessages([
                    "{$field}.{$index}.is_stock_item" => __("{$module}.setting.rules.server.warehouse_non_stock"),
                ]);
            }

            $condition = json_encode([
                $attributes['document_type'],
                $attributes['item_type'],
                $attributes['is_stock_item'],
                $attributes['item_category_id'],
            ], JSON_THROW_ON_ERROR);
            if (isset($seenConditions[$condition])) {
                throw ValidationException::withMessages([
                    "{$field}.{$index}.item_category_id" => __("{$module}.setting.rules.server.duplicate"),
                ]);
            }
            $seenConditions[$condition] = true;

            $id = $attributes['id'] ?? null;
            unset($attributes['id']);
            if ($id !== null) {
                $record = $existing->get($id);
                if ($record === null) {
                    throw ValidationException::withMessages([
                        "{$field}.{$index}.id" => __("{$module}.setting.rules.server.invalid_id"),
                    ]);
                }
                $retainedIds[] = $id;
                $record->recordLogs();
                $record->fill($attributes);
                $record->save();
            } else {
                $modelClass::query()->create($attributes);
            }
        }

        $existing->except($retainedIds)->each(function (DefaultTaxRule|DefaultWarehouseRule $record): void {
            $record->recordLogs();
            $record->delete();
        });
    }

    /** @param list<mixed> $ids
     * @return array<string, string>
     */
    private function canonicalIds(string $table, array $ids): array {
        $normalizedIds = collect($ids)
            ->filter()
            ->map(fn ($id): string => strtolower((string) $id))
            ->unique()
            ->values();

        if ($normalizedIds->isEmpty()) {
            return [];
        }

        return DB::table($table)
            ->whereIn(DB::raw('LOWER(id)'), $normalizedIds)
            ->pluck('id')
            ->mapWithKeys(fn ($id): array => [strtolower((string) $id) => (string) $id])
            ->all();
    }
}
