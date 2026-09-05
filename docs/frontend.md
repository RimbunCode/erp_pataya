# Frontend — React, Inertia, & Katalog Halaman

> Katalog lengkap halaman React per modul, peta relasi UI (`LinkModel`), komponen reusable, custom hooks, dan pola Inertia.js v2.

## Daftar Isi

- [Arsitektur Frontend](#arsitektur-frontend)
- [Pola Halaman per Modul](#pola-halaman-per-modul)
- [Katalog Halaman](#katalog-halaman)
  - [Auth & Onboarding](#auth--onboarding)
  - [Core / Shared](#core--shared)
  - [Inventory](#inventory)
  - [Purchase](#purchase)
  - [Sales](#sales)
  - [Service](#service)
  - [CRM](#crm)
  - [Helpdesk](#helpdesk)
  - [Finances](#finances)
  - [Settings](#settings)
  - [Users & Roles](#users--roles)
- [Peta LinkModel (Relasi UI)](#peta-linkmodel-relasi-ui)
- [Layouts](#layouts)
  - [AppLayout](#applayout) · [MasterLayout](#masterlayout) · [GuestLayout](#guestlayout)
- [Komponen Inti](#komponen-inti)
  - [FormPage](#formpage) — wrapper form universal
  - [DataTable2](#datatable2) — tabel server-side
  - [ShowGeneral](#showgeneral) — halaman show universal
  - [LinkModel](#linkmodel) — selector relasi model
  - [FormInput](#forminput) — wrapper field (label/error/disabled)
  - [FormTable](#formtable) — editable table baris item
  - [NumberInput](#numberinput) — input angka & mata uang (format-on-blur)
  - [BadgeStatus](#badgestatus) — badge status dokumen
  - [DatetimePicker](#datetimepicker) — date/time/range picker
  - [Select, MultiSelect, NestedSelect, SelectModel](#select-multiselect-nestedselect-selectmodel)
  - [ItemBarcode](#itembarcode) — input scan barcode
- [Penggunaan LinkModel](#penggunaan-linkmodel)
  - [Pola 1 — Wrapper per-entitas](#pola-1--wrapper-per-entitas-definisi)
  - [Pola 2 — Di dalam FormInput](#pola-2--di-dalam-forminput-field-tunggal)
  - [Pola 3 — Di dalam FormTable cell](#pola-3--di-dalam-formtable-cell-baris-item)
  - [Filter & dependent select](#filter--dependent-select)
  - [Quick-add](#quick-add-buat-record-baru-dari-dropdown)
- [Pola FormPage End-to-End](#pola-formpage-end-to-end)
- [Custom Hooks](#custom-hooks)
  - [useFormPage](#useformpage) — state form
  - [useFormPageMeta](#useformpagemeta) — meta form (disabled/errors)
  - [usePermission](#usepermission) — cek izin (can/canGlobal)
  - [useToasts](#usetoasts) — notifikasi toast
  - [useTheme](#usetheme) — tema light/dark/system
  - [useDraftForm](#usedraftform) — form + auto-save draft
  - [useIsDirtyForm](#useisdirtyform) — status dirty form
  - [useDeleteModal](#usedeletemodal) — modal konfirmasi hapus
  - [useDidMountEffect](#usedidmounteffect) — effect skip mount pertama
  - [useNestedFilters](#usenestedfilters) — filter bertingkat DataTable
  - [useDynamicRefs](#usedynamicrefs) — ref dinamis by key
  - [useIsMobile / useIsTablet](#useismobile--useistablet) — breakpoint
  - [useScreen](#usescreen) — match media custom
  - [useLocale](#uselocale) — i18n
- [shadcn/ui Components](#shadcnui-components)
- [Inertia Shared Props](#inertia-shared-props)
- [i18n](#i18n-laravel-react-i18n)
- [Ziggy Routes](#ziggy-routes)
- [Testing](#testing)
  - [Konvensi Lokasi & Command](#konvensi-lokasi--command)
  - [Tiga Jenis Test FE](#tiga-jenis-test-fe)
  - [Property-Based Testing (fast-check)](#property-based-testing-fast-check)
  - [CI Gate](#ci-gate)

---

## Arsitektur Frontend

```
resources/js/
  Components/         Komponen reusable
    ui/               shadcn/ui (Radix-based)
    Table/            Komponen tabel internal
    Navbar/  Sidebar/ Navigasi
    NumberInput/      Komponen NumberInput + helper formatNumber
  Hooks/              Custom React hooks
  Layouts/            AppLayout, MasterLayout, GuestLayout
  Pages/              Halaman Inertia per modul (lihat Katalog di bawah)
    Core/             Page-level shared (FormPage, DataTable2, PrintTemplate, ...)
    Inventory/ Purchase/ Sales/ Services/ Finances/ Settings/ Users/ Auth/ Profile/
  lib/
    utils.js          cn, generateRandom, checkPermission, ...
    linkModelUtils.js Utilities untuk LinkModel
```

Halaman di-render server-side via `Inertia::render('Path/Component', $props)`. Banyak halaman `show` di-render lewat **`ShowGeneral.jsx`** universal yang membaca `$model->formComponent` (lihat [Core](#core--shared)).

---

## Pola Halaman per Modul

Setiap entitas bisnis umumnya punya set file konsisten di `Pages/{Modul}/{Entitas}/`:

| File | Peran | Di-render oleh |
|---|---|---|
| `Index.jsx` | List/tabel data (pakai `DataTable2`) | `Controller@index` |
| `Form.jsx` | Form create/edit/show | `ShowGeneral` via `formComponent`, atau langsung |
| `Show.jsx` | Halaman detail (kadang terpisah dari Form) | `Controller@show` |
| `ItemForm.jsx` | Sub-form baris item (di dalam `FormTable`) | dipanggil oleh `Form.jsx` |
| `{Entitas}LinkModel.jsx` | **Selector relasi** entitas ini di form lain | dipanggil di mana pun butuh memilih entitas ini |

> `LinkModel` adalah kunci hubungan antar-modul di UI. Misal `SalesOrderForm` memanggil `ItemVariantLinkModel`, `CustomerLinkModel`, `TaxLinkModel`. Peta lengkap: [Peta LinkModel](#peta-linkmodel-relasi-ui).

---

## Katalog Halaman

### Auth & Onboarding

| Halaman | File | Route terkait |
|---|---|---|
| Login | `Pages/Auth/*` (Breeze) | `login` |
| Register | `Pages/Auth/*` (Breeze) | `register` |
| Confirm Password | `Pages/Auth/ConfirmPassword.jsx` | `password.confirm` |
| Forgot Password | `Pages/Auth/ForgotPassword.jsx` | `password.request` |
| Reset Password | `Pages/Auth/ResetPassword.jsx` | `password.reset` |
| Verify Email | `Pages/Auth/VerifyEmail.jsx` | `verification.notice` |
| **Setup (onboarding)** | `Pages/Setup*` / `Auth` | `setup.show`, `setup.update` |
| Profile Edit | `Pages/Profile/Edit.jsx` + Partials | (Breeze profile) |

> Profil: `Partials/UpdateProfileInformationForm.jsx`, `UpdatePasswordForm.jsx`, `DeleteUserForm.jsx`. Routes auth: [Routes · Authentication](routes.md#2-authentication-breeze--socialite).

### Core / Shared

| Halaman / Komponen | File | Peran |
|---|---|---|
| **FormPage** | `Pages/Core/FormPage.jsx` (~70KB) | Wrapper form universal semua dokumen (lihat [Komponen Inti](#formpage)) |
| **DataTable2** | `Pages/Core/DataTable2.jsx` | Tabel server-side universal |
| **ShowGeneral** | `Pages/ShowGeneral.jsx` | Halaman show universal, render `formComponent` model |
| Approval Instance | `Pages/Core/ApprovalInstanceIndex.jsx` | Daftar approval (route `approvalInstances.index`) |
| Approver Decision | `Pages/Core/Components/ApproverDecision.jsx` | Tombol approve/reject |
| Print Template | `Pages/Core/PrintTemplate/Index.jsx`, `Show.jsx` | Editor template cetak |
| Language | `Pages/Core/Language/Index.jsx` | Pemilih bahasa |
| Show Log | `Pages/Core/ShowLog.jsx` | Detail activity log (`logs.show`) |
| Status (debug) | `Pages/Status.jsx` | Halaman status (hanya `app.debug`) |
| LinkModel Core | `Pages/Core/CountryLinkModel.jsx`, `CurrencyLinkModel.jsx`, `PermissionLinkModel.jsx` | Selector entitas core |
| Todo | `Pages/Core/Todos/` — `Index`, `Form`, `Show`, `AssignedToFields` | Tugas generik, assign ke User/Role (lihat [Core · Todo](modules/core.md#todo)) |
| Assign Dialog | `Pages/Core/Components/AssignDialog.jsx` | Dialog assign generik (user/role, prioritas, tanggal) — dipakai Todo |
| Email Template | `Pages/Core/EmailTemplate/` — `Index`, `Form`, `Show` | Template email per model |
| Email Send Dialog | `Pages/Core/Components/EmailSendDialog.jsx` | Kirim email manual dari halaman detail dokumen |
| Changelog | `Pages/Core/Changelogs/Index.jsx` | Daftar rilis aplikasi (lihat [Core · Changelog](modules/core.md#changelog)) |

### Inventory

| Entitas | Folder | File |
|---|---|---|
| Item | `Inventory/Items/` | `Index`, `Form`, `Show`, `FormDetail`, `FormVariant`, `FormBarcodes`, `FormStockLevels`, `ShowVariant`, `ItemBarcode`, `ItemLinkModel`, `ItemVariantLinkModel`, `ItemUnitLinkModel` |
| Category | `Inventory/Categories/` | `Index`, `Form`, `CategoryLinkModel` |
| Unit | `Inventory/Units/` | `Index`, `Form`, `UnitLinkModel` |
| Attribute | `Inventory/Attributes/` | `Index`, `Form`, `AttributeLinkModel` |
| Item Alternative | `Inventory/ItemAlternatives/` | `Index`, `Form` |
| Warehouse | `Inventory/Warehouses/` | `Index`, `Form`, `WarehouseLinkModel` |
| Stock Entry | `Inventory/StockEntries/` | `Index`, `Form`, `Show`, `CategoryLinkModel` |
| Delivery Note | `Inventory/DeliveryNotes/` | `Index`, `Form`, `Show`, `DeliveryNoteLinkModel` |
| Stock Ledger | `Inventory/` | `StockLedger.jsx` (read-only) |

> Item punya sub-form bertingkat (`FormDetail` + `FormVariant` + `FormBarcodes` + `FormStockLevels`) — Item bisa punya banyak **Variant**. Detail: [Modul Inventory](modules/inventory.md).

### Purchase

| Entitas | Folder | File |
|---|---|---|
| Supplier | `Purchase/Suppliers/` | `Index`, `Form`, `SupplierLinkModel` |
| Purchase Request | `Purchase/PurchaseRequests/` | `Index`, `Show`, `ItemForm` |
| Purchase Order | `Purchase/PurchaseOrders/` | `Index`, `ItemForm`, `PurchaseOrderLinkModel` |
| Purchase Receipt | `Purchase/PurchaseReceipts/` | `Index`, `Show`, `ItemForm`, `PurchaseReceiptLinkModel` |

> Alur PR → PO → Receipt → Invoice: [Modul Purchase](modules/purchase.md).

### Sales

| Entitas | Folder | File |
|---|---|---|
| Customer | `Sales/Customers/` | `Index`, `Form`, `CustomerLinkModel` |
| Sales Order | `Sales/SalesOrders/` | `Index`, `Form`, `Show`, `ItemForm`, `SalesOrderLinkModel` |
| Internal Order | `Sales/InternalOrders/` | `Index`, `Form`, `Show`, `ItemForm` |

> `SalesOrders/ItemForm.jsx` memilih item via kolom `item` → `ItemVariantLinkModel`. Lihat [Sales · Item & Variant](modules/sales.md#item--variant). Dual flow SO→DN→SI / SO→SI→DN: [Modul Sales](modules/sales.md).

### Service

| Entitas | Folder | File |
|---|---|---|
| Work Order | `Services/WorkOrders/` | `Index`, `ItemForm` |

### CRM

| Entitas | Folder | File |
|---|---|---|
| Lead | `CRM/Leads/` | `Index`, `Form`, `Show`, `LeadActivities`, `LeadLinkModel` |
| Opportunity | `CRM/Opportunities/` | `Index`, `Form`, `Show`, `OpportunityLinkModel` |
| Quotation | `CRM/Quotations/` | `Index`, `Form`, `Show`, `QuotationItems`, `QuotationLinkModel` |

> Alur Lead→Opportunity→Quotation→Sales Order: [Modul CRM](modules/crm.md).

### Helpdesk

| Entitas | Folder | File |
|---|---|---|
| Ticket | `Helpdesk/Tickets/` | `Index`, `Form`, `Show`, `ResponseForm` |

> Ticket **bukan** dokumen submitable dan di luar sistem RBAC standar: [Modul Helpdesk](modules/helpdesk.md).

### Finances

| Entitas | Folder | File |
|---|---|---|
| Account (COA) | `Finances/Accounts/` | `Index`, `Form`, `Show`, `AccountLinkModel` |
| General Ledger | `Finances/` | `GeneralLedger.jsx` |
| Payment Method | `Finances/PaymentMethods/` | `Index`, `Form`, `PaymentMethodLinkModel` |
| Payment Term Template | `Finances/PaymentTermTemplate/` | `Index`, `Form`, `PaymentTermTemplateLinkModel` |
| Payment Entry | `Finances/PaymentEntries/` | `Index`, `Show` |
| Purchase Invoice | `Finances/PurchaseInvoice/` | `Index`, `Show`, `ItemForm`, `PurchaseInvoiceLinkModel` |
| Sales Invoice | `Finances/SalesInvoice/` | `Index`, `Show`, `ItemForm`, `SalesInvoiceLinkModel` |
| Tax | `Finances/Taxes/` | `Index`, `Form`, `TaxLinkModel` |
| Additional Discount | `Finances/Components/AdditionalDiscount.jsx` | Komponen diskon tambahan |

> Detail: [Modul Finances](modules/finances.md).

### Settings

| Entitas | Folder | File |
|---|---|---|
| Company | `Settings/` | `Company.jsx` |
| Branch | `Settings/Branches/` | `Index`, `Form`, `Show`, `BranchLinkModel` |
| Formating Series | `Settings/FormatingSeries/` | `Index`, `Show` |
| Approval Scheme | `Settings/ApprovalScheme/` | `Index`, `Form`, `Show` |
| Dashboard | `Settings/Dashboard/` | `Index`, `Form`, `Show`, `DashboardLinkModel` |
| Widget | `Settings/Widget/` | `Index`, `Form`, `Show`, `WidgetLinkModel` |

### Users & Roles

| Entitas | Folder | File |
|---|---|---|
| User | `Users/ManageUsers/` | `Index`, `Form`, `Show`, `FormChangePassword`, `UserLinkModel` |
| Role | `Users/Roles/` | `Index`, `Form`, `Show`, `FormNewRule` |

> RBAC: [Auth · Roles & Permissions](auth.md#roles--permissions).

---

## Peta LinkModel (Relasi UI)

`LinkModel` = komponen selector relasi (FK picker dengan search + lazy load). Tiap wrapper menetapkan satu `model` FQCN. Ini adalah **peta hubungan antar-entitas sebagaimana terlihat di UI** — saat sebuah form memanggil `XxxLinkModel`, artinya entitas itu punya referensi ke `Xxx`.

| Komponen LinkModel | File | Model (FQCN) | Tabel DB |
|---|---|---|---|
| `ItemLinkModel` | `Inventory/Items/ItemLinkModel.jsx` | `App\Models\Inventory\Item` | [items](database.md#item--itemvariant) |
| `ItemVariantLinkModel` | `Inventory/Items/ItemVariantLinkModel.jsx` | `App\Models\Inventory\ItemVariant` | [item_variants](database.md#item--itemvariant) |
| `ItemUnitLinkModel` | `Inventory/Items/ItemUnitLinkModel.jsx` | `App\Models\Inventory\ItemUnit` | item_units |
| `CategoryLinkModel` | `Inventory/Categories/`, `Inventory/StockEntries/` | `App\Models\Inventory\Category` | categories |
| `UnitLinkModel` | `Inventory/Units/UnitLinkModel.jsx` | `App\Models\Inventory\Unit` | units |
| `AttributeLinkModel` | `Inventory/Attributes/AttributeLinkModel.jsx` | `App\Models\Inventory\Attribute` | attributes |
| `WarehouseLinkModel` | `Inventory/Warehouses/WarehouseLinkModel.jsx` | `App\Models\Inventory\Warehouse` | warehouses |
| `DeliveryNoteLinkModel` | `Inventory/DeliveryNotes/DeliveryNoteLinkModel.jsx` | `App\Models\Inventory\DeliveryNote` | delivery_notes |
| `SupplierLinkModel` | `Purchase/Suppliers/SupplierLinkModel.jsx` | `App\Models\Purchase\Supplier` | suppliers |
| `PurchaseOrderLinkModel` | `Purchase/PurchaseOrders/PurchaseOrderLinkModel.jsx` | `App\Models\Purchase\PurchaseOrder` | purchase_orders |
| `PurchaseReceiptLinkModel` | `Purchase/PurchaseReceipts/PurchaseReceiptLinkModel.jsx` | `App\Models\Purchase\PurchaseReceipt` | purchase_receipts |
| `CustomerLinkModel` | `Sales/Customers/CustomerLinkModel.jsx` | `App\Models\Sales\Customer` | customers |
| `SalesOrderLinkModel` | `Sales/SalesOrders/SalesOrderLinkModel.jsx` | `App\Models\Sales\SalesOrder` | sales_orders |
| `LeadLinkModel` | `CRM/Leads/LeadLinkModel.jsx` | `App\Models\CRM\Lead` | leads |
| `OpportunityLinkModel` | `CRM/Opportunities/OpportunityLinkModel.jsx` | `App\Models\CRM\Opportunity` | opportunities |
| `QuotationLinkModel` | `CRM/Quotations/QuotationLinkModel.jsx` | `App\Models\CRM\Quotation` | quotations |
| `AccountLinkModel` | `Finances/Accounts/AccountLinkModel.jsx` | `App\Models\Finances\Account` | accounts |
| `TaxLinkModel` | `Finances/Taxes/TaxLinkModel.jsx` | `App\Models\Finances\Tax` | taxes |
| `PaymentMethodLinkModel` | `Finances/PaymentMethods/PaymentMethodLinkModel.jsx` | `App\Models\Finances\PaymentMethod` | payment_methods |
| `PaymentTermTemplateLinkModel` | `Finances/PaymentTermTemplate/PaymentTermTemplateLinkModel.jsx` | `App\Models\Finances\PaymentTermTemplate` | payment_term_templates |
| `SalesInvoiceLinkModel` | `Finances/SalesInvoice/SalesInvoiceLinkModel.jsx` | `App\Models\Finances\SalesInvoice` | sales_invoices |
| `PurchaseInvoiceLinkModel` | `Finances/PurchaseInvoice/PurchaseInvoiceLinkModel.jsx` | `App\Models\Finances\PurchaseInvoice` | purchase_invoices |
| `BranchLinkModel` | `Settings/Branches/BranchLinkModel.jsx` | `App\Models\Core\Branch` | branches |
| `WidgetLinkModel` | `Settings/Widget/WidgetLinkModel.jsx` | `App\Models\Core\Widget` | widgets |
| `DashboardLinkModel` | `Settings/Dashboard/DashboardLinkModel.jsx` | `App\Models\Core\Dashboard` | dashboards |
| `UserLinkModel` | `Users/ManageUsers/UserLinkModel.jsx` | `App\Models\User\User` | users |
| `PermissionLinkModel` | `Core/PermissionLinkModel.jsx` | `App\Models\User\Permission` | permissions |
| `CurrencyLinkModel` | `Core/CurrencyLinkModel.jsx` | `App\Models\Core\Currency` | currencies |
| `CountryLinkModel` | `Core/CountryLinkModel.jsx` | `App\Models\Core\Country` | countries |

### Contoh hubungan UI (siapa memilih siapa)

| Form sumber | Memanggil LinkModel | Relasi yang dibentuk |
|---|---|---|
| `SalesOrders/Form` + `ItemForm` | `CustomerLinkModel`, `ItemVariantLinkModel`, `UnitLinkModel`, `TaxLinkModel`, `WarehouseLinkModel` | SO → Customer, SO Item → **ItemVariant** + Unit + Tax + Warehouse |
| `PurchaseOrders/ItemForm` | `SupplierLinkModel`, `ItemVariantLinkModel`, `UnitLinkModel`, `TaxLinkModel` | PO → Supplier, PO Item → ItemVariant |
| `PurchaseReceipts/Form` | `PurchaseOrderLinkModel`, `SupplierLinkModel` | Receipt → PO + Supplier |
| `SalesInvoice/Form` | `SalesOrderLinkModel`, `CustomerLinkModel` | SI → SO + Customer |
| `PurchaseInvoice/Form` | `PurchaseOrderLinkModel`, `SupplierLinkModel` | PI → PO + Supplier |
| `Items/Form` | `CategoryLinkModel`, `UnitLinkModel`, `AttributeLinkModel` | Item → Category + Unit; Variant → Attribute |
| `Opportunities/Form` | `LeadLinkModel` | Opportunity → Lead (opsional) |
| `Quotations/Form` + `QuotationItems` | `OpportunityLinkModel`, `CustomerLinkModel`, `ItemVariantLinkModel` | Quotation → Opportunity + Customer, Quotation Item → ItemVariant |

> **Penting:** baris item di SO/PO/DN/Invoice me-reference **`ItemVariant`** (kolom `item_id` → tabel `item_variants`), bukan `Item`. Konfirmasi di kode: `SalesOrderItem::item()` = `belongsTo(ItemVariant::class, 'item_id')`. Lihat [Database · Item & Variant](database.md#item--itemvariant).

---

## Layouts

### AppLayout
**File:** `resources/js/Layouts/AppLayout.jsx`. Layout utama (auth): sidebar, navbar, alert system. Semua page bisnis memakainya.

### MasterLayout
**File:** `resources/js/Layouts/MasterLayout.jsx`. Global dialogs, alert handling, theme. Berisi: alert draft/dirty form, toast (Sonner), theme provider (next-themes), i18n locale setter.

### GuestLayout
**File:** `resources/js/Layouts/GuestLayout.jsx`. Halaman guest (login, register, forgot password).

---

## Komponen Inti

### FormPage
**File:** `resources/js/Pages/Core/FormPage.jsx` (~70KB). Wrapper form universal untuk create/edit/show dokumen. Menangani: form state + draft, permission (disabled state), workflow submit/cancel/amend, comment/tag/file, breadcrumbs, print, approval display.

Sub-export: `FormPageContent`, `FormPageLinkModelDialog`, `useFormPage`, `useFormPageMeta`.

```jsx
import { FormPage, FormPageContent } from "@/Pages/Core/FormPage";

export default function SalesOrderForm({ salesOrder, ...props }) {
  return (
    <FormPage model="App\\Models\\Sales\\SalesOrder" data={salesOrder} routeName="salesOrders">
      <FormPageContent title="Details">{/* fields */}</FormPageContent>
    </FormPage>
  );
}
```

### DataTable2
**File:** `resources/js/Pages/Core/DataTable2.jsx`. Tabel server-side: pagination, sort/filter, resize kolom, column visibility, template render, bulk action. Data dari `model.datatable` ([Routes · Core API](routes.md#4-core-api-non-inertia)).

### ShowGeneral
**File:** `resources/js/Pages/ShowGeneral.jsx`. Halaman show universal. Di-render `Controller::renderShow()` memakai `$model->formComponent` sebagai path komponen form. Props: `name`, `title`, `formPathname`, `{name}` (data model).

### LinkModel
**File:** `resources/js/Components/LinkModel.jsx`. Selector related model dengan popup search + lazy load via endpoint [`POST /model`](routes.md#4-core-api-non-inertia). Diekspor sebagai `memo(forwardRef(...))` — bisa di-`ref`. Wrapper per-entitas: [Peta LinkModel](#peta-linkmodel-relasi-ui). Penggunaan: [Penggunaan LinkModel](#penggunaan-linkmodel).

| Prop | Tipe | Default | Deskripsi |
|---|---|---|---|
| `model` | string | required | FQCN model Laravel (mis. `App\\Models\\Inventory\\Item`) |
| `value` | object | — | Nilai terpilih (controlled, object model) |
| `onValueChange` | function | — | Callback `(val) => void` saat pilih |
| `placeholder` | string | — | Placeholder input |
| `disabled` / `readOnly` / `required` | boolean | `false` | State |
| `filters` | object | — | Filter query (mis. `{ item_id: x }`); dukung `or`, key array `group[0]` |
| `joins` | string[] | — | Relasi di-join dalam query |
| `keywords` | string[] | — | Field yang disertakan di display |
| `with` | string[] | — | Eager-load relasi pada hasil (mis. `["defaultUom", "item"]`) |
| `order` | object/string | — | Urutan hasil |
| `limit` | number | `10` | Hasil per halaman |
| `cache` | boolean / `{enabled?, refreshMs?}` | `false` | Cache opsi |
| `cacheStorage` | `"memory"`/`"localStorage"`/`"sessionStorage"`/`"indexedDB"` | `"memory"` | Lokasi cache |
| `disabledNavigation` | boolean | `false` | Sembunyikan tombol "buka detail" |
| `disabledAddButton` | boolean | `false` | Sembunyikan tombol "tambah baru" |
| `defaultValueForm` | object | — | Nilai awal form quick-add |
| `titleDialog` / `classNameDialog` | string | — | Judul/class dialog quick-add |
| `customNavigation` | function | — | Override aksi navigasi |
| `translate` | — | — | Override template display (`templateLink`) |
| `as` / `valueBefore` / `defaultValue` / `form` / `postOption` / `onKeyDown` | — | — | Lanjutan (jarang dipakai) |

> `value` & data dari `onValueChange` berupa **object model utuh** (field yang di-load server). `with` menentukan relasi tambahan yang ikut ter-load — penting saat butuh `default_uom`/`item` di baris.

### FormInput
**File:** `resources/js/Components/FormInput.jsx`. Wrapper field: label, tanda required, error (auto dari `FormPage`), description. Otomatis inject `readOnly`/`required`/`id` ke child via `cloneElement` atau render-prop.

| Prop | Tipe | Deskripsi |
|---|---|---|
| `label` | string | Label field |
| `required` | boolean | Tandai wajib (auto dari child bila child `required`) |
| `name` | string | Nama field untuk lookup error (auto dari child bila ada) |
| `errors` / `error` | object/string | Override error (default: `FormPage.errors`) |
| `description` | string/ReactNode | Teks bantuan di bawah field |
| `ignoreDisabled` | boolean | Jangan warisi `disabled` dari FormPage |
| `className` | string | Class wrapper |
| `children` | ReactNode / `({id, required, readOnly}) => node` | Input atau render-prop |

> Child otomatis menerima `readOnly = props.readOnly \|\| FormPage.disabled` — tidak perlu pasang manual untuk mengikuti mode dokumen.

### FormTable
**File:** `resources/js/Components/FormTable.jsx` (~59KB). Editable table baris item: drag reorder, dialog row (`form`), kolom konfigurasi, kalkulasi (`mapItem`), data tambahan (`additionalData`/`asyncAdditionalData`).

**Props utama:**

| Prop | Tipe | Deskripsi |
|---|---|---|
| `name` | string | Identitas tabel (key persist kolom) |
| `columns` | `ColumnProps[]` | Definisi kolom (lihat bawah) |
| `value` | object[] | Array baris (controlled) |
| `onValueChange` | `(rows) => void` | Callback perubahan baris |
| `disabled` / `readOnly` | boolean | Nonaktifkan editing |
| `form` | ReactNode | Komponen dialog detail baris (mis. `<ItemForm />`) |
| `mapItem` | `(ctx) => row` | Transform baris (hitung subtotal/pajak) |
| `additionalData` | object / `(value) => object` | Data ekstra per baris (keyed by id) |
| `asyncAdditionalData` | `(value, idChanges) => Promise` | Fetch data ekstra (mis. stok tersedia) |
| `keyItem` | string | Field key baris (default `id`) |

**`ColumnProps`:**

| Field | Tipe | Deskripsi |
|---|---|---|
| `name` | string | Cocokkan dengan nama kolom/field baris |
| `title` / `titleTrans` | string | Judul kolom (statis / i18n key) |
| `type` | string | `text`/`number`/dll |
| `align` | `left`/`center`/`right` | Perataan |
| `width` | number | Lebar dalam `fr` (default `1`) |
| `required` | boolean | Wajib (auto `show: true`) |
| `unique` | boolean | Nilai tidak boleh duplikat antar baris |
| `locked` | boolean | Tidak bisa di-hide |
| `show` | boolean | Tampil default |
| `cell` | `({dataRow, data, setData, attributes, additionalData}, index) => node` | Render sel |

**Signature `cell` (PENTING):**

| Arg | Arti |
|---|---|
| `dataRow` | Seluruh object baris |
| `data` | Nilai kolom ini (`dataRow[name]`) |
| `setData` | `setData("field", val)` atau `setData({field: val, ...})` — update baris |
| `attributes` | `{ disabled, readOnly }` — **spread ke input** agar ikut mode dokumen |
| `additionalData` | Data dari `additionalData`/`asyncAdditionalData` untuk baris ini |

```jsx
const itemColumns = [
  {
    name: "item", titleTrans: "sales.salesOrder.columns.item", required: true, width: 3,
    cell({ dataRow, setData, attributes }) {
      return (
        <ItemVariantLinkModel
          value={dataRow.item}
          with={["defaultUom", "item"]}
          onValueChange={(val) =>
            setData({ item: val, unit: val?.default_uom })
          }
          {...attributes}
        />
      );
    },
  },
  {
    name: "quantity", titleTrans: "...columns.quantity", type: "number", required: true,
    cell({ data, setData, attributes, dataRow }) {
      return (
        <NumberInput
          {...attributes}
          disabled={!dataRow?.item}
          value={data}
          onValueChange={(v) => setData("quantity", v)}
        />
      );
    },
  },
];

<FormTable name="SalesOrderItems" form={<ItemForm />} columns={itemColumns}
  value={data.items ?? []} onValueChange={(v) => setData("items", v)}
  mapItem={({ item }) => ({ ...item, basic_amount: item.quantity * item.price })}
/>
```

### NumberInput
**File:** `resources/js/Components/NumberInput/index.jsx`. Input angka & mata uang, implementasi internal (pure-JS), `forwardRef`. Grouping ribuan realtime saat mengetik, pembulatan `decimalScale` ditunda hingga `onBlur` (round half-up tahan floating-point). Format separator bersumber dari `default_number_format` (preferences), dapat di-override per prop. Symbol mata uang via `currencyCode` (string code → resolve+cache, atau object data currency `{ code, symbol }` → pakai langsung tanpa fetch) dijadikan prefix.

| Prop | Tipe | Deskripsi |
|---|---|---|
| `value` | number/string/null | Nilai (float) |
| `onValueChange` | `(float, values) => void` | Callback; `values = { float, formatted, value }` |
| `currencyCode` | string \| object | Kode mata uang (`"idr"`/`"default"`) **atau** object `{ code, symbol }` untuk symbol prefix |
| `decimalScale` | number | Jumlah desimal (pembulatan saat blur) |
| `numberFormat` | string | Pola `#,###.##` — override grup/desimal/scale |
| `allowDecimals` | boolean | `false` → integer (decimalScale 0) |
| `min` / `max` | number | Batas nilai (clamp saat blur) |
| `prefix` / `suffix` | string | Teks depan/belakang (mis. `"%"`) |
| `disabled` / `readOnly` | boolean | State |

```jsx
<NumberInput value={data.price} currencyCode={data?.currency?.code}
  decimalScale={2} onValueChange={(v) => setData("price", v)} />
```

**Helper `formatNumber`** — `resources/js/Components/NumberInput/formatNumber.js`. Fungsi pure sinkron untuk memformat angka jadi string display (di luar komponen, mis. tabel/print/handlebars). Menggantikan `formatValue` lama.

```jsx
import { formatNumber } from "@/Components/NumberInput/formatNumber";
formatNumber(1234567.5, { decimalScale: 2 });            // "1,234,567.50"
formatNumber(1000, { decimalScale: 2, prefix: "Rp " });  // "Rp 1,000.00"
formatNumber(1234.5, { numberFormat: "#.###,##" });      // "1.234,50" (gaya ID/EU)
```

### BadgeStatus
**File:** `resources/js/Components/BadgeStatus.jsx`. Tampilan status dokumen sesuai `FormStatus` enum (warna + label i18n). Props: `status` (string atau string[] untuk multi-status), `className`.

```jsx
<BadgeStatus status={salesOrder.status} />          // ["to_deliver","to_bill"] → 2 badge
```

### DatetimePicker
**File:** `resources/js/Components/DatetimePicker.jsx` (~43KB). Props: `value`, `onValueChange`, `type` (`date`/`time`/`datetime`/`daterange`), `disabled`/`readOnly`.

```jsx
<DatetimePicker type="datetime" value={data.date} onValueChange={(v) => setData("date", v)} />
<DatetimePicker type="daterange" value={data.rent_date} onValueChange={(r) => setData("rent_date", r)} />
```

### Select, MultiSelect, NestedSelect, SelectModel
- **`Select.jsx`** — single select + search. Props: `value`, `onValueChange`, `options: {value,label}[]`.
- **`MultiSelect.jsx`** — multi select + chip. `value: []`, `options`. (Contoh di Item variant: pilih banyak nilai atribut.)
- **`NestedSelect.jsx`** — hierarki bertingkat (COA, categories).
- **`SelectModel.jsx`** — tombol import baris dari model lain (mis. SO import item dari Work Order). Props: `from` (map model→config), `onSelected`, `label`, `variant`, `size`. Helper `loadFromModel(model, id, select)`.

### ItemBarcode
**File:** `resources/js/Pages/Inventory/Items/ItemBarcode.jsx`. Input scan barcode → resolve ke item+unit, callback `onSelect`. Props: `with` (relasi load), `onSelect(selected)`. Dipakai untuk tambah baris item cepat via scan.

---

## Penggunaan LinkModel

`LinkModel` muncul dalam **3 pola** di codebase. Pahami ketiganya.

### Pola 1 — Wrapper per-entitas (definisi)

Tiap entitas punya wrapper tipis di `Pages/.../{Entitas}LinkModel.jsx` yang mengunci `model` (lihat [Peta LinkModel](#peta-linkmodel-relasi-ui)):

```jsx
// Pages/Sales/Customers/CustomerLinkModel.jsx
import LinkModel from "@/Components/LinkModel";
import { forwardRef } from "react";

export default forwardRef(function CustomerLinkModel(
  { value, onValueChange, placeholder, ...props }, ref) {
  return (
    <LinkModel
      model="App\Models\Sales\Customer"
      value={value} onValueChange={onValueChange} placeholder={placeholder}
      {...props} ref={ref}
    />
  );
});
```

> Selalu pakai wrapper (`<CustomerLinkModel/>`), bukan `<LinkModel model="...">` langsung — kecuali model dinamis (mis. `data.referenceable_type`).

### Pola 2 — Di dalam FormInput (field tunggal)

```jsx
<FormInput label={t("sales.salesOrder.customer")} required name="customer">
  <CustomerLinkModel
    value={data.customer}
    with={["branches"]}                       // eager-load relasi pada hasil
    onValueChange={(val) => {
      if (val?.branches?.length <= 1) setData("customer_branch", val.branches?.[0]);
      setData("customer", val);
    }}
  />
</FormInput>
```

- `readOnly`/`disabled` otomatis diwarisi dari `FormPage` via `FormInput` — tak perlu pasang manual.
- `with` menarik relasi (mis. `branches`) supaya bisa dipakai langsung di callback.

### Pola 3 — Di dalam FormTable cell (baris item)

```jsx
{
  name: "item", required: true, width: 3,
  cell({ dataRow, setData, attributes }) {
    return (
      <ItemVariantLinkModel
        value={dataRow.item}
        with={["defaultUom", "item"]}
        onValueChange={(val) => setData({ item: val, unit: val?.default_uom })}
        {...attributes}                        // ← teruskan disabled/readOnly
      />
    );
  },
}
```

> **Wajib spread `{...attributes}`** di cell agar input ikut mode dokumen (disabled saat submitted). Letakkan setelah props lain agar bisa di-override (mis. `readOnly` kondisional).

### Filter & dependent select

`filters` mempersempit opsi — sering bergantung baris/field lain:

```jsx
// Unit hanya untuk item terpilih
<ItemUnitLinkModel value={data} filters={{ item_id: dataRow?.item?.item_id }}
  onValueChange={(val) => setData({ unit: val, conversion_factor: val?.conversion_factor })}
  {...attributes} />

// Branch milik customer tertentu (filter polymorphic)
<BranchLinkModel value={data.customer_branch}
  filters={{ branchable_type: "App\\Models\\Sales\\Customer", branchable_id: data.customer?.id ?? null }}
  onValueChange={(val) => setData("customer_branch", val)} disabledNavigation />

// OR / grup (unit group + Others)
<UnitLinkModel filters={{ or: { "group[0]": activeGroup, "group[2]": "Others", "group[1]": null } }} />
```

### Quick-add (buat record baru dari dropdown)

Default LinkModel menampilkan tombol **+** untuk membuat record baru tanpa pindah halaman. `defaultValueForm` mengisi nilai awal form quick-add; `disabledAddButton` menyembunyikannya:

```jsx
<UnitLinkModel disabledAddButton={false}
  defaultValueForm={{ group: activeGroup ?? data?.default_unit?.group }} />
```

> Endpoint data: [`POST /model`](routes.md#4-core-api-non-inertia) (`ModelController`). Lihat juga [Peta LinkModel](#peta-linkmodel-relasi-ui).

---

## Pola FormPage End-to-End

`FormPage` membungkus seluruh form dokumen. Halaman `Form.jsx` per entitas **tidak** memanggil `<FormPage>` langsung — itu di-render oleh [`ShowGeneral`](#showgeneral)/`renderShow()`; `Form.jsx` cukup memakai hook `useFormPage()` dan mengisi `FormPageContent`.

```jsx
import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";

export default memo(function Form() {
  // initialData opsional, options { trackDefaultValue }
  const { data, setData, defaultData, disabled } = useFormPage(
    { date: new Date() },
    { trackDefaultValue: false },
  );

  return (
    <>
      <FormPageContent value="detail" title={t("sales.salesOrder.detail")}>
        <FormInput name="customer" label={t("...")} required>
          <CustomerLinkModel value={data.customer}
            onValueChange={(v) => setData("customer", v)} />
        </FormInput>
      </FormPageContent>

      <FormPageContent value="detail" title={t("...items")}
        actions={<SelectModel from={{...}} onSelected={mergeItems} />}>
        <FormTable name="SalesOrderItems" form={<ItemForm />}
          columns={itemColumns} value={data.items ?? []}
          onValueChange={(v) => setData("items", v)} />
      </FormPageContent>
    </>
  );
});
```

**`FormPageContent`** — section/tab di dalam form:

| Prop | Deskripsi |
|---|---|
| `title` | Judul section |
| `value` | Grup tab (section dengan `value` sama → satu tab) |
| `collapsible` / `defaultOpen` | Section bisa lipat |
| `show` | Tampilkan kondisional |
| `actions` | Node aksi di header section (mis. tombol import) |

**`setData`** menerima dua bentuk: `setData("field", val)` atau updater `setData(prev => ({...prev, ...}))` (untuk update banyak field/array atomik).

> Pola item-form terpisah (`ItemForm.jsx`) dipakai sebagai `form={<ItemForm/>}` pada FormTable — dialog detail baris. Lihat [SalesOrders/Form.jsx](#sales) sebagai contoh lengkap.

---

## Custom Hooks

Ringkasan, lalu detail per-hook (parameter + return + contoh):

| Hook | File | Tipe |
|---|---|---|
| [useFormPage](#useformpage) | export `FormPage.jsx` | Context form |
| [useFormPageMeta](#useformpagemeta) | export `FormPage.jsx` | Context form (meta) |
| [usePermission](#usepermission) | `Hooks/usePermission.jsx` | Inertia props |
| [useToasts](#usetoasts) | `Hooks/useToasts.js` | Zustand store |
| [useTheme](#usetheme) | `Hooks/useTheme.js` | Zustand store |
| [useDraftForm](#usedraftform) | `Hooks/useDraftForm.js` | Inertia form + draft |
| [useIsDirtyForm](#useisdirtyform) | `Hooks/useIsDirtyForm.js` | Zustand store |
| [useDeleteModal](#usedeletemodal) | `Hooks/useDeleteModal.js` | Zustand store |
| [useDidMountEffect](#usedidmounteffect) | `Hooks/useDidMountEffect.js` | Effect util |
| [useNestedFilters](#usenestedfilters) | `Hooks/useNestedFilters.jsx` | Context filter |
| [useDynamicRefs](#usedynamicrefs) | `Hooks/useDynamicRefs.js` | Ref util |
| [useIsMobile / useIsTablet](#useismobile--useistablet) | `Hooks/use-mobile.jsx`, `use-tablet.jsx` | Breakpoint |
| [useScreen](#usescreen) | `Hooks/useScreen.jsx` | Breakpoint |
| [useLocale](#uselocale) | `Hooks/useLocale.js` | i18n |

### useFormPage
Akses state form di dalam `FormPage`. **Param:** `(initialData?, options?)` — `options.trackDefaultValue` (boolean). **Return:** object form Inertia + helper.

| Return | Tipe | Arti |
|---|---|---|
| `data` | object | Data form |
| `setData` | `(field, val)` / `(updater)` | Update field/atomik |
| `defaultData` | object | Nilai awal |
| `disabled` | boolean | Mode read-only (submitted/no-permission) |
| `errors`, `processing`, `submit` | — | Standar Inertia form |

```jsx
const { data, setData, defaultData, disabled } = useFormPage(
  { date: new Date() }, { trackDefaultValue: false });
setData("customer", val);
setData((prev) => ({ ...prev, items: [...prev.items, row] }));
```

### useFormPageMeta
Metadata form (dipakai `FormInput`). **Param:** none. **Return:** `{ disabled, errors, fieldNameTrans }` — `fieldNameTrans` = prefix i18n untuk pesan error.

```jsx
const { disabled, errors, fieldNameTrans } = useFormPageMeta();
```

### usePermission
Cek izin dari Inertia props. **Param:** `(model: string)` FQCN. **Return:** `{ can, canGlobal }`.

| Fungsi | Signature | Return |
|---|---|---|
| `can` | `(action, options?)` | boolean |
| `canGlobal` | `(model, action, options?)` | boolean |

`options`: `{ level?: number = 0, user_id?: string }`. `user_id` dicek saat permission `only_creator` aktif (kecuali action `create`/`import`/`select`).

```jsx
const { can, canGlobal } = usePermission("App\\Models\\Sales\\SalesOrder");
can("create");                                   // boolean
can("write", { user_id: record.created_by_id }); // hormati only_creator
canGlobal("App\\Models\\Purchase\\PurchaseOrder", "create");
```

### useToasts
Zustand store notifikasi toast. **Return:** `{ toasts, addToast, removeToast }`.

| Fungsi | Signature |
|---|---|
| `addToast` | `({ type, title, message, timeout = 5000 })` |
| `removeToast` | `(id)` |

```jsx
const { addToast } = useToasts();
addToast({ type: "success", title: "Berhasil", message: "Data disimpan" });
```

### useTheme
Zustand store tema (persist ke localStorage + cookie). **Return:**

| Field/Fn | Arti |
|---|---|
| `theme` | `"light"` / `"dark"` / `"system"` (pilihan user) |
| `currentTheme` | tema efektif (`light`/`dark`, resolve `system`) |
| `setTheme(theme)` | set pilihan |
| `setCurrentTheme(t)` | set tema efektif |

```jsx
const { theme, currentTheme, setTheme } = useTheme();
setTheme("dark");
```

> Tidak ada `toggleTheme` — toggle manual: `setTheme(currentTheme === "dark" ? "light" : "dark")`.

### useDraftForm
Inertia form + auto-save draft ke localStorage (debounce 600ms). **Param:** `(name, initialData, options?)`.

| Param | Arti |
|---|---|
| `name` | Key draft (digabung user id + create/update) |
| `initialData` | Data awal |
| `options` | `{ expiredDays = 7, onContinueDraft, isCreate, isDialog, ignoreDraft }` |

**Return:** `InertiaFormProps` (data, setData, post, put, processing, errors, ...) plus integrasi alert draft. Dipakai internal oleh `FormPage`.

```jsx
const form = useDraftForm("salesOrder", salesOrder, { isCreate: true });
```

### useIsDirtyForm
Zustand store status dirty form (warning sebelum navigasi). **Return:** `{ isDirty, setIsDirty, processing, setProcessing, recentlySuccessful, ..., showAlert, cancel, leave, saveAsDraft }`.

```jsx
const { isDirty, setIsDirty } = useIsDirtyForm();
```

### useDeleteModal
Zustand store modal konfirmasi hapus. **Return:** `{ isOpen, route, id, deleteItem, close }`.

| Fungsi | Signature |
|---|---|
| `deleteItem` | `(route, id, attributes = {})` — buka modal |
| `close` | `()` — tutup |

```jsx
const { deleteItem } = useDeleteModal();
deleteItem("salesOrders.destroy", row.id);
```

### useDidMountEffect
`useEffect` yang **skip run pada mount pertama** — hanya jalan saat deps berubah. **Param:** `(func, deps)`. **Return:** none.

```jsx
useDidMountEffect(() => { /* hanya saat deps berubah */ }, [data.default_unit?.id]);
```

### useNestedFilters
Context filter bertingkat (grup AND/OR) untuk `DataTable2`. Dipakai via `<NestedFiltersProvider initialFilters columns>` + `useNestedFilters()` di anak. **Return (konsumen):** state `filters` + aksi (`updateItem`, `updateGroupKey`, `resetFilters`, `setFromInitial`, dll). Filter di-flatten jadi triple `[key, operator, value]` untuk dikirim ke server.

```jsx
import useNestedFilters, { NestedFiltersProvider } from "@/Hooks/useNestedFilters";
// <NestedFiltersProvider initialFilters={...} columns={cols}> ... </NestedFiltersProvider>
const { filters, updateItem, resetFilters } = useNestedFilters();
```

### useDynamicRefs
Map ref dinamis by key. **Return:** `[getRef, setRef]`.

```jsx
const [getRef, setRef] = useDynamicRefs();
setRef("row-1");        // buat ref
getRef("row-1");        // ambil ref
```

### useIsMobile / useIsTablet
Deteksi breakpoint (< 768px). **Param:** none. **Return:** boolean. Named export (`useIsMobile`, `useIsTablet`).

```jsx
import { useIsMobile } from "@/Hooks/use-mobile";
const isMobile = useIsMobile();
```

### useScreen
Match media query custom. **Param:** `(minWidth)` (mis. `"1024px"`). **Return:** boolean.

```jsx
const isDesktop = useScreen("1024px");
```

### useLocale
Wrapper `laravel-react-i18n` dengan alias `t` → `trans`. **Return:** `{ trans, setLocale, ...localeFunc }`.

```jsx
const { trans } = useLocale();
trans("core.form.save");
```

---

## shadcn/ui Components

Komponen UI di `resources/js/Components/ui/` (Radix-based). Lihat dokumentasi resmi shadcn/ui untuk: button, input, select, dialog, tabs, checkbox, table, badge, popover, tooltip, alert, dropdown-menu, collapsible, scroll-area, separator, avatar.

---

## Inertia Shared Props

Tersedia di setiap page via `usePage().props`:

```js
const {
  auth,            // { user: { id, name, email, ... } }
  permissions,     // { "App\\Models\\...": { ... } }
  branchSettings,  // { branches: [...], currentBranch: { id, name, code } }
  model,           // FQCN model aktif
  breadcrumbs,     // [{ name, link? }, ...]
  lang,            // "en" | "id"
  alerts,          // [{ id, title, message, type, timeout }] (flash)
} = usePage().props;
```

### Flash Pattern

```php
return back()->with('alert', ['title' => 'Berhasil', 'message' => '...', 'type' => 'success']);
```

`alerts` selalu array → di-push ke toast. Shared props diset di [`HandleInertiaRequests`](auth.md#inertia-middleware).

---

## i18n (laravel-react-i18n)

Package `laravel-react-i18n` v2. File di `lang/en/` & `lang/id/`, dikelompokkan per modul.

```jsx
const { t, setLocale } = useLaravelReactI18n();
t("core.form.save");                  // "Save"
t(`status.${status}`);                // "Draft", ...
t("inventory.item.columns.code");     // "Part No."
setLocale("id");
```

| Pattern | Contoh | Deskripsi |
|---|---|---|
| `{module}.{entity}.title` | `inventory.item.title` | Judul list |
| `{module}.{entity}.columns.{field}` | `inventory.item.columns.code` | Label kolom |
| `{module}.{entity}.menu.{section}` | `inventory.item.menu.details` | Section/tab |
| `status.{STATUS}` | `status.draft` | Status global |
| `core.form.{key}` | `core.form.save` | UI form shared |

---

## Ziggy Routes

Ziggy v2 — `route()` helper di semua komponen.

```js
import { route } from "ziggy-js";
route("salesOrders.index");                // "/salesOrders"
route("salesOrders.show", salesOrder.id);  // "/salesOrders/{id}"
route("salesOrders.submit", salesOrder.id);// "/salesOrders/{id}/submit"

import { router } from "@inertiajs/react";
router.put(route("salesOrders.submit", id));
```

Semua nama route: [Referensi Route](routes.md).

---

## Testing

Test frontend **co-located** dengan source-nya — bukan folder `__tests__` terpisah. Contoh: `resources/js/Components/EmailChipInput.jsx` + `resources/js/Components/EmailChipInput.rtl.test.jsx` di folder yang sama.

### Konvensi Lokasi & Command

| Command | Kegunaan |
|---|---|
| `npm run test` | Jalankan semua test sekali (dipakai [CI](#ci-gate)) |
| `npm run test:watch` | Mode watch untuk dev lokal |

**Config:** `vitest.config.js` di root project, memakai `test.projects` (bukan `environmentMatchGlobs` — opsi itu sudah dihapus di Vitest v4). Ada 3 project:

| Project | Environment | Include pattern | setupFiles |
|---|---|---|---|
| `unit` | `node` | `resources/js/**/*.test.{js,ts}` (exclude `*.dom.test.js`) | — |
| `dom` | `jsdom` | `resources/js/**/*.dom.test.js` | — |
| `component` | `jsdom` | `resources/js/**/*.rtl.test.{jsx,tsx}` | `./resources/js/test-setup.js` |

Alias `@/...` → `resources/js` berlaku di semua project (lewat `extends: true`).

> ⚠️ **Naming menentukan environment.** File `*.test.js`/`*.test.ts` biasa dijalankan di project `unit` (environment `node` — tidak ada `window`/`document`). File yang butuh browser API (`window.location`, `matchMedia`, `localStorage`, dll) **tapi tidak me-render komponen React** wajib disuffix `.dom.test.js` agar masuk project `dom` (jsdom). File yang me-*render* komponen React **wajib** disuffix `.rtl.test.jsx` agar masuk project `component` (jsdom). Lupa suffix → test gagal dengan `window`/`document is not defined`.
>
> **Gotcha `localStorage` di jsdom:** pada kombinasi Vitest 4.1.7 + Node 22+ di lingkungan ini, `localStorage` global (baik bare maupun `window.localStorage`) tidak selalu ter-bridge dengan bersih dari jsdom ke global scope — Node punya lazy getter `localStorage` sendiri yang bisa menabrak polyfill jsdom (`ExperimentalWarning: localStorage is not available because --localstorage-file was not provided`). Jangan gantungkan test pada `localStorage` bawaan jsdom; mock manual dengan `vi.stubGlobal("localStorage", <in-memory store>)` di `beforeEach`, lalu `vi.unstubAllGlobals()` di `afterEach`. Lihat contoh di [`resources/js/Hooks/useTheme.dom.test.js`](../resources/js/Hooks/useTheme.dom.test.js).

### Tiga Jenis Test FE

Codebase ini punya tiga pola test frontend. Pahami kapan masing-masing dipakai — jangan asal pilih pola yang familiar.

#### a) Unit test fungsi murni

Panggil function langsung, tanpa DOM. **Ini jenis yang PALING DIUTAMAKAN** — paling cepat dan paling stabil.

Contoh: [`resources/js/Components/NumberInput/index.test.js`](../resources/js/Components/NumberInput/index.test.js) (test `parseNumberFormat`, `formatNumber`, dll), [`resources/js/Pages/Core/PrintTemplate/utils/customModeUtils.property.test.js`](../resources/js/Pages/Core/PrintTemplate/utils/customModeUtils.property.test.js).

Pakai jenis ini kalau logic bisa diuji sebagai fungsi murni tanpa render apa pun.

```js
// resources/js/Components/NumberInput/index.test.js (pola)
import { describe, it, expect } from "vitest";
import { formatNumber } from "./formatNumber";

describe("formatNumber", () => {
  it("format ribuan dengan 2 desimal", () => {
    expect(formatNumber(1234567.5, { decimalScale: 2 })).toBe("1,234,567.50");
  });
});
```

#### b) Source-assertion test (regex baca source sebagai string)

Pola: `readFileSync` file `.jsx`/`.js` lalu `expect(source).toMatch(/regex/)` untuk verifikasi **pola kode** tertentu ada (misal: komponen tertentu dirender kondisional, konstanta terdaftar di tempat yang benar).

Contoh: [`resources/js/Pages/Core/PrintTemplate/Editor.gridCssFix.test.js`](../resources/js/Pages/Core/PrintTemplate/Editor.gridCssFix.test.js), [`resources/js/Pages/Core/PrintTemplate/Components/CustomMode.sidebar.drop.unit.test.js`](../resources/js/Pages/Core/PrintTemplate/Components/CustomMode.sidebar.drop.unit.test.js).

```js
// Editor.gridCssFix.test.js (pola)
import { readFileSync } from "node:fs";
const variableDropSource = readFileSync(variableDropUtilsPath, "utf8");

it("registers grid and subGrid component classes in variableDropUtils", () => {
  expect(variableDropSource).toMatch(/classes:\s*\[GRID_CLASS\]/);
});
```

> ⚠️ **RAPUH — pakai hanya kalau kepepet.** Kalau source di-refactor (ganti nama variabel, ubah urutan properti objek, ubah struktur kondisional) **tanpa** update regex, test gagal walau behavior tetap benar. Baru saja ditemukan 4 test gagal persis karena ini — source sudah lebih maju dari regex test yang ketinggalan.
>
> Rekomendasi: pakai jenis ini **hanya** kalau behavior-nya genuinely sulit diuji lewat render (misal: verifikasi struktur editor plugin GrapesJS yang butuh full canvas). Untuk kasus lain, **prefer render test asli** (poin c) — ini pola yang direkomendasikan menggantikan source-assertion test lama.

#### c) Component test (React Testing Library)

Jenis **BARU** ditambahkan — render komponen React sungguhan ke jsdom, simulasi interaksi user asli (klik, ketik, keyboard) pakai `@testing-library/user-event`, assert lewat `screen.getByRole()` dll (query by accessible role/text, **bukan** CSS selector).

Contoh lengkap: [`resources/js/Components/EmailChipInput.rtl.test.jsx`](../resources/js/Components/EmailChipInput.rtl.test.jsx).

```jsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import EmailChipInput from "./EmailChipInput";

describe("EmailChipInput", () => {
  it("menambahkan chip saat Enter ditekan pada email valid", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(<EmailChipInput value={[]} onValueChange={onValueChange} />);

    await user.type(screen.getByRole("textbox"), "customer@example.com{Enter}");

    expect(onValueChange).toHaveBeenCalledWith(["customer@example.com"]);
  });
});
```

**Naming convention wajib:** suffix `.rtl.test.jsx` (bukan `.test.jsx` biasa) — ini yang membuat `vitest.config.js` otomatis assign environment `jsdom` lewat project `component`. Lupa suffix → file otomatis coba jalan di project `unit` dengan environment `node` dan gagal (`document` undefined).

Pakai jenis ini untuk komponen dengan interaksi user nyata (form, input, tombol, dsb) — **pola yang paling direkomendasikan untuk komponen UI baru** ke depan, menggantikan source-assertion test lama.

**Dependency baru** (devDependencies): `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`.

**Ringkasan jenis-jenis test:**

| Jenis | Suffix file | Environment | Kapan dipakai |
|---|---|---|---|
| Unit fungsi murni | `.test.js` | `node` | Logic bisa diuji sebagai fungsi murni, tanpa `window`/`document` — **prioritas utama** |
| Unit butuh browser API | `.dom.test.js` | `jsdom` | Fungsi/hook pakai `window`, `matchMedia`, `localStorage`, dll tapi tidak me-render komponen React (mis. `lib/utils.js`, hook `use-mobile.jsx`) |
| Source-assertion | `.test.js` | `node` | Hanya kalau behavior genuinely sulit di-render (mis. GrapesJS canvas) — **hindari untuk komponen baru** |
| Component (RTL) | `.rtl.test.jsx` | `jsdom` | Komponen dengan interaksi user nyata — **rekomendasi default untuk UI baru** |

### Property-Based Testing (fast-check)

Beberapa test pakai [`fast-check`](https://github.com/dubzzz/fast-check) (`fc.assert` + `fc.property`) untuk generate ratusan kombinasi input acak — cocok untuk validasi function dengan banyak edge case.

Contoh: [`resources/js/Pages/Core/PrintTemplate/utils/customModeUtils.property.test.js`](../resources/js/Pages/Core/PrintTemplate/utils/customModeUtils.property.test.js), [`resources/js/Pages/Core/PrintTemplate/utils/variableTokenUtils.labelResolution.property.test.js`](../resources/js/Pages/Core/PrintTemplate/utils/variableTokenUtils.labelResolution.property.test.js).

```js
import { describe, it } from "vitest";
import * as fc from "fast-check";

it("properti X selalu benar untuk semua kombinasi input", () => {
  fc.assert(
    fc.property(fc.string(), fc.integer(), (str, num) => {
      // assertion di sini harus jalan untuk RATUSAN kombinasi random
    }),
  );
});
```

> ⚠️ **ATURAN WAJIB:** precondition `fc.pre(...)` (atau `.filter()` pada generator) **harus selaras persis** dengan validasi yang dipakai source code — bukan sekadar mirip.
>
> **Kasus nyata (bug yang sudah diperbaiki):** source pakai `Boolean(value.trim())` untuk menganggap string valid (whitespace-only dianggap kosong — lihat pola serupa di `variableTokenUtils.js`, misal `col.title.trim()`), tapi test lama pakai precondition `fc.pre(Boolean(value))`. String `" "` (spasi) lolos precondition test tapi ditolak oleh source, sehingga expected value test menyimpang dari actual behavior.
>
> Test ini **sempat lolos di sebagian besar run** karena fast-check pakai random seed berbeda tiap eksekusi — whitespace-only string jarang di-generate — sehingga bug ini nyaris tidak pernah ketahuan lewat testing manual biasa.
>
> **Fix:** generator string harus di-`.filter()` (atau `fc.pre()`) dengan kondisi **PERSIS SAMA** seperti validasi source, bukan sekadar `Boolean(x)`:
>
> ```js
> // ❌ SALAH — tidak selaras dengan source Boolean(value.trim())
> fc.pre(Boolean(value));
>
> // ✅ BENAR — persis sama dengan validasi source
> const validStringArb = fc.string().filter((s) => Boolean(s.trim()));
> ```

### CI Gate

File [`.github/workflows/tests.yml`](../.github/workflows/tests.yml) menjalankan 2 job **paralel** setiap push (kecuali branch `production`) dan setiap pull request:

| Job | Setup | Command |
|---|---|---|
| `backend` | PHP 8.4, `composer install` | `php artisan test --compact` (PHPUnit, DB sqlite in-memory dari `phpunit.xml`) |
| `frontend` | Node (versi dari `.nvmrc`), `npm ci` | `npm run test` (Vitest, kedua project `unit` + `component`) |

Tidak ada `continue-on-error` — kalau ada test gagal, CI merah, PR seharusnya tidak di-merge sampai fix.

> Terpisah dari [`.github/workflows/lint.yml`](../.github/workflows/lint.yml) (format/lint auto-commit via Pint + ESLint, `continue-on-error: true` — beda tujuan, bukan gate).

---

*Lihat juga: [Arsitektur](architecture.md) · [Routes](routes.md) · [Auth](auth.md) · [Database](database.md) · Modul: [Inventory](modules/inventory.md) · [Sales](modules/sales.md) · [Purchase](modules/purchase.md) · [Finances](modules/finances.md)*
