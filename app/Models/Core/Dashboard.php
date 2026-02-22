<?php

namespace App\Models\Core;

use App\Models\Model;
use App\Models\User\User;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class Dashboard extends Model {
  use HasUlids, SoftDeletes;
  //

  protected $guarded = ['id'];

  public function widgets() {
    return $this->belongsToMany(Widget::class, 'dashboard_widgets', 'dashboard_id', 'widget_id');
  }

  public function createdBy() {
    return $this->belongsTo(User::class, 'created_by');
  }
}
