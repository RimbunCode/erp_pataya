<?php

namespace App\Services\Core\Setting;

use App\Models\Asset\AssetSetting;
use App\Models\Core\ModuleSetting;
use App\Models\Helpdesk\HelpdeskSetting;
use App\Models\Sales\SalesSetting;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Nilai awal form baru dari setting Asset, Quotation, dan Helpdesk
 * (spec module-settings-other-modules). Nilai yang tidak lagi sah terhadap opsi
 * sumbernya tidak dikirim (P-O4); setting yang tidak terbaca dianggap kosong.
 */
class OtherModuleDefaultsResolver {
    public function __construct(private SettingsService $settings) {}

    /** @return array{depreciation_method: ?string, frequency_of_depreciation: ?int, total_number_of_depreciations: ?int} */
    public function forAsset(): array {
        $setting = $this->read(AssetSetting::class);
        $method  = $setting?->default_depreciation_method;

        return [
            'depreciation_method'           => in_array($method, AssetSetting::DEPRECIATION_METHODS, true) ? $method : null,
            'frequency_of_depreciation'     => $this->positiveInteger($setting?->default_frequency_of_depreciation),
            'total_number_of_depreciations' => $this->positiveInteger($setting?->default_total_number_of_depreciations),
        ];
    }

    public function quotationValidityDays(): ?int {
        return $this->days($this->read(SalesSetting::class)?->quotation_validity_days);
    }

    /** @return array{type: ?string, priority: ?string, due_days: ?int} */
    public function forTicket(): array {
        $setting  = $this->read(HelpdeskSetting::class);
        $type     = $setting?->default_type;
        $priority = $setting?->default_priority;

        return [
            'type'     => in_array($type, HelpdeskSetting::TICKET_TYPES, true) ? $type : null,
            'priority' => in_array($priority, HelpdeskSetting::TICKET_PRIORITIES, true) ? $priority : null,
            'due_days' => $this->days($setting?->default_due_days),
        ];
    }

    /** @param class-string<ModuleSetting> $modelClass */
    private function read(string $modelClass): ?ModuleSetting {
        try {
            return $this->settings->getForRead($modelClass);
        } catch (Throwable $exception) {
            Log::warning('Module setting could not be read; no defaults applied.', [
                'setting'   => $modelClass,
                'exception' => $exception->getMessage(),
            ]);

            return null;
        }
    }

    private function positiveInteger(mixed $value): ?int {
        return is_int($value) && $value >= 1 ? $value : null;
    }

    private function days(mixed $value): ?int {
        return is_int($value) && $value >= 0 ? $value : null;
    }
}
