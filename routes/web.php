<?php
use Inertia\Inertia;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
*/

Route::macro('resourceDetail', function ($name, $controller, bool $isSubmmitable = false, $nestedShow = null) {
  $uri = \Illuminate\Support\Str::plural($name);
  Route::prefix("/{$uri}")->controller($controller)->group(function () use ($uri, $name, $nestedShow, $isSubmmitable) {
    Route::get("/", "index")->name("$uri.index");
    Route::post("/", "store")->name("$uri.store");
    Route::get("/create/{ref?}", "create")->name("$uri.create")->where('ref', '.*');

    if ($isSubmmitable) {
      Route::put("/{{$name}}/submit", "submit")->name("$uri.submit");
      Route::put("/{{$name}}/cancel", "cancel")->name("$uri.cancel");
      Route::put("/{{$name}}/amend", "amend")->name("$uri.amend");
      Route::put("/{{$name}}/{level?}", "update")->name("$uri.update");
      Route::get("/create-print-template", 'createPrintTemplate')->name("$uri.createPrintTemplate");
      Route::get("/{{$name}}/print/{printTemplate?}", 'print')->name("$uri.print");
    } else {
      Route::put("/{{$name}}", action: "update")->name("$uri.update");
    }

    if ($nestedShow) {
      Route::prefix("/{{$name}}")->group($nestedShow)->name("$uri.show");
    }
    Route::get("/{{$name}}", "show")->name("$uri.show");
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
Route::get('/company-logo', \App\Http\Controllers\Core\CompanyLogoController::class)->name('company-logo');

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
  if (config('app.debug')) {
    Route::get('/status', function () {
      return Inertia::render('Status', [
        'canLogin'       => Route::has('login'),
        'canRegister'    => Route::has('register'),
        'laravelVersion' => \Illuminate\Foundation\Application::VERSION,
        'phpVersion'     => PHP_VERSION,
        'statuses'       => collect(App\FormStatus::cases())
          ->map(fn (App\FormStatus $status) => [
            'name'  => $status->name,
            'value' => $status->value,
            'label' => $status->label(),
          ])
          ->values(),
      ]);
    });
  }
  Route::get('/logs/{log}', [\App\Http\Controllers\Core\LogController::class, 'show'])->name('logs.show');
  // Branch Switcher
  Route::put('/switch_branch/{id}', [\App\Http\Controllers\Core\BranchController::class, 'switch'])->name('branch.switch');
  // Dashboard
  Route::get('dashboard', [\App\Http\Controllers\Core\DashboardController::class, 'dashboard'])->name('dashboard');
  Route::resourceDetail('dashboard', \App\Http\Controllers\Core\DashboardController::class);
  // Settings
  Route::prefix('/settings')->group(function () {
    // Company
    Route::controller(\App\Http\Controllers\Core\CompanyController::class)->group(function () {
      Route::get('company', 'index')->name('companies.index');
      Route::put('company', 'update')->name('companies.update');
      Route::post('company/image', 'image')->name('companies.image');
    });
    // Branches
    Route::resourceDetail('branch', \App\Http\Controllers\Core\BranchController::class);
    Route::resourceDetail('formatingSeries', \App\Http\Controllers\Core\FormatingSeriesController::class);
    Route::resourceDetail('approvalScheme', \App\Http\Controllers\Core\ApprovalSchemeController::class);

    Route::resourceDetail('printTemplates', \App\Http\Controllers\Core\PrintTemplateController::class);
    Route::get('/printTemplates/{printTemplates}/editor', [\App\Http\Controllers\Core\PrintTemplateController::class, 'editor'])->name('printTemplates.editor');
    Route::resourceDetail('widgets', \App\Http\Controllers\Core\WidgetController::class);
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
  // Approval Instance
  Route::get('approvals', [\App\Http\Controllers\Core\ApprovalInstanceController::class, 'index'])->name('approvalInstances.index');
  Route::get('approvals/{approvalInstance}', [\App\Http\Controllers\Core\ApprovalInstanceController::class, 'show'])->name('approvalInstances.show');
  Route::post('approvals/{approvalInstanceStep}/decision', [\App\Http\Controllers\Core\ApprovalInstanceController::class, 'decision'])->name('approvalInstances.decision');

  /// Inventories Group
  // Warehouse
  Route::resourceDetail('warehouse', \App\Http\Controllers\Inventory\WarehouseController::class);
  //Units
  Route::get('/units/groups/{search?}', [\App\Http\Controllers\Inventory\UnitController::class, 'getGroups'])->name('units.groups');
  Route::resourceDetail('unit', \App\Http\Controllers\Inventory\UnitController::class);
  // Categories
  Route::resourceDetail('category', \App\Http\Controllers\Inventory\CategoryController::class);
  // Items
  Route::resourceDetail('item', \App\Http\Controllers\Inventory\ItemController::class);
  Route::post('itemVariants/info', [\App\Http\Controllers\Inventory\ItemVariantController::class, 'info'])->name('itemVariants.info');
  Route::resourceDetail('itemVariant', \App\Http\Controllers\Inventory\ItemVariantController::class);
  // ItemAlternatives
  Route::resourceDetail('itemAlternative', \App\Http\Controllers\Inventory\ItemAlternativeController::class);
  // Attributes
  Route::resourceDetail('attribute', \App\Http\Controllers\Inventory\AttributeController::class);
  // Stock Entries
  Route::resourceDetail('stockEntry', \App\Http\Controllers\Inventory\StockEntryController::class, isSubmmitable: true);
  // Delivery Notes
  Route::resourceDetail('deliveryNote', \App\Http\Controllers\Inventory\DeliveryNoteController::class, isSubmmitable: true);
  // Stock Ledgers
  Route::resourceDetail('stockLedger', \App\Http\Controllers\Inventory\StockLedgerController::class);
  /// Inventories Group End

  /// Purchase Group
  // Supplier
  Route::resourceDetail('supplier', \App\Http\Controllers\Purchase\SupplierController::class);
  // Purchase Request
  Route::resourceDetail('purchaseRequest', \App\Http\Controllers\Purchase\PurchaseRequestController::class, isSubmmitable: true);
  // Purchase Order
  Route::resourceDetail('purchaseOrder', \App\Http\Controllers\Purchase\PurchaseOrderController::class, isSubmmitable: true);
  // Purchase Receipt
  Route::resourceDetail('purchaseReceipt', \App\Http\Controllers\Purchase\PurchaseReceiptController::class, isSubmmitable: true);
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

  /// Finances
  //Accounts
  Route::resourceDetail('account', \App\Http\Controllers\Finances\AccountController::class);
  //General Ledgers
  Route::resourceDetail('generalLedger', \App\Http\Controllers\Finances\GeneralLedgerController::class);
  // Payment Methods
  Route::resourceDetail('paymentMethod', \App\Http\Controllers\Finances\PaymentMethodController::class);
  // Payment Terms
  // Route::resourceDetail('paymentTerm', \App\Http\Controllers\Finances\PaymentTermController::class);
  // Payment Term Template
  Route::resourceDetail('paymentTermTemplate', \App\Http\Controllers\Finances\PaymentTermTemplateController::class);
  // Payment Entries
  Route::resourceDetail('paymentEntry', \App\Http\Controllers\Finances\PaymentEntryController::class, isSubmmitable: true);
  // Purchase Invoices
  Route::resourceDetail('purchaseInvoice', \App\Http\Controllers\Finances\PurchaseInvoiceController::class, isSubmmitable: true);
  // Sales Invoices
  Route::resourceDetail('salesInvoice', \App\Http\Controllers\Finances\SalesInvoiceController::class, isSubmmitable: true);
  // Taxes
  Route::resourceDetail('tax', \App\Http\Controllers\Finances\TaxesController::class);
  /// Finances End
});

require __DIR__ . '/auth.php';
