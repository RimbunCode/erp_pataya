<?php

namespace App\Models\Purchase;

use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class PurchaseReturnItem extends Model
{
    use HasUlids, SoftDeletes;

    //

    protected $guarded = ['id'];

}
