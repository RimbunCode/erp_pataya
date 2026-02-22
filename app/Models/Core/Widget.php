<?php

namespace App\Models\Core;

use App\Casts\Json;
use App\Models\Model;
use App\Models\User\Permission;
use App\Models\User\User;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class Widget extends Model {
  use HasUlids, SoftDeletes, DataTable;
  protected $guarded      = ['id'];
  public    $casts        = [
    'config' => Json::class,
  ];
  public    $translateKey = 'settings.widget';

  protected static function loadRelationsOnShow() {
    return ['dashboard', 'createdBy', 'permission',];
  }
  protected $configColumns = [
    'title'      => [
      'show'   => true,
      'order'  => 0,
      'isLink' => true,
    ],
    'type'       => [
      'show'  => true,
      'order' => 1,
    ],
    'permission' => [
      'show'  => true,
      'order' => 2,
    ],
    'created_by' => [
      'show'  => true,
      'order' => 3,
    ],
    'dashboard'  => [
      'show'  => true,
      'order' => 4,
    ],
    'created_at' => [
      'show'  => true,
      'order' => 5,
    ],
  ];

  public function dashboard() {
    return $this->belongsToMany(Dashboard::class, 'dashboard_widgets', 'widget_id', 'dashboard_id');
  }

  public function createdBy() {
    return $this->belongsTo(User::class, 'created_by');
  }

  public function permission() {
    return $this->belongsTo(Permission::class, 'model_id');
  }
}
