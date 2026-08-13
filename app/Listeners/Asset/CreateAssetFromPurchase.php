<?php

namespace App\Listeners\Asset;

use App\Events\Asset\FixedAssetItemApproved;
use App\Models\Asset\Asset;
use App\Models\Finances\PurchaseInvoiceItem;
use App\Models\Inventory\Item;
use App\Models\Purchase\PurchaseReceipt;
use App\Models\Purchase\PurchaseReceiptItem;
use App\Services\Asset\AssetService;
use Illuminate\Contracts\Queue\ShouldQueue;

class CreateAssetFromPurchase implements ShouldQueue {
    public function __construct(private AssetService $assetService) {}

    public function handle(FixedAssetItemApproved $event): void {
        $isReceipt = $event->sourceDocument instanceof PurchaseReceipt;

        if ($isReceipt) {
            $this->createFromReceipt($event->sourceItem, $event->item);

            return;
        }

        $existing = $this->findAssetFromRelatedReceipt($event->sourceItem);
        if ($existing) {
            $this->syncFromInvoice($existing, $event->sourceItem);

            return;
        }

        $this->createFromInvoice($event->sourceItem, $event->item);
    }

    private function createFromReceipt(PurchaseReceiptItem $receiptItem, Item $item): void {
        // Guard idempoten: cek apakah Asset untuk receipt item ini sudah ada
        if (Asset::where('purchase_receipt_item_id', $receiptItem->id)->exists()) {
            return;
        }

        $receipt = $receiptItem->purchaseReceipt;
        $rate    = $receiptItem->purchaseOrderItem?->rate ?? 0;
        $amount  = $rate * $receiptItem->quantity;

        $this->assetService->create([
            'asset_name'               => $item->name,
            'asset_category_id'        => $item->asset_category_id,
            'asset_location_id'        => null,
            'item_id'                  => $item->id,
            'asset_quantity'           => (int) $receiptItem->quantity,
            'purchase_date'            => $receipt?->received_date,
            'net_purchase_amount'      => $amount,
            'gross_purchase_amount'    => $amount,
            'purchase_receipt_id'      => $receiptItem->purchase_receipt_id,
            'purchase_receipt_item_id' => $receiptItem->id,
        ]);
    }

    private function createFromInvoice(PurchaseInvoiceItem $invoiceItem, Item $item): void {
        if (Asset::where('purchase_invoice_item_id', $invoiceItem->id)->exists()) {
            return;
        }

        $invoice = $invoiceItem->purchaseInvoice;

        $this->assetService->create([
            'asset_name'               => $item->name,
            'asset_category_id'        => $item->asset_category_id,
            'asset_location_id'        => null,
            'item_id'                  => $item->id,
            'asset_quantity'           => (int) $invoiceItem->quantity,
            'purchase_date'            => $invoice?->posting_date,
            'net_purchase_amount'      => $invoiceItem->basic_amount ?? 0,
            'gross_purchase_amount'    => $invoiceItem->amount ?? 0,
            'purchase_invoice_id'      => $invoiceItem->purchase_invoice_id,
            'purchase_invoice_item_id' => $invoiceItem->id,
        ]);
    }

    private function findAssetFromRelatedReceipt(PurchaseInvoiceItem $invoiceItem): ?Asset {
        $poItem = $invoiceItem->purchaseOrderItem;
        if (! $poItem) {
            return null;
        }

        return Asset::whereNull('purchase_invoice_id')
            ->whereHas('purchaseReceiptItem', fn ($q) => $q->where('purchase_order_item_id', $poItem->id))
            ->first();
    }

    private function syncFromInvoice(Asset $asset, PurchaseInvoiceItem $invoiceItem): void {
        $this->assetService->update($asset, [
            'purchase_invoice_id'      => $invoiceItem->purchase_invoice_id,
            'purchase_invoice_item_id' => $invoiceItem->id,
            'net_purchase_amount'      => $invoiceItem->basic_amount ?? 0,
            'gross_purchase_amount'    => $invoiceItem->amount ?? 0,
        ]);
    }
}
