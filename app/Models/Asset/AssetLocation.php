<?php

namespace App\Models\Asset;

use App\Models\Core\Branch;
use App\Models\Model;
use App\Traits\DataTable;
use App\Traits\HasBranch;
use App\Traits\TreeView;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class AssetLocation extends Model {
    use DataTable, HasBranch, HasFactory, HasUlids, SoftDeletes, TreeView;

    protected $guarded = ['id'];
    protected $casts   = [
        'is_group' => 'boolean',
    ];
    public string $formComponent = 'Asset/Locations/Form';
    public string $translateKey  = 'asset.location';

    public static function templateLink() {
        return ':location_name';
    }

    protected array $configColumns = [
        'location_name' => [
            'isLink' => true,
            'show'   => true,
            'order'  => 0,
        ],
        'is_group' => [
            'show'  => true,
            'order' => 1,
        ],
        'branch' => [
            'show'  => true,
            'order' => 2,
        ],
    ];

    protected static function loadRelationsOnShow() {
        return [
            'parent',
            'branch',
        ];
    }

    public function parent(): BelongsTo {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function branch(): BelongsTo {
        return $this->belongsTo(Branch::class);
    }

    protected static function boot(): void {
        // Registered BEFORE parent::boot() so it runs BEFORE TreeView's deleting handler
        // (TreeView returns false for soft-deletes, which would block this guard)
        static::deleting(function (self $location) {
            // ponytail: subtree Asset check via single query — add per-location caching if N+1
            $descendantIds = static::query()
                ->where('lft', '>=', $location->lft)
                ->where('rgt', '<=', $location->rgt)
                ->pluck('id');

            $exists = Asset::query()
                ->whereIn('asset_location_id', $descendantIds)
                ->exists();

            if ($exists) {
                throw new \LogicException(
                    __('asset/asset.location.cannot_delete_has_assets'),
                );
            }
        });

        parent::boot();
    }
}
