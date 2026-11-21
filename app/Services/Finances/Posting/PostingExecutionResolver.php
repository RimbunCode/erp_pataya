<?php

namespace App\Services\Finances\Posting;

use App\Enums\PostingDocumentType;
use App\Models\Finances\FinanceSetting;
use App\Services\Core\Setting\SettingsService;
use Illuminate\Support\Facades\Cache;

/**
 * Membaca cara eksekusi posting GL per jenis dokumen (Finance Fase 2, Requirement 9.2; D-1 opsi C, 2026-11-21):
 * `inline` (dalam transaksi dokumen, default) atau `queue` (listener berantrean). Hasil di-cache 60 detik;
 * `PostingExecutionService` menginvalidasi cache saat sakelar diubah. Nilai hilang atau tidak dikenal dibaca `inline`.
 */
final class PostingExecutionResolver {
    public const CACHE_KEY = 'finance.posting_executions';
    public const CACHE_TTL = 60;

    public function __construct(private readonly SettingsService $settings) {}

    public function for(PostingDocumentType $type): string {
        $execution = $this->all()[$type->value] ?? FinanceSetting::POSTING_EXECUTION_INLINE;

        return \in_array($execution, FinanceSetting::POSTING_EXECUTIONS, true) ? $execution : FinanceSetting::POSTING_EXECUTION_INLINE;
    }

    public function isQueued(PostingDocumentType $type): bool {
        return $this->for($type) === FinanceSetting::POSTING_EXECUTION_QUEUE;
    }

    /**
     * @return array<string, string>
     */
    public function all(): array {
        return Cache::remember(self::CACHE_KEY, self::CACHE_TTL, fn (): array => (array) ($this->settings->getForRead(FinanceSetting::class)->posting_executions ?? []));
    }

    public static function forget(): void {
        Cache::forget(self::CACHE_KEY);
    }
}
