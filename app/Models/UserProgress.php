<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class UserProgress extends Model {
    use HasUlids, SoftDeletes;

    //

    protected $guarded = ['id'];
}
