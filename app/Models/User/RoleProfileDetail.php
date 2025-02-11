<?php

namespace App\Models\User;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Relations\Pivot;

class RoleProfileDetail extends Pivot {
  use HasUlids;

  protected $guarded = ['id'];
}
