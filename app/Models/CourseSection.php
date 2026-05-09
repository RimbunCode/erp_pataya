<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CourseSection extends Model {
    use HasUlids;

    protected $guarded = ['id'];

    public function course(): BelongsTo {
        return $this->belongsTo(Course::class);
    }

    public function contents(): HasMany {
        return $this->hasMany(CourseContent::class, 'section_id')->orderBy('order');
    }

    public function notes() {
        return $this->hasMany(CourseNote::class, 'section_id');
    }
}