<?php
use App\Http\Controllers\Guest\TrainingController;
use Illuminate\Support\Facades\Route;

Route::prefix('guest')->group(function () {
    Route::get('/', fn () => inertia('Guest/Index'));
    Route::get('/training', [TrainingController::class, 'index']);
    Route::get('/training/{course}', [TrainingController::class, 'show'])->name('guest.training.preview');
    Route::get('/verify', fn () => inertia('Guest/VerifyCTA/VerifyCTA'));
    Route::get('/about', fn () => inertia('Guest/AboutUs/AboutUs'));
    Route::get('/contact', fn () => inertia('Guest/Contact/ContactInfo'));
});