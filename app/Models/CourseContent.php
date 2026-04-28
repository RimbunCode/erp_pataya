<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class CourseContent extends Model {
    use HasUlids, SoftDeletes;
    //

    protected $guarded = ['id'];

    public function files() {
        return $this->hasMany(CourseContentFile::class, 'content_id');
    }
}
