<?php

namespace App\Models\Core;

use App\Casts\FormStatusCast;
use App\Casts\Json;
use App\Models\Model;
use App\Models\User\User;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class ApprovalInstanceStep extends Model {
  use HasUlids, SoftDeletes;
  protected     $guarded      = ['id'];
  protected     $casts        = [
    'status'   => FormStatusCast::class,
    'acted_at' => 'datetime',
    'config'   => Json::class,
  ];
  protected     $with         = ['approver', 'actedBy'];
  public string $translateKey = 'core.approvalScheme.steps';

  public function approvalInstance() {
    return $this->belongsTo(ApprovalInstance::class);
  }

  public function approver() {
    return $this->morphTo('approver', 'approverable_type', 'approverable_id');
  }

  public function actedBy() {
    return $this->belongsTo(User::class, 'acted_by_id');
  }
}
