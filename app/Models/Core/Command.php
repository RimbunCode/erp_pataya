<?php

namespace App\Models\Core;

use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class Command extends Model
{
    use HasUlids, SoftDeletes;

    //

    protected $guarded = ['id'];

}
