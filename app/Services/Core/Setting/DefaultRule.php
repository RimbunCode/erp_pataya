<?php

namespace App\Services\Core\Setting;

final readonly class DefaultRule {
    public function __construct(
        public ?string $documentType,
        public ?string $itemType,
        public ?bool $isStockItem,
        public ?string $itemCategoryId,
        public ?string $value,
        public int $priority,
        public bool $referenceBroken = false,
    ) {}

    public function specificity(): int {
        return (int) ($this->documentType !== null)
            + (int) ($this->itemType !== null)
            + (int) ($this->isStockItem !== null)
            + (int) ($this->itemCategoryId !== null);
    }

    public function matches(string $documentType, ItemAttributes $item): bool {
        return ($this->documentType === null || $this->documentType === $documentType)
            && ($this->itemType === null || $this->itemType === $item->type)
            && ($this->isStockItem === null || $this->isStockItem === $item->isStockItem)
            && ($this->itemCategoryId === null || strcasecmp($this->itemCategoryId, $item->categoryId ?? '') === 0);
    }
}
