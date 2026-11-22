<?php

namespace App\Models\Finances;

use App\Models\Model;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;

/**
 * Riwayat parity mode `shadow` (Finance Fase 2, Requirement 6.5-6.6): hasil perbandingan jurnal jalur lama dengan
 * hasil engine per dokumen. Tidak ada catatan baru sejak mode shadow dihapus (Q-P2-23, 2026-11-22). Tidak pernah diubah (tanpa `updated_at`); dibersihkan oleh
 * `finance:prune-parity-logs` lewat query builder.
 */
class PostingParityLog extends Model {
    use DataTable, HasUlids;

    public const STATUS_MATCH       = 'match';
    public const STATUS_ROUNDING    = 'rounding';
    public const STATUS_CONFIG_DIFF = 'config_diff';
    public const STATUS_MISMATCH    = 'mismatch';
    public const STATUS_ENGINE_ERR  = 'engine_error';
    public const UPDATED_AT         = null;

    /**
     * Hanya service/komparator yang menulis catatan ini (`forceCreate()`).
     *
     * @var list<string>
     */
    protected $guarded = ['*'];

    public string $translateKey = 'finances.postingParityLog';
    protected $casts            = [
        'legacy' => 'array',
        'engine' => 'array',
        'diff'   => 'array',
    ];

    /**
     * Izin Requirement 11.3: `select`, `read`, ditambah izin ubah-mode `switch_posting_mode` (lihat `extraPermissions`).
     *
     * @return string[]
     */
    protected static function permissions() {
        return [
            'select',
            'read',
        ];
    }

    /**
     * Izin `switch_posting_mode` kini hanya menjaga sakelar cara eksekusi posting (inline/queue), diperiksa `PostingExecutionService` (Q-P2-23: mode off/shadow dihapus 2026-11-22).
     *
     * @return string[]
     */
    protected static function extraPermissions(): array {
        return ['switch_posting_mode'];
    }

    public static function getDefaultSortColumn(): string {
        return 'created_at';
    }

    protected $configColumns = [
        'document_type' => [
            'order'      => 0,
            'show'       => true,
            'groupable'  => true,
            'valueTrans' => 'finances.postingParityLog.columns.document_type.options',
        ],
        'status' => [
            'order'      => 1,
            'show'       => true,
            'groupable'  => true,
            'valueTrans' => 'finances.postingParityLog.columns.status.options',
        ],
        'source_type' => [
            'order' => 2,
            'show'  => true,
        ],
        'source_id' => [
            'order' => 3,
            'show'  => true,
        ],
        'created_at' => [
            'order' => 4,
            'show'  => true,
        ],
        'legacy' => [
            'ignore' => true,
        ],
        'engine' => [
            'ignore' => true,
        ],
        'diff' => [
            'ignore' => true,
        ],
    ];

    public function canDelete() {
        return false;
    }

    public static function templateLink() {
        return ':document_type :source_id';
    }

    /**
     * Lookup generik (`ModelController`) wajib memeriksa izin `select`: catatan parity adalah data audit engine.
     */
    public static function lookupRequiresSelectPermission(): bool {
        return true;
    }
}
