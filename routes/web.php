<?php

use Inertia\Inertia;
use Illuminate\Support\Facades\Route;


Route::macro('resourceDetail', function ($name, $controller, bool $isSubmmitable = false, $nestedShow = null) {
  $uri = \Illuminate\Support\Str::plural($name);
  Route::prefix("/{$uri}")->controller($controller)->group(function () use ($uri, $name, $nestedShow, $isSubmmitable) {
    Route::get("/", "index")->name("$uri.index");
    Route::post("/", "store")->name("$uri.store");
    Route::get("/create/{ref?}", "create")->name("$uri.create")->where('ref', '.*');
    if ($nestedShow) {
      Route::prefix("/{{$name}}")->group($nestedShow)->name("$uri.show");
    }
    Route::get("/{{$name}}", "show")->name("$uri.show");
    if ($isSubmmitable) {
      Route::put("/{{$name}}/submit", "submit")->name("$uri.submit");
      Route::put("/{{$name}}/{level?}", "update")->name("$uri.update");
    } else {
      Route::put("/{{$name}}", "update")->name("$uri.update");
    }
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
  Route::post('/lang', action: 'set')->name('lang.set');
});

// Route for Preview Image
Route::get('/files/{file}/preview', [\App\Http\Controllers\Core\FileController::class, 'preview'])->name('files.preview');
// Get Data from Model Direct
Route::post('/model', \App\Http\Controllers\ModelController::class)
  ->middleware(middleware: ['auth'])
  ->name('model');
Route::post('/model/datatable', [\App\Http\Controllers\ModelController::class, "datatable"])
  ->middleware(middleware: ['auth'])
  ->name('model.datatable');
Route::get('/model/{model}', [\App\Http\Controllers\ModelController::class, 'columns'])
  ->where('model', '.*')
  ->middleware(middleware: ['auth'])
  ->name('model.columns');

Route::middleware(['auth', 'lang', 'app'])->group(function () {
  Route::get('/logs/{log}', [\App\Http\Controllers\Core\LogController::class, 'show'])->name('logs.show');
  // Branch Switcher
  Route::put('/switch_branch/{id}', [\App\Http\Controllers\Core\BranchController::class, 'switch'])->name('branch.switch');
  // Dashboard
  Route::get('/dashboard', function () {
    return Inertia::render('Dashboard');
  })->name('dashboard');
  // Settings
  Route::prefix('/settings')->group(function () {
    // Company
    Route::controller(\App\Http\Controllers\Core\CompanyController::class)->group(function () {
      Route::get('company', 'index')->name('companies.index');
      Route::put('company', 'update')->name('companies.update');
    });
    // Branches
    Route::resourceDetail('branch', \App\Http\Controllers\Core\BranchController::class);
    Route::resourceDetail('formatingSeries', \App\Http\Controllers\Core\FormatingSeriesController::class);
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
  Route::resourceDetail('itemVariant', \App\Http\Controllers\Inventory\ItemVariantController::class);
  // ItemAlternatives
  Route::resourceDetail('itemAlternative', \App\Http\Controllers\Inventory\ItemAlternativeController::class);
  //Attributes
  Route::resourceDetail('attribute', \App\Http\Controllers\Inventory\AttributeController::class);

  /// Purchase Group
  // Supplier
  Route::resourceDetail('supplier', \App\Http\Controllers\Purchase\SupplierController::class);
  // Purchase Request
  Route::resourceDetail('purchaseRequest', \App\Http\Controllers\Purchase\PurchaseRequestController::class);
  // Purchase Order
  Route::resourceDetail('purchaseOrder', \App\Http\Controllers\Purchase\PurchaseOrderController::class);
  /// Purchase Group End

  // Customer
  Route::resourceDetail('customer', \App\Http\Controllers\Sales\CustomerController::class);

  /// Service Group
  // Work Order
  Route::resourceDetail('workOrder', \App\Http\Controllers\Service\WorkOrderController::class, isSubmmitable: true);
  /// Service Group End
  /// Sales Groups
  // Sales Orders
  Route::resourceDetail('salesOrder', \App\Http\Controllers\Sales\SalesOrderController::class, isSubmmitable: true);
  // Internal Orders
  Route::resourceDetail('internalOrder', \App\Http\Controllers\Sales\InternalOrderController::class, isSubmmitable: true);
  /// Sales Groups End
  // Finances
  // Taxes
  Route::resourceDetail('tax', \App\Http\Controllers\Finances\TaxesController::class);
});


require __DIR__ . '/auth.php';
