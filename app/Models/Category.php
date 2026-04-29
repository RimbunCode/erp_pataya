<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Category extends Model {
    use HasUlids;

    protected $guarded = ['id'];

    public function courses(): BelongsToMany {
        return $this->belongsToMany(Course::class, 'course_category');
    }
}