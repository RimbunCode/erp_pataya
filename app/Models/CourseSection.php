<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class CourseSection extends Model {
    use HasUlids, SoftDeletes;
    //

    protected $guarded = ['id'];

    public function contents() {
        return $this->hasMany(CourseContent::class, 'section_id');
    }
}
