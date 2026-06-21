<?php
use App\Http\Controllers\Guest\GuestPageController;
use App\Http\Controllers\Guest\TrainingController;
use Illuminate\Support\Facades\Route;

Route::name('guest.')->group(function () {
    Route::get('/', [GuestPageController::class, 'home'])->name('home');
    Route::get('/training', [TrainingController::class, 'index'])->name('training');
    Route::get('/training/{course}', [TrainingController::class, 'show'])->name('training.preview');
    Route::get('/verify', [GuestPageController::class, 'verify'])->name('verify');
    Route::get('/about', [GuestPageController::class, 'about'])->name('about');
    Route::get('/contact', [GuestPageController::class, 'contact'])->name('contact');
});
