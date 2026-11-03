<?php

namespace App\Services\Finances\Audit;

use App\Enums\FormStatus;
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
 *
 * Kunci `approved` bermakna "dokumen pasca-persetujuan" (keputusan DV-D opsi a, 2026-11-03): `onApproved`
 * setiap service menimpa status dokumen dengan status lanjutan, sehingga status `approved` hampir tidak pernah
 * tersimpan. Subjek `approved`, `posting_not_posted`, dan `posting_missing` adalah dokumen yang statusnya
 * salah satu dari `statuses` jenisnya. Daftar dibuat per jenis (bukan satu himpunan bersama) karena `submitted`
 * berarti pasca-persetujuan pada Asset dan Asset Value Adjustment, tetapi tidak pernah diset pada jenis lain.
 */
final class DocumentCoverageMatrix {
    /**
     * `tracked` = jenis yang membuat baris `gl_posting_statuses` (Payment Entry dan Stock Entry posting
     * sinkron tanpa pelacakan: dilaporkan "tidak dilacak", bukan anomali).
     *
     * `statuses` = status dokumen setelah `onApproved` (dan transisi lanjutannya), terverifikasi dari kode:
     * - Sales/Purchase Invoice: `unpaid` atau `returned` (`onApproved`), lalu `partially_paid`/`paid`
     *   (`UpdatePaymentableStatus`). `overdue` ada di enum tetapi belum diset kode; disertakan agar jenis ini
     *   tidak kembali tak terhitung bila diaktifkan.
     * - Purchase Receipt: `received` atau `returned`. Delivery Note: `delivered` atau `returned`.
     * - Payment Entry: `paid`. Stock Entry: `completed`.
     * - Asset Value Adjustment: `submitted`. Asset: `submitted` (tanggal siap pakai di masa depan) atau `active`,
     *   lalu status operasional (`issued`, `in_maintenance`, `out_of_order`, `scrapped`, `sold`, `partially_sold`,
     *   `in_rent`, `partially_rented`, `fully_depreciated`); aset terjual penuh kehilangan `active`.
     * - Jadwal depresiasi tidak punya kolom `status`: subjeknya seluruh baris, daftar dikosongkan.
     *
     * @var list<array{type: string, model: class-string, tracked: bool, statuses: list<FormStatus>}>
     */
    private const DOCUMENT_TYPES = [
        ['type' => 'sales_invoice', 'model' => SalesInvoice::class, 'tracked' => true, 'statuses' => [FormStatus::UNPAID, FormStatus::PARTIALLY_PAID, FormStatus::PAID, FormStatus::OVERDUE, FormStatus::RETURNED]],
        ['type' => 'purchase_invoice', 'model' => PurchaseInvoice::class, 'tracked' => true, 'statuses' => [FormStatus::UNPAID, FormStatus::PARTIALLY_PAID, FormStatus::PAID, FormStatus::OVERDUE, FormStatus::RETURNED]],
        ['type' => 'purchase_receipt', 'model' => PurchaseReceipt::class, 'tracked' => true, 'statuses' => [FormStatus::RECEIVED, FormStatus::RETURNED]],
        ['type' => 'delivery_note', 'model' => DeliveryNote::class, 'tracked' => true, 'statuses' => [FormStatus::DELIVERED, FormStatus::RETURNED]],
        ['type' => 'payment_entry', 'model' => PaymentEntry::class, 'tracked' => false, 'statuses' => [FormStatus::PAID]],
        ['type' => 'stock_entry', 'model' => StockEntry::class, 'tracked' => false, 'statuses' => [FormStatus::COMPLETED]],
        ['type' => 'asset_depreciation_schedule', 'model' => AssetDepreciationSchedule::class, 'tracked' => true, 'statuses' => []],
        ['type' => 'asset_value_adjustment', 'model' => AssetValueAdjustment::class, 'tracked' => true, 'statuses' => [FormStatus::SUBMITTED]],
        ['type' => 'asset', 'model' => Asset::class, 'tracked' => true, 'statuses' => [
            FormStatus::SUBMITTED, FormStatus::ACTIVE, FormStatus::ISSUED, FormStatus::IN_MAINTENANCE, FormStatus::OUT_OF_ORDER,
            FormStatus::SCRAPPED, FormStatus::SOLD, FormStatus::PARTIALLY_SOLD, FormStatus::IN_RENT, FormStatus::PARTIALLY_RENTED,
            FormStatus::FULLY_DEPRECIATED,
        ]],
    ];

    public function __construct(private Connection $db) {}

    /**
     * @return list<array<string, mixed>>
     */
    public function build(): array {
        return array_map(fn (array $definition) => $this->row($definition), self::DOCUMENT_TYPES);
    }

    /**
     * @param  array{type: string, model: class-string, tracked: bool, statuses: list<FormStatus>}  $definition
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

        if ($doc['has_status'] && $definition['statuses'] === []) {
            throw new \LogicException("Daftar status pasca-approve jenis {$definition['type']} kosong: semua dokumen akan terhitung.");
        }

        // Subjek "pasca-approve": status salah satu dari `statuses`; tanpa kolom status, seluruh baris.
        $postApproval = fn (): Builder => $doc['has_status']
            ? $docs()->where(function (Builder $query) use ($definition) {
                foreach ($definition['statuses'] as $status) {
                    $query->orWhereJsonContains('status', $status->value);
                }
            })
            : $docs();

        $row['with_gl'] = $docs()->whereExists($this->ledgerOf($class, $table))->count();

        if ($doc['has_status']) {
            $row['approved'] = $postApproval()->count();
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
            $row['posting_not_posted'] = $postApproval()->whereExists($this->postingStatusOf($class, $table, notPosted: true))->count();
            $row['posting_missing']    = $postApproval()->whereNotExists($this->postingStatusOf($class, $table))->count();
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
