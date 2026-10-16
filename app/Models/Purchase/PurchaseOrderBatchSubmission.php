<?php

namespace App\Models\Purchase;

use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;

class PurchaseOrderBatchSubmission extends Model {
    use HasUlids;

    protected $guarded = ['id'];
    protected $casts   = [
        'purchase_order_ids' => 'array',
    ];
}
