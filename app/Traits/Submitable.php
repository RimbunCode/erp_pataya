<?php

namespace App\Traits;

use App\Casts\FormStatusCast;
use App\FormStatus;
use App\Models\Core\Branch;
use App\Models\User\User;
use Illuminate\Support\Facades\Auth;

trait Submitable {
  use DataTable;
  protected static bool $is_submitable = true;

  public function initializeSubmitable() {
    $this->mergeCasts([
      'status'       => FormStatusCast::class,
      'submitted_at' => 'datetime',
    ]);
    $this->with = [
      ...$this->with ?? [],
      "createdBy",
    ];
  }

  public static function bootSubmitable() {
    self::creating(function ($model) {
      if (! ($model->isSubmitable() ?? false)) {
        return;
      }
      if ($model->status == null) {
        $model->status = FormStatus::DRAFT;
      }
      if ($model->created_by == null) {
        $model->created_by = Auth::id();
      }
    });
    self::saving(function ($model) {
      if (! ($model->isSubmitable() ?? false)) {
        return;
      }
      if ($model->status == FormStatus::SUBMITTED) {
        $model->submitted_at = now();
      }
    });
  }

  public function createdBy() {
    return $this->belongsTo(User::class, 'created_by');
  }

  public function branch() {
    return $this->belongsTo(Branch::class);
  }
}
