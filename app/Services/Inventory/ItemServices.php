<?php

namespace App\Services\Inventory;

use App\Models\Inventory\Item;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\ItemVariantAttribute;

class ItemServices {
  public function updateUom(Item $item, array $uoms) {
    foreach ($uoms as $uom) {
      if ($uom['isCustom'] ?? false) {
        $item->uom()->updateOrCreate([
          'unit_id' => $uom['id'],
        ], [
          'conversion_factor' => $uom['conversion_factor'],
        ]);
      }
    }
    foreach ($item->uom as $uom) {
      if (!in_array($uom->unit_id, array_column($uoms, 'id'))) {
        $uom->delete();
      }
    }
  }

  public function updateVariants(Item $item, string $formatVariants, array $variants) {
    if (isset($variants) && \count($variants) > 0) {
      if (isset($formatVariants)) {
        $attribute_map = array_column(array_column($variants, 'attribute'), 'id', 'name');
        $attribute_map['Item Code'] = 'item';

        // Ganti format menggunakan regex
        $formatVariants = preg_replace_callback('/\{([^}]+)\}/', function ($matches) use ($attribute_map) {
          $name = $matches[1];
          return isset($attribute_map[$name]) ? "@[$name]({$attribute_map[$name]})" : $matches[0];
        }, $formatVariants);
      }
      foreach ($variants as $variant) {
        $item->variants()->updateOrCreate([
          'attribute_id' => $variant['attribute']['id'],
        ], [
          'values' => $variant['values']
        ]);
      }
      $variantIds = array_column(
        array_column($variants, 'attribute'),
        'id'
      );
      foreach ($item->variants as $variant) {
        if (!\in_array(
          $variant->attribute_id,
          $variantIds
        )) {
          $variant->delete();
        }
      }
      $datavariants = ItemVariant::selectRaw("
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
      $this->generateVariants($datavariants, $item, $variants);
    } else {
      $item->variants()->delete();
      $itemVariant = ItemVariant::updateOrCreate([
        'item_id' => $item->id,
        'format_variant' => null,
      ], [
        'item_code' => $item->code,
      ]);
      return $itemVariant;
    }
  }

  private function generateVariants($variants, Item $item, array $attributes, array $prefix = []) {
    if (!$attributes) {
      $variant = $variants->where(function ($variant) use ($prefix) {
        if (\count($variant->values) != \count($prefix)) return false;
        foreach ($prefix as $attribute) {
          if (!\in_array($attribute['value'], $variant->values ?? [])) {
            return false;
          }
        }
        return true;
      })->first() ?? null;
      if (!$variant) {
        $variantId = ItemVariant::create([
          'item_id' => $item->id,
          'item_code' => $item->code,
          'format_variant' => $item->format_variant,
        ])->id;
        foreach ($prefix as $attribute) {
          ItemVariantAttribute::create([
            'item_variant_id' => $variantId,
            ...$attribute
          ]);
        }
        return;
      } else {
        $variantId = $variant->update([
          'format_variant' => $item->format_variant,
          'item_code' => $item->code,
        ]);
        $variantId = $variant->id;
      }
      foreach ($prefix as $attribute) {
        ItemVariantAttribute::updateOrCreate([
          'item_variant_id' => $variantId,
          'attribute_id' => $attribute['attribute_id'],
        ], [
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

  public function updateBarcodes(ItemVariant $variant, array $barcodes) {
    $variant->barcodes()->delete();
    foreach ($barcodes as $barcode) {
      $variant->barcodes()->create([
        'barcode' => $barcode['barcode'],
        'unit_id' => $barcode['unit']['id'],
      ]);
    }
  }
}
