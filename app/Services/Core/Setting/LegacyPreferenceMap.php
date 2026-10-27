<?php

namespace App\Services\Core\Setting;

use App\Models\Core\Preference;

final class LegacyPreferenceMap {
    /** @return array<string, mixed> */
    public static function build(bool $includeHidden = false): array {
        return self::snapshot($includeHidden)['values'];
    }

    /** @return array{values: array<string, mixed>, updated_at: string|null} */
    public static function snapshot(bool $includeHidden = false): array {
        $values     = [];
        $legacyMap  = config('settings.legacy_map', []);
        $timestamps = [];
        $settings   = app(SettingsService::class);

        $settingsByModel = [];
        foreach (collect($legacyMap)->pluck(0)->unique() as $modelClass) {
            $setting                      = $settings->get($modelClass);
            $settingsByModel[$modelClass] = $setting;
            $timestamps[]                 = $setting->updated_at?->toDateTimeString();
        }

        foreach ($legacyMap as $legacyKey => [$modelClass, $column]) {
            if (! $includeHidden && Preference::isPrivateKey($legacyKey)) {
                continue;
            }
            $value = $settingsByModel[$modelClass]->getAttribute($column);
            if ($value !== null) {
                $values[$legacyKey] = $value;
            }
        }

        $query = Preference::query();
        if ($includeHidden) {
            $query->withoutGlobalScope(Preference::HIDE_PRIVATE_KEYS_SCOPE);
        }

        foreach ($query->get(['key', 'value', 'updated_at']) as $preference) {
            if (! array_key_exists($preference->key, $legacyMap)) {
                $values[$preference->key] = $preference->value;
            }
            $timestamps[] = $preference->updated_at?->toDateTimeString();
        }

        return [
            'values'     => $values,
            'updated_at' => collect($timestamps)->filter()->max(),
        ];
    }
}
