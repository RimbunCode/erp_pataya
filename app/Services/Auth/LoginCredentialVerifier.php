<?php

namespace App\Services\Auth;

use App\FormStatus;
use App\Models\User\User;
use Illuminate\Auth\Events\Lockout;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class LoginCredentialVerifier {
    public function verifyCredentials(
        string $usernameOrEmail,
        string $password,
        string $ipAddress,
        ?Request $request = null,
    ): User {
        $normalizedIdentifier = trim($usernameOrEmail);
        $throttleKey          = $this->throttleKey($normalizedIdentifier, $ipAddress);

        $this->ensureIsNotRateLimited($normalizedIdentifier, $ipAddress, $request);

        $user = $this->findByIdentifier($normalizedIdentifier);
        if (! $user) {
            $this->failAttempt($throttleKey, [
                'usernameOrEmail' => trans('auth.failed'),
            ]);
        }

        if (! $user->password) {
            $this->failAttempt($throttleKey, [
                'status' => trans('auth.failed'),
            ]);
        }

        if ($user->status === FormStatus::INACTIVE) {
            $this->failAttempt($throttleKey, [
                'status' => trans('auth.disabled'),
            ]);
        }

        if (! Hash::check($password, $user->password)) {
            $this->failAttempt($throttleKey, [
                'password' => trans('auth.failed'),
            ]);
        }

        RateLimiter::clear($throttleKey);

        return $user;
    }

    public function throttleKey(string $usernameOrEmail, string $ipAddress): string {
        return Str::transliterate(Str::lower(trim($usernameOrEmail)) . '|' . $ipAddress);
    }

    public function ensureIsNotRateLimited(
        string $usernameOrEmail,
        string $ipAddress,
        ?Request $request = null,
    ): void {
        $throttleKey = $this->throttleKey($usernameOrEmail, $ipAddress);
        if (! RateLimiter::tooManyAttempts($throttleKey, 5)) {
            return;
        }

        if ($request) {
            event(new Lockout($request));
        }

        $seconds = RateLimiter::availableIn($throttleKey);

        throw ValidationException::withMessages([
            'usernameOrEmail' => trans('auth.throttle', [
                'seconds' => $seconds,
                'minutes' => (int) ceil($seconds / 60),
            ]),
        ]);
    }

    private function findByIdentifier(string $usernameOrEmail): ?User {
        return User::query()
            ->where('email', $usernameOrEmail)
            ->orWhere('username', $usernameOrEmail)
            ->first();
    }

    /**
     * @param  array<string, string>  $errors
     */
    private function failAttempt(string $throttleKey, array $errors): never {
        RateLimiter::hit($throttleKey);

        throw ValidationException::withMessages($errors);
    }
}
