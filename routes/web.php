<?php

use App\Http\Controllers\ProfileController;
use Illuminate\Foundation\Application;
use Inertia\Inertia;
use Illuminate\Support\Facades\Route;

Route::macro('resourceDetail', function ($uri, $name, $controller) {
  Route::prefix("/{$uri}")->controller($controller)->group(function () use ($uri, $name) {
    Route::get("/", "index")->name("$uri.index");
    Route::post("/", "store")->name("$uri.store");
    Route::get("/{{$name}}", "create")->name("$uri.create");
    Route::get("/{{$name}}", "show")->name("$uri.show");
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

// Route for Preview Image
Route::get('/files/{file}/preview', [\App\Http\Controllers\Core\FileController::class, 'preview'])->name('files.show');
Route::middleware(['auth', 'lang'])->group(function () {
  // Dashboard
  Route::get('/dashboard', function () {
    return Inertia::render('Dashboard');
  })->name('dashboard');
  // Settings
  Route::prefix('/settings')->group(function () {
    // Company
    Route::resource('company', \App\Http\Controllers\Core\CompanyController::class)->only(['index', 'store']);
    // Branches
    Route::resourceDetail('branches', 'branch', \App\Http\Controllers\Core\BranchController::class);
  });
  // Tags
  Route::resourceDetail('tags', 'tag', \App\Http\Controllers\Core\TagController::class);
  // Files
  Route::resourceDetail('files', 'file', \App\Http\Controllers\Core\FileController::class);
  // Users
  Route::post('/users/{user}/image', [\App\Http\Controllers\User\UserController::class, 'image'])->name('users.image');
  Route::resourceDetail('users', 'user', \App\Http\Controllers\User\UserController::class);
  // Roles
  Route::get('/roles/permissions', [\App\Http\Controllers\User\RoleController::class, 'permissions'])->name('roles.permissions');
  Route::resourceDetail('roles', 'role', \App\Http\Controllers\User\RoleController::class);

  Route::resourceDetail('suppliers', 'supplier', \App\Http\Controllers\Purchase\SupplierController::class);
});

require __DIR__ . '/auth.php';
