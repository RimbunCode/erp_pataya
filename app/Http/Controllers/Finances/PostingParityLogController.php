<?php

namespace App\Http\Controllers\Finances;

use App\Enums\PostingDocumentType;
use App\Http\Controllers\Controller;
use App\Models\Finances\PostingParityLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Halaman Parity Log baca-saja sebagai riwayat (Finance Fase 2, Requirement 8.3, 8.5). Daftar (izin `select`) hanya
 * membaca catatan lama dengan filter jenis dokumen/status/tanggal; rincian selisih hanya dikirim untuk pemegang izin
 * `read`. Kontrol ubah mode dihapus 2026-11-22 (Q-P2-23, opsi A): mode `off`/`shadow` tidak ada lagi dan tidak ada
 * catatan baru sejak Task 14.1.
 */
class PostingParityLogController extends Controller {
    private const PER_PAGE = 25;

    public function __construct(Request $request) {
        parent::__construct($request, PostingParityLog::class);
    }

    public function index(Request $request): Response {
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
        ]);
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

    private function hasPermission(string $action): bool {
        try {
            PostingParityLog::_checkPermission($action);
        } catch (HttpException) {
            return false;
        }

        return true;
    }
}
