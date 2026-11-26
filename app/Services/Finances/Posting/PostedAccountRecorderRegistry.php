<?php

namespace App\Services\Finances\Posting;

use App\Enums\PostingDocumentType;
use App\Services\Finances\Posting\Contexts\PostingContext;
use Illuminate\Contracts\Container\Container;

/**
 * Peta `PostingDocumentType` => recorder (Requirement 13.2). Recorder di-resolve malas lewat container; class yang
 * belum ada (domain belum membuatnya) dilewati. Tidak boleh mengimpor model modul bisnis (P-8): hanya nama class
 * berupa string.
 */
final class PostedAccountRecorderRegistry {
    /** @var array<string, class-string<PostedAccountRecorder>|string> */
    public const DEFAULT_MAP = [
        'sales_invoice'          => 'App\Services\Sales\Accounting\SalesInvoicePostedAccountRecorder',
        'purchase_invoice'       => 'App\Services\Finances\Accounting\PurchaseInvoicePostedAccountRecorder',
        'payment_entry'          => 'App\Services\Finances\Accounting\PaymentEntryPostedAccountRecorder',
        'stock_entry'            => 'App\Services\Inventory\Accounting\StockEntryPostedAccountRecorder',
        'asset_value_adjustment' => 'App\Services\Asset\Accounting\AssetValueAdjustmentPostedAccountRecorder',
    ];

    /**
     * @param  array<string, string>|null  $map  `PostingDocumentType->value` => FQCN recorder; null = peta bawaan
     */
    public function __construct(
        private readonly Container $container,
        private readonly ?array $map = null,
    ) {}

    /**
     * @return array<string, string>
     */
    public function map(): array {
        return $this->map ?? self::DEFAULT_MAP;
    }

    public function has(PostingDocumentType $type): bool {
        $class = $this->map()[$type->value] ?? null;

        return $class !== null && class_exists($class);
    }

    public function recorderFor(PostingDocumentType $type): ?PostedAccountRecorder {
        return $this->has($type) ? $this->container->make($this->map()[$type->value]) : null;
    }

    public function record(PostingContext $ctx, PostedAccountNotes $notes): void {
        $this->recorderFor($ctx->documentType)?->record($ctx, $notes);
    }
}
