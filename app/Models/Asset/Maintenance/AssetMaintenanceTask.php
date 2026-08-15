<?php

namespace App\Models\Asset\Maintenance;

use App\Models\Asset\AssetService;
use App\Models\Model;
use App\Models\User\User;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class AssetMaintenanceTask extends Model {
    use HasFactory, HasUlids, SoftDeletes;

    public static $parentRelation = 'assetMaintenance';
    protected $guarded            = ['id'];
    protected $casts              = [
        'next_due_date'        => 'date',
        'last_completion_date' => 'date',
        'certificate_required' => 'boolean',
    ];

    public function assetMaintenance(): BelongsTo {
        return $this->belongsTo(AssetMaintenance::class);
    }

    public function assignTo(): BelongsTo {
        return $this->belongsTo(User::class, 'assign_to_id');
    }

    public function services(): HasMany {
        return $this->hasMany(AssetService::class, 'asset_maintenance_task_id');
    }

    public function periodicityInDays(): int {
        return (int) $this->periodicity;
    }
}
