# Referensi Route

> **837 route** terdaftar (`php artisan route:list --except-vendor`, dihitung ulang 25 Juli 2026 — termasuk penambahan modul CRM & Helpdesk serta fitur Todo/Image Uploader yang menyusul sejak angka sebelumnya). Dokumen ini meng-_expand_ semua route, termasuk yang di-generate oleh macro `Route::resourceDetail`, lengkap dengan `Controller@method`.
>
> Sumber: `routes/web.php`, `routes/auth.php`, `routes/console.php`.

## Daftar Isi

- [Cara Membaca Dokumen Ini](#cara-membaca-dokumen-ini)
- [Konvensi: Macro `Route::resourceDetail`](#konvensi-macro-routeresourcedetail)
- [Middleware](#middleware)
- [1. Route Publik & Auth Helper](#1-route-publik--auth-helper)
- [2. Authentication (Breeze + Socialite)](#2-authentication-breeze--socialite)
- [3. Onboarding / Setup](#3-onboarding--setup)
- [4. Core API (non-Inertia)](#4-core-api-non-inertia)
- [5. Dashboard & Widget](#5-dashboard--widget)
- [6. Settings](#6-settings)
- [7. User & Access Management](#7-user--access-management)
- [8. Approval](#8-approval)
- [9. Tags & Files](#9-tags--files)
- [10. Inventory](#10-inventory)
- [11. Purchase](#11-purchase)
- [12. Sales](#12-sales)
- [13. Service](#13-service)
- [14. Finances](#14-finances)
- [15. CRM](#15-crm)
- [16. Helpdesk](#16-helpdesk)
- [Lampiran: Daftar Controller](#lampiran-daftar-controller)

---

## Cara Membaca Dokumen Ini

- Kolom **Action** = `Controller@method`. Namespace dasar `App\Http\Controllers\` dihilangkan untuk keringkasan.
- Controller tanpa `@method` (mis. `Core\HtmlSanitizeController`) adalah **invokable controller** (single-action `__invoke()`).
- Parameter route ditulis `{param}`; `{param?}` = opsional.
- Route yang **tidak punya nama** (`name`) ditandai `—` di kolom Route Name (umumnya POST endpoint Breeze).

---

## Konvensi: Macro `Route::resourceDetail`

Hampir semua resource bisnis didaftarkan lewat satu macro kustom di `routes/web.php:59`:

```php
Route::resourceDetail('salesOrder', SalesOrderController::class, isSubmmitable: true);
```

Macro ini meng-generate **12 route dasar** + **6 route tambahan** bila `isSubmmitable: true`. Pola URI memakai bentuk plural dari nama (`salesOrder` → `salesOrders`).

### Route dasar (selalu di-generate)

| Method | URI | Route Name | Action (`Controller@`) |
|---|---|---|---|
| GET | `/{plural}` | `{plural}.index` | `index` |
| POST | `/{plural}` | `{plural}.store` | `store` |
| GET | `/{plural}/create/{ref?}` | `{plural}.create` | `create` |
| GET | `/{plural}/{id}` | `{plural}.show` | `show` |
| PUT | `/{plural}/{id}` | `{plural}.update` | `update` |
| DELETE | `/{plural}/{id}` | `{plural}.destroy` | `destroy` |
| POST | `/{plural}/{id}/comment` | `{plural}.addComment` | `addComment` |
| DELETE | `/{plural}/{id}/comment/{id}` | `{plural}.removeComment` | `removeComment` |
| POST | `/{plural}/{id}/tag` | `{plural}.addTag` | `addTag` |
| DELETE | `/{plural}/{id}/tag/{id}` | `{plural}.removeTag` | `removeTag` |
| POST | `/{plural}/{id}/file` | `{plural}.addFile` | `addFile` |
| DELETE | `/{plural}/{id}/file/{id}` | `{plural}.removeFile` | `removeFile` |

> `addComment`/`addTag`/`addFile` di-handle oleh trait/base — lihat [Modul Core](modules/core.md).

### Route tambahan (`isSubmmitable: true`)

Untuk dokumen transaksional yang melewati workflow status Draft → Submitted → Cancelled/Amended:

| Method | URI | Route Name | Action |
|---|---|---|---|
| PUT | `/{plural}/{id}/submit` | `{plural}.submit` | `submit` |
| PUT | `/{plural}/{id}/cancel` | `{plural}.cancel` | `cancel` |
| PUT | `/{plural}/{id}/amend` | `{plural}.amend` | `amend` |
| PUT | `/{plural}/{id}/{level?}` | `{plural}.update` | `update` |
| GET | `/{plural}/create-print-template` | `{plural}.createPrintTemplate` | `createPrintTemplate` |
| GET | `/{plural}/{id}/print/{printTemplate?}` | `{plural}.print` | `print` |

> Workflow status & arti `{level?}` (approval level) dijelaskan di [Auth & Workflow](auth.md#workflow-dokumen) dan [Modul Core](modules/core.md#trait-submitable).

Pada bagian-bagian modul di bawah, resource yang murni mengikuti pola macro ditandai dengan badge **`resourceDetail`** atau **`resourceDetail · submitable`**, dan **hanya route non-standar yang ditabelkan penuh**. Untuk route standar, lihat tabel pola di atas — cukup ganti `{plural}` dengan nama resource.

---

## Middleware

| Grup | Middleware | Berlaku untuk |
|---|---|---|
| Publik | _(none)_ | `/lang`, `/company-logo`, `/files/{file}/preview`, `/health` |
| API auth | `auth` | `/model*`, `/api/html/sanitize`, `/commands/*` |
| Guest | `guest`, `lang` | login, register, forgot/reset password, OAuth redirect |
| Auth dasar | `auth`, `lang` | verify-email, confirm-password, **setup**, logout, update password |
| **App utama** | `auth`, `lang`, `onboarded`, `app` | **Semua route bisnis** (dashboard, settings, inventory, purchase, sales, service, finances) |

- `onboarded` — memastikan user sudah menyelesaikan [Setup](#3-onboarding--setup). Jika belum → redirect ke `setup.show`.
- `app` — bootstrap konteks aplikasi (branch aktif, preferences, dsb).
- `lang` — set locale dari sesi/preferensi user.

Detail middleware: [Auth](auth.md#middleware).

---

## 1. Route Publik & Auth Helper

| Method | URI | Route Name | Action |
|---|---|---|---|
| GET | `/` | — | `Closure` → redirect ke `dashboard` |
| GET | `/lang` | `lang.index` | `Core\LanguageController@index` |
| POST | `/lang` | `lang.set` | `Core\LanguageController@set` |
| GET | `/company-logo` | `company-logo` | `Core\CompanyLogoController` _(invokable)_ |
| GET | `/files/{file}/preview` | `files.preview` | `Core\FileController@preview` |
| GET | `/health` | — | `Closure` → `{ "status": "ok" }` |
| GET | `/up` | — | Laravel default health check (vendor) |

---

## 2. Authentication (Breeze + Socialite)

File: `routes/auth.php`. Lihat juga [Auth](auth.md).

### Guest (`guest`, `lang`)

| Method | URI | Route Name | Action |
|---|---|---|---|
| GET | `/login` | `login` | `Auth\AuthenticatedSessionController@create` |
| POST | `/login` | — | `Auth\AuthenticatedSessionController@store` |
| GET | `/register` | `register` | `Auth\RegisteredUserController@create` |
| POST | `/register` | — | `Auth\RegisteredUserController@store` |
| GET | `/auth/{driver}/redirect` | `auth.login-provider` | `Auth\AuthenticatedSessionController@redirectToProvider` |
| GET | `/forgot-password` | `password.request` | `Auth\PasswordResetLinkController@create` |
| POST | `/forgot-password` | `password.email` | `Auth\PasswordResetLinkController@store` |
| GET | `/reset-password/{token}` | `password.reset` | `Auth\NewPasswordController@create` |
| POST | `/reset-password` | `password.store` | `Auth\NewPasswordController@store` |

### OAuth Callback (tanpa grup guest)

| Method | URI | Route Name | Action |
|---|---|---|---|
| GET | `/auth/{driver}/callback` | — | `Auth\AuthenticatedSessionController@handleProviderCallback` |

> Socialite OAuth — lihat [Auth · Social Login](auth.md#social-login-socialite). `{driver}` = provider (mis. `google`).

### Auth dasar (`auth`, `lang`)

| Method | URI | Route Name | Action |
|---|---|---|---|
| GET | `/verify-email` | `verification.notice` | `Auth\EmailVerificationPromptController` _(invokable)_ |
| GET | `/verify-email/{id}/{hash}` | `verification.verify` | `Auth\VerifyEmailController` _(invokable, `signed` + `throttle:6,1`)_ |
| POST | `/email/verification-notification` | `verification.send` | `Auth\EmailVerificationNotificationController@store` _(`throttle:6,1`)_ |
| GET | `/confirm-password` | `password.confirm` | `Auth\ConfirmablePasswordController@show` |
| POST | `/confirm-password` | — | `Auth\ConfirmablePasswordController@store` |
| PUT | `/password` | `password.update` | `Auth\PasswordController@update` |
| POST | `/logout` | `logout` | `Auth\AuthenticatedSessionController@destroy` |

---

## 3. Onboarding / Setup

Middleware: `auth`, `lang`. User baru wajib menyelesaikan setup sebelum bisa mengakses route bisnis (di-enforce middleware `onboarded`).

| Method | URI | Route Name | Action |
|---|---|---|---|
| GET | `/setup` | `setup.show` | `Auth\SetupUserController@show` |
| PUT | `/setup` | `setup.update` | `Auth\SetupUserController@update` |

Frontend page: lihat [Frontend · Setup](frontend.md#auth--onboarding).

---

## 4. Core API (non-Inertia)

Middleware: `auth`. Endpoint ini di-_skip_ dari `HandleInertiaRequests` (mengembalikan JSON murni), kecuali `/model*` yang tetap melalui Inertia.

| Method | URI | Route Name | Action | Keterangan |
|---|---|---|---|---|
| POST | `/model` | `model` | `ModelController` _(invokable)_ | Fetch data model untuk komponen `LinkModel` |
| POST | `/model/datatable` | `model.datatable` | `ModelController@datatable` | Data server-side untuk `DataTable2` |
| GET | `/model/{model}` | `model.columns` | `ModelController@columns` | Definisi kolom model (`{model}` = FQCN, `where('.*')`) |
| POST | `/api/html/sanitize` | `api.html.sanitize` | `Core\HtmlSanitizeController` _(invokable)_ | Sanitasi HTML print template |
| GET | `/commands/search` | `commands.search` | `Core\CommandSearchController@index` | Command palette search |
| POST | `/commands/recent` | `commands.recent.track` | `Core\CommandSearchController@track` | Catat command terakhir dipakai |
| DELETE | `/commands/recent` | `commands.recent.remove` | `Core\CommandSearchController@remove` | Hapus recent command |

> `ModelController` & komponen `LinkModel` adalah tulang punggung relasi UI — lihat [Frontend · Peta LinkModel](frontend.md#peta-linkmodel-relasi-ui) dan [Modul Core](modules/core.md#modelcontroller).

---

## 5. Dashboard & Widget

Middleware: `auth, lang, onboarded, app`.

| Method | URI | Route Name | Action |
|---|---|---|---|
| GET | `/dashboard-view` | `dashboard` | `Core\DashboardController@view` |
| POST | `/dashboard-update` | `dashboardForms.store` | `Core\DashboardController@storeUserDashboard` |
| POST | `/dashboard-widget-order/{dashboard}` | `dashboard.widgets.reorder` | `Core\DashboardController@reorderWidgets` |
| POST | `/get-chart/{widget}` | `get-chart` | `Core\WidgetController@getChartData` |
| GET | `/logs/{log}` | `logs.show` | `Core\LogController@show` |
| PUT | `/switch_branch/{id}` | `branch.switch` | `Core\BranchController@switch` |

Definisi widget & dashboard sebagai resource ada di [Settings](#6-settings).

---

## 6. Settings

Prefix: `/settings`. Middleware: `auth, lang, onboarded, app`.

### Company

| Method | URI | Route Name | Action |
|---|---|---|---|
| GET | `/settings/company` | `companies.index` | `Core\CompanyController@index` |
| PUT | `/settings/company` | `companies.update` | `Core\CompanyController@update` |
| POST | `/settings/company/image` | `companies.image` | `Core\CompanyController@image` |

### Resource `resourceDetail` di bawah `/settings`

Semua mengikuti [pola macro](#konvensi-macro-routeresourcedetail) (12 route dasar). Action di controller masing-masing.

| Resource | Prefix URI | Route Name | Controller | Catatan |
|---|---|---|---|---|
| **Dashboard** | `/settings/dashboards` | `dashboards.*` | `Core\DashboardController` | — |
| **Branch** | `/settings/branches` | `branches.*` | `Core\BranchController` | Multi-branch — lihat [Core](modules/core.md#branch--multi-branch) |
| **FormatingSeries** | `/settings/formatingSeries` | `formatingSeries.*` | `Core\FormatingSeriesController` | Penomoran dokumen otomatis |
| **ApprovalScheme** | `/settings/approvalSchemes` | `approvalSchemes.*` | `Core\ApprovalSchemeController` | Skema approval — lihat [Approval](#8-approval) |
| **PrintTemplate** | `/settings/printTemplates` | `printTemplates.*` | `Core\PrintTemplateController` | + route non-standar di bawah |
| **Widget** | `/settings/widgets` | `widgets.*` | `Core\WidgetController` | — |

> Catatan URI: `formatingSeries` adalah pengecualian — karena nama sudah berakhiran "s", bentuk plural-nya tetap `/settings/formatingSeries` (bukan `formatingSeriess`).

### Print Template — route non-standar

| Method | URI | Route Name | Action |
|---|---|---|---|
| GET | `/settings/printTemplates/{printTemplate}/editor` | `printTemplates.editor` | `Core\PrintTemplateController@editor` |
| POST | `/settings/printTemplates/{printTemplate}/preview` | `printTemplates.preview` | `Core\PrintTemplateController@preview` |
| POST | `/settings/printTemplates/{printTemplate}/generate-example-data` | `printTemplates.generate-example-data` | `Core\PrintTemplateController@generateExampleData` |

> Print template engine — lihat [Modul Core · Print Template](modules/core.md#print-templates).

---

## 7. User & Access Management

Middleware: `auth, lang, onboarded, app`.

### Users — `resourceDetail` + non-standar

Resource `users.*` (12 route dasar, `User\UserController`). Route tambahan:

| Method | URI | Route Name | Action |
|---|---|---|---|
| GET | `/users/{user}/connect/{driver}/redirect` | `users.connect-provider` | `User\UserController@connectToProvider` |
| POST | `/users/{user}/image` | `users.image` | `User\UserController@image` |

> `connect-provider` = hubungkan akun user ke OAuth provider (Socialite). Lihat [Auth · Social Login](auth.md#social-login-socialite).

### Roles — `resourceDetail` + non-standar

Resource `roles.*` (12 route dasar, `User\RoleController`). Route tambahan:

| Method | URI | Route Name | Action |
|---|---|---|---|
| GET | `/roles/permissions` | `roles.permissions` | `User\RoleController@permissions` |

> Sistem RBAC (role, permission, role profile) dijelaskan di [Auth · Roles & Permissions](auth.md#roles--permissions).

---

## 8. Approval

Middleware: `auth, lang, onboarded, app`.

| Method | URI | Route Name | Action |
|---|---|---|---|
| GET | `/approvals` | `approvalInstances.index` | `Core\ApprovalInstanceController@index` |
| GET | `/approvals/{approvalInstance}` | `approvalInstances.show` | `Core\ApprovalInstanceController@show` |
| POST | `/approvals/{approvalInstanceStep}/decision` | `approvalInstances.decision` | `Core\ApprovalInstanceController@decision` |

> Mesin approval (scheme → instance → step) — lihat [Modul Core · Approval](modules/core.md#approval).

---

## 9. Tags & Files

Middleware: `auth, lang, onboarded, app`. Keduanya resource `resourceDetail` ([pola macro](#konvensi-macro-routeresourcedetail)).

| Resource | Prefix URI | Route Name | Controller |
|---|---|---|---|
| **Tag** | `/tags` | `tags.*` | `Core\TagController` |
| **File** | `/files` | `files.*` | `Core\FileController` |

> `files.preview` (route publik) di-daftarkan terpisah, lihat [Route Publik](#1-route-publik--auth-helper).

---

## 10. Inventory

Middleware: `auth, lang, onboarded, app`. Detail bisnis: [Modul Inventory](modules/inventory.md).

### Resource `resourceDetail`

| Resource | Prefix URI | Route Name | Controller | Submitable |
|---|---|---|---|---|
| **Warehouse** | `/warehouses` | `warehouses.*` | `Inventory\WarehouseController` | — |
| **Unit** | `/units` | `units.*` | `Inventory\UnitController` | — |
| **Category** | `/categories` | `categories.*` | `Inventory\CategoryController` | — |
| **Item** | `/items` | `items.*` | `Inventory\ItemController` | — |
| **ItemVariant** | `/itemVariants` | `itemVariants.*` | `Inventory\ItemVariantController` | — |
| **ItemAlternative** | `/itemAlternatives` | `itemAlternatives.*` | `Inventory\ItemAlternativeController` | — |
| **Attribute** | `/attributes` | `attributes.*` | `Inventory\AttributeController` | — |
| **StockEntry** | `/stockEntries` | `stockEntries.*` | `Inventory\StockEntryController` | ✅ |
| **DeliveryNote** | `/deliveryNotes` | `deliveryNotes.*` | `Inventory\DeliveryNoteController` | ✅ |
| **StockLedger** | `/stockLedgers` | `stockLedgers.*` | `Inventory\StockLedgerController` | — (read-only di praktiknya) |

### Route non-standar Inventory

| Method | URI | Route Name | Action |
|---|---|---|---|
| GET | `/units/groups/{search?}` | `units.groups` | `Inventory\UnitController@getGroups` |
| POST | `/itemVariants/info` | `itemVariants.info` | `Inventory\ItemVariantController@info` |

> **Item vs ItemVariant**: line item di semua dokumen transaksi (`SalesOrderItem`, `PurchaseOrderItem`, dst.) sebenarnya me-_reference_ **`ItemVariant`**, bukan `Item`. Lihat [Database · Item & Variant](database.md#item--itemvariant) dan [Inventory](modules/inventory.md#item--variant).

---

## 11. Purchase

Middleware: `auth, lang, onboarded, app`. Detail bisnis & dual-flow: [Modul Purchase](modules/purchase.md).

### Resource `resourceDetail`

| Resource | Prefix URI | Route Name | Controller | Submitable |
|---|---|---|---|---|
| **Supplier** | `/suppliers` | `suppliers.*` | `Purchase\SupplierController` | — |
| **PurchaseRequest** | `/purchaseRequests` | `purchaseRequests.*` | `Purchase\PurchaseRequestController` | ✅ |
| **PurchaseOrder** | `/purchaseOrders` | `purchaseOrders.*` | `Purchase\PurchaseOrderController` | ✅ |
| **PurchaseReceipt** | `/purchaseReceipts` | `purchaseReceipts.*` | `Purchase\PurchaseReceiptController` | ✅ |

### Route non-standar Purchase

| Method | URI | Route Name | Action |
|---|---|---|---|
| POST | `/purchaseOrders/{purchaseOrder}/sync-items` | `purchaseOrders.syncItems` | `Purchase\PurchaseOrderController@syncItems` |
| POST | `/purchaseOrders/{purchaseOrder}/mark-done` | `purchaseOrders.markDone` | `Purchase\PurchaseOrderController@markDone` |

> Alur PR → PO → PR(eceipt) → PI dan fungsi `syncItems`/`markDone` — lihat [Modul Purchase](modules/purchase.md#alur-bisnis).

---

## 12. Sales

Middleware: `auth, lang, onboarded, app`. Detail bisnis & dual-flow SO→DN→SI / SO→SI→DN: [Modul Sales](modules/sales.md).

### Resource `resourceDetail`

| Resource | Prefix URI | Route Name | Controller | Submitable |
|---|---|---|---|---|
| **Customer** | `/customers` | `customers.*` | `Sales\CustomerController` | — |
| **SalesOrder** | `/salesOrders` | `salesOrders.*` | `Sales\SalesOrderController` | ✅ |
| **InternalOrder** | `/internalOrders` | `internalOrders.*` | `Sales\InternalOrderController` | ✅ |

### Route non-standar Sales

| Method | URI | Route Name | Action |
|---|---|---|---|
| POST | `/salesOrders/{salesOrder}/sync-items` | `salesOrders.syncItems` | `Sales\SalesOrderController@syncItems` |
| POST | `/salesOrders/{salesOrder}/mark-done` | `salesOrders.markDone` | `Sales\SalesOrderController@markDone` |

> `Customer` didaftarkan di luar grup Sales pada `routes/web.php` namun secara domain milik Sales. SO line item → **ItemVariant** (lihat [Sales · Item](modules/sales.md#item--variant)).

---

## 13. Service

Middleware: `auth, lang, onboarded, app`. Detail: [Modul Service](modules/service.md).

| Resource | Prefix URI | Route Name | Controller | Submitable |
|---|---|---|---|---|
| **WorkOrder** | `/workOrders` | `workOrders.*` | `Service\WorkOrderController` | ✅ |

---

## 14. Finances

Middleware: `auth, lang, onboarded, app`. Detail: [Modul Finances](modules/finances.md).

| Resource | Prefix URI | Route Name | Controller | Submitable |
|---|---|---|---|---|
| **Account** | `/accounts` | `accounts.*` | `Finances\AccountController` | — |
| **GeneralLedger** | `/generalLedgers` | `generalLedgers.*` | `Finances\GeneralLedgerController` | — (read-only di praktiknya) |
| **PaymentMethod** | `/paymentMethods` | `paymentMethods.*` | `Finances\PaymentMethodController` | — |
| **PaymentTermTemplate** | `/paymentTermTemplates` | `paymentTermTemplates.*` | `Finances\PaymentTermTemplateController` | — |
| **PaymentEntry** | `/paymentEntries` | `paymentEntries.*` | `Finances\PaymentEntryController` | ✅ |
| **PurchaseInvoice** | `/purchaseInvoices` | `purchaseInvoices.*` | `Finances\PurchaseInvoiceController` | ✅ |
| **SalesInvoice** | `/salesInvoices` | `salesInvoices.*` | `Finances\SalesInvoiceController` | ✅ |
| **Tax** | `/taxes` | `taxes.*` | `Finances\TaxesController` | — |

> Chart of Accounts, jurnal (`GeneralLedger`), dan keterkaitan invoice ↔ payment ada di [Modul Finances](modules/finances.md).

---

## 15. CRM

Middleware: `auth, lang, onboarded, app`. Detail bisnis & flow Lead→Opportunity→Quotation: [Modul CRM](modules/crm.md).

### Resource `resourceDetail`

| Resource | Prefix URI | Route Name | Controller | Submitable |
|---|---|---|---|---|
| **Lead** | `/leads` | `leads.*` | `CRM\LeadController` | — |
| **Opportunity** | `/opportunities` | `opportunities.*` | `CRM\OpportunityController` | — |
| **Quotation** | `/quotations` | `quotations.*` | `CRM\QuotationController` | ✅ |

### Route non-standar CRM

| Method | URI | Route Name | Action |
|---|---|---|---|
| PUT | `/leads/{lead}/convert` | `leads.convert` | `CRM\LeadController@convert` |

> Konversi Lead → Customer lewat endpoint `leads.convert`. Quotation → Sales Order **bukan** endpoint convert, melainkan prefill form via `?ref=quotation/{id}` — lihat [Modul CRM · Korelasi](modules/crm.md#korelasi-antar-feature).

---

## 16. Helpdesk

Middleware: `auth, lang, onboarded, app`. Detail: [Modul Helpdesk](modules/helpdesk.md). **Catatan**: `TicketController` men-set `ignorePermission = true` — semua user login bisa akses tanpa dicek RBAC (kecuali aksi `markDone`/`updateTicket`).

### Resource `resourceDetail`

| Resource | Prefix URI | Route Name | Controller | Submitable |
|---|---|---|---|---|
| **Ticket** | `/tickets` | `tickets.*` | `Helpdesk\TicketController` | — |

### Route non-standar Helpdesk

| Method | URI | Route Name | Action |
|---|---|---|---|
| PUT | `/tickets/{ticket}/markDone` | `tickets.markDone` | `Helpdesk\TicketController@markDone` |
| PUT | `/tickets/{ticket}/updateTicket` | `tickets.updateTicket` | `Helpdesk\TicketController@updateTicket` |
| GET | `/changelogs` | `changelogs.index` | `Core\ChangelogController@index` |

> `Core\ChangelogController` didaftarkan di luar grup Helpdesk pada `routes/web.php` namun secara bisnis terhubung erat via integrasi deploy webhook — lihat [Helpdesk · Integrasi Deploy](modules/helpdesk.md#integrasi-deploy---changelog---ticket) dan [Core · Changelog](modules/core.md#changelog). Endpoint `POST /api/webhooks/deploy` (di `routes/api.php`, autentikasi Bearer token terpisah) tidak termasuk daftar ini karena bukan route web.

---

## Lampiran: Daftar Controller

Controller yang **tidak terhubung ke route web** (dipakai internal / command / belum dirilis): `Core\BackupController`, `Core\SettingController`, `Finances\PaymentScheduleController`, `RouteController`, `ProfileController` (Breeze profile, jika diaktifkan). Verifikasi ulang dengan:

```bash
php artisan route:list --except-vendor
```

| Namespace | Controller |
|---|---|
| `Auth\` | AuthenticatedSessionController, RegisteredUserController, ConfirmablePasswordController, EmailVerificationNotificationController, EmailVerificationPromptController, NewPasswordController, PasswordController, PasswordResetLinkController, VerifyEmailController, SetupUserController |
| `Core\` | ApprovalInstanceController, ApprovalSchemeController, BranchController, ChangelogController, CommandSearchController, CompanyController, CompanyLogoController, DashboardController, EmailTemplateController, FileController, FormatingSeriesController, HtmlSanitizeController, LanguageController, LogController, NotificationController, PrintTemplateController, SavedFilterController, TagController, TodoController, WidgetController, BackupController*†, SettingController* |
| `Inventory\` | AttributeController, CategoryController, DeliveryNoteController, ItemAlternativeController, ItemController, ItemVariantController, StockEntryController, StockLedgerController, UnitController, WarehouseController |
| `Purchase\` | PurchaseOrderController, PurchaseReceiptController, PurchaseRequestController, SupplierController |
| `Sales\` | CustomerController, InternalOrderController, SalesOrderController |
| `Service\` | WorkOrderController |
| `Finances\` | AccountController, GeneralLedgerController, PaymentEntryController, PaymentMethodController, PaymentScheduleController*, PaymentTermTemplateController, PurchaseInvoiceController, SalesInvoiceController, TaxesController |
| `CRM\` | LeadController, OpportunityController, QuotationController |
| `Helpdesk\` | TicketController |
| `Api\` | DeployWebhookController* (route di `routes/api.php`, bukan `web.php`) |
| _(root)_ | ModelController, ProfileController*, RouteController* |

`*` = tidak terdaftar di route web. `†` = `Core\BackupController` terdaftar tapi seluruh method-nya masih stub kosong — belum diimplementasikan.

---

*Lihat juga: [Arsitektur](architecture.md) · [Auth & Workflow](auth.md) · [Frontend](frontend.md) · [Database](database.md) · Modul: [Core](modules/core.md) · [Inventory](modules/inventory.md) · [Purchase](modules/purchase.md) · [Sales](modules/sales.md) · [Service](modules/service.md) · [Finances](modules/finances.md) · [CRM](modules/crm.md) · [Helpdesk](modules/helpdesk.md)*
