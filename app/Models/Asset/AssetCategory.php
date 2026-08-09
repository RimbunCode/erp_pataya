<?php

namespace App\Models\Asset;

use App\Models\Model;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class AssetCategory extends Model {
    use DataTable, HasFactory, HasUlids, SoftDeletes;

    protected $guarded = ['id'];
    protected $casts   = [
        'non_depreciable_category' => 'boolean',
        'enable_cwip_accounting'   => 'boolean',
        'is_rentable'              => 'boolean',
    ];
    public string $formComponent = 'Asset/Categories/Form';
    public string $translateKey  = 'asset.category';

    public static function templateLink() {
        return ':category_name';
    }

    protected array $configColumns = [
        'category_name' => [
            'isLink' => true,
            'show'   => true,
            'order'  => 0,
        ],
        'is_rentable' => [
            'show'  => true,
            'order' => 1,
        ],
        'non_depreciable_category' => [
            'show'  => true,
            'order' => 2,
        ],
    ];

    protected static function loadRelationsOnShow() {
        return [
            'accounts',
        ];
    }

    public function accounts(): HasMany {
        return $this->hasMany(AssetCategoryAccount::class);
    }
}
