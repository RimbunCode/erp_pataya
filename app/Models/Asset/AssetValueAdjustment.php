<?php

namespace App\Models\Asset;

use App\Models\Core\Branch;
use App\Models\Core\GlPostingStatus;
use App\Models\Finances\Account;
use App\Models\Model;
use App\Services\Asset\AssetValueAdjustmentService;
use App\Traits\DataTable;
use App\Traits\Submitable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class AssetValueAdjustment extends Model {
    use DataTable, HasFactory, HasUlids, SoftDeletes, Submitable;

    protected static $service    = AssetValueAdjustmentService::class;
    public string $formComponent = 'Asset/ValueAdjustments/Form';
    public string $translateKey  = 'asset.valueAdjustment';
    protected $guarded           = ['id'];
    protected $casts             = [
        'date'                => 'date',
        'current_asset_value' => 'decimal:2',
        'new_asset_value'     => 'decimal:2',
    ];

    public static function templateLink() {
        return ':code';
    }

    protected array $configColumns = [
        'code' => [
            'show'   => true,
            'order'  => 0,
            'isLink' => true,
        ],
        'asset' => [
            'type'  => 'relation',
            'show'  => true,
            'order' => 1,
        ],
        'date' => [
            'show'  => true,
            'order' => 2,
        ],
        'new_asset_value' => [
            'show'  => true,
            'order' => 3,
        ],
        'status' => [
            'show'       => true,
            'order'      => 4,
            'valueTrans' => 'status',
        ],
    ];

    protected static function loadRelationsOnShow() {
        return [
            'asset',
            'differenceAccount',
            'branch',
        ];
    }

    public function asset(): BelongsTo {
        return $this->belongsTo(Asset::class);
    }

    public function differenceAccount(): BelongsTo {
        return $this->belongsTo(Account::class, 'difference_account_id');
    }

    public function branch(): BelongsTo {
        return $this->belongsTo(Branch::class);
    }

    public function glPostingStatus(): MorphOne {
        return $this->morphOne(GlPostingStatus::class, 'referenceable');
    }

    protected function differenceAmount(): Attribute {
        // ponytail: computed accessor, not physical column — avoids out-of-sync risk
        return Attribute::get(fn () => (float) $this->new_asset_value - (float) $this->current_asset_value);
    }
}
