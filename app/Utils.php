<?php

namespace App;

use Illuminate\Http\Request;

class Utils {
  public static function isInertiaRequest(Request $request) {
    return $request->header('X-Inertia') == 'true' || $request->header('X-Inertia-Partial') == 'true';
  }
}
