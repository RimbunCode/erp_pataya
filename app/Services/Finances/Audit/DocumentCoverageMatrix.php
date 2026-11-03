<?php

namespace App\Services\Finances\Audit;

use App\Models\Asset\Asset;
use App\Models\Asset\AssetDepreciationSchedule;
use App\Models\Asset\AssetValueAdjustment;
use App\Models\Finances\PaymentEntry;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Finances\SalesInvoice;
use App\Models\Inventory\DeliveryNote;
use App\Models\Inventory\StockEntry;
use App\Models\Purchase\PurchaseReceipt;
use Illuminate\Database\Connection;
use Illuminate\Database\Query\Builder;

/**
 * Matriks per jenis dokumen yang memposting ke GL (Lampiran B PRD): cakupan GL, dampak pembatalan,
 * dan apakah posting dilacak `GlPostingStatus`.
 *
 * Dokumen yang di-soft-delete tetap dihitung (tabel dokumen dibaca apa adanya).
 */
final class DocumentCoverageMatrix {
    /**
     * `tracked` = jenis yang membuat baris `gl_posting_statuses` (Payment Entry dan Stock Entry posting
     * sinkron tanpa pelacakan: dilaporkan "tidak dilacak", bukan anomali).
     *
     * @var list<array{type: string, model: class-string, tracked: bool}>
     */
    private const DOCUMENT_TYPES = [
        ['type' => 'sales_invoice', 'model' => SalesInvoice::class, 'tracked' => true],
        ['type' => 'purchase_invoice', 'model' => PurchaseInvoice::class, 'tracked' => true],
        ['type' => 'purchase_receipt', 'model' => PurchaseReceipt::class, 'tracked' => true],
        ['type' => 'delivery_note', 'model' => DeliveryNote::class, 'tracked' => true],
        ['type' => 'payment_entry', 'model' => PaymentEntry::class, 'tracked' => false],
        ['type' => 'stock_entry', 'model' => StockEntry::class, 'tracked' => false],
        ['type' => 'asset_depreciation_schedule', 'model' => AssetDepreciationSchedule::class, 'tracked' => true],
        ['type' => 'asset_value_adjustment', 'model' => AssetValueAdjustment::class, 'tracked' => true],
        ['type' => 'asset', 'model' => Asset::class, 'tracked' => true],
    ];

    public function __construct(private Connection $db) {}

    /**
     * @return list<array<string, mixed>>
     */
    public function build(): array {
        return array_map(fn (array $definition) => $this->row($definition), self::DOCUMENT_TYPES);
    }

    /**
     * @param  array{type: string, model: class-string, tracked: bool}  $definition
     * @return array<string, mixed>
     */
    private function row(array $definition): array {
        $row = [
            'type'                    => $definition['type'],
            'available'               => true,
            'approved'                => 0,
            'canceled'                => 0,
            'with_gl'                 => 0,
            'canceled_gl_softdeleted' => 0,
            'canceled_active_gl'      => 0,
            'tracked'                 => $definition['tracked'],
            'posting_not_posted'      => null,
            'posting_missing'         => null,
        ];

        $doc = LedgerDocumentTable::describe($this->db, $definition['model']);
        if ($doc === null) {
            return [...$row, 'available' => false];
        }

        $class = $definition['model'];
        $table = $doc['table'];
        $docs  = fn (): Builder => $this->db->table($table);

        $row['with_gl'] = $docs()->whereExists($this->ledgerOf($class, $table))->count();

        if ($doc['has_status']) {
            $row['approved'] = $docs()->whereJsonContains('status', 'approved')->count();
            $row['canceled'] = $docs()->whereJsonContains('status', 'canceled')->count();

            $canceled                       = fn (): Builder => $docs()->whereJsonContains('status', 'canceled');
            $row['canceled_active_gl']      = $canceled()->whereExists($this->ledgerOf($class, $table, activeOnly: true))->count();
            $row['canceled_gl_softdeleted'] = $canceled()
                ->whereExists($this->ledgerOf($class, $table))
                ->whereNotExists($this->ledgerOf($class, $table, activeOnly: true))
                ->count();
        } else {
            // Tanpa kolom status (jadwal depresiasi): tidak ada konsep approved/canceled.
            $row['approved'] = null;
            $row['canceled'] = null;
        }

        if ($definition['tracked']) {
            $subject = fn (): Builder => $doc['has_status'] ? $docs()->whereJsonContains('status', 'approved') : $docs();

            $row['posting_not_posted'] = $subject()->whereExists($this->postingStatusOf($class, $table, notPosted: true))->count();
            $row['posting_missing']    = $subject()->whereNotExists($this->postingStatusOf($class, $table))->count();
        }

        return $row;
    }

    private function ledgerOf(string $class, string $table, bool $activeOnly = false): \Closure {
        return function (Builder $exists) use ($class, $table, $activeOnly) {
            $exists->selectRaw('1')->from('general_ledgers')
                ->where('general_ledgers.referenceable_type', $class)
                ->whereColumn('general_ledgers.referenceable_id', "{$table}.id");

            if ($activeOnly) {
                $exists->whereNull('general_ledgers.deleted_at');
            }
        };
    }

    private function postingStatusOf(string $class, string $table, bool $notPosted = false): \Closure {
        return function (Builder $exists) use ($class, $table, $notPosted) {
            $exists->selectRaw('1')->from('gl_posting_statuses')
                ->where('gl_posting_statuses.referenceable_type', $class)
                ->whereColumn('gl_posting_statuses.referenceable_id', "{$table}.id");

            if ($notPosted) {
                $exists->where('gl_posting_statuses.status', '!=', 'posted');
            }
        };
    }
}
