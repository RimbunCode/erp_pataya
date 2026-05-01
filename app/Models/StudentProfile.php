<?php

namespace App\Models;

use App\Models\User\User;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StudentProfile extends Model {
    use HasUlids;

    protected $guarded = ['id'];
    protected $casts   = [
        'socials' => 'array',
    ];

    public function user(): BelongsTo {
        return $this->belongsTo(User::class);
    }
}