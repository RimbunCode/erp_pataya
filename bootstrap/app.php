<?php
use App\Console\Commands\Feature;
use App\Console\Commands\ModelCacheCommand;
use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EnsureUserIsOnboarded;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\HandleTheme;
use App\Http\Middleware\LanguageMiddleware;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

$temporaryPath = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'storage' . DIRECTORY_SEPARATOR . 'framework' . DIRECTORY_SEPARATOR . 'temp';

if (! is_dir($temporaryPath)) {
    mkdir($temporaryPath, 0755, true);
}

if (is_writable($temporaryPath)) {
    ini_set('sys_temp_dir', $temporaryPath);
    ini_set('upload_tmp_dir', $temporaryPath);
    putenv("TMP={$temporaryPath}");
    putenv("TEMP={$temporaryPath}");
}

return Application::configure(dirname(__DIR__))
    ->withRouting(
        web: __DIR__ . '/../routes/web.php',
        commands: __DIR__ . '/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        // Cookie yang di-set dari sisi klien (JS) disimpan plaintext, jadi
        // dikecualikan dari enkripsi agar `$request->cookie()` membaca nilai mentah.
        // `datatable_columns*` (glob) mencakup nama per-path: datatable_columns,
        // datatable_columns_items, datatable_columns_sales, dst.
        $middleware->encryptCookies(except: ['theme', 'datatable_show', 'datatable_columns*']);

        $middleware->web(append: [
            HandleTheme::class,
            AddLinkHeadersForPreloadedAssets::class,
            HandleInertiaRequests::class,
        ]);
        $middleware->alias([
            'app'       => AppMiddleware::class,
            'lang'      => LanguageMiddleware::class,
            'onboarded' => EnsureUserIsOnboarded::class,
        ]);
        //
    })
    ->withCommands([
        Feature::class,
        ModelCacheCommand::class,
    ])
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->respond(function (Response $response, Throwable $exception, Request $request): Response {
            if (
                config('app.debug')
                || $request->expectsJson()
                || ! $request->user()
                || ! \in_array($response->getStatusCode(), [403, 404, 500, 503], true)
            ) {
                return $response;
            }

            return Inertia::render('Error', [
                'status'       => $response->getStatusCode(),
                'useAppLayout' => true,
            ])->toResponse($request)->setStatusCode($response->getStatusCode());
        });
    })->create();
