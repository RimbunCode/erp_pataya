<?php

namespace App\Models;

use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class Course extends Model {
    use HasUlids, SoftDeletes;
    protected $guarded = ['id'];

    public function sections() {
        return $this->hasMany(CourseSection::class);
    }

    public function categories() {
        return $this->belongsToMany(Category::class, 'course_category');
    }

    public function enrollments() {
        return $this->hasMany(Enrollment::class);
    }
}
