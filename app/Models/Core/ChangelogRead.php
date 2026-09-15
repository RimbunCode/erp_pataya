<?php

namespace App\Models\Core;

use App\Models\User\User;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ChangelogRead extends Model {
    use HasUlids;

    protected $guarded = ['id'];
    protected $casts   = [
        'read_at' => 'datetime',
    ];

    public static function templateLink() {
        return ':changelog.version - :user.name';
    }

    public function changelog(): BelongsTo {
        return $this->belongsTo(Changelog::class);
    }

    public function user(): BelongsTo {
        return $this->belongsTo(User::class);
    }
}
