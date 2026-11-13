<?php

namespace App\Services\Finances\Posting;

use App\Enums\PostingDocumentType;
use App\Models\Finances\FinanceSetting;
use App\Services\Core\Setting\SettingsService;
use Illuminate\Support\Facades\Cache;

/**
 * Membaca mode engine per jenis dokumen (Finance Fase 2, Requirement 6.1): `off` (jalur lama), `shadow`, atau `on`,
 * dari setting Finances `posting_modes`. Hasil di-cache 60 detik agar tidak query setiap posting; `PostingModeService`
 * menginvalidasi cache saat mode diubah. Nilai hilang atau tidak dikenal dibaca sebagai `off` (aman: jalur lama).
 */
final class PostingModeResolver {
    public const CACHE_KEY = 'finance.posting_modes';
    public const CACHE_TTL = 60;

    public function __construct(private readonly SettingsService $settings) {}

    public function for(PostingDocumentType $type): string {
        $mode = $this->all()[$type->value] ?? FinanceSetting::POSTING_MODE_OFF;

        return \in_array($mode, FinanceSetting::POSTING_MODES, true) ? $mode : FinanceSetting::POSTING_MODE_OFF;
    }

    /**
     * @return array<string, string>
     */
    public function all(): array {
        return Cache::remember(self::CACHE_KEY, self::CACHE_TTL, fn (): array => (array) ($this->settings->getForRead(FinanceSetting::class)->posting_modes ?? []));
    }

    public static function forget(): void {
        Cache::forget(self::CACHE_KEY);
    }
}
