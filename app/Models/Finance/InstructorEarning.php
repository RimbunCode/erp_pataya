<?php

namespace App\Models\Finance;

use App\Models\Course;
use App\Models\Model;
use App\Models\Payment;
use App\Models\User\User;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class InstructorEarning extends Model {
    use HasUlids, SoftDeletes;

    protected $guarded = ['id'];
    protected $casts   = [
        'gross_amount'      => 'decimal:2',
        'company_amount'    => 'decimal:2',
        'instructor_amount' => 'decimal:2',
        'available_at'      => 'datetime',
        'released_at'       => 'datetime',
    ];

    public function instructor(): BelongsTo {
        return $this->belongsTo(User::class, 'instructor_id');
    }

    public function payment(): BelongsTo {
        return $this->belongsTo(Payment::class);
    }

    public function course(): BelongsTo {
        return $this->belongsTo(Course::class);
    }

    public function payoutItems(): HasMany {
        return $this->hasMany(InstructorPayoutRequestItem::class, 'earning_id');
    }
}
