<?php

namespace App\Models\Sales;

use App\Models\Core\Branch;
use App\Models\Model;
use App\Traits\DataTable;
use App\Traits\Submitable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class InternalOrder extends Model
{
    use DataTable, HasUlids, SoftDeletes, Submitable;

    protected $guarded = ['id'];

    protected $casts = [
        'date' => 'datetime',
    ];

    protected static string $defaultFormatCode = '@[branch_code]/IO-@[iiii]/@[yy]';

    public static function templateLink()
    {
        return ':code';
    }

    public function codeRelations()
    {
        return [
            'branch_code:branch.code',
            'branch_name:branch.name',
        ];
    }

    public $keyBreadcrumb = 'code';

    public function branch()
    {
        return $this->belongsTo(Branch::class);
    }

    public function items()
    {
        return $this->hasMany(InternalOrderItem::class);
    }

    public string $translateKey = 'sales.internalOrder';

    protected $configColumns = [
        'code' => [
            'isLink' => true,
            'show' => true,
            'order' => 0,
        ],
        'date' => [
            'show' => true,
            'order' => 1,
        ],
        'status' => [
            'show' => true,
            'order' => 2,
        ],
        'branch' => [
            'ignore' => true,
        ],
    ];
}
