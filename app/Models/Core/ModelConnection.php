<?php

namespace App\Models\Core;

use App\Models\Model;
use App\Utils;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class ModelConnection extends Model {
  use HasUlids, SoftDeletes;

  protected $guarded = [
    "id"
  ];

  protected static function booted() {
    static::creating(function ($model) {
      if (!isset($model->model_display)) {
        $modelDisplay = $model->getDisplayFromTemplateLink($model->model_type, $model->model_id);
        $model->setAttribute('model_display', $modelDisplay);
      }
      if (!isset($model->reference_display)) {
        $referenceDisplay = $model->getDisplayFromTemplateLink($model->reference_type, $model->reference_id);
        $model->setAttribute('reference_display', $referenceDisplay);
      }
    });
  }

  public function getDisplayFromTemplateLink(string $model_type, string $model_id) {
    $data = $model_type::find($model_id);

    if (isset($data->templateLink)) {
      return Utils::convertTemplateLink($data);
    } else {
      $keyBreadcrumb = $data->keyBreadcrumb ?? "name";
      return $data->$keyBreadcrumb ?? $data->name;
    }
  }

  public function scopeSearch(Builder $query, string $type, string $id) {
    $query
      ->selectRaw(
        "id, IF(`model_type` = ?, `reference_type`, `model_type`) as reference_type, IF(`model_type` = ?, `reference_id`, `model_id`) as reference_id, IF(`model_type` = ?, `reference_display`, `model_display`) as reference_display",
        [$type, $type, $type]
      );
    return $query->where(function (Builder $query) use ($type, $id): void {
      $query->where(function (Builder $query) use ($type, $id) {
        $query->where('model_type', $type);
        $query->where('model_id', $id);
      });
      $query->orWhere(function (Builder $query) use ($type, $id) {
        $query->where('reference_type', $type);
        $query->where('reference_id', $id);
      });
    });
  }

  public function model() {
    return $this->morphTo();
  }
  public function reference() {
    return $this->morphTo();
  }
}
