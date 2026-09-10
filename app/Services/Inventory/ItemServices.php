<?php

namespace App\Services\Inventory;

use App\Models\Inventory\Category;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Unit;
use Illuminate\Support\Collection;

class ItemServices {
    /**
     * Turunkan `type`, `is_fixed_asset`, dan `is_stock_item` dari Category yang dipilih.
     * Kategori jasa (`type = 'service'`) tidak bisa jadi aset tetap, dan aset tetap
     * tidak pernah tercatat sebagai barang stok.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function applyCategoryDerivedFields(array $data, Category $category): array {
        $categoryIsStock        = $category->type != 'service';
        $data['is_fixed_asset'] = $categoryIsStock && ($data['is_fixed_asset'] ?? false);
        $data['is_stock_item']  = $categoryIsStock && ! $data['is_fixed_asset'];
        $data['type']           = $category->type;

        return $data;
    }

    /**
     * Summary of getSku
     *
     * @param  ItemVariant|Item  $item
     */
    public static function getSku(mixed $item, ?array $attributes = null) {
        if ($item->format_variant === null || $item->format_variant === '') {
            return $item->item_code;
        }
        $attributesValues = $item instanceof Item ? $attributes : $item->values->toArray();
        $data             = array_combine(array_column($attributesValues, 'attribute_id'), array_column($attributesValues, 'value'));
        $data['item']     = $item instanceof Item ? $item->code : ($item->item_code ?? $item->item->code);
        $result           = preg_replace_callback('/@\[(.*?)\]\((.*?)\)/', function ($matches) use ($data) {
            $key = $matches[1];
            $id  = $matches[2];

            return $data[$key] ?? ($data[$id] ?? $matches[0]);
        }, $item->format_variant ?? $item->item->format_variant);

        return $result;
    }

    public function sanitizeUoms(?string $defaultUnitId, array $uoms): array {
        if (! $defaultUnitId) {
            return [];
        }

        $unitIds = array_values(array_unique(array_filter([
            ...array_column($uoms, 'id'),
            $defaultUnitId,
        ])));

        /** @var Collection<string, Unit> $units */
        $units = Unit::query()
            ->whereIn('id', $unitIds)
            ->get()
            ->keyBy('id');

        $defaultUnit = $units->get($defaultUnitId);
        if (! $defaultUnit) {
            return [];
        }

        $defaultGroup          = $this->normalizeUnitGroup($defaultUnit->getRawOriginal('group'));
        $primaryNonOthersGroup = $defaultGroup;
        $normalizedUoms        = [];

        foreach ($uoms as $uom) {
            $unitId = $uom['id'] ?? null;
            if (! \is_string($unitId)) {
                continue;
            }

            $unit = $units->get($unitId);
            if (! $unit) {
                continue;
            }

            $unitGroup = $this->normalizeUnitGroup($unit->getRawOriginal('group'));
            if (! $primaryNonOthersGroup && $unitGroup) {
                $primaryNonOthersGroup = $unitGroup;
            }

            $normalizedUoms[$unitId] = [
                'id'                     => $unitId,
                'conversion_factor'      => $this->normalizeConversionFactor($uom['conversion_factor'] ?? null),
                'isManual'               => array_key_exists('isManual', $uom) ? (bool) $uom['isManual'] : null,
                'generatedByDefaultUnit' => array_key_exists('generatedByDefaultUnit', $uom) ? (bool) $uom['generatedByDefaultUnit'] : null,
            ];
        }

        $filteredUoms = [];
        foreach ($normalizedUoms as $unitId => $uom) {
            $unit = $units->get($unitId);
            if (! $unit) {
                continue;
            }

            $unitGroup = $this->normalizeUnitGroup($unit->getRawOriginal('group'));
            $isDefault = $unitId === $defaultUnitId;
            $isOthers  = $unitGroup === null;
            $inPrimary = $primaryNonOthersGroup && $unitGroup === $primaryNonOthersGroup;

            if (! ($isDefault || $isOthers || $inPrimary)) {
                continue;
            }

            $filteredUoms[$unitId] = $uom;
        }

        if (! \array_key_exists($defaultUnitId, $filteredUoms)) {
            $filteredUoms = [
                $defaultUnitId => [
                    'id'                     => $defaultUnitId,
                    'conversion_factor'      => $this->normalizeConversionFactor($defaultUnit->conversion_factor),
                    'isManual'               => false,
                    'generatedByDefaultUnit' => true,
                ],
                ...$filteredUoms,
            ];
        }

        return array_values($filteredUoms);
    }

    public function resolveDefaultUnitConversionFactor(?string $defaultUnitId, array $uoms): ?float {
        if (! $defaultUnitId) {
            return null;
        }

        $defaultUom = collect($uoms)->first(fn ($uom) => ($uom['id'] ?? null) === $defaultUnitId);

        if ($defaultUom) {
            return $this->normalizeConversionFactor($defaultUom['conversion_factor'] ?? null);
        }

        $fallback = Unit::query()
            ->where('id', $defaultUnitId)
            ->value('conversion_factor');

        return $this->normalizeConversionFactor($fallback);
    }

    public function updateUom(Item $item, array $uoms) {
        Unit::whereIn('id', array_column($uoms, 'id'))->update(['have_transactions' => 1]);
        foreach ($uoms as $order => $uom) {
            $item->uom()->updateOrCreate([
                'unit_id' => $uom['id'],
            ], [
                'order'                     => $order,
                'is_default'                => $uom['id'] === $item->default_unit_id,
                'conversion_factor'         => $this->normalizeConversionFactor($uom['conversion_factor'] ?? null),
                'is_manual'                 => \array_key_exists('isManual', $uom) ? (bool) $uom['isManual'] : null,
                'generated_by_default_unit' => \array_key_exists('generatedByDefaultUnit', $uom) ? (bool) $uom['generatedByDefaultUnit'] : null,
            ]);
        }
        foreach ($item->uom as $uom) {
            if (! \in_array($uom->unit_id, array_column($uoms, 'id'))) {
                $uom->delete();
            }
        }
    }

    private function normalizeUnitGroup(mixed $group): ?string {
        if ($group === null || $group === '' || $group === 'Others') {
            return null;
        }

        return (string) $group;
    }

    private function normalizeConversionFactor(mixed $value): ?float {
        if ($value === null || $value === '') {
            return null;
        }

        return (float) $value;
    }

    public function updateVariants(Item $item, string $formatVariants, array $attributes) {
        if (isset($attributes) && \count($attributes) > 0) {
            if (isset($formatVariants)) {
                $attribute_map              = array_column(array_column($attributes, 'attribute'), 'id', 'name');
                $attribute_map['Item Code'] = 'item';

                // Ganti format menggunakan regex
                $formatVariants = preg_replace_callback('/\{([^}]+)\}/', function ($matches) use ($attribute_map) {
                    $name = $matches[1];

                    return isset($attribute_map[$name]) ? "@[$name]({$attribute_map[$name]})" : $matches[0];
                }, $formatVariants);
            }
            foreach ($attributes as $attribute) {
                $item->attributes()->updateOrCreate([
                    'attribute_id' => $attribute['attribute']['id'],
                ], [
                    'values' => $attribute['values'],
                ]);
            }
            $attributeIds = array_column(
                array_column($attributes, 'attribute'),
                'id',
            );
            foreach ($item->attributes as $attribute) {
                if (
                    ! \in_array(
                        $attribute->attribute_id,
                        $attributeIds,
                    )
                ) {
                    $attribute->delete();
                }
            }
            $dataVariants = ItemVariant::selectRaw("
        item_variants.id,
        CONCAT('[', GROUP_CONCAT(DISTINCT CONCAT('\"', item_variant_attributes.value, '\"') SEPARATOR ', '), ']') AS `values`
      ")
                ->leftJoin('item_variant_attributes', 'item_variants.id', '=', 'item_variant_attributes.item_variant_id')
                ->where('item_id', $item->id)
                ->groupBy('item_variants.id')
                ->withCasts([
                    'values' => 'array',
                ])
                ->get();
            $this->generateVariants($dataVariants, $item, $attributes);
        } else {
            $item->attributes()->delete();
            $itemVariant = ItemVariant::updateOrCreate([
                'item_id'        => $item->id,
                'format_variant' => null,
            ], [
                'code'              => $item->code,
                'item_code'         => $item->code,
                'item_name'         => $item->name,
                'category_id'       => $item->category_id,
                'default_unit_id'   => $item->default_unit_id,
                'is_stock_item'     => $item->is_stock_item,
                'type'              => $item->type,
                'conversion_factor' => $item->conversion_factor,
            ]);

            return $itemVariant;
        }
    }

    private function generateVariants($variants, Item $item, array $attributes, array $prefix = []) {
        if (! $attributes) {
            $variant = $variants->where(function ($variant) use ($prefix) {
                if (\count($variant->values ?? []) != \count($prefix)) {
                    return false;
                }
                foreach ($prefix as $attribute) {
                    if (! \in_array($attribute['value'], $variant->values ?? [])) {
                        return false;
                    }
                }

                return true;
            })->first() ?? null;
            if (! $variant) {
                $variant = ItemVariant::create([
                    'item_id'           => $item->id,
                    'code'              => static::getSku($item, $prefix),
                    'item_code'         => $item->code,
                    'item_name'         => $item->name,
                    'format_variant'    => $item->format_variant,
                    'category_id'       => $item->category_id,
                    'default_unit_id'   => $item->default_unit_id,
                    'is_stock_item'     => $item->is_stock_item,
                    'type'              => $item->type,
                    'conversion_factor' => $item->conversion_factor,
                ]);
                foreach ($prefix as $attribute) {
                    $variant->values()->create([
                        ...$attribute,
                    ]);
                }

                return;
            } else {
                $variant->update([
                    'format_variant'  => $item->format_variant,
                    'code'            => static::getSku($item, $prefix),
                    'item_code'       => $item->code,
                    'item_name'       => $item->name,
                    'category_id'     => $item->category_id,
                    'default_unit_id' => $item->default_unit_id,
                    'is_stock_item'   => $item->is_stock_item,
                    'type'            => $item->type,
                ]);
            }
            foreach ($prefix as $attribute) {
                $variant->values()->updateOrCreate([], [
                    ...$attribute,
                ]);
            }

            // $sku = $item->code . '-' . implode('-', \array_column($prefix, 'value'));
            return;
        }
        $currentAttributes = array_shift($attributes);
        foreach ($currentAttributes['values'] as $value) {
            $this->generateVariants(
                $variants,
                $item,
                $attributes,
                [
                    ...$prefix,
                    [
                        'attribute_id'   => $currentAttributes['attribute']['id'],
                        'attribute_name' => $currentAttributes['attribute']['name'],
                        'value'          => $value,
                    ],
                ],
            );
        }
    }

    public function updateBarcodes(?ItemVariant $variant, array $barcodes) {
        if (! $variant) {
            return;
        }

        $keptIds = [];

        $unitIds = \array_filter(\array_map(fn ($barcode) => $barcode['basic_unit']['id'] ?? null, $barcodes), fn ($barcode) => $barcode != null);

        $uomIds = $variant
            ->uoms()
            ->whereIn('unit_id', $unitIds)
            ->get()
            ->mapWithKeys(fn ($uom) => [$uom->unit_id => $uom->id]);
        $existingBarcodes = $variant->barcodes()->get();
        $existingById     = $existingBarcodes->keyBy('id');
        $existingByCode   = $existingBarcodes->keyBy('barcode');

        foreach ($barcodes as $barcode) {
            $unitId  = $barcode['basic_unit']['id'];
            $payload = [
                'barcode'      => $barcode['barcode'],
                'unit_id'      => $unitId,
                'item_unit_id' => $uomIds[$unitId] ?? null,
            ];

            if (! empty($barcode['id'])) {
                $barcodeModel = $existingById->get($barcode['id']);
                if ($barcodeModel) {
                    $barcodeModel->update($payload);
                    $keptIds[] = $barcodeModel->id;
                }

                continue;
            }

            $model = $existingByCode->get($barcode['barcode']);
            if ($model) {
                $model->update($payload);
            } else {
                $model = $variant->barcodes()->create($payload);
            }
            $keptIds[] = $model->id;
        }

        if (\count($keptIds)) {
            $variant->barcodes()->whereNotIn('id', $keptIds)->delete();
        } else {
            // kosongkan semua jika input kosong
            $variant->barcodes()->delete();
        }
    }
}
