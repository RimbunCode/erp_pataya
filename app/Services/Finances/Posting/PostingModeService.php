<?php

namespace App\Services\Finances\Posting;

use App\Enums\PostingDocumentType;
use App\Models\Finances\FinanceSetting;
use App\Models\Finances\PostingParityLog;
use App\Services\Core\Setting\SettingsService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\Log;
use InvalidArgumentException;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Satu-satunya jalur mengubah mode engine (Finance Fase 2, Requirement 6.8): memeriksa izin `switch_posting_mode`
 * (pada `PostingParityLog`), menulis setting lewat `SettingsService::updateInternal()` (audit pengaturan modul:
 * siapa, kapan, sebelum/sesudah) dan menginvalidasi cache `PostingModeResolver`. Perpindahan ke `on` adalah keputusan
 * pemilik produk; service ini tidak menilai kelayakannya.
 */
final class PostingModeService {
    public function __construct(private readonly SettingsService $settings) {}

    /**
     * @throws AuthorizationException bila pengguna tidak memiliki izin `switch_posting_mode`
     * @throws InvalidArgumentException bila mode tidak dikenal
     */
    public function switch(PostingDocumentType $type, string $mode): FinanceSetting {
        $this->authorize();

        if (! \in_array($mode, FinanceSetting::POSTING_MODES, true)) {
            throw new InvalidArgumentException("Unknown posting mode [{$mode}].");
        }

        // Baca-ubah-tulis di dalam transaksi dengan kunci baris setting: dua admin yang mengubah jenis dokumen
        // berbeda secara bersamaan tidak saling menimpa.
        /** @var FinanceSetting $setting */
        $setting = $this->settings->updateInternal(FinanceSetting::class, fn (FinanceSetting $locked): array => ['posting_modes' => array_merge(
            array_fill_keys(PostingDocumentType::values(), FinanceSetting::POSTING_MODE_OFF),
            (array) ($locked->posting_modes ?? []),
            [$type->value => $mode],
        )]);
        PostingModeResolver::forget();

        Log::info('posting.mode_switched', ['document_type' => $type->value, 'mode' => $mode]);

        return $setting;
    }

    private function authorize(): void {
        try {
            PostingParityLog::_checkPermission('switch_posting_mode');
        } catch (HttpException) {
            throw new AuthorizationException(__('finances/posting.errors.switch_mode_forbidden'));
        }
    }
}
