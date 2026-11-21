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
 * Satu-satunya jalur mengubah cara eksekusi posting GL (Finance Fase 2, Requirement 9.5): memeriksa izin
 * `switch_posting_mode`, menulis setting lewat `SettingsService::updateInternal()` (audit pengaturan modul) dan
 * menginvalidasi cache `PostingExecutionResolver`. Dapat dibalik tanpa deploy.
 */
final class PostingExecutionService {
    public function __construct(private readonly SettingsService $settings) {}

    /**
     * @throws AuthorizationException bila pengguna tidak memiliki izin `switch_posting_mode`
     * @throws InvalidArgumentException bila cara eksekusi tidak dikenal
     */
    public function switch(PostingDocumentType $type, string $execution): FinanceSetting {
        $this->authorize();

        if (! \in_array($execution, FinanceSetting::POSTING_EXECUTIONS, true)) {
            throw new InvalidArgumentException("Unknown posting execution [{$execution}].");
        }

        /** @var FinanceSetting $setting */
        $setting = $this->settings->updateInternal(FinanceSetting::class, fn (FinanceSetting $locked): array => ['posting_executions' => array_merge(
            array_fill_keys(PostingDocumentType::values(), FinanceSetting::POSTING_EXECUTION_INLINE),
            (array) ($locked->posting_executions ?? []),
            [$type->value => $execution],
        )]);
        PostingExecutionResolver::forget();

        Log::info('posting.execution_switched', ['document_type' => $type->value, 'execution' => $execution]);

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
