<?php

namespace App\Models;

use App\Models\User\User;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class CertificateTemplate extends Model {
    use HasUlids, SoftDeletes;

    protected $guarded = ['id'];
    protected $casts   = [
        'placeholders' => 'array',
        'is_active'    => 'boolean',
    ];

    public function course(): BelongsTo {
        return $this->belongsTo(Course::class);
    }

    public function creator(): BelongsTo {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function certificates(): HasMany {
        return $this->hasMany(Certificate::class);
    }

    public function getDocsEditUrlAttribute(): ?string {
        if (! $this->gdoc_template_id) {
            return null;
        }

        return "https://docs.google.com/document/d/{$this->gdoc_template_id}/edit";
    }

    public function isInternalTemplate(): bool {
        return $this->gdoc_template_id === null;
    }
}
