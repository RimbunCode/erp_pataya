<?php

namespace App\Http\Middleware;

use Carbon\Carbon;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\Session;
use Illuminate\Support\Facades\URL;
use Symfony\Component\HttpFoundation\Response;

class LanguageMiddleware {
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response {
        if ($request->hasCookie('lang')) {
            App::setLocale($request->cookie('lang'));
            Carbon::setLocale($request->cookie('lang'));

            return $next($request)->withCookie(
                cookie('lang', $request->cookie(key: 'lang'), 60 * 24 * 30),
            );
        }
        Session::put('url.intended', URL::full());

        return redirect()->route('lang.index');
    }
}
