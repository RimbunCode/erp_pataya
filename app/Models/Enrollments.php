<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\User\User;

class Enrollment extends Model {
    use HasUlids;
    protected $guarded = ['id'];
    protected $casts   = [
        'enrolled_at' => 'datetime',
    ];

    public function user(): BelongsTo {
        return $this->belongsTo(User::class);
    }

    public function course(): BelongsTo {
        return $this->belongsTo(Course::class);
    }

    public function payment(): BelongsTo {
        return $this->belongsTo(Payment::class);
    }
}