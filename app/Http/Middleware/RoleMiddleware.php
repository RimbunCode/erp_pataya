<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RoleMiddleware {
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    // app/Http/Middleware/RoleMiddleware.php
    public function handle(Request $request, Closure $next, string ...$roles): Response {
        $user = $request->user();

        if (! $user) {
            return redirect('/guest');
        }

        // cek apakah user punya salah satu dari role yang dibutuhkan
        $userRoles = $user->roles->pluck('name')->toArray();
        $hasRole   = \count(array_intersect($roles, $userRoles)) > 0;

        if (! $hasRole) {
            abort(403, 'Unauthorized.');
        }

        return $next($request);
    }
}
