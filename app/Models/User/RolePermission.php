<?php

namespace App\Models\User;

use App\Casts\Json;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;

class RolePermission extends Model {
  use HasUlids;

  protected $guarded = ['id'];
  protected $casts = [
    'permissions' => Json::class,
  ];

  public function role() {
    return $this->belongsTo(Role::class);
  }
}
