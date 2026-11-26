<?php

namespace App\Services\Finances\Posting\AccountPanel;

use App\Enums\PostingDocumentType;
use Illuminate\Contracts\Container\Container;
use Illuminate\Database\Eloquent\Model;

/**
 * Peta jenis dokumen => `PanelSource` (Task 12.4). Sumber di-resolve malas lewat container; class yang belum ada
 * dilewati. Tidak boleh mengimpor model modul bisnis (P-8): hanya nama class berupa string.
 */
final class PanelSourceRegistry {
    /** @var array<string, string> `PostingDocumentType->value` => FQCN `PanelSource` */
    public const DEFAULT_MAP = [
        'sales_invoice'          => 'App\Services\Sales\Accounting\SalesInvoicePanelSource',
        'purchase_invoice'       => 'App\Services\Finances\Accounting\PurchaseInvoicePanelSource',
        'payment_entry'          => 'App\Services\Finances\Accounting\PaymentEntryPanelSource',
        'stock_entry'            => 'App\Services\Inventory\Accounting\StockEntryPanelSource',
        'asset_value_adjustment' => 'App\Services\Asset\Accounting\AssetValueAdjustmentPanelSource',
        'delivery_note'          => 'App\Services\Inventory\Accounting\DeliveryNotePanelSource',
        'purchase_receipt'       => 'App\Services\Purchase\Accounting\PurchaseReceiptPanelSource',
    ];

    /** @var array<string, string> FQCN model dokumen => `PostingDocumentType->value` */
    public const MODEL_TYPES = [
        'App\Models\Finances\SalesInvoice'      => 'sales_invoice',
        'App\Models\Finances\PurchaseInvoice'   => 'purchase_invoice',
        'App\Models\Finances\PaymentEntry'      => 'payment_entry',
        'App\Models\Inventory\StockEntry'       => 'stock_entry',
        'App\Models\Asset\AssetValueAdjustment' => 'asset_value_adjustment',
        'App\Models\Inventory\DeliveryNote'     => 'delivery_note',
        'App\Models\Purchase\PurchaseReceipt'   => 'purchase_receipt',
    ];

    public function __construct(private readonly Container $container) {}

    /**
     * Jenis dokumen posting untuk model ini, null bila modelnya tidak punya panel.
     */
    public function typeFor(Model $document): ?PostingDocumentType {
        $value = self::MODEL_TYPES[$document::class] ?? null;

        return $value === null ? null : PostingDocumentType::tryFrom($value);
    }

    public function sourceFor(PostingDocumentType $type): ?PanelSource {
        $class = self::DEFAULT_MAP[$type->value] ?? null;

        return $class !== null && class_exists($class) ? $this->container->make($class) : null;
    }
}
