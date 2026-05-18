<?php

namespace App\Models\Inventory;

use App\Models\Model;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class ItemUnit extends Model {
    use HasUlids, SoftDeletes;

    protected $guarded = ['id'];
    protected $casts   = [
        'is_default'                => 'boolean',
        'is_manual'                 => 'boolean',
        'generated_by_default_unit' => 'boolean',
    ];
    public string $translateKey    = 'inventories.itemUnit';
    protected array $configColumns = [
        'item',
        'unit',
        'is_default' => [
            'ignore' => true,
        ],
        'is_manual' => [
            'ignore' => true,
        ],
        'generated_by_default_unit' => [
            'ignore' => true,
        ],
    ];

    protected static function booted(): void {
        static::addGlobalScope('join_units', function (Builder $builder): void {
            $table = $builder->getModel()->getTable();

            $builder
                ->join('units', 'units.id', '=', "{$table}.unit_id")
                ->addSelect("{$table}.*")
                ->addSelect('units.name')
                ->addSelect('units.code');
        });
    }

    public static function templateLink() {
        return ':name (:code)';
    }

    public function item() {
        return $this->belongsTo(Item::class);
    }

    public function unit() {
        return $this->belongsTo(Unit::class);
    }

    public static function getConversionFactor(string $itemId, string $unitId) {
        $table = (new self)->getTable();

        return self::select("{$table}.conversion_factor")
            ->where("{$table}.item_id", $itemId)
            ->where("{$table}.unit_id", $unitId)
            ->first()?->conversion_factor;
    }
}
