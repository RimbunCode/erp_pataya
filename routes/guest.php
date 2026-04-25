<?php
use Illuminate\Support\Facades\Route;

Route::prefix('guest')->group(function () {
    Route::get('/', fn () => inertia('Guest/Index'));
    Route::get('/training', fn () => inertia('Guest/TrainingSection/TrainingSection'));
    Route::get('/verify', fn () => inertia('Guest/VerifyCTA/VerifyCTA'));
    Route::get('/about', fn () => inertia('Guest/AboutUs/AboutUs'));
    Route::get('/contact', fn () => inertia('Guest/Contact/ContactInfo'));
});