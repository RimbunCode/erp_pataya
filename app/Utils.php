<?php

namespace App;

use Illuminate\Http\Request;

class Utils {
  public static function isInertiaRequest(Request $request) {
    if (!$request->ajax())
      return true;
    return $request->header('X-Inertia') == 'true' || $request->header('X-Inertia-Partial') == 'true';
  }
}
