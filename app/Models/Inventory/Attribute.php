<?php

namespace App\Models\Inventory;

use App\Casts\FormTable;
use App\Models\Model;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Casts\Attribute as CastsAttribute;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Arr;

class Attribute extends Model
{
    use DataTable, HasUlids, SoftDeletes;

    protected $guarded = ['id'];

    protected $casts = [
        'is_numeric' => 'boolean',
        'values' => FormTable::class,
    ];

    protected $appends = [
        'options',
    ];

    public function options(): CastsAttribute
    {
        return new CastsAttribute(
            get: function () {
                return Arr::join(
                    Arr::map((array) $this->values, fn ($value) => ($value['value'])),
                    ', '
                );
            }
        );
    }

    public static function templateLink()
    {
        return ':name';
    }

    public string $formComponent = 'Inventory/Attributes/Form';

    public string $translateKey = 'inventory.attribute';

    protected $configColumns = [
        'name' => [
            'isLink' => true,
            'show' => true,
            'order' => 1,
        ],
        'options' => [
            'show' => true,
            'order' => 2,
        ],
        'values' => [
            'ignore' => true,
        ],
    ];
}
