<?php

namespace App\Services\Core\Setting;

use App\Models\Core\Preference;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;

final class PreferenceMigrator {
    /**
     * @return array{
     *   migrated: array<string>,
     *   skipped_existing: array<string>,
     *   invalid: array<string, mixed>,
     *   unknown_keys: array<string>
     * }
     */
    public function run(bool $dryRun = false, bool $force = false): array {
        $report = [
            'migrated'         => [],
            'skipped_existing' => [],
            'invalid'          => [],
            'unknown_keys'     => [],
        ];

        $legacyMap = config('settings.legacy_map', []);
        $columns   = [];

        // Konteks skema minimal (sebagian test): tanpa tabel preferences
        // tidak ada yang bisa dimigrasi; laporkan kosong, bukan error.
        if (! Schema::hasTable((new Preference)->getTable())) {
            return $report;
        }

        $allPrefs = Preference::withoutGlobalScope(Preference::HIDE_PRIVATE_KEYS_SCOPE)
            ->pluck('value', 'key')->all();

        foreach ($allPrefs as $key => $_) {
            if (! array_key_exists($key, $legacyMap)) {
                $report['unknown_keys'][] = $key;
            }
        }

        foreach ($legacyMap as $legacyKey => [$modelClass, $column]) {
            if (! array_key_exists($legacyKey, $allPrefs)) {
                continue;
            }

            $rawValue   = $allPrefs[$legacyKey];
            $normalized = $this->normalizeValue($legacyKey, $rawValue);

            $rules     = [$column => $modelClass::rules()[$column] ?? []];
            $validator = Validator::make([$column => $normalized], $rules);

            if ($validator->fails()) {
                $report['invalid'][$legacyKey] = $validator->errors()->get($column);

                continue;
            }

            $columns[$modelClass] ??= Schema::getColumnListing((new $modelClass)->getTable());
            if ($columns[$modelClass] === []) {
                $report['invalid'][$legacyKey] = ['Table missing.'];

                continue;
            }

            if (! in_array($column, $columns[$modelClass], true)) {
                $report['invalid'][$legacyKey] = ['Column missing.'];

                continue;
            }

            $defaults   = $modelClass::defaultAttributes();
            $defaultVal = $defaults[$column] ?? null;
            // Dry-run reads the real row (without creating it) so the report
            // matches what a real run would decide.
            $setting       = $dryRun ? $modelClass::query()->first() : $modelClass::current();
            $existingValue = $setting?->getAttribute($column) ?? $defaultVal;

            // Is the column still untouched (null or default)?
            $isUntouched = ($existingValue === null) || ($existingValue === $defaultVal);

            if (! $force && ! $isUntouched) {
                $report['skipped_existing'][] = $legacyKey;

                continue;
            }

            if (! $dryRun) {
                $setting->setAttribute($column, $normalized);
                $setting->save();
            }

            $report['migrated'][] = $legacyKey;
        }

        return $report;
    }

    private function normalizeValue(string $legacyKey, mixed $value): mixed {
        if (\in_array($legacyKey, ['tax_invoice_serial_range_start', 'tax_invoice_serial_range_end', 'tax_invoice_serial_last_used'], true)) {
            // Empty serial values become the 0 "not configured" sentinel;
            // the target columns are NOT NULL with default 0, so null would
            // abort the whole migration (Requirement 5.4). Non-numeric input
            // is left untouched so validation reports it as invalid.
            if ($value === '' || $value === null) {
                return 0;
            }

            return is_numeric($value) ? (int) $value : $value;
        }

        if (in_array($legacyKey, ['num_per_page', 'mail_port'], true)) {
            return ($value === '' || $value === null) ? null : (is_numeric($value) ? (int) $value : $value);
        }

        if ($legacyKey === 'per_page_options') {
            if (\is_string($value)) {
                $decoded = json_decode($value, true);

                return \is_array($decoded) ? array_map('intval', $decoded) : $value;
            }
            if (\is_array($value)) {
                return array_map('intval', $value);
            }

            return $value;
        }

        if (\in_array($legacyKey, ['country_id', 'default_currency_id'], true)) {
            return ($value === '' || $value === null) ? null : strtoupper((string) $value);
        }

        return $value;
    }
}
