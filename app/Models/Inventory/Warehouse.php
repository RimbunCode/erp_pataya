<?php

namespace App\Models\Inventory;

use App\Models\Core\Branch;
use App\Models\User\User;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Warehouse extends Model {
  use HasUlids, SoftDeletes, DataTable;

  protected $guarded = ['id'];

  public function branch() {
    return $this->belongsTo(Branch::class);
  }

  public function pic() {
    return $this->belongsTo(User::class, 'user_id');
  }
}
