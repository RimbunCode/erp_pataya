<?php

use App\Http\Controllers\ProfileController;
use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::macro('resourceDetail', function ($uri, $name, $controller) {
  Route::prefix("/{$uri}")->controller($controller)->group(function () use ($uri, $name) {
    Route::get("/", "index")->name("$uri.index");
    Route::post("/", "store")->name("$uri.store");
    Route::get("/{{$name}}", "edit")->name("$uri.edit");
    Route::put("/{{$name}}", "update")->name("$uri.update");
    Route::delete("/{{$name}}", "destroy")->name("$uri.destroy");

    Route::post("/{{$name}}/comment", "addComment")->name("$uri.addComment");
    Route::delete("/{{$name}}/comment/{id}", "removeComment")->name("$uri.removeComment");

    Route::post("/{{$name}}/tag", "addTag")->name("$uri.addTag");
    Route::delete("/{{$name}}/tag/{id}", "removeTag")->name("$uri.removeTag");

    Route::post("/{{$name}}/file", "addFile")->name("$uri.addFile");
    Route::delete("/{{$name}}/file/{id}", "removeFile")->name("$uri.removeFile");
  });
});



Route::get('/', function () {
  return redirect()->route('dashboard');
});


Route::middleware('auth')->group(function () {
  Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
  Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
  Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

// Languages
Route::controller(\App\Http\Controllers\Core\LanguageController::class)->group(function () {
  Route::get('/lang', 'index')->name('lang.index');
  Route::post('/lang', 'set')->name('lang.set');
});
Route::middleware(['auth', 'lang'])->group(function () {
  // Dashboard
  Route::get('/dashboard', function () {
    return Inertia::render('Dashboard');
  })->name('dashboard');

  // Tags
  Route::resourceDetail('tags', 'tag', \App\Http\Controllers\Core\TagController::class);
  // Files
  Route::get('/files/{file}/preview', [\App\Http\Controllers\Core\FileController::class, 'show'])->name('files.show');
  Route::resourceDetail('files', 'file', \App\Http\Controllers\Core\FileController::class);
  // Users
  Route::resourceDetail('users', 'user', \App\Http\Controllers\User\UserController::class);
});

require __DIR__ . '/auth.php';
