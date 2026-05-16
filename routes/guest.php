<?php
use App\Http\Controllers\Guest\TrainingController;
use Illuminate\Support\Facades\Route;

Route::name('guest.')->group(function () {
    Route::get('/', fn () => inertia('Guest/Index'))->name('home');
    Route::get('/training', [TrainingController::class, 'index'])->name('training');
    Route::get('/training/{course}', [TrainingController::class, 'show'])->name('training.preview');
    Route::get('/verify', fn () => inertia('Guest/VerifyCTA/VerifyCTA'))->name('verify');
    Route::get('/about', fn () => inertia('Guest/AboutUs/AboutUs'))->name('about');
    Route::get('/contact', fn () => inertia('Guest/Contact/ContactInfo'))->name('contact');
});