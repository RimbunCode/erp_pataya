<?php

namespace App\Models;

use App\Models\User\User;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class CoursePublishRequest extends Model {
    use HasUlids, SoftDeletes;

    protected $guarded = ['id'];
    protected $casts   = [
        'reviewed_at'        => 'datetime',
        'submitted_price'    => 'decimal:2',
        'submitted_discount' => 'decimal:2',
    ];

    public function course(): BelongsTo {
        return $this->belongsTo(Course::class);
    }

    public function requester(): BelongsTo {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function reviewer(): BelongsTo {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
