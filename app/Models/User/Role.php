<?php

namespace App\Models\User;

use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use App\Models\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Role extends Model {
  use HasUlids, SoftDeletes, DataTable;
  protected $guarded = ['id'];

  protected $casts = [
    'is_disabled' => 'boolean'
  ];

  public function users() {
    return $this->belongsToMany(User::class, 'user_roles', 'role_id', 'user_id');
  }
  public function rules() {
    return $this->hasMany(RolePermission::class);
  }
}
