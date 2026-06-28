<?php

namespace App\Models;

use App\Models\User\User;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Certificate extends Model {
    use HasUlids, SoftDeletes;

    protected $guarded = ['id'];
    protected $casts   = [
        'issued_at'  => 'datetime',
        'expires_at' => 'datetime',
    ];

    public function enrollment(): BelongsTo {
        return $this->belongsTo(Enrollment::class);
    }

    public function user(): BelongsTo {
        return $this->belongsTo(User::class);
    }

    public function course(): BelongsTo {
        return $this->belongsTo(Course::class);
    }

    public function template(): BelongsTo {
        return $this->belongsTo(CertificateTemplate::class, 'certificate_template_id');
    }

    public function getIsExpiredAttribute(): bool {
        return $this->expires_at && $this->expires_at->isPast();
    }

    public function getEffectiveStatusAttribute(): string {
        if ($this->status === 'revoked') return 'revoked';
        return $this->is_expired ? 'expired' : 'active';
    }
}
