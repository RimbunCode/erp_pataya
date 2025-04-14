<?php

use App\Http\Controllers\ProfileController;
use Illuminate\Foundation\Application;
use Inertia\Inertia;
use Illuminate\Support\Facades\Route;


Route::macro('resourceDetail', function ($name, $controller, $nestedShow = null) {
  $uri = \Illuminate\Support\Str::plural($name);
  Route::prefix("/{$uri}")->controller($controller)->group(function () use ($uri, $name, $nestedShow) {
    Route::get("/", "index")->name("$uri.index");
    Route::post("/", "store")->name("$uri.store");
    Route::get("/create", "create")->name("$uri.create");
    if ($nestedShow) {
      Route::prefix("/{{$name}}")->group($nestedShow)->name("$uri.show");
    }
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

// Languages
Route::controller(\App\Http\Controllers\Core\LanguageController::class)->group(function () {
  Route::get('/lang', 'index')->name('lang.index');
  Route::post('/lang', 'set')->name('lang.set');
});

// Route for Preview Image
Route::get('/files/{file}/preview', [\App\Http\Controllers\Core\FileController::class, 'preview'])->name('files.preview');
// Get Data from Model Direct
Route::post('/model', \App\Http\Controllers\ModelController::class)
  ->middleware(['auth'])
  ->name('model');
Route::middleware(['auth', 'lang', 'app'])->group(function () {
  // Branch Switcher
  Route::put('/switch_branch/{id}', [\App\Http\Controllers\Core\BranchController::class, 'switch'])->name('branch.switch');
  // Dashboard
  Route::get('/dashboard', function () {
    return Inertia::render('Dashboard');
  })->name('dashboard');
  // Settings
  Route::prefix('/settings')->group(function () {
    // Company
    Route::resource('company', \App\Http\Controllers\Core\CompanyController::class)->only(['index', 'store']);
    // Branches
    Route::resourceDetail('branch', \App\Http\Controllers\Core\BranchController::class);
  });
  // Tags
  Route::resourceDetail('tag', \App\Http\Controllers\Core\TagController::class);
  // Files
  Route::resourceDetail('file', \App\Http\Controllers\Core\FileController::class);
  // Users
  Route::post('/users/{user}/image', [\App\Http\Controllers\User\UserController::class, 'image'])->name('users.image');
  Route::resourceDetail('user', \App\Http\Controllers\User\UserController::class);
  // Roles
  Route::get('/roles/permissions', [\App\Http\Controllers\User\RoleController::class, 'permissions'])->name('roles.permissions');
  Route::resourceDetail('role', \App\Http\Controllers\User\RoleController::class);
  // Warehouse
  Route::resourceDetail('warehouse', \App\Http\Controllers\Inventory\WarehouseController::class);
  //Units
  Route::get('/units/groups/{search?}', [\App\Http\Controllers\Inventory\UnitController::class, 'getGroups'])->name('units.groups');
  Route::resourceDetail('unit', \App\Http\Controllers\Inventory\UnitController::class);
  // Categories
  Route::resourceDetail('category', \App\Http\Controllers\Inventory\CategoryController::class);
  // Items
  Route::resourceDetail('item', \App\Http\Controllers\Inventory\ItemController::class);
  Route::resourceDetail('variant', \App\Http\Controllers\Inventory\ItemVariantController::class);
  // ItemAlternatives
  Route::resourceDetail('itemAlternative', \App\Http\Controllers\Inventory\ItemAlternativeController::class);
  //Attributes
  Route::resourceDetail('attribute', \App\Http\Controllers\Inventory\AttributeController::class);
  // Supplier
  Route::resourceDetail('supplier', \App\Http\Controllers\Purchase\SupplierController::class);
});

require __DIR__ . '/auth.php';
