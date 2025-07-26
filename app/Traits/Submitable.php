<?php

namespace App\Traits;

use App\Casts\FormStatusCast;
use App\Models\User\User;

trait Submitable {
  protected static bool $is_submitable = true;

  public function initializeSubmitable() {
    $this->mergeCasts([
      'status' => FormStatusCast::class
    ]);
  }
  public function createdBy() {
    return $this->belongsTo(User::class, 'created_by');
  }
}
