<?php

namespace App\Models\Inventory;

use App\Models\Model;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;

class Category extends Model {
    use DataTable, HasFactory, HasUlids, SoftDeletes;

    protected $guarded = ['id'];

    public static function templateLink() {
        return ':name';
    }

    public string $formComponent   = 'Inventory/Categories/Form';
    public string $translateKey    = 'inventory.category';
    protected array $configColumns = [
        'name' => [
            'isLink' => true,
            'show'   => true,
            'order'  => 0,
        ],
        'type' => [
            'show'       => true,
            'order'      => 1,
            'valueTrans' => 'inventory.category.types',
            'options'    => ['inventory', 'vehicle', 'service'],
            'linkable'   => true,
        ],
        'defaultUnit' => [
            'show'       => true,
            'order'      => 2,
            'valueTrans' => 'inventory.category.default_unit',
        ],
    ];

    protected static function loadRelationsOnShow() {
        return [
            'defaultUnit',
        ];
    }

    public function defaultUnit() {
        return $this->belongsTo(Unit::class, 'default_unit_id');
    }
}
