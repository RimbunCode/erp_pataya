<?php

namespace App\Models\Inventory;

use App\Models\Model;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class Unit extends Model
{
    use DataTable, HasUlids, SoftDeletes;

    protected $guarded = ['id'];

    protected $casts = [
        'is_default' => 'boolean',
    ];

    public static function templateLink()
    {
        return ':name (:code)';
    }

    public string $formComponent = 'Inventory/Units/Form';

    public string $translateKey = 'inventory.unit';

    protected $configColumns = [
        'code' => [
            'isLink' => true,
            'show' => true,
            'order' => 0,
        ],
        'name' => [
            'isLink' => true,
            'show' => true,
            'order' => 1,
        ],
        'group' => [
            'show' => true,
            'order' => 2,
        ],
    ];

    public function canDelete()
    {
        return ! $this->is_default;
    }
}
