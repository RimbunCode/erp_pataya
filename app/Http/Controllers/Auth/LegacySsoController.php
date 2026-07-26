<?php

namespace App\Http\Controllers\Auth;

use App\Enums\FormStatus;
use App\Http\Controllers\Controller;
use App\Models\User\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;

class LegacySsoController extends Controller {
    /**
     * Authenticate a user coming from the legacy application via a
     * short-lived, single-use, HMAC-signed token, so they don't have
     * to log in again. Accepts POST only so the token never lands in
     * URLs, Referer headers, or access logs.
     */
    public function login(Request $request): RedirectResponse {
        $token = $request->input('token', '');

        $payload = $this->verifyToken($token);

        if (! $payload) {
            return redirect()->route('login')->withErrors([
                'status' => __('auth.legacy_sso_invalid'),
            ]);
        }

        [$email, $expiresAt, $jti] = $payload;

        if (time() > (int) $expiresAt) {
            return redirect()->route('login')->withErrors([
                'status' => __('auth.legacy_sso_expired'),
            ]);
        }

        $ttl        = (int) config('services.legacy_sso.ttl_seconds', 60);
        $consumedAt = Cache::add("legacy_sso:jti:{$jti}", 1, $ttl);

        if (! $consumedAt) {
            return redirect()->route('login')->withErrors([
                'status' => __('auth.legacy_sso_invalid'),
            ]);
        }

        $user = User::where('email', $email)->first();

        if (! $user || $user->status === FormStatus::INACTIVE) {
            return redirect()->route('login')->withErrors([
                'status' => __('auth.failed'),
            ]);
        }

        Auth::login($user);

        $request->session()->regenerate();

        $request->session()->put('currentBranch', $user->default_branch_id);

        return redirect()->intended(route('dashboard', absolute: false));
    }

    /**
     * Decode and verify the signed token, returning [email, expiresAt, jti] or null.
     *
     * @return array{0: string, 1: string, 2: string}|null
     */
    private function verifyToken(string $token): ?array {
        if (! str_contains($token, '.')) {
            return null;
        }

        [$encodedPayload, $signature] = explode('.', $token, 2);

        $payload = base64_decode($encodedPayload, true);

        if ($payload === false || substr_count($payload, '|') !== 2) {
            return null;
        }

        $secret = config('services.legacy_sso.secret');

        if (! $secret) {
            return null;
        }

        $expectedSignature = hash_hmac('sha256', $payload, $secret);

        if (! hash_equals($expectedSignature, $signature)) {
            return null;
        }

        [$email, $expiresAt, $jti] = explode('|', $payload, 3);

        if ($jti === '') {
            return null;
        }

        // Cap the accepted TTL server-side so a caller with a valid
        // signature cannot mint a longer-lived token than we allow.
        $maxTtl    = (int) config('services.legacy_sso.ttl_seconds', 60);
        $expiresAt = min((int) $expiresAt, time() + $maxTtl);

        return [$email, (string) $expiresAt, $jti];
    }
}
