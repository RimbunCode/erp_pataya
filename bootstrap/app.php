<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(dirname(__DIR__))
  ->withRouting(
    web: __DIR__ . '/../routes/web.php',
    commands: __DIR__ . '/../routes/console.php',
    health: '/up',
  )
  ->withMiddleware(function (Middleware $middleware) {
    $middleware->web(append: [
      \App\Http\Middleware\HandleInertiaRequests::class,
      \Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets::class,
      \App\Http\Middleware\AppMiddleware::class
    ]);
    $middleware->alias([
      'app' => App\Http\Middleware\AppMiddleware::class,
      'lang' => App\Http\Middleware\LanguageMiddleware::class,
    ]);
    //
  })
  ->withExceptions(function (Exceptions $exceptions) {
    //
  })->create();
