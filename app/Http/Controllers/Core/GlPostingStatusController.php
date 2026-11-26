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
use App\Models\Purchase\PurchaseReceipt;
use App\Services\Inventory\Accounting\DeliveryNoteLineAmounts;
use Illuminate\Http\Request;
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
            $doc instanceof PurchaseReceipt => $this->purchaseReceiptRetryEvent($doc),
            $doc instanceof DeliveryNote    => new DeliveryNoteGeneralLedgerPostingRequested(
                deliveryNote: $doc->load('items.item', 'items.returnAgainstItem'),
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

    private function purchaseReceiptRetryEvent(PurchaseReceipt $pr): PurchaseReceiptGeneralLedgerPostingRequested {
        $pr->load('items.purchaseOrderItem');
        $lineAmounts = $this->recalcPurchaseReceiptLineAmounts($pr);

        return new PurchaseReceiptGeneralLedgerPostingRequested(
            purchaseReceipt: $pr,
            totalRatesForGL: (float) array_sum($lineAmounts),
            isReturn: (bool) $pr->return_against_id,
            transactionDate: now(),
            lineAmounts: $lineAmounts,
        );
    }

    /**
     * Nilai GL per baris receipt (id baris => nilai); total event = jumlahnya, sehingga selalu konsisten.
     *
     * @return array<string, float>
     */
    private function recalcPurchaseReceiptLineAmounts(PurchaseReceipt $pr): array {
        $amounts = [];
        foreach ($pr->items as $item) {
            $poItem = $item->purchaseOrderItem;
            if (! $poItem) {
                continue;
            }
            $amounts[(string) $item->getKey()] = (float) $poItem->rate * (float) $item->quantity;
        }

        return $amounts;
    }

    private function recalcDeliveryNoteGL(DeliveryNote $dn): float {
        // Retur memakai nilai baris dokumen asal (baris retur tidak menyimpan valuation_rates sendiri).
        return DeliveryNoteLineAmounts::total(
            DeliveryNoteLineAmounts::forDocument($dn, (bool) $dn->return_against_id),
        );
    }

    private function recalcPurchaseInvoiceStockGL(PurchaseInvoice $pi): float {
        $total = 0;
        foreach ($pi->items as $item) {
            $poItem = $item->purchaseOrderItem;
            if (! $poItem || $pi->return_against_id) {
                continue;
            }
            $total += (float) $item->rate * (float) $item->quantity;
        }

        return $total;
    }
}
