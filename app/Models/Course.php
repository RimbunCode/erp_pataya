<?php

namespace App\Models;

use App\Models\User\User;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Course extends Model {
    use HasUlids, SoftDeletes;

    protected $guarded = ['id'];
    protected $casts   = [
        'is_published' => 'boolean',
        'price'        => 'decimal:2',
    ];

    public function creator(): BelongsTo {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function categories(): BelongsToMany {
        return $this->belongsToMany(Category::class, 'course_category');
    }

    public function sections(): HasMany {
        return $this->hasMany(CourseSection::class)->orderBy('order');
    }

    public function notes(): HasMany {
        return $this->hasMany(CourseNote::class)->latest();
    }

    public function enrollments(): HasMany {
        return $this->hasMany(Enrollment::class);
    }

    public function payments(): HasMany {
        return $this->hasMany(Payment::class);
    }
}