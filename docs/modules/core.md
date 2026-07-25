# Modul Core / Settings

> Dokumentasi modul inti: Branches, Approval Schemes, FormatingSeries, Print Templates, Dashboard, Tags, Files, Todo, Notification, Email Template, Image Uploader, SavedFilter, Changelog.

## Daftar Isi

- [Gambaran Modul](#gambaran-modul)
- [Branch & Multi-Branch](#branch--multi-branch)
- [Approval](#approval)
- [Trait Submitable](#trait-submitable)
- [FormatingSeries (Penomoran Dokumen)](#formatingseries-penomoran-dokumen)
- [Print Templates](#print-templates)
- [Dashboard & Widgets](#dashboard--widgets)
- [Tags & Files](#tags--files)
- [Todo](#todo)
- [Notification System](#notification-system)
- [Email Template](#email-template)
- [Image Uploader (Generik)](#image-uploader-generik)
- [SavedFilter](#savedfilter)
- [Changelog](#changelog)
- [Backup (Belum Diimplementasikan)](#backup-belum-diimplementasikan)
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

## Todo

Tugas generik yang bisa ditugaskan ke **User** atau **Role** — dipakai lintas modul untuk mencatat pekerjaan yang tidak terikat dokumen transaksi tertentu (mis. "follow up customer X", "siapkan laporan bulanan").

### Fields

| Field | Tipe | Deskripsi |
|---|---|---|
| `code` | string | Kode todo (auto: FormatingSeries, format `TODO/@[yy]-@[mm]/@[iiii]`) |
| `description` | text | Deskripsi tugas |
| `reference` | morphTo | Dokumen konteks (opsional — mis. todo terkait sebuah Sales Order) |
| `allocated_to` | morphTo | Penerima tugas — **User** atau **Role** (dibedakan lewat `allocated_to_type`) |
| `assigned_by` | relation | User pemberi tugas |
| `priority` | string | Prioritas todo |
| `date` | date | Tanggal todo |
| `due_date` | datetime | Batas waktu |
| `status` | string | Status todo |

### Business Logic — Assignment ke User atau Role

Jika `allocated_to_type = 'role'`, tugas berlaku untuk **semua user yang punya role tersebut** (bukan satu user spesifik). Method `allocatedUsers()` di model meresolusi daftar user penerima aktual:

```php
public function allocatedUsers(): Collection {
    if ($this->allocated_to_type === 'role') {
        return User::whereHas('roles', fn ($q) => $q->where('roles.id', $this->allocated_to_id))->get();
    }
    $user = User::find($this->allocated_to_id);
    return $user ? collect([$user]) : collect();
}
```

Saat todo dibuat/di-assign, sistem mengirim notifikasi `TodoAssignedNotification` ke seluruh `allocatedUsers()`.

Query listing todo memakai dua scope permission-aware:
- `assignedToMe($user)` — todo yang di-assign langsung ke user tersebut, **atau** ke salah satu role yang dimiliki user tersebut.
- `assignedByMe($userId)` — todo yang dibuat/di-assign oleh user tersebut.

### Komponen UI — AssignDialog

`Pages/Core/Components/AssignDialog.jsx` adalah dialog assign generik: memilih penerima (User atau Role), prioritas, rentang tanggal, dan deskripsi. Dipakai di form Todo (`AssignedToFields.jsx`) — komponen ini menggantikan inline-picker versi sebelumnya.

### Routes — Todo

`Core\TodoController`: 12 route dasar `todos.*` ([macro `resourceDetail`](../routes.md#konvensi-macro-routeresourcedetail), non-submitable) → prefix `/todos`.

---

## Notification System

Notifikasi in-app standar Laravel — dipakai untuk memberi tahu user soal event penting (mis. `TodoAssignedNotification`).

### Routes — Notification

`Core\NotificationController` — murni JSON API (bukan halaman Inertia):

| Method | URI | Route Name | Controller@method |
|---|---|---|---|
| GET | `/notifications` | `notifications.index` | `Core\NotificationController@index` |
| PUT | `/notifications/{id}/read` | `notifications.markAsRead` | `Core\NotificationController@markAsRead` |
| PUT | `/notifications/mark-all-read` | `notifications.markAllRead` | `Core\NotificationController@markAllRead` |

> UI ditampilkan via `Components/Navbar/Notifications.jsx` (dropdown lonceng notifikasi di navbar).

---

## Email Template

Template email per model, dengan mekanisme `is_default` yang **otomatis eksklusif** per model — pola yang sama seperti [Print Templates](#print-templates).

### Fields

| Field | Tipe | Deskripsi |
|---|---|---|
| `name` | string | Nama template |
| `name_model` | string | Label model tujuan (tampilan) |
| `model` | string | FQCN model target |
| `permission` | relation | Permission terkait |
| `is_default` | boolean | Default untuk model ini |
| `body_json` | json | Isi template (rich-text editor) |

### Business Logic

- Saat template disimpan dengan `is_default = true`, semua template lain untuk `model` yang sama otomatis di-set `is_default = false` (eksklusivitas terjaga di level model, bukan hanya validasi form).
- Jika ini adalah template pertama untuk suatu `model`, otomatis dijadikan default meski tidak dicentang manual.
- Endpoint `fields()` menyediakan daftar merge-tag yang tersedia untuk suatu model (di-whitelist by `Permission::model` untuk mencegah eksekusi class arbitrary/RCE).
- **Test Send**: mengirim email uji ke user yang sedang login, memakai data contoh (`HasExampleData`).

### Komponen UI — EmailSendDialog

`Pages/Core/Components/EmailSendDialog.jsx` — tombol kirim email manual dari halaman detail dokumen apa pun yang punya Email Template terkait modelnya.

### Routes — Email Template

`Core\EmailTemplateController`: 12 route dasar `emailTemplates.*` (macro `resourceDetail`) → prefix `/settings/emailTemplates`, + tambahan:

| Method | URI | Keterangan |
|---|---|---|
| GET | `/settings/emailTemplates/{id}/fields` | Daftar merge-tag tersedia |
| POST | `/settings/emailTemplates/{id}/testSend` | Kirim email uji |

---

## Image Uploader (Generik)

Pola upload/preview/hapus gambar yang konsisten dipakai di beberapa model — bukan fitur terpisah, melainkan pola berulang lewat kolom `image` (FK ke [File](#tags--files)).

| Dipakai di | Endpoint upload | Endpoint hapus |
|---|---|---|
| User | `POST /users/{user}/image` | `DELETE /users/{user}/image` |
| Item | `POST /items/{item}/image` | `DELETE /items/{item}/image` |
| ItemVariant | `POST /itemVariants/{itemVariant}/image` | `DELETE /itemVariants/{itemVariant}/image` |
| Company | `POST /settings/company/image` | `DELETE /settings/company/image` |

> **Catatan migrasi**: kolom ini sebelumnya bernama `image_id` pada Item/ItemVariant — sudah di-rename menjadi `image` agar konsisten dengan penamaan di `users.image`.

### Picture Attribute (khusus User)

Model `User` punya accessor tambahan `picture` yang menggabungkan dua sumber gambar:
1. `image` — hasil upload manual (via endpoint di atas), diresolusi ke URL lewat `route('files.preview', id)`.
2. `avatar_url` — fallback dari provider OAuth (Socialite) jika user belum upload gambar manual.

Logic resolusi ada di util frontend `resolveImageSrc()`/`isImageUrl()` (`resources/js/lib/utils.js`) — otomatis mendeteksi apakah value adalah file-ID (perlu di-resolve ke route preview) atau URL langsung (dipakai apa adanya, termasuk URL protocol-relative `//host/path` dari provider OAuth).

### Komponen UI

Avatar (preview bulat) + `UploadDialog.jsx` (dialog pilih & upload file) — pola yang sama dipakai di ketiga tempat di atas.

---

## SavedFilter

Filter DataTable yang bisa disimpan per user per model — mendukung dua mode: filter **tersimpan bernama** dan filter **transient** (sementara).

### Fields

| Field | Tipe | Deskripsi |
|---|---|---|
| `user` | relation | Pemilik filter |
| `model` | string | FQCN model target filter |
| `name` | string | Nama filter (hanya relevan jika `is_saved`) |
| `filter` | json | Kondisi filter |
| `is_saved` | boolean | `true` = filter tersimpan bernama; `false` = filter transient |

> Filter transient (`is_saved = false`) dibersihkan otomatis oleh scheduled command `saved-filters:prune` — lihat [Artisan Commands](../artisan-commands.md).

### Routes — SavedFilter

Route manual di luar macro `resourceDetail` (murni JSON API, tanpa Inertia): `GET/POST/PATCH/DELETE /saved-filters/*`.

---

## Changelog

Catatan rilis aplikasi — dibuat **otomatis** dari webhook deploy CI/CD, bukan diinput manual lewat form. Terintegrasi erat dengan modul [Helpdesk](helpdesk.md) untuk auto-resolve ticket saat rilis.

### Fields

| Field | Tipe | Deskripsi |
|---|---|---|
| `version` | string | Versi rilis (unik) |
| `environment` | string | Environment tujuan deploy |
| `content_raw` | text | Teks changelog asli (Markdown) |
| `content_html` | text | Hasil konversi HTML (disanitasi, `html_input: strip` mencegah XSS) |
| `deployed_at` | datetime | Waktu deploy tercatat |
| `readers` | belongsToMany | User yang sudah membaca (pivot `changelog_reads`, kolom `read_at`) |

### Business Logic

- Format `[#KODE-TICKET]` di dalam teks changelog otomatis dikonversi jadi link menuju halaman ticket terkait saat di-render ke HTML.
- Halaman `/changelogs` otomatis menandai semua changelog sebagai "sudah dibaca" oleh user yang membukanya (`markAllRead`).
- Detail lengkap alur webhook deploy → Changelog → auto-resolve Ticket: [Helpdesk · Integrasi Deploy](helpdesk.md#integrasi-deploy---changelog---ticket).

### Routes — Changelog

| Method | URI | Route Name | Controller@method |
|---|---|---|---|
| GET | `/changelogs` | `changelogs.index` | `Core\ChangelogController@index` |

---

## Backup (Belum Diimplementasikan)

`Core\BackupController` terdaftar di codebase, namun **seluruh method-nya masih stub kosong** — tidak ada logic backup database/file yang aktif saat ini. Disebutkan di sini agar maintainer tidak salah asumsi bahwa fitur backup otomatis sudah berjalan.

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
| Changelog ↔ integrasi deploy Ticket | [Helpdesk · Integrasi Deploy](helpdesk.md#integrasi-deploy---changelog---ticket) |
| Image Uploader dipakai di Item/ItemVariant | [Inventory · Image Uploader](inventory.md#image-uploader) |
