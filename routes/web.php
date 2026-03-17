<?php

use App\FormStatus;
use App\Http\Controllers\Core\ApprovalInstanceController;
use App\Http\Controllers\Core\ApprovalSchemeController;
use App\Http\Controllers\Core\BranchController;
use App\Http\Controllers\Core\CompanyController;
use App\Http\Controllers\Core\CompanyLogoController;
use App\Http\Controllers\Core\DashboardController;
use App\Http\Controllers\Core\FileController;
use App\Http\Controllers\Core\FormatingSeriesController;
use App\Http\Controllers\Core\LanguageController;
use App\Http\Controllers\Core\LogController;
use App\Http\Controllers\Core\PrintTemplateController;
use App\Http\Controllers\Core\TagController;
use App\Http\Controllers\Core\WidgetController;
use App\Http\Controllers\Finances\AccountController;
use App\Http\Controllers\Finances\GeneralLedgerController;
use App\Http\Controllers\Finances\PaymentEntryController;
use App\Http\Controllers\Finances\PaymentMethodController;
use App\Http\Controllers\Finances\PaymentTermTemplateController;
use App\Http\Controllers\Finances\PurchaseInvoiceController;
use App\Http\Controllers\Finances\SalesInvoiceController;
use App\Http\Controllers\Finances\TaxesController;
use App\Http\Controllers\Inventory\AttributeController;
use App\Http\Controllers\Inventory\CategoryController;
use App\Http\Controllers\Inventory\DeliveryNoteController;
use App\Http\Controllers\Inventory\ItemAlternativeController;
use App\Http\Controllers\Inventory\ItemController;
use App\Http\Controllers\Inventory\ItemVariantController;
use App\Http\Controllers\Inventory\StockEntryController;
use App\Http\Controllers\Inventory\StockLedgerController;
use App\Http\Controllers\Inventory\UnitController;
use App\Http\Controllers\Inventory\WarehouseController;
use App\Http\Controllers\ModelController;
use App\Http\Controllers\Purchase\PurchaseOrderController;
use App\Http\Controllers\Purchase\PurchaseReceiptController;
use App\Http\Controllers\Purchase\PurchaseRequestController;
use App\Http\Controllers\Purchase\SupplierController;
use App\Http\Controllers\Sales\CustomerController;
use App\Http\Controllers\Sales\InternalOrderController;
use App\Http\Controllers\Sales\SalesOrderController;
use App\Http\Controllers\Service\WorkOrderController;
use App\Http\Controllers\User\RoleController;
use App\Http\Controllers\User\UserController;
use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Inertia\Inertia;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
*/

Route::macro('resourceDetail', function ($name, $controller, bool $isSubmmitable = false, $nestedShow = null) {
    $uri = Str::plural($name);
    Route::prefix("/{$uri}")->controller($controller)->group(function () use ($uri, $name, $nestedShow, $isSubmmitable) {
        Route::get('/', 'index')->name("$uri.index");
        Route::post('/', 'store')->name("$uri.store");
        Route::get('/create/{ref?}', 'create')->name("$uri.create")->where('ref', '.*');

        if ($isSubmmitable) {
            Route::put("/{{$name}}/submit", 'submit')->name("$uri.submit");
            Route::put("/{{$name}}/cancel", 'cancel')->name("$uri.cancel");
            Route::put("/{{$name}}/amend", 'amend')->name("$uri.amend");
            Route::put("/{{$name}}/{level?}", 'update')->name("$uri.update");
            Route::get('/create-print-template', 'createPrintTemplate')->name("$uri.createPrintTemplate");
            Route::get("/{{$name}}/print/{printTemplate?}", 'print')->name("$uri.print");
        } else {
            Route::put("/{{$name}}", action: 'update')->name("$uri.update");
        }

        if ($nestedShow) {
            Route::prefix("/{{$name}}")->group($nestedShow)->name("$uri.show");
        }
        Route::get("/{{$name}}", 'show')->name("$uri.show");
        Route::delete("/{{$name}}", 'destroy')->name("$uri.destroy");

        Route::post("/{{$name}}/comment", 'addComment')->name("$uri.addComment");
        Route::delete("/{{$name}}/comment/{id}", 'removeComment')->name("$uri.removeComment");

        Route::post("/{{$name}}/tag", 'addTag')->name("$uri.addTag");
        Route::delete("/{{$name}}/tag/{id}", 'removeTag')->name("$uri.removeTag");

        Route::post("/{{$name}}/file", 'addFile')->name("$uri.addFile");
        Route::delete("/{{$name}}/file/{id}", 'removeFile')->name("$uri.removeFile");
    });
});

Route::get('/', function () {
    return redirect()->route('dashboard');
});

// Languages
Route::controller(LanguageController::class)->group(function () {
    Route::get('/lang', 'index')->name('lang.index');
    Route::post('/lang', action: 'set')->name('lang.set');
});

// Route for Preview Image
Route::get('/company-logo', CompanyLogoController::class)->name('company-logo');

Route::get('/files/{file}/preview', [FileController::class, 'preview'])->name('files.preview');
// Get Data from Model Direct
Route::post('/model', ModelController::class)
    ->middleware(middleware: ['auth'])
    ->name('model');
Route::post('/model/datatable', [ModelController::class, 'datatable'])
    ->middleware(middleware: ['auth'])
    ->name('model.datatable');
Route::get('/model/{model}', [ModelController::class, 'columns'])
    ->where('model', '.*')
    ->middleware(middleware: ['auth'])
    ->name('model.columns');

Route::middleware(['auth', 'lang', 'app'])->group(function () {
    if (config('app.debug')) {
        Route::get('/status', function () {
            return Inertia::render('Status', [
                'canLogin'       => Route::has('login'),
                'canRegister'    => Route::has('register'),
                'laravelVersion' => Application::VERSION,
                'phpVersion'     => PHP_VERSION,
                'statuses'       => collect(FormStatus::cases())
                    ->map(fn (FormStatus $status) => [
                        'name'  => $status->name,
                        'value' => $status->value,
                        'label' => $status->label(),
                    ])
                    ->values(),
            ]);
        });
    }
    Route::get('/logs/{log}', [LogController::class, 'show'])->name('logs.show');
    // Branch Switcher
    Route::put('/switch_branch/{id}', [BranchController::class, 'switch'])->name('branch.switch');
    // Dashboard
    Route::get('dashboard-view', [DashboardController::class, 'view'])->name('dashboard');
    Route::resourceDetail('dashboard', DashboardController::class);
    // Settings
    Route::prefix('/settings')->group(function () {
        // Dashboard
        Route::resourceDetail('dashboard', DashboardController::class);

        // Company
        Route::controller(CompanyController::class)->group(function () {
            Route::get('company', 'index')->name('companies.index');
            Route::put('company', 'update')->name('companies.update');
            Route::post('company/image', 'image')->name('companies.image');
        });
        // Branches
        Route::resourceDetail('branch', BranchController::class);
        Route::resourceDetail('formatingSeries', FormatingSeriesController::class);
        Route::resourceDetail('approvalScheme', ApprovalSchemeController::class);

        Route::resourceDetail('printTemplates', PrintTemplateController::class);
        Route::get('/printTemplates/{printTemplates}/editor', [PrintTemplateController::class, 'editor'])->name('printTemplates.editor');
        Route::resourceDetail('widget', WidgetController::class);
    });
    // Tags
    Route::resourceDetail('tag', TagController::class);
    // Files
    Route::resourceDetail('file', FileController::class);
    // Users
    Route::post('/users/{user}/image', [UserController::class, 'image'])->name('users.image');
    Route::resourceDetail('user', UserController::class);
    // Roles
    Route::get('/roles/permissions', [RoleController::class, 'getPermissions'])->name('roles.permissions');
    Route::resourceDetail('role', RoleController::class);
    // Approval Instance
    Route::get('approvals', [ApprovalInstanceController::class, 'index'])->name('approvalInstances.index');
    Route::get('approvals/{approvalInstance}', [ApprovalInstanceController::class, 'show'])->name('approvalInstances.show');
    Route::post('approvals/{approvalInstanceStep}/decision', [ApprovalInstanceController::class, 'decision'])->name('approvalInstances.decision');

    // / Inventories Group
    // Warehouse
    Route::resourceDetail('warehouse', WarehouseController::class);
    // Units
    Route::get('/units/groups/{search?}', [UnitController::class, 'getGroups'])->name('units.groups');
    Route::resourceDetail('unit', UnitController::class);
    // Categories
    Route::resourceDetail('category', CategoryController::class);
    // Items
    Route::resourceDetail('item', ItemController::class);
    Route::post('itemVariants/info', [ItemVariantController::class, 'info'])->name('itemVariants.info');
    Route::resourceDetail('itemVariant', ItemVariantController::class);
    // ItemAlternatives
    Route::resourceDetail('itemAlternative', ItemAlternativeController::class);
    // Attributes
    Route::resourceDetail('attribute', AttributeController::class);
    // Stock Entries
    Route::resourceDetail('stockEntry', StockEntryController::class, isSubmmitable: true);
    // Delivery Notes
    Route::resourceDetail('deliveryNote', DeliveryNoteController::class, isSubmmitable: true);
    // Stock Ledgers
    Route::resourceDetail('stockLedger', StockLedgerController::class);
    // / Inventories Group End

    // / Purchase Group
    // Supplier
    Route::resourceDetail('supplier', SupplierController::class);
    // Purchase Request
    Route::resourceDetail('purchaseRequest', PurchaseRequestController::class, isSubmmitable: true);
    // Purchase Order
    Route::resourceDetail('purchaseOrder', PurchaseOrderController::class, isSubmmitable: true);
    // Purchase Receipt
    Route::resourceDetail('purchaseReceipt', PurchaseReceiptController::class, isSubmmitable: true);
    // / Purchase Group End

    // Customer
    Route::resourceDetail('customer', CustomerController::class);

    // / Service Group
    // Work Order
    Route::resourceDetail('workOrder', WorkOrderController::class, isSubmmitable: true);
    // / Service Group End

    // / Sales Groups
    // Sales Orders
    Route::resourceDetail('salesOrder', SalesOrderController::class, isSubmmitable: true);
    // Internal Orders
    Route::resourceDetail('internalOrder', InternalOrderController::class, isSubmmitable: true);
    // / Sales Groups End

    // / Finances
    // Accounts
    Route::resourceDetail('account', AccountController::class);
    // General Ledgers
    Route::resourceDetail('generalLedger', GeneralLedgerController::class);
    // Payment Methods
    Route::resourceDetail('paymentMethod', PaymentMethodController::class);
    // Payment Terms
    // Route::resourceDetail('paymentTerm', \App\Http\Controllers\Finances\PaymentTermController::class);
    // Payment Term Template
    Route::resourceDetail('paymentTermTemplate', PaymentTermTemplateController::class);
    // Payment Entries
    Route::resourceDetail('paymentEntry', PaymentEntryController::class, isSubmmitable: true);
    // Purchase Invoices
    Route::resourceDetail('purchaseInvoice', PurchaseInvoiceController::class, isSubmmitable: true);
    // Sales Invoices
    Route::resourceDetail('salesInvoice', SalesInvoiceController::class, isSubmmitable: true);
    // Taxes
    Route::resourceDetail('tax', TaxesController::class);
    // / Finances End
});

require __DIR__ . '/auth.php';
