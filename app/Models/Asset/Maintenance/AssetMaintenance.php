<?php

namespace App\Models\Asset\Maintenance;

use App\Models\Asset\Asset;
use App\Models\Model;
use App\Services\Asset\Maintenance\AssetMaintenanceService;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class AssetMaintenance extends Model {
    use DataTable, HasFactory, HasUlids, SoftDeletes;

    protected static $service    = AssetMaintenanceService::class;
    public string $formComponent = 'Asset/Maintenances/Show';
    public string $translateKey  = 'asset.maintenance';
    protected $guarded           = ['id'];

    public static function templateLink() {
        return ':asset';
    }

    protected array $configColumns = [
        'asset' => [
            'type'   => 'relation',
            'show'   => true,
            'order'  => 0,
            'isLink' => true,
        ],
        'maintenanceTeam' => [
            'type'  => 'relation',
            'show'  => true,
            'order' => 1,
        ],
    ];

    protected static function loadRelationsOnShow() {
        return [
            'asset',
            'maintenanceTeam',
            'tasks.assignTo',
            'tasks.services',
        ];
    }

    public function asset(): BelongsTo {
        return $this->belongsTo(Asset::class);
    }

    public function maintenanceTeam(): BelongsTo {
        return $this->belongsTo(AssetMaintenanceTeam::class);
    }

    public function tasks(): HasMany {
        return $this->hasMany(AssetMaintenanceTask::class);
    }
}
