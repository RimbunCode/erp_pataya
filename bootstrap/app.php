<?php
use App\Console\Commands\Feature;
use App\Console\Commands\ModelCacheCommand;
use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EncryptCookies;
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
    ->withEvents(discover: false)
    ->withRouting(
        channels: __DIR__ . '/../routes/channels.php',
        web: __DIR__ . '/../routes/web.php',
        api: __DIR__ . '/../routes/api.php',
        commands: __DIR__ . '/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        // Cookie JS (plaintext) dikecualikan dari enkripsi via custom EncryptCookies
        // yang override isDisabled() — karena encryptCookies(except:[]) tidak support
        // prefix/glob, hanya exact match.
        $middleware->replaceInGroup('web', Illuminate\Cookie\Middleware\EncryptCookies::class, EncryptCookies::class);

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

        // Legacy SSO POST datang dari domain aplikasi lama (cross-origin) —
        // tidak mungkin membawa CSRF token app ini. Diamankan lewat HMAC
        // signature + TTL + one-time jti di LegacySsoController, bukan CSRF.
        $middleware->validateCsrfTokens(except: [
            'auth/legacy-sso',
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
