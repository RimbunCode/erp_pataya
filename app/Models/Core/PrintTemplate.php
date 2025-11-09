<?php

namespace App\Models\Core;

use App\Casts\Json;
use App\Models\Model;
use App\Models\User\Permission;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class PrintTemplate extends Model {
  use HasUlids, DataTable, SoftDeletes;
  protected     $guarded       = ['id'];
  protected     $casts         = [
    'template'   => Json::class,
    'is_default' => 'boolean',
  ];
  protected     $appends       = ['title'];
  public string $keyBreadcrumb = "name";
  public string $translateKey  = "core.printTemplate";

  public function title(): Attribute {
    return new Attribute(
      get: function () {
        $model = $this->model;
        if ($model == null)

          return "";
        $modelInstance = new $model();

        return "{$modelInstance->translateKey}.title";
      }
    );
  }
  public $configColumns = [
    'name'       => [
      'show'   => true,
      'order'  => 0,
      'isLink' => true,
    ],
    'name_model' => [
      'show'  => true,
      'order' => 1,
    ],
    'is_default' => [
      'show'  => true,
      'order' => 2,
    ],
    'model'      => [
      'ignore' => true,
    ],
  ];

  public static function boot() {
    parent::boot();

    self::saved(function ($model) {
      if ($model->is_default) {
        PrintTemplate::where('model', $model->model)
          ->whereNot('id', $model->id)
          ->update(['is_default' => false]);
      } else {
        $counter = PrintTemplate::where('model', $model->model)
          ->whereNot('id', $model->id)
          ->count();

        if ($counter <= 0) {
          $model->is_default = true;
        }
      }

      $model->saveQuietly();
    });
  }

  protected static function loadRelationsOnShow() {
    return ['permission'];
  }

  public function permission() {
    return $this->belongsTo(Permission::class);
  }
}
