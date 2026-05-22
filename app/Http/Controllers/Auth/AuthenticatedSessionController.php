<?php

namespace App\Http\Controllers\Auth;

use App\FormStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\LoginRolesRequest;
use App\Http\Requests\Auth\SelectRoleRequest;
use App\Models\User\User;
use App\Models\User\UserProvider;
use App\Services\Auth\LoginCredentialVerifier;
use App\Services\Auth\RoleResolver;
use App\Services\Auth\UserRoleManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Laravel\Socialite\Facades\Socialite;

class AuthenticatedSessionController extends Controller {
    public function __construct(
        private RoleResolver $roleResolver,
        private LoginCredentialVerifier $loginCredentialVerifier,
        private UserRoleManager $userRoleManager,
    ) {}

    /**
     * Display the login view.
     */
    public function create(): Response {
        return Inertia::render('Auth/Login', [
            'canResetPassword' => false, // Route::has('password.request'),
            'status'           => session('status'),
        ]);
    }

    public function roles(LoginRolesRequest $request): JsonResponse {
        $user = $this->loginCredentialVerifier->verifyCredentials(
            $request->string('usernameOrEmail')->toString(),
            $request->string('password')->toString(),
            (string) $request->ip(),
            $request,
        );

        $roles = $this->roleResolver->normalizeRoles($user->roles->pluck('name')->toArray());
        if (\count($roles) === 0) {
            $this->throwNoRoleAccess($request);
        }

        return response()->json([
            'roles'              => $roles,
            'requires_selection' => \count($roles) > 1,
            'auto_role'          => \count($roles) === 1 ? $roles[0] : null,
        ]);
    }

    /**
     * Handle an incoming authentication request.
     */
    public function store(LoginRequest $request): RedirectResponse {
        $user = $this->loginCredentialVerifier->verifyCredentials(
            $request->string('usernameOrEmail')->toString(),
            $request->string('password')->toString(),
            (string) $request->ip(),
            $request,
        );

        Auth::login($user, $request->boolean('remember'));
        $request->session()->regenerate();

        return $this->redirectAfterAuthentication(
            $request,
            $user,
            $request->string('preferred_role')->toString(),
        );
    }

    public function showRoleSelection(Request $request): RedirectResponse|Response {
        $user = $request->user();
        if (! $user) {
            return redirect('/guest');
        }

        $roles = $this->roleResolver->normalizeRoles($user->roles->pluck('name')->toArray());
        if (\count($roles) === 0) {
            $this->throwNoRoleAccess($request);
        }

        if (\count($roles) === 1) {
            return $this->redirectToRoleDashboard($roles[0], $roles);
        }

        return Inertia::render('Auth/SelectRole', [
            'roles'             => $roles,
            'contact_admin_url' => route('guest.contact', absolute: false),
        ]);
    }

    public function selectRole(SelectRoleRequest $request): RedirectResponse {
        $user = $request->user();
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
            ->redirect();
    }

    public function handleProviderCallback(Request $request, string $driver): RedirectResponse {
        $providerUser = Socialite::driver($driver)->user();

        $authUser = $request->user();

        $payload = match ($driver) {
            'google' => [
                'avatar_url'       => $providerUser->getAvatar(),
                'token'            => $providerUser->token,
                'refresh_token'    => $providerUser->refreshToken,
                'token_expired_at' => now()->addSeconds($providerUser->expiresIn - 10),
            ],
        };

        if ($authUser) {
            DB::transaction(function () use ($authUser, $driver, $providerUser, $payload): void {
                $alreadyConnected = UserProvider::where('provider', $driver)
                    ->where('provider_id', $providerUser->getId())
                    ->exists();

                if ($alreadyConnected) {
                    throw ValidationException::withMessages([
                        'provider_account' => 'This provider account is already connected to your account.',
                    ]);
                }

                $authUser->providers()->updateOrCreate([
                    'provider'    => $driver,
                    'provider_id' => $providerUser->getId(),
                    'user_id'     => $authUser->id,
                ], $payload);

                $selectedProvider = $authUser->providers()->whereNotNull('avatar_url')->latest()->first();

                if ($selectedProvider) {
                    $authUser->update([
                        'avatar_url' => $selectedProvider->avatar_url,
                    ]);
                }
            });

            return redirect()->route('users.show', $authUser->id);
        }

        $authUser = DB::transaction(function () use ($driver, $providerUser, $payload): User {
            $provider = UserProvider::where('provider', $driver)
                ->where('provider_id', $providerUser->getId())
                ->first();

            if (! $provider) {
                $linkedUser = User::where('email', $providerUser->getEmail())->first();
                if (! $linkedUser) {
                    $linkedUser = User::create([
                        'name'              => $providerUser->getName() ?? $providerUser->getNickname() ?? 'User',
                        'email'             => $providerUser->getEmail(),
                        'email_verified_at' => now(),
                        'status'            => FormStatus::PRE_REGISTERED,
                    ]);
                }

                $provider = UserProvider::create([
                    'provider'    => $driver,
                    'provider_id' => $providerUser->getId(),
                    'user_id'     => $linkedUser->id,
                    ...$payload,
                ]);
            } else {
                $provider->update($payload);
            }

            $resolvedUser = $provider->user;
            $this->userRoleManager->ensureStudentRole($resolvedUser);

            $selectedProvider = $resolvedUser->providers()->whereNotNull('avatar_url')->latest()->first();
            if ($selectedProvider) {
                $resolvedUser->update([
                    'avatar_url' => $selectedProvider->avatar_url,
                ]);
            }

            return $resolvedUser->fresh('roles');
        });

        if ($authUser->status == FormStatus::INACTIVE) {
            throw ValidationException::withMessages([
                'status' => trans('auth.disabled'),
            ])->redirectTo(route('login'));
        }

        Auth::login($authUser);
        $request->session()->regenerate();

        if (\in_array($authUser->status, [FormStatus::PRE_REGISTERED, FormStatus::INVITED], true)) {
            return redirect()->route('setup.show');
        }

        return $this->redirectAfterAuthentication($request, $authUser);
    }

    private function redirectAfterAuthentication(
        Request $request,
        User $user,
        ?string $preferredRole = null,
    ): RedirectResponse {
        $roles = $this->roleResolver->normalizeRoles($user->roles->pluck('name')->toArray());
        $request->session()->put('user_roles', $roles);

        if (\count($roles) === 0) {
            $this->throwNoRoleAccess($request);
        }

        $normalizedPreferredRole = $this->roleResolver->normalizeRole($preferredRole);

        if (\count($roles) > 1 && $normalizedPreferredRole === null) {
            return redirect()->route('login.select-role');
        }

        if (
            $normalizedPreferredRole !== null
            && ! \in_array($normalizedPreferredRole, $roles, true)
        ) {
            throw ValidationException::withMessages([
                'preferred_role' => trans('auth.invalid_role'),
            ]);
        }

        $resolvedRole = \count($roles) === 1
            ? $roles[0]
            : $normalizedPreferredRole;

        if (! \is_string($resolvedRole)) {
            return redirect()->route('login.select-role');
        }

        return $this->redirectToRoleDashboard($resolvedRole, $roles);
    }

    /**
     * @param  array<int, string>  $roles
     */
    private function redirectToRoleDashboard(string $resolvedRole, array $roles): RedirectResponse {
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

    private function throwNoRoleAccess(Request $request): never {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        throw ValidationException::withMessages([
            'status'            => trans('auth.no_role_access'),
            'contact_admin_url' => route('guest.contact', absolute: false),
        ])->redirectTo(route('login'));
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
