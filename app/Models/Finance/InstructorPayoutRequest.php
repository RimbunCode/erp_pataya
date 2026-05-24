<?php

namespace App\Models\Finance;

use App\Models\Model;
use App\Models\User\User;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class InstructorPayoutRequest extends Model {
    use HasUlids, SoftDeletes;

    protected $guarded = ['id'];
    protected $casts   = [
        'requested_amount' => 'decimal:2',
        'approved_amount'  => 'decimal:2',
        'requested_at'     => 'datetime',
        'approved_at'      => 'datetime',
        'paid_at'          => 'datetime',
    ];

    public function instructor(): BelongsTo {
        return $this->belongsTo(User::class, 'instructor_id');
    }

    public function requestedBy(): BelongsTo {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function approvedBy(): BelongsTo {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function paidBy(): BelongsTo {
        return $this->belongsTo(User::class, 'paid_by');
    }

    public function items(): HasMany {
        return $this->hasMany(InstructorPayoutRequestItem::class, 'payout_request_id');
    }
}
