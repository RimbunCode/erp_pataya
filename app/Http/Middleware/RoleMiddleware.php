<?php

namespace App\Http\Middleware;

use App\Services\Auth\RoleResolver;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RoleMiddleware {
    public function __construct(private RoleResolver $roleResolver) {}

    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response {
        $user = $request->user();

        if (! $user) {
            return redirect('/guest');
        }

        $userRoles     = $this->roleResolver->normalizeRoles($user->roles->pluck('name')->toArray());
        $requiredRoles = $this->roleResolver->normalizeRoles($roles);
        $hasRole       = \count(array_intersect($requiredRoles, $userRoles)) > 0;

        if (! $hasRole) {
            abort(403, 'Unauthorized.');
        }

        $response = $next($request);
        $pathRole = $this->roleResolver->roleFromPath($request->path());

        if (
            $pathRole !== null
            && \in_array($pathRole, $requiredRoles, true)
            && \in_array($pathRole, $userRoles, true)
        ) {
            $response->headers->setCookie($this->roleResolver->makeLastActiveRoleCookie($pathRole));
        }

        return $response;
    }
}
