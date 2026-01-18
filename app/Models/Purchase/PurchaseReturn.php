<?php

namespace App\Models\Purchase;

use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class PurchaseReturn extends Model
{
    use HasUlids, SoftDeletes;

    //

    protected $guarded = ['id'];

}
