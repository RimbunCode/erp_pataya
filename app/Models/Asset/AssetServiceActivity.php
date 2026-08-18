<?php

namespace App\Models\Asset;

use App\Models\Model;
use App\Models\User\User;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class AssetServiceActivity extends Model {
    use HasFactory, HasUlids, SoftDeletes;

    public static $parentRelation = 'assetService';
    protected $guarded            = ['id'];
    protected $casts              = [
        'action_date' => 'datetime',
        'is_done'     => 'boolean',
    ];

    public function assetService(): BelongsTo {
        return $this->belongsTo(AssetService::class);
    }

    public function pic(): BelongsTo {
        return $this->belongsTo(User::class, 'pic_id');
    }
}
