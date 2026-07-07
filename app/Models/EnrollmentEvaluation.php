<?php

namespace App\Models;

use App\Models\User\User;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class EnrollmentEvaluation extends Model {
    use HasUlids, SoftDeletes;

    protected $guarded = ['id'];
    protected $casts   = [
        'final_score'  => 'decimal:2',
        'is_passed'    => 'boolean',
        'submitted_at' => 'datetime',
        'finalized_at' => 'datetime',
    ];

    public function enrollment(): BelongsTo {
        return $this->belongsTo(Enrollment::class);
    }

    public function submittedBy(): BelongsTo {
        return $this->belongsTo(User::class, 'submitted_by');
    }

    public function finalizedBy(): BelongsTo {
        return $this->belongsTo(User::class, 'finalized_by');
    }
}
