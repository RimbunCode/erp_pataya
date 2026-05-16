<?php

namespace App\Http\Controllers\Auth;

use App\FormStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Models\User\User;
use App\Models\User\UserProvider;
use App\Services\Auth\RoleResolver;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Laravel\Socialite\Facades\Socialite;

class AuthenticatedSessionController extends Controller {
    public function __construct(private RoleResolver $roleResolver) {}

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

        $user = Auth::user();
        if (! $user) {
            return redirect('/guest');
        }

        return $this->redirectAfterAuthentication(
            $request,
            $user,
            $request->string('preferred_role')->toString(),
        );
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

        DB::beginTransaction();
        if ($authUser) {
            $alreadyConnected = UserProvider::where('provider', $driver)
                ->where('provider_id', $user->getId())
                ->exists();

            if ($alreadyConnected) {
                throw ValidationException::withMessages([
                    'provider_account' => 'This provider account is already connected to your account.',
                ]);
            }
            $authUser->providers()->updateOrCreate([
                'provider'    => $driver,
                'provider_id' => $user->getId(),
                'user_id'     => $authUser->id,
            ], $payload);

            $selectedProvider = $authUser->providers()->whereNotNull('avatar_url')->latest()->first();

            if ($selectedProvider) {
                $authUser->update([
                    'avatar_url' => $selectedProvider->avatar_url,
                ]);
            }

            DB::commit();

            return redirect()->route('users.show', $authUser->id);
        } else {
            $provider = UserProvider::where('provider', $driver)
                ->where('provider_id', $user->getId())->first();

            if (! $provider) {
                $authUser = User::where('email', $user->getEmail())->first();
                if (! $authUser) {
                    $authUser = User::create([
                        'name'              => $user->getName(),
                        'email'             => $user->getEmail(),
                        'email_verified_at' => now(),
                        'status'            => FormStatus::PRE_REGISTERED,
                    ]);
                }
                $provider = UserProvider::create([
                    'provider'    => $driver,
                    'provider_id' => $user->getId(),
                    'user_id'     => $authUser->id,
                    ...$payload,
                ]);
            } else {
                $provider->update($payload);
                $authUser = $provider->user;
            }

            $authUser         = $provider->user;
            $selectedProvider = $authUser->providers()->whereNotNull('avatar_url')->latest()->first();

            if ($selectedProvider) {
                $authUser->update([
                    'avatar_url' => $selectedProvider->avatar_url,
                ]);
            }

            DB::commit();

            if (! $authUser->password) {
                throw ValidationException::withMessages([
                    'status' => trans('auth.failed'),
                ])->redirectTo(route('login'));
            } elseif ($authUser?->status == FormStatus::INACTIVE) {
                throw ValidationException::withMessages([
                    'status' => trans('auth.disabled'),
                ])->redirectTo(route('login'));
            }

            Auth::login($authUser);

            if (\in_array($authUser->status, [FormStatus::PRE_REGISTERED, FormStatus::INVITED])) {
                return redirect()->route('setup.show');
            }

            return $this->redirectAfterAuthentication($request, $authUser);
        }
        // return $this->storeProviderUser($user, $driver);
    }

    private function redirectAfterAuthentication(Request $request, User $user, ?string $preferredRole = null): RedirectResponse {
        $roles = $this->roleResolver->normalizeRoles($user->roles->pluck('name')->toArray());
        $request->session()->put('user_roles', $roles);

        $resolvedRole = $this->roleResolver->resolvePreferredOwnedRole(
            $roles,
            $preferredRole,
            $request->cookie(RoleResolver::LAST_ACTIVE_ROLE_COOKIE),
        );

        if ($resolvedRole === null) {
            return redirect('/guest');
        }

        $cookieRole  = $resolvedRole;
        $intendedUrl = redirect()->getIntendedUrl();
        if (\is_string($intendedUrl)) {
            $intendedRole = $this->roleResolver->roleFromPath($intendedUrl);
            if ($intendedRole !== null) {
                if (! $this->roleResolver->isRoleOwned($intendedRole, $roles)) {
                    redirect()->setIntendedUrl($this->roleResolver->dashboardPath($resolvedRole));
                } else {
                    $cookieRole = $intendedRole;
                }
            }
        }

        return redirect()
            ->intended($this->roleResolver->dashboardPath($resolvedRole))
            ->withCookie($this->roleResolver->makeLastActiveRoleCookie($cookieRole));
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
