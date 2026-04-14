<?php

namespace App\Http\Middleware;

use App\FormStatus;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserIsOnboarded {
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response {
        if (\in_array($request->user()->status, [FormStatus::PRE_REGISTERED, FormStatus::INVITED])) {
            return redirect()->route('setup.show');
        }

        return $next($request);
    }
}
