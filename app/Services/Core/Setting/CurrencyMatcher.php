<?php

namespace App\Services\Core\Setting;

use App\Models\Core\CoreSetting;

class CurrencyMatcher {
    public function __construct(private readonly SettingsService $settings) {}

    /** Kode kosong dianggap mata uang default (sama dengan cara dokumen menyimpan `currency_code`). */
    public function same(?string $sourceCode, ?string $documentCode): bool {
        $default = $this->settings->getForRead(CoreSetting::class)->default_currency_id;

        return ($sourceCode ?: $default) === ($documentCode ?: $default);
    }
}
