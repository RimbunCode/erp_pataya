<?php

namespace App\Models\Asset\Maintenance;

use App\Models\Core\Branch;
use App\Models\Model;
use App\Models\User\User;
use App\Services\Asset\Maintenance\AssetMaintenanceTeamService;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class AssetMaintenanceTeam extends Model {
    use DataTable, HasFactory, HasUlids, SoftDeletes;

    protected static $service      = AssetMaintenanceTeamService::class;
    public string $formComponent   = 'Asset/MaintenanceTeams/Form';
    public string $translateKey    = 'asset.maintenanceTeam';
    protected $guarded             = ['id'];
    protected array $configColumns = [
        'team_name' => [
            'show'   => true,
            'order'  => 0,
            'isLink' => true,
        ],
        'manager' => [
            'type'  => 'relation',
            'show'  => true,
            'order' => 1,
        ],
        'branch' => [
            'type'  => 'relation',
            'show'  => true,
            'order' => 2,
        ],
    ];

    protected static function loadRelationsOnShow() {
        return [
            'members.user',
            'manager',
            'branch',
        ];
    }

    public function members(): HasMany {
        return $this->hasMany(MaintenanceTeamMember::class, 'maintenance_team_id');
    }

    public function manager(): BelongsTo {
        return $this->belongsTo(User::class, 'manager_id');
    }

    public function branch(): BelongsTo {
        return $this->belongsTo(Branch::class);
    }
}
