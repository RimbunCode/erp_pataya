<?php

namespace App\Models;

use App\Casts\FormStatusCast;
use App\Models\Core\File;
use App\Models\User\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class OrganizationInvitation extends Model {
    use HasUlids, SoftDeletes;

    /** @use HasFactory<\Database\Factories\OrganizationInvitationFactory> */
    use HasFactory;

    protected $guarded = ['id'];

    protected function casts(): array {
        return [
            'status'       => FormStatusCast::class,
            'reviewed_at'  => 'datetime',
            'submitted_at' => 'datetime',
            'expired_at'   => 'datetime',
            'password'     => 'hashed',
        ];
    }

    public function invitedBy(): BelongsTo {
        return $this->belongsTo(User::class, 'invited_by');
    }

    public function reviewedBy(): BelongsTo {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function user(): BelongsTo {
        return $this->belongsTo(User::class);
    }

    public function logoFile(): BelongsTo {
        return $this->belongsTo(File::class, 'logo_file_id');
    }

    /**
     * @param  Builder<self>  $query
     */
    public function scopePendingReview(Builder $query): void {
        $query->where('status', 'submitted');
    }

    /**
     * @param  Builder<self>  $query
     */
    public function scopeInvited(Builder $query): void {
        $query->where('status', 'invited');
    }

    /**
     * @param  Builder<self>  $query
     */
    public function scopeApproved(Builder $query): void {
        $query->where('status', 'approved');
    }

    public function isExpired(): bool {
        return $this->expired_at !== null && $this->expired_at->isPast();
    }

    public function isPendingReview(): bool {
        return $this->status->value === 'submitted';
    }

    public function isApproved(): bool {
        return $this->status->value === 'approved';
    }
}
