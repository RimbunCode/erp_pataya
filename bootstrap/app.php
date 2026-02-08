<?php

use App\Console\Commands\Feature;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->web(append: [
            \Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets::class,
            \App\Http\Middleware\HandleInertiaRequests::class,
        ]);
        $middleware->alias([
            'app' => App\Http\Middleware\AppMiddleware::class,
            'lang' => App\Http\Middleware\LanguageMiddleware::class,
        ]);
        //
    })
    ->withCommands([
        Feature::class,
    ])
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();
