<?php

namespace App\Models\Core;

use App\Models\Model;
use App\Models\User\User;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DeskUserPreference extends Model {
    use HasUlids;

    protected $guarded = ['id'];

    public static function templateLink() {
        return ':desk.name - :user.name';
    }

    protected function casts(): array {
        return [
            'is_hidden' => 'boolean',
        ];
    }

    public function desk(): BelongsTo {
        return $this->belongsTo(Desk::class);
    }

    public function user(): BelongsTo {
        return $this->belongsTo(User::class);
    }
}
