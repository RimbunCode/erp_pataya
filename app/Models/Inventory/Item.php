<?php

namespace App\Models\Inventory;

use App\Models\Core\File;
use App\Models\Model;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class Item extends Model {
    use DataTable, HasUlids, SoftDeletes;

    protected $guarded = ['id'];
    protected $casts   = [
        'is_disabled'            => 'boolean',
        'allow_alternative_item' => 'boolean',
        'is_stock_item'          => 'boolean',
        'conversion_factor'      => 'float',
    ];

    public static function templateLink() {
        return '<title>:code - :name</title><b>:code</b><br/><span>:name</span>';
    }

    protected static function loadRelationsOnShow() {
        return [
            'attributes',
            'category',
            'defaultUnit',
            // 'uom',
            'uoms',
            // 'variants',
            'barcodes',
        ];
    }

    public string $formComponent   = 'Inventory/Items/Form';
    public string $translateKey    = 'inventory.item';
    protected array $configColumns = [
        'image' => [
            'show'  => true,
            'order' => 0,
            'type'  => 'image',
            'width' => 'fit',
        ],
        'code' => [
            'show'   => true,
            'order'  => 0,
            'isLink' => true,
        ],
        'name' => [
            'show'  => true,
            'order' => 1,
        ],
        'category' => [
            'type'  => 'relation',
            'show'  => true,
            'order' => 2,
        ],
        'conversion_factor' => [
            'hidden'   => true,
            'linkable' => true,
        ],
        'defaultUnit',
        'imageFile',
        'defaultUom' => [
            'ignore' => true,
        ],
    ];

    public function attributes() {
        return $this->hasMany(ItemAttribute::class)->with(['attribute']);
    }

    public function imageFile() {
        return $this->belongsTo(File::class, 'image');
    }

    public function defaultUnit() {
        return $this->belongsTo(Unit::class, 'default_unit_id');
    }

    public function defaultUom() {
        $itemUnitTable = (new ItemUnit)->getTable();
        $itemTable     = $this->getTable();

        return $this->hasOne(ItemUnit::class, 'item_id', 'id')
            ->join("{$itemTable} as default_uom_items", 'default_uom_items.id', '=', "{$itemUnitTable}.item_id")
            ->whereColumn("{$itemUnitTable}.unit_id", 'default_uom_items.default_unit_id')
            ->select("{$itemUnitTable}.*");
    }

    public function uom() {
        return $this->hasMany(ItemUnit::class, 'item_id', 'id')->with(['unit']);
    }

    protected function barcodes() {
        $variant = $this->variants
            ->whereNull('format_variant')
            ->first();
        if ($variant) {
            return $variant->barcodes()->get();
        }
    }

    public function uoms() {
        $uoms = $this->uom()
            ->orderBy('order', 'asc')
            ->get()
            ->filter(fn (ItemUnit $itemUom) => $itemUom->unit !== null)
            ->map(function (ItemUnit $itemUom) {
                $isManual               = $itemUom->is_manual;
                $generatedByDefaultUnit = $itemUom->generated_by_default_unit === true;
                $readOnly               = $generatedByDefaultUnit || ($isManual !== null ? $isManual === false : false);
                $conversionFactor       = $itemUom->conversion_factor;

                return [
                    ...$itemUom->unit->toArray(),
                    'conversion_factor'      => $conversionFactor,
                    'isCustom'               => $conversionFactor === null,
                    'isManual'               => $isManual === true,
                    'generatedByDefaultUnit' => $generatedByDefaultUnit,
                    'readOnly'               => $readOnly,
                ];
            })
            ->values();

        if (! $this->default_unit_id || $uoms->contains(fn ($uom) => ($uom['id'] ?? null) === $this->default_unit_id)) {
            return $uoms;
        }

        $defaultUnit = $this->defaultUnit;
        if (! $defaultUnit) {
            return $uoms;
        }

        $defaultConversionFactor = $this->conversion_factor ?? $defaultUnit->conversion_factor;

        return $uoms
            ->prepend([
                ...$defaultUnit->toArray(),
                'conversion_factor'      => $defaultConversionFactor,
                'isCustom'               => $defaultConversionFactor === null,
                'isManual'               => false,
                'generatedByDefaultUnit' => true,
                'readOnly'               => true,
            ])
            ->values();
    }

    public function category() {
        return $this->belongsTo(Category::class);
    }

    public function variants() {
        return $this->hasMany(ItemVariant::class, 'item_id', 'id');
    }
}
