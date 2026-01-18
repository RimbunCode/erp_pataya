<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;
use Tighten\Ziggy\Ziggy;

class HandleInertiaRequests extends Middleware {
  /**
   * The root template that is loaded on the first page visit.
   *
   * @var string
   */
  protected $rootView = 'app';

  /**
   * Determine the current asset version.
   */
  public function version(Request $request): ?string {
    return parent::version($request);
  }

  /**
   * Define the props that are shared by default.
   *
   * @return array<string, mixed>
   */
  public function share(Request $request): array {
    $isDebug   = config('app.debug');
    $flashKeys = $request->session()->has("_flash") ? $request->session()->get("_flash")["old"] : [];
    $user      = $request->user();
    if ($user) {
      $user->id_roles = $user->idRoles()->pluck('roles.id');
    }

    return [
      ...parent::share($request),
      'auth'  => [
        'user' => $user,
      ],
      'lang'  => $request->cookie('lang') ?? 'en',
      'ziggy' => fn () => [
        ...(new Ziggy)->toArray(),
        'location' => $request->url(),
        'query'    => \count($request->query()) > 0 ? $request->query() : null,
      ],
      'flash' => \array_filter(
        $request->session()->all(),
        fn ($key) => \in_array($key, $flashKeys),
        \ARRAY_FILTER_USE_KEY,
      ),
      ...($isDebug ? ['debug' => $isDebug] : []),
    ];
  }
}
