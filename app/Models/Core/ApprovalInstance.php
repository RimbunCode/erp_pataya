<?php

namespace App\Models\Core;

use App\Casts\FormStatusCast;
use App\Casts\Json;
use App\FormStatus;
use App\Models\Core\ApprovalScheme;
use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\DB;

class ApprovalInstance extends Model {
  use HasUlids, SoftDeletes;
  protected     $guarded      = ['id'];
  protected     $casts        = [
    'status'  => FormStatusCast::class,
    'options' => Json::class,
  ];
  protected     $with         = ['steps'];
  public string $translateKey = 'core.approvalScheme';

  public function approvalScheme() {
    return $this->belongsTo(ApprovalScheme::class);
  }

  public function document() {
    return $this->morphTo('document', 'document_type', 'document_id');
  }

  public function steps() {
    return $this->hasMany(ApprovalInstanceStep::class, 'approval_instance_id');
  }

  public static function makeInstance(Model $data, array $options = []) {
    DB::beginTransaction();
    $model  = \get_class($data);
    $scheme = ApprovalScheme::where('model', $model)
      ->where('is_active', true)
      ->first();

    if (! $scheme) {
      return null;
    }
    $steps    = $scheme->steps;
    $instance = static::firstOrCreate([
      'approval_scheme_id' => $scheme->id,
      'document_type'      => $model,
      'document_id'        => $data->id,
    ], [
      'options' => $options,
      'status'  => $steps->count() > 0 ? FormStatus::PENDING : FormStatus::APPROVED,
    ]);

    foreach ($steps as $step) {
      $instance->steps()->create([
        'sequence'          => $step->sequence,
        'approver_type'     => $step->approver_type,
        'approverable_type' => $step->approverable_type,
        'approverable_id'   => $step->approverable_id,
      ]);
    }
    DB::commit();

    return $instance;
  }
}
