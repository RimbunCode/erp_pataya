<?php

namespace App\Services\Core\Setting;

class SettingsRegistry {
    /** @return array<string, array{model: string, controller: string, page: string, icon: string, title: string, label: string, desks: array, order: int}> */
    public static function all(): array {
        return config('settings.pages', []);
    }

    public static function get(string $key): ?array {
        return config("settings.pages.{$key}");
    }
}
