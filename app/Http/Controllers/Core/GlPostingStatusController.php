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
                expenseHeadAccountId: $doc->expenseHeadAccount->id,
                creditAccountId: $doc->creditAccount->id,
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

    private function recalcPurchaseReceiptGL(PurchaseReceipt $pr): float {
        $total = 0;
        foreach ($pr->items as $item) {
            $poItem = $item->purchaseOrderItem;
            if (! $poItem) {
                continue;
            }
            $total += (float) $poItem->rate * (float) $item->quantity;
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
            $total += (float) $item->rate * (float) $item->quantity;
        }

        return $total;
    }
}
