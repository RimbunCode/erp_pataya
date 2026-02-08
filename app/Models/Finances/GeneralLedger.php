<?php

namespace App\Models\Finances;

use App\Models\Core\FormatingSeries;
use App\Models\Model;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class GeneralLedger extends Model {
  use HasUlids, SoftDeletes, DataTable;
  protected               $guarded            = ['id'];
  protected static string $defaultFormatCode  = 'GL-@[iiii]/@[yy]';
  protected static        $generateCodeSeries = true;

  public static function boot() {
    parent::boot();
    self::creating(function ($model) {
      $model->code = FormatingSeries::generate(GeneralLedger::class, $model->toArray());
    });
  }
}
