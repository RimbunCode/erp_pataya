<?php

namespace App\Http\Controllers\Core;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Inertia\Inertia;

class LanguageController extends Controller
{
    public function index(Request $request)
    {
        $locales = [
            [
                'code' => 'en',
                'name' => 'English',
                'countryCode' => 'gb',
            ],
            [
                'code' => 'id',
                'name' => 'Bahasa Indonesia',
                'countryCode' => 'id',
            ],
        ];

        return Inertia::render(
            'Core/Language/Index',
            [
                'locales' => $locales,
            ]
        );
    }

    public function set(Request $request)
    {
        $locale = $request->code;

        return redirect()->intended(route('dashboard', absolute: false))->withCookie(
            cookie('lang', $locale, 60 * 24 * 30)
        );
    }
}
