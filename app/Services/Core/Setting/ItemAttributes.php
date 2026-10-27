<?php

namespace App\Services\Core\Setting;

final readonly class ItemAttributes {
    public function __construct(
        public ?string $type,
        public bool $isStockItem,
        public ?string $categoryId,
    ) {}
}
