<?php

namespace App\Models\Core;

use App\Casts\Json;
use App\Casts\LogContent;
use App\Models\User\User;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use App\Models\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Log extends Model {
  use HasUlids, SoftDeletes;

  protected $guarded = ['id'];
  protected $casts = [
    'activity' => LogContent::class,
  ];

  public function user() {
    return $this->belongsTo(User::class);
  }
  public function loggable() {
    return $this->morphTo();
  }
}
