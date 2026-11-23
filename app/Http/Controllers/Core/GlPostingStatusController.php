<?php

namespace App\Http\Controllers\Core;

use App\Enums\FormStatus;
use App\Events\Asset\AssetDepreciationDue;
use App\Events\Asset\AssetScrapped;
use App\Events\Asset\AssetValueAdjustmentApproved;
use App\Events\Finances\PurchaseInvoiceGeneralLedgerPostingRequested;
use App\Events\Inventory\DeliveryNoteGeneralLedgerPostingRequested;
use App\Events\Purchase\PurchaseReceiptGeneralLedgerPostingRequested;
use App\Http\Controllers\Controller;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetDepreciationSchedule;
use App\Models\Asset\AssetValueAdjustment;
use App\Models\Core\GlPostingStatus;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Inventory\DeliveryNote;
use App\Models\Inventory\StockLedgerEntry;
use App\Models\Purchase\PurchaseReceipt;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class GlPostingStatusController extends Controller {
    public function __construct(Request $request) {
        parent::__construct($request, GlPostingStatus::class);
    }

    protected function enforcePermission(string $method) {
        if ($method === 'retry') {
            return 'write';
        }
    }

    public function index(Request $request) {
        $this->setBreadcrumbs();
        GlPostingStatus::dataTable($request->merge([
            'status' => ['pending', 'failed'],
        ]));

        return Inertia::render('Core/GlPostingStatuses/Index');
    }

    public function retry(GlPostingStatus $glPostingStatus) {
        abort_unless($glPostingStatus->status === FormStatus::FAILED, 422);

        $glPostingStatus->update([
            'status'      => FormStatus::PENDING,
            'retry_count' => 0,
            'last_error'  => null,
        ]);

        event($this->resolveRetryEvent($glPostingStatus));

        return back();
    }

    /**
     * Resolve ulang event GL dari dokumen sumber.
     * ponytail: re-query data terbaru dari dokumen sumber, bukan replay payload stale.
     */
    private function resolveRetryEvent(GlPostingStatus $glPostingStatus) {
        $doc = $glPostingStatus->referenceable;

        return match (true) {
            $doc instanceof PurchaseReceipt => new PurchaseReceiptGeneralLedgerPostingRequested(
                purchaseReceipt: $doc->load('items.purchaseOrderItem'),
                totalRatesForGL: $this->recalcPurchaseReceiptGL($doc),
                isReturn: (bool) $doc->return_against_id,
                transactionDate: now(),
            ),
            $doc instanceof DeliveryNote => new DeliveryNoteGeneralLedgerPostingRequested(
                deliveryNote: $doc->load('items.returnAgainstItem'),
                totalPicked: $this->recalcDeliveryNoteGL($doc),
                isReturn: (bool) $doc->return_against_id,
                transactionDate: now(),
            ),
            $doc instanceof PurchaseInvoice => new PurchaseInvoiceGeneralLedgerPostingRequested(
                purchaseInvoice: $doc->load(['items.purchaseOrderItem', 'items.returnAgainstItem', 'expenseHeadAccount', 'creditAccount']),
                totalStockGL: $this->recalcPurchaseInvoiceStockGL($doc),
                totalAmount: (float) $doc->amount,
                isReturn: (bool) $doc->return_against_id,
                transactionDate: now(),
                expenseHeadAccountId: $doc->expenseHeadAccount?->id,
                creditAccountId: $doc->creditAccount?->id,
            ),
            $doc instanceof AssetDepreciationSchedule => new AssetDepreciationDue(
                schedule: $doc,
                transactionDate: now(),
            ),
            $doc instanceof Asset => new AssetScrapped(
                asset: $doc,
                writeOffAmount: $doc->bookValue(),
                transactionDate: now(),
            ),
            $doc instanceof AssetValueAdjustment => new AssetValueAdjustmentApproved(
                adjustment: $doc,
                transactionDate: now(),
            ),
            default => throw new \InvalidArgumentException(
                'Unsupported referenceable type: ' . get_class($doc),
            ),
        };
    }

    /**
     * Nilai jurnal stok Purchase Receipt dihitung dari SLE yang ditulis receipt ini sendiri, bukan dari `rate` PO Item:
     * SLE itu sudah memuat nilai persis yang dipakai posting asli (rate bersih ALUR-2, rate entri queue pada retur),
     * sehingga percobaan ulang selalu sama dengan nilai persediaan (Finance Fase 2, Task 13.4).
     *
     * - Retur: seluruh SLE-nya ditulis dan dinilai oleh receipt retur itu sendiri; total = Σ -`change_in_stock_value`.
     * - Receipt biasa (hanya ALUR-2 yang memposting jurnal stok): hanya SLE yang DINILAI receipt saat dibuat. SLE pending
     *   (sisa over-receipt, baris ALUR-1) yang kemudian dinilai Purchase Invoice tetap berreferensi ke receipt ini dan
     *   berstatus `is_valuated`, tetapi nilainya dijurnal oleh Purchase Invoice itu; pembedanya snapshot `stock_queue`
     *   milik SLE: entri terakhirnya (entri yang baru dibuat SLE itu) berstatus `is_valuated` hanya bila receipt sendiri
     *   yang menilainya, dan penilaian Purchase Invoice tidak pernah menulis ulang snapshot itu. Bila tak satu pun SLE
     *   valued punya snapshot (data legacy/impor), total memakai Σ `change_in_stock_value` seluruh SLE valued itu; total
     *   0 dicatat sebagai `Log::warning`, tidak diam-diam dianggap sukses.
     */
    private function recalcPurchaseReceiptGL(PurchaseReceipt $pr): float {
        $entries = StockLedgerEntry::query()
            ->where('referenceable_type', PurchaseReceipt::class)
            ->where('referenceable_id', $pr->id)
            ->where('is_valuated', true)
            ->get(['id', 'change_in_stock_value', 'stock_queue']);

        if ($pr->return_against_id) {
            return -$entries->sum(fn ($entry) => (float) $entry->change_in_stock_value);
        }

        // Data legacy/impor bisa tak punya snapshot `stock_queue`: bila TIDAK ADA SLE ber-snapshot, pembeda di atas tak
        // bisa dipakai dan total diambil dari seluruh SLE valued receipt ini.
        $withSnapshot = $entries->filter(fn ($entry) => ! empty($entry->stock_queue));
        if ($withSnapshot->isEmpty()) {
            $total = (float) $entries->sum(fn ($entry) => (float) $entry->change_in_stock_value);
        } else {
            $total = 0.0;
            foreach ($withSnapshot as $entry) {
                $snapshot = $entry->stock_queue;
                $last     = end($snapshot);
                if (\is_array($last) && ($last['is_valuated'] ?? false)) {
                    $total += (float) $entry->change_in_stock_value;
                }
            }
        }

        if ($total == 0.0) {
            Log::warning('Percobaan ulang GL Purchase Receipt: total jurnal stok tidak dapat dihitung dari SLE (0).', [
                'purchase_receipt_id' => $pr->id,
                'valued_sle_count'    => $entries->count(),
                'with_snapshot_count' => $withSnapshot->count(),
            ]);
        }

        return $total;
    }

    private function recalcDeliveryNoteGL(DeliveryNote $dn): float {
        $total = 0;
        foreach ($dn->items as $item) {
            $valuationRates = $item->valuation_rates ?? [];
            $total += array_sum(array_map(
                fn ($v) => (float) ($v['rate'] ?? 0) * (float) ($v['quantity'] ?? 0),
                $valuationRates,
            ));
        }

        return $total;
    }

    private function recalcPurchaseInvoiceStockGL(PurchaseInvoice $pi): float {
        $total = 0;
        foreach ($pi->items as $item) {
            $poItem = $item->purchaseOrderItem;
            if (! $poItem || $pi->return_against_id) {
                continue;
            }
            $total += $item->netRate() * (float) $item->quantity;
        }

        return $total;
    }
}
