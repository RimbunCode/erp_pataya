<?php

namespace App\Models\User;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Relations\Pivot;
use Illuminate\Database\Eloquent\SoftDeletes;

class UserBranch extends Pivot
{
    // use HasUlids, SoftDeletes;
    // protected $guarded = ['id'];
    // protected $table = 'user_branch';
}
