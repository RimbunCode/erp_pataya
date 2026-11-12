<?php

namespace App\Services\Core\Setting;

use App\Events\Core\ModuleSettingUpdated;
use App\Models\Core\CoreSetting;
use App\Models\Core\Currency;
use App\Models\Core\ModuleSetting as ModuleSettingModel;
use App\Models\Finances\FinanceSetting;
use Closure;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

class SettingsService {
    /** @var array<class-string<ModuleSettingModel>, ModuleSettingModel> */
    private array $memo = [];

    /** @param class-string<ModuleSettingModel> $modelClass */
    public function forget(string $modelClass): void {
        unset($this->memo[$modelClass]);
    }

    /** @param class-string<ModuleSettingModel> $modelClass */
    public function get(string $modelClass): ModuleSettingModel {
        $this->assertModelClass($modelClass);

        return $this->memo[$modelClass] ??= $modelClass::current();
    }

    /** @param class-string<ModuleSettingModel> $modelClass */
    public function getForRead(string $modelClass): ModuleSettingModel {
        $this->assertModelClass($modelClass);

        return $modelClass::query()->first() ?? new $modelClass($modelClass::defaultAttributes());
    }

    /** @param class-string<ModuleSettingModel> $modelClass
     * @param  array<string, mixed>  $attributes
     */
    public function update(string $modelClass, array $attributes): ModuleSettingModel {
        $this->assertModelClass($modelClass);

        $setting  = $this->get($modelClass);
        $allowed  = array_filter(array_keys($modelClass::rules()), fn (string $attribute): bool => ! str_contains($attribute, '.'));
        $unknown  = array_diff(array_keys($attributes), $allowed);
        $readonly = array_intersect(array_keys($attributes), $modelClass::readonlyColumns());
        $messages = [];
        foreach ([...$unknown, ...$readonly] as $attribute) {
            $messages[$attribute] = __('validation.prohibited', ['attribute' => $attribute]);
        }
        if ($messages !== []) {
            throw ValidationException::withMessages($messages);
        }

        $normalized = $this->normalizeCodes($attributes);
        $rules      = array_filter(
            $modelClass::rules(),
            fn (string $attribute): bool => array_key_exists(explode('.', $attribute)[0], $normalized),
            ARRAY_FILTER_USE_KEY,
        );
        $validated = Validator::make($normalized, $rules)->validate();

        $updated = DB::transaction(function () use ($modelClass, $setting, $validated): ModuleSettingModel {
            $setting = $modelClass::query()->whereKey($setting->getKey())->lockForUpdate()->firstOrFail();
            $setting->recordLogs();
            $setting->fill($validated);

            if ($setting instanceof CoreSetting && array_key_exists('default_currency_id', $validated)) {
                $currency = $validated['default_currency_id'] === null
                    ? null
                    : Currency::find(strtoupper($validated['default_currency_id']));
                $setting->default_number_format = $currency?->number_format ?? '#,###.##';
            }

            if ($setting instanceof FinanceSetting) {
                $this->assertValidSerialRange($setting);
            }

            $setting->save();
            $this->memo[$modelClass] = $setting->refresh();

            return $this->memo[$modelClass];
        });

        ModuleSettingUpdated::dispatch($updated, $validated);

        return $updated;
    }

    /**
     * Write columns declared in `internalRules()` (not exposed by the generic settings form). Same locking, audit
     * snapshot, and event as `update()`; used by dedicated services that enforce their own authorization.
     *
     * `$attributes` may be a closure receiving the row locked inside the transaction and returning the attributes,
     * so read-modify-write of a JSON column cannot lose a concurrent update.
     *
     * @param  class-string<ModuleSettingModel>  $modelClass
     * @param  array<string, mixed>|Closure(ModuleSettingModel): array<string, mixed>  $attributes
     */
    public function updateInternal(string $modelClass, array|Closure $attributes): ModuleSettingModel {
        $this->assertModelClass($modelClass);

        $internal = $modelClass::internalRules();
        $allowed  = array_filter(array_keys($internal), fn (string $attribute): bool => ! str_contains($attribute, '.'));
        $setting  = $this->get($modelClass);

        $updated = DB::transaction(function () use ($modelClass, $setting, $attributes, $internal, $allowed): array {
            $locked     = $modelClass::query()->whereKey($setting->getKey())->lockForUpdate()->firstOrFail();
            $attributes = $attributes instanceof Closure ? $attributes($locked) : $attributes;

            $unknown = array_diff(array_keys($attributes), $allowed);
            if ($unknown !== []) {
                throw ValidationException::withMessages(array_fill_keys($unknown, __('validation.prohibited', ['attribute' => implode(', ', $unknown)])));
            }

            $rules = array_filter(
                $internal,
                fn (string $attribute): bool => array_key_exists(explode('.', $attribute)[0], $attributes),
                ARRAY_FILTER_USE_KEY,
            );
            $validated = Validator::make($attributes, $rules)->validate();

            $locked->recordLogs();
            $locked->fill($validated);
            $locked->save();
            $this->memo[$modelClass] = $locked->refresh();

            return [$this->memo[$modelClass], $validated];
        });

        ModuleSettingUpdated::dispatch($updated[0], $updated[1]);

        return $updated[0];
    }

    private function assertValidSerialRange(FinanceSetting $setting): void {
        $start    = $setting->tax_invoice_serial_range_start;
        $end      = $setting->tax_invoice_serial_range_end;
        $lastUsed = $setting->tax_invoice_serial_last_used;

        // 0/0 stays the "not configured" sentinel (Requirement 2.2).
        if ($start !== null && $end !== null && (int) $start > 0 && (int) $end > 0 && (int) $start > (int) $end) {
            throw ValidationException::withMessages([
                'tax_invoice_serial_range_end' => __('validation.gte.numeric', ['attribute' => 'tax_invoice_serial_range_end', 'value' => $start]),
            ]);
        }

        if ($lastUsed !== null && $end !== null && (int) $end > 0 && (int) $lastUsed > (int) $end) {
            throw ValidationException::withMessages([
                'tax_invoice_serial_range_end' => __('validation.gte.numeric', ['attribute' => 'tax_invoice_serial_range_end', 'value' => $lastUsed]),
            ]);
        }
    }

    /**
     * Advance the tax invoice serial counter under the row lock held by the
     * caller (TaxInvoiceSerialAllocator wraps this in a transaction). This
     * keeps every write to a setting inside SettingsService (Requirement 3.6).
     */
    public function advanceTaxInvoiceSerial(FinanceSetting $setting, int $next): FinanceSetting {
        $setting->tax_invoice_serial_last_used = $next;
        $setting->save();
        $this->memo[FinanceSetting::class] = $setting;

        return $setting;
    }

    /** @param class-string<ModuleSettingModel> $modelClass */
    public function lockedCurrent(string $modelClass): ModuleSettingModel {
        $this->assertModelClass($modelClass);

        $modelClass::current();
        $setting                 = $modelClass::query()->lockForUpdate()->firstOrFail();
        $this->memo[$modelClass] = $setting;

        return $setting;
    }

    /** @param class-string $modelClass */
    private function assertModelClass(string $modelClass): void {
        if (! is_subclass_of($modelClass, ModuleSettingModel::class)) {
            throw new InvalidArgumentException("[$modelClass] must extend " . ModuleSettingModel::class . '.');
        }
    }

    /** @param array<string, mixed> $attributes @return array<string, mixed> */
    private function normalizeCodes(array $attributes): array {
        foreach (['default_currency_id', 'country_id'] as $key) {
            if (array_key_exists($key, $attributes)) {
                $value            = $attributes[$key];
                $code             = is_array($value) ? ($value['code'] ?? null) : $value;
                $attributes[$key] = $code === null || $code === '' ? null : strtoupper((string) $code);
            }
        }

        return $attributes;
    }
}
