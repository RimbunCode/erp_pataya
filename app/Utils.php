<?php

namespace App;

use Illuminate\Http\Request;
use Inertia\Inertia;

class Utils
{
  public static function renderShow($formPathname, $name, $title, $data, $props = [])
  {
    return Inertia::render('ShowGeneral', array_merge([
      'name' => $name,
      'title' => $title,
      'formPathname' => $formPathname,
      $name => $data,
    ], $props));
  }
  public static function isInertiaRequest(Request $request)
  {
    if (!$request->ajax())
      return true;
    return $request->header('X-Inertia') == 'true' || $request->header('X-Inertia-Partial') == 'true';
  }
  public static function generateRandom($length)
  {
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
  public static function isNullOrWhitespace($value)
  {
    return $value === null || trim($value) === '';
  }

  public static function convertQuantity($qty, $conversionFactorFrom, $conversionFactorTo = 1)
  {
    if ($conversionFactorFrom == $conversionFactorTo) {
      return $qty;
    }

    if ($conversionFactorFrom > $conversionFactorTo) {
      return   $qty * $conversionFactorFrom / $conversionFactorTo;
    }

    return   $qty * $conversionFactorTo / $conversionFactorFrom;
  }
}
