<?php

namespace App\Services\Inventory;

use App\Models\Inventory\Item;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\ItemVariantAttribute;
use App\Models\Inventory\Unit;

class ItemServices {
  /**
   * Summary of getSku
   * @param \App\Models\Inventory\ItemVariant|\App\Models\Inventory\Item $item
   */
  public static function getSku(mixed $item, array|null $attributes = null) {

    if ($item->format_variant === null || $item->format_variant === '') {
      return $item->item_code;
    }
    $attributesValues = $item instanceof Item ? $attributes : $item->values->toArray();
    $data = array_combine(array_column($attributesValues, 'attribute_id'), array_column($attributesValues, 'value'));
    $data['item'] = $item instanceof Item ? $item->code : ($item->item_code ?? $item->item->code);
    $result = preg_replace_callback('/@\[(.*?)\]\((.*?)\)/', function ($matches) use ($data) {
      $key = $matches[1];
      $id = $matches[2];
      return $data[$key] ?? ($data[$id] ?? $matches[0]);
    }, $item->format_variant ?? $item->item->format_variant);
    return $result;
  }
  public function updateUom(Item $item, array $uoms) {
    foreach ($uoms as $uom) {
      Unit::find($uom['id'])->updateHaveTransactions();
      $item->uom()->updateOrCreate([
        'unit_id' => $uom['id'],
      ], [
        'conversion_factor' => $uom['conversion_factor'],
      ]);
    }
    foreach ($item->uom as $uom) {
      if (!in_array($uom->unit_id, array_column($uoms, 'id'))) {
        $uom->delete();
      }
    }
  }

  public function updateVariants(Item $item, string $formatVariants, array $attributes) {
    if (isset($attributes) && \count($attributes) > 0) {
      if (isset($formatVariants)) {
        $attribute_map = array_column(array_column($attributes, 'attribute'), 'id', 'name');
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
          'values' => $attribute['values']
        ]);
      }
      $attributeIds = array_column(
        array_column($attributes, 'attribute'),
        'id'
      );
      foreach ($item->attributes as $attribute) {
        if (!\in_array(
          $attribute->attribute_id,
          $attributeIds
        )) {
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
          'values' => 'array'
        ])
        ->get();
      $this->generateVariants($dataVariants, $item, $attributes);
    } else {
      $item->attributes()->delete();
      $itemVariant = ItemVariant::updateOrCreate([
        'item_id' => $item->id,
        'format_variant' => null,
      ], [
        'code' => $item->code,
        'item_code' => $item->code,
        'item_name' => $item->name,
        'category_id' => $item->category_id,
        'default_unit_id' => $item->default_unit_id,
        'is_stock_item' => $item->is_stock_item,
        'conversion_factor' => $item->conversion_factor,
      ]);
      return $itemVariant;
    }
  }

  private function generateVariants($variants, Item $item, array $attributes, array $prefix = []) {
    if (!$attributes) {
      $variant = $variants->where(function ($variant) use ($prefix) {
        if (\count($variant->values ?? []) != \count($prefix)) return false;
        foreach ($prefix as $attribute) {
          if (!\in_array($attribute['value'], $variant->values ?? [])) {
            return false;
          }
        }
        return true;
      })->first() ?? null;
      if (!$variant) {
        $variant = ItemVariant::create([
          'item_id' => $item->id,
          'code' => static::getSku($item, $prefix),
          'item_code' => $item->code,
          'item_name' => $item->name,
          'format_variant' => $item->format_variant,
          'category_id' => $item->category_id,
          'default_unit_id' => $item->default_unit_id,
          'is_stock_item' => $item->is_stock_item,
          'conversion_factor' => $item->conversion_factor,
        ]);
        foreach ($prefix as $attribute) {
          $variant->values()->create([
            ...$attribute
          ]);
        }
        return;
      } else {
        $variant = $variant->update([
          'format_variant' => $item->format_variant,
          'code' => static::getSku($item, $prefix),
          'item_code' => $item->code,
          'item_name' => $item->name,
          'category_id' => $item->category_id,
          'default_unit_id' => $item->default_unit_id,
          'is_stock_item' => $item->is_stock_item,
        ]);
      }
      foreach ($prefix as $attribute) {
        $variant->values()->updateOrCreate([], [
          ...$attribute
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
            'attribute_id' => $currentAttributes['attribute']['id'],
            'attribute_name' => $currentAttributes['attribute']['name'],
            'value' => $value
          ]
        ]
      );
    }
  }

  public function updateBarcodes(ItemVariant|null $variant, array $barcodes) {
    if (!$variant) return;
    $variant->barcodes()->delete();
    foreach ($barcodes as $barcode) {
      $variant->barcodes()->create([
        'barcode' => $barcode['barcode'],
        'unit_id' => $barcode['unit']['id'],
      ]);
    }
  }
}
