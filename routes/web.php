<?php
use App\Enums\FormStatus;
use App\Http\Controllers\Core\ApprovalInstanceController;
use App\Http\Controllers\Core\ApprovalSchemeController;
use App\Http\Controllers\Core\BranchController;
use App\Http\Controllers\Core\ChangelogController;
use App\Http\Controllers\Core\CommandSearchController;
use App\Http\Controllers\Core\CompanyController;
use App\Http\Controllers\Core\CompanyLogoController;
use App\Http\Controllers\Core\CountryController;
use App\Http\Controllers\Core\CurrencyController;
use App\Http\Controllers\Core\DashboardController;
use App\Http\Controllers\Core\EmailTemplateController;
use App\Http\Controllers\Core\FileController;
use App\Http\Controllers\Core\FormatingSeriesController;
use App\Http\Controllers\Core\HtmlSanitizeController;
use App\Http\Controllers\Core\LanguageController;
use App\Http\Controllers\Core\LogController;
use App\Http\Controllers\Core\NotificationController;
use App\Http\Controllers\Core\PrintTemplateController;
use App\Http\Controllers\Core\SavedFilterController;
use App\Http\Controllers\Core\TagController;
use App\Http\Controllers\Core\TodoController;
use App\Http\Controllers\Core\WidgetController;
use App\Http\Controllers\CRM\LeadController;
use App\Http\Controllers\CRM\OpportunityController;
use App\Http\Controllers\CRM\QuotationController;
use App\Http\Controllers\Finances\AccountController;
use App\Http\Controllers\Finances\GeneralLedgerController;
use App\Http\Controllers\Finances\PaymentEntryController;
use App\Http\Controllers\Finances\PaymentMethodController;
use App\Http\Controllers\Finances\PaymentTermTemplateController;
use App\Http\Controllers\Finances\PurchaseInvoiceController;
use App\Http\Controllers\Finances\SalesInvoiceController;
use App\Http\Controllers\Finances\TaxesController;
use App\Http\Controllers\Helpdesk\TicketController;
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
use App\Http\Middleware\HandleInertiaRequests;
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
            Route::post("/{{$name}}/print/{printTemplate}/pdf", 'printPdf')->name("$uri.print.pdf");
            Route::get("/{{$name}}/email/{emailTemplate?}", 'emailPreview')->name("$uri.email.preview");
            Route::post("/{{$name}}/email", 'sendEmail')->name("$uri.email.send");
        } else {
            Route::put("/{{$name}}", action: 'update')->name("$uri.update");
        }

        if ($nestedShow) {
            Route::prefix("/{{$name}}")->group($nestedShow)->name("$uri.show");
        }
        Route::get("/{{$name}}", 'show')->name("$uri.show");
        Route::delete("/{{$name}}", 'destroy')->name("$uri.destroy");

        Route::post("/{{$name}}/comment", 'addComment')->name("$uri.addComment");
        Route::put("/{{$name}}/comment/{id}", 'editComment')->name("$uri.editComment");
        Route::delete("/{{$name}}/comment/{id}", 'removeComment')->name("$uri.removeComment");

        Route::post("/{{$name}}/tag", 'addTag')->name("$uri.addTag");
        Route::delete("/{{$name}}/tag/{id}", 'removeTag')->name("$uri.removeTag");

        Route::post("/{{$name}}/file", 'addFile')->name("$uri.addFile");
        Route::delete("/{{$name}}/file/{id}", 'removeFile')->name("$uri.removeFile");

        Route::post("/{{$name}}/assignee", 'addAssignee')->name("$uri.addAssignee");
        Route::delete("/{{$name}}/assignee/{id}", 'removeAssignee')->name("$uri.removeAssignee");
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
Route::post('/model/select-data', [ModelController::class, 'selectData'])
    ->middleware(middleware: ['auth'])
    ->name('model.selectData');
Route::get('/model/{model}', [ModelController::class, 'columns'])
    ->where('model', '.*')
    ->middleware(middleware: ['auth'])
    ->name('model.columns');
// Saved filters (FilterTable transport via ?fid=)
Route::middleware(['auth'])
    ->withoutMiddleware([HandleInertiaRequests::class])
    ->group(function () {
        Route::get('/saved-filters', [SavedFilterController::class, 'index'])->name('saved-filters.index');
        Route::get('/saved-filters/{savedFilter}', [SavedFilterController::class, 'show'])->name('saved-filters.show');
        Route::post('/saved-filters', [SavedFilterController::class, 'store'])->name('saved-filters.store');
        Route::patch('/saved-filters/{savedFilter}', [SavedFilterController::class, 'update'])->name('saved-filters.update');
        Route::delete('/saved-filters/{savedFilter}', [SavedFilterController::class, 'destroy'])->name('saved-filters.destroy');
    });
Route::post('/api/html/sanitize', HtmlSanitizeController::class)
    ->middleware(middleware: ['auth'])
    ->withoutMiddleware([HandleInertiaRequests::class])
    ->name('api.html.sanitize');
Route::get('/commands/search', [CommandSearchController::class, 'index'])
    ->middleware(middleware: ['auth'])
    ->withoutMiddleware([HandleInertiaRequests::class])
    ->name('commands.search');
Route::post('/commands/recent', [CommandSearchController::class, 'track'])
    ->middleware(middleware: ['auth'])
    ->withoutMiddleware([HandleInertiaRequests::class])
    ->name('commands.recent.track');
Route::delete('/commands/recent', [CommandSearchController::class, 'remove'])
    ->middleware(middleware: ['auth'])
    ->withoutMiddleware([HandleInertiaRequests::class])
    ->name('commands.recent.remove');

Route::middleware(['auth', 'lang', 'onboarded', 'app'])->group(function () {
    if (config('app.debug')) {
        Route::get('/test/link-model', function () {
            return Inertia::render('Test/LinkModelTest');
        });

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
    Route::post('dashboard-update', [DashboardController::class, 'storeUserDashboard'])->name('dashboardForms.store');
    Route::post('dashboard-widget-order/{dashboard}', [DashboardController::class, 'reorderWidgets'])->name('dashboard.widgets.reorder');
    Route::post('get-chart/{widget}', [WidgetController::class, 'getChartData'])->name('get-chart');
    // Settings
    Route::prefix('/settings')->group(function () {
        // Dashboard
        Route::resourceDetail('dashboard', DashboardController::class);

        // Company
        Route::controller(CompanyController::class)->group(function () {
            Route::get('company', 'index')->name('companies.index');
            Route::put('company', 'update')->name('companies.update');
            Route::post('company/image', 'image')->name('companies.image');
            Route::delete('company/image', 'removeImage')->name('companies.removeImage');
        });
        // Branches
        Route::resourceDetail('branch', BranchController::class);
        // Countries & Currencies
        Route::resourceDetail('country', CountryController::class);
        Route::resourceDetail('currency', CurrencyController::class);
        Route::resourceDetail('formatingSeries', FormatingSeriesController::class);
        Route::resourceDetail('approvalScheme', ApprovalSchemeController::class);

        Route::resourceDetail('printTemplate', PrintTemplateController::class);
        Route::get('/printTemplates/{printTemplate}/editor', [PrintTemplateController::class, 'editor'])->name('printTemplates.editor');
        Route::post('/printTemplates/{printTemplate}/preview', [PrintTemplateController::class, 'preview'])->name('printTemplates.preview');
        Route::post('/printTemplates/{printTemplate}/generate-example-data', [PrintTemplateController::class, 'generateExampleData'])->name('printTemplates.generate-example-data');

        Route::get('/emailTemplates/fields', [EmailTemplateController::class, 'fields'])->name('emailTemplates.fields');
        Route::resourceDetail('emailTemplate', EmailTemplateController::class);
        Route::post('/emailTemplates/{emailTemplate}/test-send', [EmailTemplateController::class, 'testSend'])->name('emailTemplates.testSend');
        Route::resourceDetail('widget', WidgetController::class);
    });
    // Tags
    Route::resourceDetail('tag', TagController::class);
    // Files
    Route::resourceDetail('file', FileController::class);
    // ToDo
    Route::resourceDetail('todo', TodoController::class);
    // Users
    Route::get('/users/{user}/connect/{driver}/redirect', [UserController::class, 'connectToProvider'])->name('users.connect-provider');
    Route::post('/users/{user}/image', [UserController::class, 'image'])->name('users.image');
    Route::delete('/users/{user}/image', [UserController::class, 'removeImage'])->name('users.removeImage');
    Route::resourceDetail('user', UserController::class);
    // Roles
    Route::get('/roles/permissions', [RoleController::class, 'permissions'])->name('roles.permissions');
    Route::resourceDetail('role', RoleController::class);
    // Approval Instance
    Route::get('approvals', [ApprovalInstanceController::class, 'index'])->name('approvalInstances.index');
    Route::get('approvals/{approvalInstance}', [ApprovalInstanceController::class, 'show'])->name('approvalInstances.show');
    Route::post('approvals/{approvalInstanceStep}/decision', [ApprovalInstanceController::class, 'decision'])->name('approvalInstances.decision');
    // Notifications — JSON API murni (dipanggil dari Popover, bukan navigasi
    // halaman), tidak butuh Inertia sharing sama sekali. withoutMiddleware
    // menghindari resolveSharedUserRoleIds() dkk yang tidak relevan di sini.
    Route::withoutMiddleware([HandleInertiaRequests::class])->group(function () {
        Route::get('notifications', [NotificationController::class, 'index'])->name('notifications.index');
        Route::post('notifications/{id}/read', [NotificationController::class, 'markAsRead'])->name('notifications.read');
        Route::post('notifications/read-all', [NotificationController::class, 'markAllAsRead'])->name('notifications.readAll');
    });

    // / Inventories Group
    // Warehouse
    Route::resourceDetail('warehouse', WarehouseController::class);
    // Units
    Route::get('/units/groups/{search?}', [UnitController::class, 'getGroups'])->name('units.groups');
    Route::resourceDetail('unit', UnitController::class);
    // Categories
    Route::resourceDetail('category', CategoryController::class);
    // Items
    Route::post('/items/{item}/image', [ItemController::class, 'image'])->name('items.image');
    Route::delete('/items/{item}/image', [ItemController::class, 'removeImage'])->name('items.removeImage');
    Route::resourceDetail('item', ItemController::class);
    Route::post('itemVariants/info', [ItemVariantController::class, 'info'])->name('itemVariants.info');
    Route::post('/itemVariants/{itemVariant}/image', [ItemVariantController::class, 'image'])->name('itemVariants.image');
    Route::delete('/itemVariants/{itemVariant}/image', [ItemVariantController::class, 'removeImage'])->name('itemVariants.removeImage');
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
    Route::post('purchaseOrders/{purchaseOrder}/sync-items', [PurchaseOrderController::class, 'syncItems'])->name('purchaseOrders.syncItems');
    Route::post('purchaseOrders/{purchaseOrder}/mark-done', [PurchaseOrderController::class, 'markDone'])->name('purchaseOrders.markDone');
    // Purchase Receipt
    Route::resourceDetail('purchaseReceipt', PurchaseReceiptController::class, isSubmmitable: true);
    // / Purchase Group End

    // Customer
    Route::resourceDetail('customer', CustomerController::class);

    // / CRM Group
    Route::resourceDetail('lead', LeadController::class);
    Route::put('/leads/{lead}/convert', [LeadController::class, 'convert'])->name('leads.convert');
    Route::resourceDetail('opportunity', OpportunityController::class);
    Route::resourceDetail('quotation', QuotationController::class, isSubmmitable: true);
    // / CRM Group End

    // / Service Group
    // Work Order
    Route::resourceDetail('workOrder', WorkOrderController::class, isSubmmitable: true);
    // / Service Group End

    // / Helpdesk Group
    // Ticket
    Route::resourceDetail('ticket', TicketController::class);
    Route::put('/tickets/{ticket}/markDone', [TicketController::class, 'markDone'])->name('tickets.markDone');
    Route::put('/tickets/{ticket}/updateTicket', [TicketController::class, 'updateTicket'])->name('tickets.updateTicket');
    // Changelog
    Route::get('/changelogs', [ChangelogController::class, 'index'])->name('changelogs.index');
    // / Helpdesk Group End

    // / Sales Groups
    // Sales Orders
    Route::resourceDetail('salesOrder', SalesOrderController::class, isSubmmitable: true);
    Route::post('salesOrders/{salesOrder}/sync-items', [SalesOrderController::class, 'syncItems'])->name('salesOrders.syncItems');
    Route::post('salesOrders/{salesOrder}/mark-done', [SalesOrderController::class, 'markDone'])->name('salesOrders.markDone');
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

Route::get('/health', fn () => response()->json(['status' => 'ok']));

require __DIR__ . '/auth.php';
