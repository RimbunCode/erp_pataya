<?php

namespace App\Models\Core;

use App\Casts\Json;
use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class ApprovalSchemeStep extends Model {
    use HasUlids, SoftDeletes;

    protected $guarded = ['id'];
    protected $casts   = [
        'is_active'   => 'boolean',
        'is_advanced' => 'boolean',
        'config'      => Json::class,
    ];
    public string $translateKey = 'core.approvalScheme.steps';

    public function approvalScheme() {
        return $this->belongsTo(ApprovalScheme::class);
    }

    public function approver() {
        return $this->morphTo('approver', 'approverable_type', 'approverable_id');
    }

    public function approvers() {
        return $this->hasMany(ApprovalSchemeStepApprover::class, 'approval_scheme_step_id');
    }
}
