<?php

namespace App\Http\Middleware;

use App\Models\User\User;
use App\Services\Admin\AdminPermissionService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AdminModulePermissionMiddleware {
    public function __construct(private AdminPermissionService $adminPermissionService) {}

    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next, string ...$requiredPermissions): Response {
        /** @var User|null $user */
        $user = $request->user();
        if (! $user) {
            return redirect('/');
        }

        if ($this->adminPermissionService->hasAny($user, ...$requiredPermissions)) {
            return $next($request);
        }

        if ($request->expectsJson()) {
            abort(403);
        }

        return redirect()
            ->route('admin.dashboard')
            ->with('error', 'Anda tidak memiliki akses ke modul ini.');
    }
}
