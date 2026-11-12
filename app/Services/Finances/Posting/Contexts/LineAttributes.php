<?php

namespace App\Services\Finances\Posting\Contexts;

/**
 * Satu baris beratribut barang pada `PostingContext::$lines` (Finance Fase 2, Requirement 4.1). Atribut barang
 * (`item_type`, `is_stock_item`, `item_category_id`) menjadi kondisi aturan akun bersyarat (Requirement 12); nilai
 * null berarti atribut tidak diketahui sehingga aturan yang mensyaratkannya tidak cocok.
 *
 * `amounts` memuat jumlah bernama baris itu (mis. `amount`, `gross_amount`, `discount_amount`).
 */
final readonly class LineAttributes {
    /**
     * @param  array<string, float|int|string>  $amounts
     */
    public function __construct(
        public array $amounts = [],
        public ?string $itemType = null,
        public ?bool $isStockItem = null,
        public ?string $itemCategoryId = null,
        public ?string $lineId = null,
    ) {}

    public function amount(string $name): float {
        return (float) ($this->amounts[$name] ?? 0);
    }
}
