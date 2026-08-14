<?php

namespace App\Models\Asset;

use App\Enums\AssetMovementPurpose;
use App\Models\Core\Branch;
use App\Models\Model;
use App\Services\Asset\AssetMovementService;
use App\Traits\DataTable;
use App\Traits\Submitable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class AssetMovement extends Model {
    use DataTable, HasFactory, HasUlids, SoftDeletes, Submitable;

    protected static $service    = AssetMovementService::class;
    public string $formComponent = 'Asset/Movements/Form';
    public string $translateKey  = 'asset.movement';
    protected $guarded           = ['id'];
    protected $casts             = [
        'purpose'          => AssetMovementPurpose::class,
        'transaction_date' => 'date',
    ];
    protected array $configColumns = [
        'code' => [
            'show'   => true,
            'order'  => 0,
            'isLink' => true,
        ],
        'purpose' => [
            'show'       => true,
            'order'      => 1,
            'valueTrans' => 'movement.purpose',
        ],
        'transaction_date' => [
            'show'  => true,
            'order' => 2,
        ],
        'status' => [
            'show'       => true,
            'order'      => 3,
            'valueTrans' => 'status',
        ],
    ];

    protected static function loadRelationsOnShow() {
        return [
            'items.asset',
            'items.sourceLocation',
            'items.targetLocation',
            'items.fromCustodian',
            'items.toCustodian',
            'branch',
        ];
    }

    public function items(): HasMany {
        return $this->hasMany(AssetMovementItem::class);
    }

    public function branch(): BelongsTo {
        return $this->belongsTo(Branch::class);
    }
}
