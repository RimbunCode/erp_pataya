<?php

namespace App\Models\User;

use App\Casts\Json;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use App\Models\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class RolePermission extends Model {
  use HasUlids, SoftDeletes;

  protected $guarded = ['id'];
  protected $casts = [
    'permissions' => Json::class,
    'is_submittable' => 'boolean',
  ];

  public function role() {
    return $this->belongsTo(Role::class);
  }
}
