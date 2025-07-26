<?php

namespace App\Models\Core;

use App\Casts\Json;
use App\Models\Model;
use App\Traits\DataTable;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Support\Facades\Session;
use Illuminate\Support\Str;

class FormatingSeries extends Model {
  use DataTable, HasUlids;
  protected $table = 'formating_series';
  protected $guarded = ["id"];
  protected $casts = [
    'logs' => Json::class
  ];
  public function getListOfCodeFormats() {
    $now = Carbon::now()->addMonths(-3);
    $currentBranchId = Session::get('currentBranch');
    $branch = Branch::find($currentBranchId)->first();
    $codeFormats = [
      [
        'id' => 'yyyy',
        'display' => "Year ({$now->translatedFormat('Y')})",
      ],
      [
        'id' => 'yy',
        'display' => "Year ({$now->translatedFormat('y')})",
      ],
      [
        'id' => 'mmmm',
        'display' => "Month ({$now->translatedFormat('F')})",
      ],
      [
        'id' => 'mmm',
        'display' => "Month ({$now->translatedFormat('M')})",
      ],
      [
        'id' => 'mm',
        'display' => "Month ({$now->translatedFormat('m')})",
      ],
      [
        'id' => 'branch',
        'display' => "Branch ({$branch->name})",
      ]
    ];
    $model = $this->model;
    with(new $model, function ($objectModel) use (&$codeFormats) {
      if (method_exists($objectModel, 'codeRelations')) {
        $codeRelations = $objectModel->codeRelations() ?? [];
        foreach ($codeRelations as $codeRelation) {
          $relation = \explode(":", $codeRelation)[0];
          $codeFormats[] = [
            'id' => $relation,
            'display' => Str::headline($relation),
          ];
        }
      }
    });

    return $codeFormats;
  }
}
