<?php

namespace App\Models\User;

use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class AdminUserPermission extends Model {
    use HasUlids, SoftDeletes;

    protected $guarded = ['id'];

    public function user(): BelongsTo {
        return $this->belongsTo(User::class);
    }

    public function permission(): BelongsTo {
        return $this->belongsTo(Permission::class);
    }
}
