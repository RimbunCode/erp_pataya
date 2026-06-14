# Modul Core / Settings

> Dokumentasi modul inti: Branches, Approval Schemes, FormatingSeries, Print Templates, Dashboard, Tags, Files.

## Daftar Isi

- [Gambaran Modul](#gambaran-modul)
- [Branch & Multi-Branch](#branch--multi-branch)
- [Approval](#approval)
- [Trait Submitable](#trait-submitable)
- [FormatingSeries (Penomoran Dokumen)](#formatingseries-penomoran-dokumen)
- [Print Templates](#print-templates)
- [Dashboard & Widgets](#dashboard--widgets)
- [Tags & Files](#tags--files)
- [Preferences](#preferences)
- [Company Settings](#company-settings)
- [Model Connections](#model-connections)
- [Command Palette](#command-palette)

---

## Gambaran Modul

Modul Core berisi konfigurasi dan utilitas yang digunakan di seluruh sistem.

**Routes prefix:** `/settings/` untuk konfigurasi, `/` untuk utilitas

---

## Branch & Multi-Branch

Branch adalah unit bisnis atau cabang perusahaan. Setiap dokumen transaksional di-assign ke branch.

### Fields

| Field | Tipe | Deskripsi |
|---|---|---|
| `code` | string | Kode cabang (digunakan di FormatingSeries) |
| `name` | string | Nama cabang |
| `is_main_branch` | boolean | Apakah kantor pusat |
| `is_disabled` | boolean | Status aktif |
| `branchable_type/id` | polymorphic | Entitas terkait |
| `shipping_street`, `shipping_city`, dll. | string | Alamat pengiriman |
| `billing_address` | enum | `same_main` / `same_shipping` / `separate` |

### Branch Switcher

User bisa ganti branch aktif via `PUT /switch_branch/{id}`. Branch aktif tersimpan di session dan di-share ke frontend.

**Routes — Branch** (`Core\BranchController`): 12 route dasar `branches.*` ([macro](../routes.md#konvensi-macro-routeresourcedetail)) → prefix `/settings/branches`, + tambahan branch switcher:

| Method | URI | Route Name | Controller@method |
|---|---|---|---|
| PUT | `/switch_branch/{id}` | `branch.switch` | `Core\BranchController@switch` |

---

## Approval

Sistem approval terdiri dari **dua lapis**: _scheme_ (konfigurasi) dan _instance_ (runtime saat dokumen disubmit).

```
ApprovalScheme (config) ──< ApprovalSchemeStep
        │ trigger saat submit
        ▼
ApprovalInstance (runtime) ──< ApprovalInstanceStep ──> decision (approve/reject)
```

### Approval Scheme (Konfigurasi)

Konfigurasi skema approval per model dokumen.

### Approval Scheme Fields

| Field | Tipe | Deskripsi |
|---|---|---|
| `name` | string | Nama scheme |
| `permission` | relation | Permission (model) yang menggunakan scheme ini |
| `name_model` | string | Nama model |
| `model` | string | FQCN model |
| `is_active` | boolean | Scheme aktif |
| `trigger_on` | string | Trigger event (`submit`, dll.) |
| `config` | json | Konfigurasi tambahan (🚧 future) |
| `steps` | hasMany | Langkah-langkah approval |

### Approval Scheme Step Fields

| Field | Tipe | Deskripsi |
|---|---|---|
| `sequence` | tinyint | Urutan step (0, 1, 2, ...) |
| `approver_type` | string | `role` atau `user` |
| `approverable_type` | string | Model class approver |
| `approverable_id` | char(26) | ID role atau user |
| `config` | json | Konfigurasi tambahan (🚧 future) |

### Business Logic

- Hanya satu scheme yang boleh `is_active = true` per model + trigger_on kombinasi
- Jika scheme diaktifkan, scheme lain untuk model yang sama otomatis di-nonaktifkan

**Routes — ApprovalScheme** (`Core\ApprovalSchemeController`): 12 route dasar `approvalSchemes.*` → prefix `/settings/approvalSchemes`.

### Approval Instance (Runtime)

Saat dokumen submitable di-submit, trait [`Submitable::checkApproval()`](#trait-submitable) memanggil `ApprovalInstanceController@checkApproval`. Jika ada scheme aktif → dibuat `ApprovalInstance` + `ApprovalInstanceStep` per langkah.

| Field (ApprovalInstance) | Deskripsi |
|---|---|
| `document_type/id` | Dokumen yang di-approve (morph) |
| `scheme_id` | Scheme yang dipakai |
| `status` | Status approval keseluruhan |

| Field (ApprovalInstanceStep) | Deskripsi |
|---|---|
| `sequence` | Urutan step |
| `approverable_type/id` | Approver (role/user) |
| `status` | `pending` / `approved` / `rejected` |
| `decided_by` / `decided_at` | Pemutus & waktu |

**Routes Approval Instance:**

| Method | URI | Route Name | Action |
|---|---|---|---|
| GET | `/approvals` | `approvalInstances.index` | `Core\ApprovalInstanceController@index` |
| GET | `/approvals/{approvalInstance}` | `approvalInstances.show` | `@show` |
| POST | `/approvals/{approvalInstanceStep}/decision` | `approvalInstances.decision` | `@decision` |

- Saat semua step `approved` → callback `onApproved()` di service dokumen (status lanjut ke TO_DELIVER/TO_RECEIVE/dll).
- Saat salah satu step `rejected` → `onRejected()` (status REJECTED, dapat di-amend).

> Frontend: [`ApprovalInstanceIndex.jsx`](../frontend.md#core--shared), `ApproverDecision.jsx`.

---

## Trait Submitable

`app/Traits/Submitable.php` — di-`use` oleh semua model dokumen transaksi (SalesOrder, PurchaseOrder, StockEntry, DeliveryNote, Invoice, PaymentEntry, WorkOrder, dll). Menyediakan workflow status & lifecycle dokumen.

### Yang ditambahkan trait ini

| Elemen | Fungsi |
|---|---|
| Cast `status` | `FormStatusesCast` — status sebagai array (multi-status) |
| `creating` event | Set status awal `DRAFT` + `created_by_id` |
| `saving` event | Set `submitted_at`; saat **CANCELED → soft-delete `GeneralLedger` & `StockLedgerEntry` terkait** (reversal jurnal & stok otomatis) |
| `checkApproval()` | Trigger pembuatan [ApprovalInstance](#approval-instance-runtime) |
| `amend()` | Replikasi dokumen + relasi dengan kode baru `{code}-{revision}`; relasi `amendedFrom` |
| `approvalable()` | morphOne ke `ApprovalInstance` |
| `attachConnections()` | Bangun [`model_connections`](#model-connections) rekursif antar dokumen |

### Arti `{level?}` pada route update

Route `PUT /{plural}/{id}/{level?}` (lihat [Routes · macro submitable](../routes.md#route-tambahan-issubmmitable-true)) — `{level?}` opsional menandakan level approval saat update terjadi di tengah proses approval.

### Status (FormStatus enum)

`app/FormStatus.php` — enum semua status dokumen (DRAFT, SUBMITTED, NEED_APPROVAL, APPROVED, REJECTED, CANCELED, TO_DELIVER, DELIVERED, TO_BILL, BILLED, CLOSED, IN_RENT, RETURNED, dll). Status disimpan sebagai **JSON array** sehingga satu dokumen bisa multi-status (mis. `["to_deliver", "to_bill"]`). Lihat [Auth · Workflow Dokumen](../auth.md#workflow-dokumen).

---

## FormatingSeries (Penomoran Dokumen)

Konfigurasi auto-numbering untuk setiap dokumen submitable.

### Fields

| Field | Tipe | Deskripsi |
|---|---|---|
| `model` | string | FQCN model |
| `name` | string | Nama seri |
| `format` | string | Template format dengan token `@[...]` |
| `logs` | json | Counter per periode |

### Token Format

| Token | Deskripsi | Contoh |
|---|---|---|
| `@[i]` | Sequence 1+ digit | `1`, `10`, `100` |
| `@[ii]` | Sequence 2+ digit | `01`, `10`, `100` |
| `@[iiii]` | Sequence 4+ digit | `0001`, `0010`, `1000` |
| `@[yyyy]` | Tahun 4 digit | `2025` |
| `@[yy]` | Tahun 2 digit | `25` |
| `@[mmmm]` | Nama bulan lengkap | `January` |
| `@[mmm]` | Nama bulan 3 huruf | `Jan` |
| `@[mm]` | Bulan 2 digit | `01` |
| `@[branch_code]` | Kode branch (dari codeRelations) | `HO` |

### Counter Reset Logic

- Format dengan `@[mm]` + `@[yyyy]` → counter reset tiap bulan
- Format dengan `@[yyyy]` saja → counter reset tiap tahun
- Format tanpa token waktu → counter global tidak reset
- DRAFT documents pakai counter terpisah (`"draft"` key)

### Contoh

`@[branch_code]/SO-@[iiii]/@[yy]` dengan branch_code=`HO`, bulan=Jan, tahun=2025, urutan=1 → `HO/SO-0001/25`

**Routes — FormatingSeries** (`Core\FormatingSeriesController`): 12 route dasar `formatingSeries.*` → prefix `/settings/formatingSeries` (nama berakhiran "s" → plural tidak digandakan).

---

## Print Templates

Template cetak HTML/CSS untuk dokumen submitable. Editor berbasis GrapesJS.

### Fields

| Field | Tipe | Deskripsi |
|---|---|---|
| `name` | string | Nama template |
| `permission` | relation | Permission (model) terkait |
| `model` | string | FQCN model |
| `is_default` | boolean | Template default untuk model ini |
| `html` | longtext | Template HTML |
| `css` | longtext | Style CSS |
| `template` | json | Konfigurasi template (GrapesJS) |
| `paper` | string | Ukuran kertas (A4, Letter, dll.) |
| `orientation` | string | Portrait / Landscape |
| `width`, `height` | double | Dimensi kustom |
| `margin_top/bottom/left/right` | double | Margin |
| `is_letter_head` | boolean | Menggunakan letter head |
| `letter_head` | relation | File letter head |
| `used_relations` | json | Relasi Eloquent yang diperlukan untuk render |

### Routes

| Method | URI | Keterangan |
|---|---|---|
| *(resourceDetail)* | `/settings/printTemplates/...` | CRUD |
| GET | `/settings/printTemplates/{id}/editor` | Editor GrapesJS |
| POST | `/settings/printTemplates/{id}/preview` | Preview cetak |
| POST | `/settings/printTemplates/{id}/generate-example-data` | Generate data contoh |

---

## Dashboard & Widgets

Setiap user bisa konfigurasi dashboard mereka sendiri dengan widget pilihan.

### Dashboard

| Field | Tipe | Deskripsi |
|---|---|---|
| `title` | string | Judul dashboard |
| `created_by` | relation | Pemilik dashboard |
| `widgets` | hasMany | Widget yang ada di dashboard |

### Widget

| Field | Tipe | Deskripsi |
|---|---|---|
| `title` | string | Judul widget |
| `type` | string | Tipe: `chart`, `table`, `metric`, dll. |
| `calculation_type` | string | Cara kalkulasi data |
| `model_class` | string | Model yang jadi sumber data |
| `filters` | json | Filter data |
| `config` | json | Konfigurasi display |

**Routes — Dashboard & Widget:**

| Method | URI | Route Name | Controller@method |
|---|---|---|---|
| GET | `/dashboard-view` | `dashboard` | `Core\DashboardController@view` |
| POST | `/dashboard-update` | `dashboardForms.store` | `Core\DashboardController@storeUserDashboard` |
| POST | `/dashboard-widget-order/{dashboard}` | `dashboard.widgets.reorder` | `Core\DashboardController@reorderWidgets` |
| POST | `/get-chart/{widget}` | `get-chart` | `Core\WidgetController@getChartData` |
| *(resourceDetail)* | `/settings/dashboards` | `dashboards.*` | `Core\DashboardController@*` |
| *(resourceDetail)* | `/settings/widgets` | `widgets.*` | `Core\WidgetController@*` |

---

## Tags & Files

### Tags

Sistem tagging polimorfik. Semua model bisa di-tag.

| Field | Tipe | Deskripsi |
|---|---|---|
| `name` | string | Nama tag |
| `description` | text | Deskripsi |

**Routes — Tag** (`Core\TagController`): 12 route dasar `tags.*` → prefix `/tags`.

Tambah tag ke dokumen apa pun: `POST /{resource}/{id}/tag` → `{resource}.addTag` (di-generate macro untuk setiap resource).

### Files

Upload dan manajemen file. Mendukung hierarki folder (TreeView trait).

| Field | Tipe | Deskripsi |
|---|---|---|
| `name` | string | Nama file |
| `path` | text | Path storage |
| `extension` | string | Ekstensi file |
| `mime_type` | string | MIME type |
| `is_public` | boolean | Apakah file public |
| `created_by` | relation | Uploader |
| `parent_id`, `lft`, `rgt`, `depth` | — | Hierarki folder (TreeView) |

**Routes — File** (`Core\FileController`): 12 route dasar `files.*` → prefix `/files`, + preview publik:

| Method | URI | Route Name | Controller@method |
|---|---|---|---|
| GET | `/files/{file}/preview` | `files.preview` | `Core\FileController@preview` |

Tambah file ke dokumen apa pun: `POST /{resource}/{id}/file` → `{resource}.addFile`.

---

## Preferences

Key-value store untuk pengaturan aplikasi global.

| Key | Deskripsi |
|---|---|
| `default_currency_id` | Mata uang default |
| `timezone` | Timezone untuk penomoran dokumen |
| `company_name` | Nama perusahaan |
| Lainnya | Berbagai pengaturan aplikasi |

---

## Company Settings

Pengaturan profil perusahaan (nama, alamat, logo).

| Method | URI | Keterangan |
|---|---|---|
| GET | `/settings/company` | Lihat pengaturan |
| PUT | `/settings/company` | Update pengaturan |
| POST | `/settings/company/image` | Upload logo |

---

## Model Connections

System cross-document linking untuk traceability. Dibuat otomatis saat dokumen disubmit/approved.

| Field | Tipe | Deskripsi |
|---|---|---|
| `model_type/id` | polymorphic | Dokumen sumber |
| `reference_type/id` | polymorphic | Dokumen referensi |
| `model_display` | string | Label tampilan dokumen sumber |
| `reference_display` | string | Label tampilan dokumen referensi |
| `is_manual` | boolean | Manual atau otomatis |
| `data` | json | Data tambahan |

---

## Command Palette

Global search dan navigasi via keyboard shortcut. Index di-rebuild via `commands:index`.

### Tipe Command

| Tipe | Deskripsi |
|---|---|
| `navigation` | Link ke halaman (menu, settings, dll.) |
| `record` | Link ke dokumen spesifik (SO, PO, Item, dll.) |

### Routes

| Method | URI | Keterangan |
|---|---|---|
| GET | `/commands/search` | Search command palette |
| POST | `/commands/recent` | Track recent command |
| DELETE | `/commands/recent` | Hapus recent command |

---

## Related Documents

| Topik | Dokumen |
|---|---|
| Workflow dokumen & status | [Auth · Workflow Dokumen](../auth.md#workflow-dokumen) |
| Roles, permissions, branches | [Auth · Roles & Permissions](../auth.md#roles--permissions) |
| ModelConnection antar dokumen | [Database · model_connections](../database.md#model_connections) |
| Print template engine | (lihat [Print Templates](#print-templates)) |
| Tabel database | [Database · Domain Core/Settings](../database.md#domain-core--settings) |
| Route Settings + Controller@method | [Routes · Settings](../routes.md#6-settings) · [Approval](../routes.md#8-approval) |
| Halaman React | [Frontend · Settings](../frontend.md#settings) · [Core](../frontend.md#core--shared) |
| Dipakai oleh semua modul transaksi | [Sales](sales.md) · [Purchase](purchase.md) · [Inventory](inventory.md) · [Finances](finances.md) · [Service](service.md) |
