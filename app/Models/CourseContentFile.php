<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class CourseContentFile extends Model {
    use HasUlids, SoftDeletes;

    //

    protected $guarded = ['id'];
}
