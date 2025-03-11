<?php

namespace App;

use Illuminate\Http\Request;

class Utils {
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
}
