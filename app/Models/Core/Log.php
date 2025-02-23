<?php

namespace App\Models\Core;

use App\Casts\Json;
use App\Models\User\User;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Log extends Model {
  use HasUlids, SoftDeletes;

  protected $guarded = ['id'];
  // protected $casts = [
  //   'activity' => Json::class,
  // ];

  public function user() {
    return $this->belongsTo(User::class);
  }
  public function loggable() {
    return $this->morphTo();
  }
}
