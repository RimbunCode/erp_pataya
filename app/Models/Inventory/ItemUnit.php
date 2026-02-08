<?php

namespace App\Models\Inventory;

use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class ItemUnit extends Model
{
    use HasUlids, SoftDeletes;

    protected $guarded = ['id'];

    public string $translateKey = 'inventories.itemUnit';

    protected $configColumns = [
        'item',
        'unit',
    ];

    public function item()
    {
        return $this->belongsTo(Item::class);
    }

    public function unit()
    {
        return $this->belongsTo(Unit::class);
    }

    public static function getConversionFactor(string $itemId, string $unitId)
    {
        return self::select('conversion_factor')
            ->where('item_id', $itemId)
            ->where('unit_id', $unitId)
            ->first()?->conversion_factor;
    }
}
