<?php

namespace App\Http\Middleware;

use App\Models\Preference;
use Closure;
use Illuminate\Http\Request;
use Inertia\Middleware;
use Symfony\Component\HttpFoundation\Response;

class AppMiddleware extends Middleware {
  /**
   * Handle an incoming request.
   *
   * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
   */
  public function handle(Request $request, Closure $next): Response {
    return parent::handle($request, $next);
  }
  public function share(Request $request): array {
    $preferences = Preference::get(['key', 'value']);
    return [
      ...parent::share($request),
      'preferences' => $preferences->toArray(),
    ];
  }
}
