<?php

namespace Database\Factories\Inventory;

use App\Models\Inventory\Item;
use App\Models\Inventory\ItemAlternative;
use App\Models\Inventory\ItemVariant;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ItemAlternative>
 */
class ItemAlternativeFactory extends Factory {
    protected $model = ItemAlternative::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array {
        $item        = $this->resolveSourceVariant();
        $alternative = $this->resolveAlternativeVariant($item);
        $twoWay      = fake()->boolean(50);

        if ($twoWay && ! $this->variantAllowsAlternative($alternative)) {
            $alternative = $this->resolveAlternativeVariant($item, true);
        }

        return [
            'item_id'             => $item->id,
            'alternative_item_id' => $alternative->id,
            'two_way'             => $twoWay && $this->variantAllowsAlternative($alternative),
        ];
    }

    private function resolveSourceVariant() {
        $item = ItemVariant::query()
            ->select('item_variants.*')
            ->join('items', 'items.id', '=', 'item_variants.item_id')
            ->where(function ($query): void {
                $query->where('item_variants.allow_alternative_item', true)
                    ->orWhere('items.allow_alternative_item', true);
            })
            ->inRandomOrder()
            ->first();

        if ($item) {
            return $item;
        }

        $fallbackItem = ItemVariant::query()->inRandomOrder()->first() ?? ItemVariantFactory::new()->create();

        if (! $this->variantAllowsAlternative($fallbackItem)) {
            $fallbackItem->update([
                'allow_alternative_item' => true,
            ]);
            $fallbackItem->refresh();
        }

        return $fallbackItem;
    }

    private function resolveAlternativeVariant(ItemVariant $item, bool $mustAllowAlternative = false) {
        $query = ItemVariant::query()
            ->select('item_variants.*')
            ->join('items', 'items.id', '=', 'item_variants.item_id')
            ->where('item_variants.id', '!=', $item->id);

        if ($mustAllowAlternative) {
            $query->where(function ($builder): void {
                $builder->where('item_variants.allow_alternative_item', true)
                    ->orWhere('items.allow_alternative_item', true);
            });
        }

        $alternative = $query->inRandomOrder()->first();
        if ($alternative) {
            return $alternative;
        }

        $fallbackAlternative = ItemVariant::query()
            ->where('id', '!=', $item->id)
            ->inRandomOrder()
            ->first();

        if (! $fallbackAlternative) {
            $fallbackAlternative = ItemVariantFactory::new()->create();
            if ($fallbackAlternative->id === $item->id) {
                $fallbackAlternative = ItemVariantFactory::new()->create();
            }
        }

        if ($mustAllowAlternative && ! $this->variantAllowsAlternative($fallbackAlternative)) {
            $fallbackAlternative->update([
                'allow_alternative_item' => true,
            ]);
            $fallbackAlternative->refresh();
        }

        return $fallbackAlternative;
    }

    private function variantAllowsAlternative(ItemVariant $variant): bool {
        if ((bool) $variant->allow_alternative_item) {
            return true;
        }

        return (bool) Item::query()
            ->whereKey($variant->item_id)
            ->value('allow_alternative_item');
    }
}
