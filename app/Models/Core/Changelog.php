<?php

namespace App\Models\Core;

use App\Models\User\User;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Changelog extends Model {
    use HasUlids;

    public string $translateKey = 'core.changelog';
    protected $guarded          = ['id'];
    protected $casts            = [
        'deployed_at' => 'datetime',
    ];

    public function reads(): HasMany {
        return $this->hasMany(ChangelogRead::class);
    }

    public function readers(): BelongsToMany {
        return $this->belongsToMany(User::class, 'changelog_reads')->withPivot('read_at');
    }

    public function isReadBy(User $user): bool {
        return $this->reads()->where('user_id', $user->id)->exists();
    }
}
