<?php

namespace App\Models\Asset\Maintenance;

use App\Models\Model;
use App\Models\User\User;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class MaintenanceTeamMember extends Model {
    use HasFactory, HasUlids, SoftDeletes;

    public static $parentRelation  = 'maintenanceTeam';
    protected $guarded             = ['id'];
    protected array $configColumns = [
        'user',
    ];

    public static function templateLink() {
        return ':user.name';
    }

    public function maintenanceTeam(): BelongsTo {
        return $this->belongsTo(AssetMaintenanceTeam::class, 'maintenance_team_id');
    }

    public function user(): BelongsTo {
        return $this->belongsTo(User::class);
    }
}
