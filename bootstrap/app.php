<?php

use App\Console\Commands\Feature;
use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\LanguageMiddleware;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;

return Application::configure(dirname(__DIR__))
    ->withRouting(
        web: __DIR__ . '/../routes/web.php',
        commands: __DIR__ . '/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->web(append: [
            AddLinkHeadersForPreloadedAssets::class,
            HandleInertiaRequests::class,
        ]);
        $middleware->alias([
            'app'  => AppMiddleware::class,
            'lang' => LanguageMiddleware::class,
        ]);
        //
    })
    ->withCommands([
        Feature::class,
    ])
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();
