<?php

namespace App\Http\Middleware;

use App\Support\Notifications\MenuNotificationMap;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class MarkMenuNotificationsAsRead {
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response {
        $user = $request->user();

        if ($user && $request->isMethod('get')) {
            $menuKey = MenuNotificationMap::menuKeyForRoute($request->route()?->getName());

            if ($menuKey !== null) {
                $user->unreadNotifications()
                    ->where('data->menu_key', $menuKey)
                    ->update(['read_at' => now()]);
            }
        }

        return $next($request);
    }
}
