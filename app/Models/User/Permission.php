<?php

namespace App\Models\User;

use App\Casts\Json;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use App\Models\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Permission extends Model {
  use HasUlids, SoftDeletes;

  protected $guarded = ['id'];
  protected $casts = [
    'permissions' => Json::class,
    'is_submitable' => 'boolean',
  ];
  protected $appends = ['translateKey'];
  public static function templateLink() {
    return "<title>:name</title><b>:name</b><br/><span>:module</span>";
  }
  protected function getTranslateKeyAttribute() {
    $model = $this->model;
    $instance = new $model();
    return $instance->translateKey;
  }
}
