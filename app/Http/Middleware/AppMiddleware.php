<?php

namespace App\Http\Middleware;

use App\Models\Core\Branch;
use App\Models\Core\Preference;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Session;
use Inertia\Inertia;
use Inertia\Middleware;
use Symfony\Component\HttpFoundation\Response;

class AppMiddleware extends Middleware {
  /**
   * Handle an incoming request.
   *
   * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
   */
  public function handle(Request $request, Closure $next): Response {
    if (Auth::check()) {
      $currentBranch = $request->session()->get('currentBranch');

      Inertia::share([
        'branchSettings' => [
          'branches' => function () {
            return Branch::whereNull('branchable_type')
              ->whereNull('branchable_id')
              ->where('is_disabled', false)
              ->get();
          },
          'currentBranch' => $currentBranch,
        ]
      ]);
    }
    return parent::handle($request, $next);
  }
  public function share(Request $request): array {
    $preferences = Preference::get(['key', 'value'])->mapWithKeys(fn($pref) => [$pref->key => $pref->value]);
    return [
      ...parent::share($request),
      'preferences' => $preferences->toArray(),
    ];
  }
}
