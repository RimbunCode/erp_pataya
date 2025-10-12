<?php

namespace App;

use Illuminate\Http\Request;
use Inertia\Inertia;

class Utils {
  public static function renderShow($formPathname, $name, $title, $data, $props = []) {
    return Inertia::render('ShowGeneral', array_merge([
      'name' => $name,
      'title' => $title,
      'formPathname' => $formPathname,
      $name => $data,
    ], $props));
  }
  public static function isInertiaRequest(Request $request) {
    if (!$request->ajax())
      return true;
    return $request->header('X-Inertia') == 'true' || $request->header('X-Inertia-Partial') == 'true';
  }
  public static function generateRandom($length) {
    $result = "";
    $characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    $charactersLength = strlen($characters);
    $counter = 0;
    while ($counter < $length) {
      $result .= $characters[rand(0, $charactersLength - 1)];
      $counter += 1;
    }
    return $result;
  }
  public static function isNullOrWhitespace($value) {
    return $value === null || trim($value) === '';
  }

  public static function convertQuantity($qty, $conversionFactorFrom, $conversionFactorTo = 1) {
    if ($conversionFactorFrom == $conversionFactorTo) {
      return $qty;
    }

    if ($conversionFactorFrom > $conversionFactorTo) {
      return $qty * $conversionFactorFrom / $conversionFactorTo;
    }

    return $qty * $conversionFactorTo / $conversionFactorFrom;
  }
  public static function getValueObject($obj, $key) {
    $keys = explode(".", $key);
    $newValue = $obj;
    foreach ($keys as $k) {
      if (is_array($newValue) && array_key_exists($k, $newValue)) {
        $newValue = $newValue[$k];
      } else {
        return null;
      }
    }
    return $newValue;
  }
  public static function convertTemplateLink($value) {
    if (!$value) return null;
    if ($value instanceof \Illuminate\Support\Collection || $value instanceof \Illuminate\Database\Eloquent\Model) $value = $value->toArray();
    else if (!is_array($value)) return null;
    if (!isset($value['templateLink']))
      return null;

    $template = $value['templateLink'] ?? "";
    $item = preg_replace_callback('/:((\w[\w]+{:[\w]+})|(\w[\w.]+))/', function ($match) use ($value) {
      $match[0] = preg_replace('/(.*?){:(.*?)}/i', ':$2', $match[0]);
      $newValue = static::getValueObject($value, substr($match[0], 1));
      return $newValue ?: $match[0];
    }, $template);

    preg_match('/<title(.*?)>(.*?)<\/title>/i', $item, $titleMatch);
    preg_match('/^[^<]+/', $item, $plainTextMatch);

    if (!empty($titleMatch)) {
      return trim($titleMatch[2] ?? '');
    }
    if (!empty($plainTextMatch)) {
      return trim($plainTextMatch[0] ?? '');
    }
    return null;
  }
}
