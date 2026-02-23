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
  protected $table   = 'formating_series';
  protected $guarded = ["id"];
  protected $casts   = [
    'logs' => Json::class,
  ];

  public function getListOfCodeFormats() {
    $now             = Carbon::now()->addMonths(-3);
    $currentBranchId = Session::get('currentBranch');
    $branch          = Branch::find($currentBranchId)->first();
    $codeFormats     = [
      [
        'id'      => 'yyyy',
        'display' => "Year ({$now->translatedFormat('Y')})",
      ],
      [
        'id'      => 'yy',
        'display' => "Year ({$now->translatedFormat('y')})",
      ],
      [
        'id'      => 'mmmm',
        'display' => "Month ({$now->translatedFormat('F')})",
      ],
      [
        'id'      => 'mmm',
        'display' => "Month ({$now->translatedFormat('M')})",
      ],
      [
        'id'      => 'mm',
        'display' => "Month ({$now->translatedFormat('m')})",
      ],
      [
        'id'      => 'branch',
        'display' => "Branch ({$branch->name})",
      ],
    ];
    $model           = $this->model;
    with(new $model, function ($objectModel) use (&$codeFormats) {
      if (method_exists($objectModel, 'codeRelations')) {
        $codeRelations = $objectModel->codeRelations() ?? [];
        foreach ($codeRelations as $codeRelation) {
          $relation      = \explode(":", $codeRelation)[0];
          $codeFormats[] = [
            'id'      => $relation,
            'display' => Str::headline($relation),
          ];
        }
      }
    });

    return $codeFormats;
  }
  protected     $configColumns = [
    'name'   => [
      'isLink' => true,
      'show'   => true,
      'order'  => 0,
    ],
    'format' => [
      'show'  => true,
      'order' => 1,
    ],
  ];
  public string $translateKey  = "core.formatingSeries";

  private static function getCodeRelations(string $model) {
    $objectModel   = new $model;
    $codeRelations = collect(
      \method_exists($objectModel, 'codeRelations') ?
      $objectModel->codeRelations() : []
    )->mapWithKeys(function ($value) {
      preg_replace_callback('/^([^:]+):([^\.]+)\.([^\.]+)$/', function ($matches) use (&$code, &$relation, &$key) {
        $code     = $matches[1];
        $relation = $matches[2];
        $key      = $matches[3];
      }, $value);
      return [
        $code => [
          'relation' => $relation,
          'key'      => $key,
        ],
      ];
    })->toArray();
    return $codeRelations;
  }

  public static function generateKeyLogsForInit(string $model, string $format) {
    $codeRelations = static::getCodeRelations($model);
    $key           = [];
    preg_replace_callback('/@\[([myi]|(?:\w+))+\]/', function ($matches) use (&$key, $codeRelations) {
      $char = $matches[1];
      if (\in_array($char, ['m', 'i', 'y'])) {
        $key[] = $char;
        return;
      }
      $key[] = $codeRelations[$char]["relation"];
    }, $format);
    sort($key);
    return implode($key);
  }

  public function getKeyLogs(array|null &$codeRelations = null) {
    $codeRelations = static::getCodeRelations($this->model);
    $key           = [];
    preg_replace_callback('/@\[([myi]|(?:\w+))+\]/', function ($matches) use (&$key, $codeRelations) {
      $char = $matches[1];
      if (\in_array($char, ['m', 'i', 'y'])) {
        $key[] = $char;
        return;
      }
      $key[] = $codeRelations[$char]["relation"];
    }, $this->format);

    sort($key);
    return implode($key);
  }

  /**
   * Summary of generate
   * @param string $model
   * @param Model|array $data
   * @param bool $isDraft
   * @return string|null
   */
  public static function generate(string $model, mixed $data, bool $isDraft = false): string {
    $ref           = FormatingSeries::where('model', $model)->first();
    $codeRelations = [];
    $keyFormat     = $ref->getKeyLogs($codeRelations);

    $refKey = (array) ((array) $ref->logs)[$keyFormat];

    $timezone = (string) Preference::where('key', 'timezone')->first()?->value ?? "UTC";

    preg_match('/^(?=.*@\[(mm|mmm|mmmm)\])(?=.*@\[(yy|yyyy)\]).*$/', $ref->format, $monthYear);
    preg_match('/^(?=.*@\[(yy|yyyy)\]).*$/', $ref->format, $year);
    $now = Carbon::now()->timezone($timezone);

    $selectTime = \count($monthYear) > 0 ? "{$now->month}/{$now->year}" : (\count($year) > 0 ? (string) $now->year : null);
    $selectKey  = $isDraft ? 'draft' : $selectTime ?? 0;

    if (! isset($refKey[$selectKey])) {
      $refKey[$selectKey] = [
        'current'    => 0,
        'updated_at' => now()->addDays(-1),
      ];
    }

    $refLatest   = $selectTime ? $refKey[$selectKey] : $refKey;
    $lastUpdated = Carbon::parse($refLatest['updated_at']);

    if (\count($monthYear) > 0) {
      if ($now->year > $lastUpdated->year || $now->year >= $lastUpdated->year && $now->month > $lastUpdated->month) {
        $refLatest['current'] = 1;
      } else {
        $refLatest['current'] += 1;
      }
    } else if (\count($year) > 0) {
      if ($now->year > $lastUpdated->year) {
        $refLatest['current'] = 1;
      } else {
        $refLatest['current'] += 1;
      }
    } else {
      $refLatest['current'] += 1;
    }

    if (! \is_array($data)) {
      $relations = \array_unique(\array_values(\array_map(fn ($item) => $item['relation'], $codeRelations)));
      $data->load($relations);
      $data = $data->toArray();
    }
    $pattern = '/@\[(.*?)\]/';
    $result  = preg_replace_callback($pattern, function ($matches) use ($isDraft, $codeRelations, $data, $now, $refLatest) {
      $format = $matches[1];
      if ($format[0] == "i") {
        $rslt = str_pad($refLatest['current'], \strlen($format), '0', STR_PAD_LEFT);
        return $isDraft ? "(DRAFT/$rslt)" : $rslt;
      }

      return match ($format) {
        'yyyy'  => $now->translatedFormat('Y'),
        'yy'    => $now->translatedFormat('y'),
        'mmmm'  => $now->translatedFormat('F'),
        'mmm'   => $now->translatedFormat('M'),
        'mm'    => $now->translatedFormat('m'),
        default => $data[($codeRelations[$format]["relation"])][($codeRelations[$format]["key"])] ?? "{{$format}}",
      };
    }, $ref->format);

    $refKey[$selectKey] = [
      'current'    => $refLatest['current'],
      'updated_at' => now(),
    ];
    $logs               = [
      ...(array) $ref->logs,
      $keyFormat => $refKey,
    ];

    $ref->fill([
      'logs' => $logs,
    ]);
    $ref->save();

    return $result;
  }
}
