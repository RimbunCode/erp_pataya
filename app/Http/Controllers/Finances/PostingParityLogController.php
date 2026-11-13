<?php

namespace App\Http\Controllers\Finances;

use App\Enums\PostingDocumentType;
use App\Http\Controllers\Controller;
use App\Http\Requests\Finances\PostingModeRequest;
use App\Models\Finances\FinanceSetting;
use App\Models\Finances\PostingParityLog;
use App\Services\Finances\Posting\PostingModeResolver;
use App\Services\Finances\Posting\PostingModeService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Halaman Parity Log dan kontrol mode engine per jenis dokumen (Finance Fase 2, Requirement 6.8, 8.3, 8.5). Daftar
 * (izin `select`) hanya membaca catatan shadow dengan filter jenis dokumen/status/tanggal; rincian selisih hanya
 * dikirim untuk pemegang izin `read`. Mengubah mode memerlukan izin `switch_posting_mode` dan dilakukan SATU-SATUNYA
 * lewat `PostingModeService::switch()` yang memeriksa izin ulang dan menulis audit; pemilihan `on` wajib disertai
 * konfirmasi eksplisit. Controller tidak menulis setting atau log secara langsung.
 */
class PostingParityLogController extends Controller {
    private const PER_PAGE = 25;

    public function __construct(Request $request) {
        parent::__construct($request, PostingParityLog::class);
    }

    protected function enforcePermission(string $method) {
        return $method === 'switchMode' ? 'switch_posting_mode' : parent::enforcePermission($method);
    }

    public function index(Request $request, PostingModeResolver $modes): Response {
        $this->setBreadcrumbs();

        $filters = Validator::make($request->query(), [
            'document_type' => ['nullable', 'string', Rule::in(PostingDocumentType::values())],
            'status'        => ['nullable', 'string', Rule::in($this->statuses())],
            'date_from'     => ['nullable', 'date_format:Y-m-d'],
            'date_to'       => ['nullable', 'date_format:Y-m-d', 'after_or_equal:date_from'],
        ])->validate();

        $canRead = $this->hasPermission('read');

        $logs = PostingParityLog::query()
            ->when($filters['document_type'] ?? null, fn ($query, string $type) => $query->where('document_type', $type))
            ->when($filters['status'] ?? null, fn ($query, string $status) => $query->where('status', $status))
            ->when($filters['date_from'] ?? null, fn ($query, string $date) => $query->where('created_at', '>=', $date . ' 00:00:00'))
            ->when($filters['date_to'] ?? null, fn ($query, string $date) => $query->where('created_at', '<=', $date . ' 23:59:59'))
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate(self::PER_PAGE)
            ->withQueryString()
            ->through(fn (PostingParityLog $log): array => [
                'id'            => $log->id,
                'document_type' => $log->document_type,
                'status'        => $log->status,
                'source_type'   => class_basename((string) $log->source_type),
                'source_id'     => $log->source_id,
                'created_at'    => $log->created_at?->toIso8601String(),
                'diff'          => $canRead ? $log->diff : null,
            ]);

        $current = $modes->all();

        return Inertia::render('Finances/PostingParityLogs/Index', [
            'logs'    => $logs,
            'filters' => [
                'document_type' => $filters['document_type'] ?? '',
                'status'        => $filters['status'] ?? '',
                'date_from'     => $filters['date_from'] ?? '',
                'date_to'       => $filters['date_to'] ?? '',
            ],
            'documentTypes' => PostingDocumentType::values(),
            'statuses'      => $this->statuses(),
            'modes'         => collect(PostingDocumentType::values())
                ->mapWithKeys(fn (string $type): array => [$type => $this->normalizeMode($current[$type] ?? null)])
                ->all(),
            'modeOptions'   => FinanceSetting::POSTING_MODES,
            'canSwitchMode' => $this->hasPermission('switch_posting_mode'),
        ]);
    }

    public function switchMode(PostingModeRequest $request, PostingDocumentType $documentType, PostingModeService $service): RedirectResponse {
        $mode = (string) $request->validated('mode');

        $service->switch($documentType, $mode);

        return back()->with('success', __('finances/postingParityLog.mode.switched', [
            // Kunci lang bertitik ('document_type.options' sebagai kunci datar) tidak dapat diakses lewat notasi titik.
            'document_type' => __('finances/postingParityLog.columns')['document_type.options'][$documentType->value] ?? $documentType->value,
            'mode'          => __("finances/postingParityLog.mode.options.{$mode}"),
        ]));
    }

    /**
     * @return list<string>
     */
    private function statuses(): array {
        return [
            PostingParityLog::STATUS_MATCH,
            PostingParityLog::STATUS_ROUNDING,
            PostingParityLog::STATUS_CONFIG_DIFF,
            PostingParityLog::STATUS_MISMATCH,
            PostingParityLog::STATUS_ENGINE_ERR,
        ];
    }

    private function normalizeMode(?string $mode): string {
        return \in_array($mode, FinanceSetting::POSTING_MODES, true) ? $mode : FinanceSetting::POSTING_MODE_OFF;
    }

    private function hasPermission(string $action): bool {
        try {
            PostingParityLog::_checkPermission($action);
        } catch (HttpException) {
            return false;
        }

        return true;
    }
}
