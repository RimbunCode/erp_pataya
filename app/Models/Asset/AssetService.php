<?php

namespace App\Models\Asset;

use App\Enums\AssetServiceType;
use App\Models\Asset\Maintenance\AssetMaintenanceTask;
use App\Models\Model;
use App\Services\Asset\AssetServiceService;
use App\Traits\DataTable;
use App\Traits\Submitable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class AssetService extends Model {
    use DataTable, HasFactory, HasUlids, SoftDeletes, Submitable;

    protected static $service    = AssetServiceService::class;
    public string $formComponent = 'Asset/Services/Form';
    public string $translateKey  = 'asset.service';
    protected $guarded           = ['id'];
    protected $casts             = [
        'type'                   => AssetServiceType::class,
        'failure_date'           => 'datetime',
        'completion_date'        => 'datetime',
        'capitalize_repair_cost' => 'boolean',
    ];
    protected array $configColumns = [
        'code' => [
            'show'   => true,
            'order'  => 0,
            'isLink' => true,
        ],
        'type' => [
            'show'       => true,
            'order'      => 1,
            'valueTrans' => 'service.type',
        ],
        'status' => [
            'show'       => true,
            'order'      => 2,
            'valueTrans' => 'status',
        ],
    ];

    protected static function loadRelationsOnShow() {
        return [
            'asset',
            'assetMaintenanceTask.assetMaintenance.asset',
            'activities.pic',
            'consumedItems.item',
            'branch',
        ];
    }

    public function asset(): BelongsTo {
        return $this->belongsTo(Asset::class);
    }

    public function assetMaintenanceTask(): BelongsTo {
        return $this->belongsTo(AssetMaintenanceTask::class);
    }

    public function activities(): HasMany {
        return $this->hasMany(AssetServiceActivity::class);
    }

    public function consumedItems(): HasMany {
        return $this->hasMany(AssetServiceConsumedItem::class);
    }

    /**
     * Asset terkait, diturunkan sesuai type: repair → asset_id langsung,
     * maintenance_task → via chain assetMaintenanceTask.assetMaintenance.asset.
     */
    public function resolvedAsset(): ?Asset {
        return $this->type === AssetServiceType::REPAIR
            ? $this->asset
            : $this->assetMaintenanceTask?->assetMaintenance?->asset;
    }

    public function isFullyChecked(): bool {
        return $this->activities()->count() > 0
            && $this->activities()->where('is_done', false)->doesntExist();
    }

    public function totalRepairCost(): float {
        return (float) $this->consumedItems()->sum('total_value');
    }
}
