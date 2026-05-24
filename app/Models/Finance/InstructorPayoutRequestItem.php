<?php

namespace App\Models\Finance;

use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class InstructorPayoutRequestItem extends Model {
    use HasUlids, SoftDeletes;

    protected $guarded = ['id'];
    protected $casts   = [
        'amount' => 'decimal:2',
    ];

    public function payoutRequest(): BelongsTo {
        return $this->belongsTo(InstructorPayoutRequest::class, 'payout_request_id');
    }

    public function earning(): BelongsTo {
        return $this->belongsTo(InstructorEarning::class, 'earning_id');
    }
}
