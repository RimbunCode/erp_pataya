<?php

namespace App\Models;

use App\Models\Core\File;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphToMany;

class CourseContent extends Model {
    use HasUlids;

    protected $guarded = ['id'];
    protected $casts   = [
        'is_optional' => 'boolean',
        'is_required' => 'boolean',
        'deadline'    => 'datetime',
    ];

    public function section(): BelongsTo {
        return $this->belongsTo(CourseSection::class, 'section_id');
    }

    public function files(): MorphToMany {
        return $this->morphToMany(File::class, 'fileable')
            ->whereNull('fileables.deleted_at');
    }

    public function submissions(): HasMany {
        return $this->hasMany(Submission::class, 'content_id');
    }

    public function progress(): HasMany {
        return $this->hasMany(UserProgress::class, 'content_id');
    }

    public function isSubmissionType(): bool {
        return in_array($this->type, ['pre_assessment', 'assignment'], true);
    }

    public function deadlineLabel(): ?string {
        return $this->deadline?->format('d M Y, H:i T');
    }

    public function hasDeadlinePassed(?CarbonInterface $at = null): bool {
        if (! $this->deadline) {
            return false;
        }

        return $this->deadline->lte($at ?? now());
    }
}
