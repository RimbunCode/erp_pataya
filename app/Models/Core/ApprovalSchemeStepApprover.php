<?php

namespace App\Models\Core;

use App\Casts\Json;
use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class ApprovalSchemeStepApprover extends Model {
    use HasUlids, SoftDeletes;

    protected $guarded = ['id'];
    protected $casts   = [
        'config' => Json::class,
    ];

    public function approvalSchemeStep() {
        return $this->belongsTo(ApprovalSchemeStep::class);
    }

    public function approver() {
        return $this->morphTo('approver', 'approverable_type', 'approverable_id');
    }
}
