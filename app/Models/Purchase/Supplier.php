<?php

namespace App\Models\Purchase;

use App\Casts\FormTable;
use App\Models\Core\Country;
use App\Models\Model;
use App\Traits\DataTable;
use App\Traits\TreeView;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class Supplier extends Model
{
    use DataTable, HasUlids, SoftDeletes, TreeView;

    protected $guarded = ['id'];

    protected $casts = [
        'is_disabled' => 'boolean',
        'banks' => FormTable::class,
    ];

    protected $appends = [
        'address',
    ];

    public function getAddressAttribute()
    {
        return "{$this->street}, {$this->city}, {$this->province}, {$this->country->name} {$this->zip_code}";
    }

    public static function templateLink()
    {
        return ':name';
    }

    public function country()
    {
        return $this->belongsTo(Country::class, 'country_id', 'code');
    }

    public function branchOf()
    {
        return $this->belongsTo(Supplier::class, 'parent_id');
    }

    public function branches()
    {
        return $this->hasMany(Supplier::class, 'parent_id');
    }

    public string $formComponent = 'Purchase/Suppliers/Form';

    public string $translateKey = 'purchase.supplier';

    protected $configColumns = [
        'name' => [
            'isLink' => true,
            'show' => true,
            'order' => 0,
        ],
        'phone' => [
            'show' => true,
            'order' => 1,
        ],
        'email' => [
            'show' => true,
            'order' => 2,
        ],
        'address' => [
            'show' => true,
            'order' => 3,
        ],
        'country',
        'branchOf',
    ];
}
