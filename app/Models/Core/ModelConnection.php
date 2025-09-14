<?php

namespace App\Models\Core;

use App\Models\Model;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class ModelConnection extends Model {
  use HasUlids, SoftDeletes;

  protected $guarded = [
    "id"
  ];

  public function scopeSearch(Builder $query, string $type, string $id) {
    $query
      ->selectRaw("IF(`model_type` = ?, `reference_type`, `model_type`) as reference_type, IF(`model_type` = ?, `reference_id`, `model_id`) as reference_id", [$type, $type]);
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
