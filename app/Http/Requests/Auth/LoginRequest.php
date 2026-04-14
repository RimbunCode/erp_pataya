<?php

namespace App\Http\Requests\Auth;

use App\FormStatus;
use App\Http\Requests\BaseFormRequest;
use App\Models\User\User;
use Illuminate\Auth\Events\Lockout;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class LoginRequest extends BaseFormRequest {
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array {
        return [
            'usernameOrEmail' => ['required', 'string'],
            'password'        => ['required', 'string'],
        ];
    }

    /**
     * Attempt to authenticate the request's credentials.
     *
     * @throws ValidationException
     */
    public function authenticate(): void {
        $this->ensureIsNotRateLimited();
        $login_type = filter_var($this->input('usernameOrEmail'), FILTER_VALIDATE_EMAIL)
            ? 'email'
            : 'username';

        $this->merge([
            $login_type => $this->input('usernameOrEmail'),
        ]);

        $user = User::where('email', $this->input('usernameOrEmail'))->orWhere('username', $this->input('usernameOrEmail'))->first();
        if (! $user->password) {
            throw ValidationException::withMessages([
                'status' => trans('auth.failed'),
            ]);
        } elseif ($user?->status == FormStatus::INACTIVE) {
            throw ValidationException::withMessages([
                'status' => trans('auth.disabled'),
            ]);
        }
        if (! Auth::attempt($this->only($login_type, 'password'), $this->boolean('remember'))) {
            RateLimiter::hit($this->throttleKey());

            throw ValidationException::withMessages([
                'email' => trans('auth.failed'),
            ]);
        }

        RateLimiter::clear($this->throttleKey());
    }

    /**
     * Ensure the login request is not rate limited.
     *
     * @throws ValidationException
     */
    public function ensureIsNotRateLimited(): void {
        if (! RateLimiter::tooManyAttempts($this->throttleKey(), 5)) {
            return;
        }

        event(new Lockout($this));

        $seconds = RateLimiter::availableIn($this->throttleKey());

        throw ValidationException::withMessages([
            'email' => trans('auth.throttle', [
                'seconds' => $seconds,
                'minutes' => ceil($seconds / 60),
            ]),
        ]);
    }

    /**
     * Get the rate limiting throttle key for the request.
     */
    public function throttleKey(): string {
        return Str::transliterate(Str::lower($this->string('email')) . '|' . $this->ip());
    }
}
