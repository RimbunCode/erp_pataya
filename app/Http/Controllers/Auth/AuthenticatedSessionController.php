<?php

namespace App\Http\Controllers\Auth;

use App\Enums\FormStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Models\User\User;
use App\Models\User\UserProvider;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Session;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Laravel\Socialite\Facades\Socialite;

class AuthenticatedSessionController extends Controller {
    /**
     * Display the login view.
     */
    public function create(): Response {
        return Inertia::render('Auth/Login', [
            'canResetPassword' => false, // Route::has('password.request'),
            'status'           => session('status'),
        ]);
    }

    /**
     * Handle an incoming authentication request.
     */
    public function store(LoginRequest $request): RedirectResponse {
        $request->authenticate();

        $request->session()->regenerate();

        $request->session()->put('currentBranch', Auth::user()->default_branch_id);

        return redirect()->intended(route('dashboard', absolute: false));
    }

    public function redirectToProvider(string $driver) {
        return Socialite::driver($driver)
            // ->scopes([
            //     'https://www.googleapis.com/auth/documents',
            //     'https://www.googleapis.com/auth/spreadsheets',
            // ])
            // ->with([
            //     'access_type' => 'offline',
            //     'prompt'      => 'consent',
            // ])
            ->redirect();
    }

    public function handleProviderCallback(Request $request, string $driver) {
        $user = Socialite::driver($driver)->user();

        $authUser = $request->user();

        $payload = match ($driver) {
            'google' => [
                'avatar_url'       => $user->getAvatar(),
                'token'            => $user->token,
                'refresh_token'    => $user->refreshToken,
                'token_expired_at' => now()->addSeconds($user->expiresIn - 10),
            ],
        };

        if ($authUser) {
            $alreadyConnected = UserProvider::where('provider', $driver)
                ->where('provider_id', $user->getId())
                ->exists();

            if ($alreadyConnected) {
                throw ValidationException::withMessages([
                    'provider_account' => 'This provider account is already connected to your account.',
                ]);
            }

            $emailOwner = User::where('email', $user->getEmail())->first();

            if ($emailOwner && $emailOwner->id !== $authUser->id) {
                throw ValidationException::withMessages([
                    'provider_account' => trans('auth.email_already_registered'),
                ]);
            }

            DB::transaction(function () use ($authUser, $driver, $user, $payload) {
                $authUser->providers()->updateOrCreate([
                    'provider'    => $driver,
                    'provider_id' => $user->getId(),
                    'user_id'     => $authUser->id,
                ], $payload);

                if (! $authUser->email_verified_at) {
                    $authUser->forceFill(['email_verified_at' => now()])->save();
                }

                $this->syncAvatarFromProvider($authUser);
            });

            return redirect()->route('users.show', $authUser->id);
        } else {
            $provider = UserProvider::where('provider', $driver)
                ->where('provider_id', $user->getId())->first();

            $authUser = $provider?->user ?? User::where('email', $user->getEmail())->first();

            if ($authUser) {
                if (! $authUser->password) {
                    throw ValidationException::withMessages([
                        'status' => trans('auth.failed'),
                    ])->redirectTo(route('login'));
                } elseif ($authUser->status == FormStatus::INACTIVE) {
                    throw ValidationException::withMessages([
                        'status' => trans('auth.disabled'),
                    ])->redirectTo(route('login'));
                }
            }

            DB::transaction(function () use (&$authUser, &$provider, $driver, $user, $payload) {
                if (! $authUser) {
                    $authUser = User::create([
                        'name'              => $user->getName(),
                        'email'             => $user->getEmail(),
                        'email_verified_at' => now(),
                        'status'            => FormStatus::PRE_REGISTERED,
                    ]);
                }

                if ($provider) {
                    $provider->update($payload);
                } else {
                    UserProvider::create([
                        'provider'    => $driver,
                        'provider_id' => $user->getId(),
                        'user_id'     => $authUser->id,
                        ...$payload,
                    ]);
                }

                if (! $authUser->email_verified_at) {
                    $authUser->forceFill(['email_verified_at' => now()])->save();
                }

                $this->syncAvatarFromProvider($authUser);
            });

            Auth::login($authUser);

            if (\in_array($authUser->status, [FormStatus::PRE_REGISTERED, FormStatus::INVITED])) {
                return redirect()->route('setup.show');
            }

            return redirect()->intended(route('dashboard', absolute: false));
        }
    }

    /**
     * Refresh the user's avatar from their most recently linked provider.
     */
    private function syncAvatarFromProvider(User $authUser): void {
        $selectedProvider = $authUser->providers()->whereNotNull('avatar_url')->latest()->first();

        if ($selectedProvider) {
            $authUser->update([
                'avatar_url' => $selectedProvider->avatar_url,
            ]);
        }
    }

    /**
     * Destroy an authenticated session.
     */
    public function destroy(Request $request): RedirectResponse {
        Auth::guard('web')->logout();

        $request->session()->invalidate();

        $request->session()->regenerateToken();

        return redirect('/');
    }
}
