<?php

namespace App\Models\Core;

use App\Casts\Json;
use App\Models\Core\ApprovalScheme;
use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class ApprovalSchemeStep extends Model {
  use HasUlids, SoftDeletes;
  protected     $guarded      = ['id'];
  protected     $casts        = [
    'is_active' => 'boolean',
    'config'    => Json::class,
  ];
  public string $translateKey = 'core.approvalScheme.steps';

  public function approvalScheme() {
    return $this->belongsTo(ApprovalScheme::class);
  }

  public function approver() {
    return $this->morphTo('approver', 'approverable_type', 'approverable_id');
  }
}
