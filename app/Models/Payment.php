<?php

namespace App\Models;

use App\Models\User\User;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Payment extends Model {
    use HasUlids, SoftDeletes;

    protected $guarded = ['id'];
    protected $casts   = [
        'amount'      => 'decimal:2',
        'paid_at'     => 'datetime',
        'verified_at' => 'datetime',
    ];

    public function user(): BelongsTo {
        return $this->belongsTo(User::class);
    }

    public function course(): BelongsTo {
        return $this->belongsTo(Course::class);
    }

    public function verifier(): BelongsTo {
        return $this->belongsTo(User::class, 'verified_by');
    }

    public function enrollment(): HasOne {
        return $this->hasOne(Enrollment::class);
    }
}
