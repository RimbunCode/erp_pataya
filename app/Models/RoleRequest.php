<?php

namespace App\Models;

use App\Models\Core\File;
use App\Models\User\User;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class RoleRequest extends Model {
    use HasUlids, SoftDeletes;

    protected $guarded = ['id'];
    protected $casts   = [
        'reviewed_at' => 'datetime',
    ];

    public function user(): BelongsTo {
        return $this->belongsTo(User::class);
    }

    public function reviewer(): BelongsTo {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function proofFile(): BelongsTo {
        return $this->belongsTo(File::class, 'proof_file_id');
    }
}
