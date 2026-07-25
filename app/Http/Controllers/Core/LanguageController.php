<?php

namespace App\Http\Controllers\Core;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Inertia\Inertia;

class LanguageController extends Controller {
    public function index(Request $request) {
        $locales = [
            [
                'code'        => 'en',
                'name'        => 'English',
                'countryCode' => 'gb',
            ],
            [
                'code'        => 'id',
                'name'        => 'Bahasa Indonesia',
                'countryCode' => 'id',
            ],
        ];

        return Inertia::render(
            'Core/Language/Index',
            [
                'locales' => $locales,
            ],
        );
    }

    public function set(Request $request) {
        $locale   = $request->code;
        $previous = url()->previous();
        $fallback = parse_url($previous, PHP_URL_HOST) === $request->getHost()
            ? $previous
            : url('/');

        return redirect()->intended($fallback)->withCookie(
            cookie('lang', $locale, 60 * 24 * 30),
        );
    }
}
