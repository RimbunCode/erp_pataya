<?php

namespace App\Services\Core;

use App\Models\Core\FormatingSeries;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class FormatingSeriesService {
  public function get(string $model, array $data): string {
    $ref = FormatingSeries::where('model', $model)->first();

    $keyFormat = $this->getKeyLogs($ref, $codeRelations);

    $refLatest = $ref->logs[$keyFormat];

    $now = Carbon::now();
    $lastUpdated = Carbon::parse($refLatest['updated_at']);
    preg_match('/^(?=.*@\[(mm|mmm|mmmm)\])(?=.*@\[(yy|yyyy)\]).*$/', $ref->format, $monthYear);
    preg_match('/^(?=.*@\[(yy|yyyy)\]).*$/', $ref->format, $year);
    if (\count($monthYear) > 0) {
      if ($now->year > $lastUpdated->year || ($now->year >= $lastUpdated->year && $now->month > $lastUpdated->month)) {
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


    $pattern = '/@\[(.*?)\]/';
    $result = preg_replace_callback($pattern, function ($matches) use ($codeRelations, $data, $now, $refLatest) {
      $format = $matches[1];
      if ($format[0] == "i") {
        return str_pad($refLatest['current'], strlen($format), '0', STR_PAD_LEFT);
      }
      return match ($format) {
        'yyyy' => $now->translatedFormat('Y'),
        'yy' => $now->translatedFormat('y'),
        'mmmm' => $now->translatedFormat('F'),
        'mmm' => $now->translatedFormat('M'),
        'mm' => $now->translatedFormat('m'),
        default => $data[($codeRelations[$format]["relation"])][($codeRelations[$format]["key"])] ?? "{{$format}}",
      };
    },  $ref->format);

    $ref->fill([
      'logs' => [
        ...$ref->logs,
        $keyFormat => [
          'current' => $refLatest['current'],
          'updated_at' => now()
        ]
      ]
    ]);
    $ref->save();

    return $result;
  }
  private function getCodeRelations(string $model) {
    $objectModel = new $model;
    $codeRelations = collect($objectModel->codeRelations() ?? [])->mapWithKeys(function ($value) {
      preg_replace_callback('/^([^:]+):([^\.]+)\.([^\.]+)$/', function ($matches) use (&$code, &$relation, &$key) {
        $code = $matches[1];
        $relation = $matches[2];
        $key = $matches[3];
      }, $value);
      return [$code => [
        'relation' => $relation,
        'key' => $key
      ]];
    })->toArray();
    return $codeRelations;
  }
  public function getKeyLogs(FormatingSeries $formatingSeries, array|null &$codeRelations = null) {
    $codeRelations = $this->getCodeRelations($formatingSeries->model);
    preg_replace_callback('/@\[([myi]|(?:\w+))+\]/', function ($matches) use (&$key, $codeRelations) {
      $char = $matches[1];
      if (in_array($char, ['m', 'i', 'y'])) {
        $key[] = $char;
        return;
      }
      $key[] = $codeRelations[$char]["relation"];
    }, $formatingSeries->format);

    sort($key);
    return implode($key);
  }
}
