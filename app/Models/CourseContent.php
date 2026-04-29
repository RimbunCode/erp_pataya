<?php

namespace App\Models;

use App\Models\Core\File;
use App\Models\Core\Fileable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphToMany;

class CourseContent extends Model {
    use HasUlids;
    protected $guarded = ['id'];
    protected $casts   = [
        'is_optional' => 'boolean',
        'is_required' => 'boolean',
        'deadline'    => 'date',
    ];

    public function section(): BelongsTo {
        return $this->belongsTo(CourseSection::class, 'section_id');
    }

    public function files(): MorphToMany {
        return $this->morphToMany(File::class, 'fileable', 'fileables', 'fileable_id', 'file_id')
            ->using(Fileable::class)
            ->withTimestamps();
    }

    public function submissions(): HasMany {
        return $this->hasMany(Submission::class, 'content_id');
    }

    public function progress(): HasMany {
        return $this->hasMany(UserProgress::class, 'content_id');
    }
}