<?php

namespace App\Http\Middleware;

use App\FormStatus;
use App\Models\Core\ApprovalInstance;
use App\Models\Core\Branch;
use App\Models\Core\Country;
use App\Models\Core\Preference;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
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
      if (! $currentBranch) {
        $currentBranch = Auth::user()->default_branch_id;
        $request->session()->put('currentBranch', $currentBranch);
      }
      $branches = $request->user()->branches()->get();

      Inertia::share([
        'branchSettings' => [
          'branches'      => $branches,
          'currentBranch' => $branches->where('id', $currentBranch)->first() ?? $branches->where('id', $request->user()->default_branch_id)->first(),
        ],
      ]);
    }

    return parent::handle($request, $next);
  }

  public function share(Request $request): array {
    $preferences = Preference::get(['key', 'value'])->mapWithKeys(fn ($pref) => [$pref->key => $pref->value]);
    return [
      ...parent::share($request),
      'preferences' => [
        ...$preferences->toArray(),
        'country_name' => Country::find($preferences["country_id"])?->name,
      ],
    ];
  }
}
