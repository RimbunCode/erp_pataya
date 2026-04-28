<?php

namespace App\Http\Controllers\Auth;

use App\FormStatus;
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

        $user = Auth::user();

        // Load roles
        $roles = $user->roles->pluck('name')->toArray();

        // Simpan roles ke session supaya bisa diakses di frontend
        $request->session()->put('user_roles', $roles);

        $primaryRole = $roles[0] ?? null;

        return redirect()->intended($this->redirectByRole($primaryRole));
    }

    private function redirectByRole(?string $role): string {
        return match ($role) {
            'student'      => route('student.dashboard', absolute: false),
            'instructor'   => route('instructor.dashboard', absolute: false),
            'organization' => route('organization.dashboard', absolute: false),
            'admin'        => route('admin.dashboard', absolute: false),
            default        => '/guest',
        };
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

            return redirect()->intended(route('dashboard', absolute: false));
        }
        // return $this->storeProviderUser($user, $driver);
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
