# Requirements Document

## Introduction

Aplikasi ERP ini belum memiliki modul manajemen aset tetap (fixed asset). Kebutuhan pelacakan aset perusahaan (kendaraan, mesin, peralatan kantor) saat ini tidak tertampung dengan benar — bukti nyatanya adalah sistem rental pada `SalesOrder` (`is_rent`) yang terpaksa memakai `Item`/`ItemVariant` sebagai representasi unit yang disewakan, padahal `Item` dirancang untuk barang dagangan bervolume (quantity agregat), bukan unit fisik individual yang perlu dilacak kepemilikan, lokasi, kondisi, dan nilai bukunya dari waktu ke waktu.

Spec ini adalah **Fase 1 dari 5 fase modul Asset Management**, mengadaptasi model data ERPNext v16 (diverifikasi langsung dari source code ERPNext yang berjalan di instance Docker milik user) ke konvensi arsitektur codebase ini. Fase ini membangun fondasi: model `Asset`, `AssetCategory`, dan `AssetLocation`, termasuk field skema yang akan dipakai fase-fase berikutnya (depresiasi, integrasi Purchase, Movement/Maintenance/Rental) agar tidak perlu migrasi ulang kolom inti.

**Fase-fase lanjutan (di luar scope spec ini, dicatat sebagai konteks)**:
- Fase 2 — Integrasi Purchase/Inventory (`Item.is_fixed_asset`, auto-create Asset dari Purchase Receipt/Invoice)
- Fase 3 — Depresiasi otomatis + posting General Ledger + Asset Value Adjustment
- Fase 4 — Asset Movement, Asset Maintenance (Team/Task), Asset Repair, Report, dan perbaikan sistem rental SalesOrder (basis Item → Asset)
- Fase 5 — Asset Capitalization, Composite Asset, penyelesaian Capital Work in Progress (CWIP)

## Glossary

- **Asset**: satu baris data yang merepresentasikan satu unit (atau satu kelompok unit identik, lihat `asset_quantity`) aset tetap milik/dikuasai perusahaan.
- **Asset Category**: pengelompokan Asset yang menentukan default perilaku depresiasi dan status dapat-disewakan (`is_rentable`).
- **Asset Location**: lokasi fisik penempatan Asset, berstruktur pohon (tree) mengikuti hierarki organisasi/gedung.
- **Ownership**: kepemilikan legal Asset — bisa milik perusahaan sendiri (`company`), milik Supplier yang dititipkan (consignment), atau milik Customer yang dititip untuk dikelola/diservis. Berbeda dari `custodian`, yang merupakan penanggung jawab operasional harian (staf internal).
- **Submitable**: trait `App\Traits\Submitable` yang menyediakan siklus hidup dokumen (draft → submit → approval → active/cancel) beserta fitur amend (revisi) dan auto-cancel entri jurnal terkait.
- **is_rentable**: flag pada `AssetCategory` yang menentukan apakah Asset dalam kategori tersebut boleh disewakan lewat `SalesOrder` (dipakai Fase 4, disiapkan skemanya di sini).
- **Asset Type**: penanda apakah Asset berdiri sendiri (`existing_asset`) atau merupakan hasil/komponen dari proses penggabungan aset (`composite_asset`/`composite_component`, logic penuh baru di Fase 5).

## Requirements

### Requirement 1: Model Asset Category

**User Story:** As an administrator aset, I want mendefinisikan kategori aset beserta akun akuntansi dan pengaturan depresiasi default-nya, so that setiap Asset baru dalam kategori tersebut otomatis mewarisi konfigurasi yang konsisten.

#### Acceptance Criteria

1. THE system SHALL menyediakan model `AssetCategory` dengan field `category_name` (wajib, unik).
2. THE system SHALL menyediakan child table `AssetCategoryAccount` pada `AssetCategory` berisi `fixed_asset_account_id`, `accumulated_depreciation_account_id`, `depreciation_expense_account_id`, dan `capital_work_in_progress_account_id`, masing-masing merujuk ke model `Account` (Chart of Accounts), dikelompokkan per Branch.
3. THE `AssetCategory` SHALL memiliki field `non_depreciable_category` (boolean, default `false`) yang menentukan nilai default `is_depreciable` pada Asset baru dalam kategori tersebut.
4. THE `AssetCategory` SHALL memiliki field `enable_cwip_accounting` (boolean, default `false`) yang disiapkan skemanya untuk Fase 5, TANPA logic aktif pada fase ini.
5. THE `AssetCategory` SHALL memiliki field `is_rentable` (boolean, default `false`) sebagai ekstensi di luar parity ERPNext, disiapkan untuk validasi Fase 4.
6. THE `AssetCategory` SHALL memiliki field default pengaturan depresiasi (`default_depreciation_method`, `default_frequency_of_depreciation`, `default_total_number_of_depreciations`) yang disalin ke Asset baru saat pembuatan.
7. WHEN `AssetCategory` akan dihapus DAN masih ada Asset yang merujuk padanya, THE system SHALL menolak penghapusan (foreign key restrict, bukan cascade).

### Requirement 2: Model Asset Location (hierarki pohon)

**User Story:** As an administrator aset, I want mengatur lokasi penempatan aset dalam struktur hierarki (mis. Gedung > Lantai > Ruangan), so that pelacakan lokasi aset mengikuti struktur fisik/organisasi perusahaan.

#### Acceptance Criteria

1. THE system SHALL menyediakan model `AssetLocation` dengan field `location_name` (wajib, unik).
2. THE `AssetLocation` SHALL mengimplementasikan struktur pohon menggunakan trait `TreeView` yang sudah ada di codebase (nested set `lft`/`rgt`/`depth`), BUKAN membangun mekanisme tree baru.
3. THE `AssetLocation` SHALL memiliki field `parent_id` (self-referencing, dikelola otomatis oleh `TreeView`) dan `is_group` (boolean, default `false`).
4. THE `AssetLocation` SHALL menggunakan trait `HasBranch` untuk pembatasan lingkup per cabang perusahaan.
5. WHEN `AssetLocation` akan dihapus DAN masih terdapat Asset aktif pada lokasi tersebut atau pada subtree-nya, THE system SHALL menolak penghapusan.
6. THE system SHALL TIDAK menyertakan field geolocation (`latitude`, `longitude`, `area`, peta) dari ERPNext pada fase ini.

### Requirement 3: Model Asset — identitas, kategori, dan lokasi

**User Story:** As a staf aset, I want mencatat data inti sebuah unit aset (nama, kategori, lokasi, tipe), so that setiap aset perusahaan dapat diidentifikasi dan dikelompokkan dengan jelas.

#### Acceptance Criteria

1. THE system SHALL menyediakan model `Asset` dengan field `asset_name` (wajib), `code` (dihasilkan via `FormatingSeries`), `asset_category_id` (FK ke `AssetCategory`, wajib), `asset_location_id` (FK ke `AssetLocation`, wajib).
2. THE `Asset` SHALL memiliki field `asset_type` (enum: `existing_asset` | `composite_asset` | `composite_component`, default `existing_asset`). Value `composite_*` SHALL disiapkan pada skema namun TIDAK memiliki logic aktif pada fase ini (ditangani Fase 5).
3. THE `Asset` SHALL memiliki field `item_id` (FK ke `Item`, nullable) yang disiapkan untuk integrasi Fase 2, TANPA proses otomatis pengisian pada fase ini.
4. THE `Asset` SHALL memiliki field `asset_quantity` (integer, default `1`).
5. IF `AssetCategory` milik Asset memiliki `is_rentable = true`, THEN THE system SHALL memvalidasi `asset_quantity = 1` saat disimpan (aset yang dapat disewakan wajib dilacak per-unit, tidak boleh berupa kelompok).

### Requirement 4: Model Asset — kepemilikan (ownership)

**User Story:** As an akuntan, I want mencatat siapa pemilik legal suatu aset (perusahaan sendiri, supplier, atau customer), so that aset yang bukan milik perusahaan tidak keliru disusutkan dalam pembukuan perusahaan.

#### Acceptance Criteria

1. THE `Asset` SHALL memiliki field `ownership_type` (enum: `company` | `supplier` | `customer`, default `company`).
2. THE `Asset` SHALL memiliki tiga field terpisah: `ownership_company_id`, `ownership_supplier_id` (FK ke `App\Models\Purchase\Supplier`), dan `ownership_customer_id` (FK ke `App\Models\Sales\Customer`), masing-masing nullable.
3. WHEN `ownership_type` bernilai `company`, THE system SHALL mengharuskan `ownership_company_id` terisi DAN `ownership_supplier_id`/`ownership_customer_id` kosong.
4. WHEN `ownership_type` bernilai `supplier`, THE system SHALL mengharuskan `ownership_supplier_id` terisi DAN dua field ownership lainnya kosong.
5. WHEN `ownership_type` bernilai `customer`, THE system SHALL mengharuskan `ownership_customer_id` terisi DAN dua field ownership lainnya kosong.
6. THE `Asset` SHALL menyediakan accessor method (bukan `morphTo()` bawaan Laravel) untuk menyimpulkan entitas ownership berdasarkan `ownership_type`.
7. WHEN `ownership_type` bernilai selain `company`, THE system SHALL mengatur `is_depreciable` menjadi `false` secara otomatis saat disimpan, KECUALI pengguna melakukan override manual secara eksplisit.

### Requirement 5: Model Asset — data pembelian dan nilai

**User Story:** As seorang akuntan, I want mencatat tanggal dan nilai perolehan aset, so that nilai buku aset dapat dihitung dan dilacak dari waktu ke waktu.

#### Acceptance Criteria

1. THE `Asset` SHALL memiliki field `purchase_date`, `available_for_use_date`, dan `disposal_date` (nullable, read-only, terisi otomatis saat aset di-scrap/dijual).
2. THE `Asset` SHALL memiliki field `purchase_receipt_id` dan `purchase_invoice_id` (FK nullable) yang disiapkan untuk integrasi Fase 2.
3. THE `Asset` SHALL memiliki field `net_purchase_amount`, `gross_purchase_amount`, `additional_asset_cost` (default `0`), dan `total_asset_cost` (read-only, computed sebagai penjumlahan `gross_purchase_amount` dan `additional_asset_cost`).

### Requirement 6: Model Asset — konfigurasi depresiasi (skema, tanpa kalkulasi)

**User Story:** As an akuntan, I want mengatur metode dan parameter depresiasi pada tingkat Asset, so that Fase 3 dapat langsung menghitung jadwal penyusutan tanpa migrasi skema tambahan.

#### Acceptance Criteria

1. THE `Asset` SHALL memiliki field `calculate_depreciation` (boolean, default `false`) sebagai gate utama.
2. THE `Asset` SHALL memiliki field `is_depreciable` (boolean), yang nilai defaultnya diturunkan dari `AssetCategory.non_depreciable_category` saat Asset dibuat.
3. THE `Asset` SHALL memiliki field `opening_accumulated_depreciation` (default `0`) dan `opening_number_of_booked_depreciations` (default `0`), relevan hanya ketika `asset_type = existing_asset`.
4. THE `Asset` SHALL memiliki field flat (bukan child table terpisah, karena codebase ini tidak memiliki konsep multi-buku akuntansi paralel/"Finance Book"): `depreciation_method` (enum: `straight_line` | `double_declining_balance` | `written_down_value` | `manual`), `frequency_of_depreciation` (integer, bulan), `total_number_of_depreciations` (integer), `next_depreciation_date` (date, nullable), `expected_value_after_useful_life` (decimal, default `0`, salvage value), `salvage_value_percentage` (decimal, nullable), `rate_of_depreciation` (decimal, nullable, relevan hanya untuk metode `written_down_value`), `daily_prorata_based` (boolean, default `false`), `total_number_of_booked_depreciations` (integer, read-only), dan `increase_in_asset_life` (integer, nullable, bulan — akan terisi otomatis dari Asset Repair pada Fase 4).
5. THE system SHALL TIDAK mengimplementasikan kalkulasi jadwal depresiasi maupun posting jurnal pada fase ini (ditangani Fase 3).

### Requirement 7: Model Asset — asuransi

**User Story:** As staf aset, I want mencatat data polis asuransi suatu aset, so that informasi perlindungan aset tersimpan bersama data asetnya.

#### Acceptance Criteria

1. THE `Asset` SHALL memiliki field `insurance_policy_number`, `insurance_insurer`, `insurance_insured_value`, `insurance_start_date`, `insurance_end_date`, dan `insurance_comprehensive`, seluruhnya nullable.
2. THE system SHALL TIDAK mengimplementasikan validasi, reminder, atau notifikasi otomatis terkait masa berlaku asuransi pada fase ini.

### Requirement 8: Model Asset — siklus hidup dokumen via Submitable

**User Story:** As seorang manajer, I want proses pencatatan aset baru melalui alur draft-submit-approval seperti dokumen transaksional lain, so that setiap aset baru tervalidasi sebelum aktif digunakan.

#### Acceptance Criteria

1. THE `Asset` SHALL menggunakan trait `App\Traits\Submitable` secara penuh, termasuk field `status` yang di-cast sebagai array `FormStatus` melalui `FormStatusesCast`.
2. THE system SHALL menambahkan value baru berikut ke enum `App\Enums\FormStatus` sebelum implementasi Asset dimulai: `SCRAPPED`, `SOLD`, `OUT_OF_ORDER`, `IN_MAINTENANCE`, `ISSUED`, `PARTIALLY_DEPRECIATED`, `FULLY_DEPRECIATED`, `CAPITALIZED`, `WORK_IN_PROGRESS`.
3. THE `Asset` SHALL menyediakan service kelas (`AssetService`) yang mengimplementasikan `App\Contracts\SubmitableService`, sehingga `checkApproval()` dari `Submitable` dapat dipanggil saat submit.
4. WHEN Asset di-submit, THE system SHALL menjalankan alur approval melalui `ApprovalService` sebelum status Asset menjadi efektif, mengikuti pola yang sama dengan `SalesOrder`/`PurchaseOrder`.
5. [REVISI] THE `Asset` SHALL TIDAK mendukung aksi cancel maupun delete, konsisten dengan siklus hidup Asset di ERPNext (aset fisik tidak dibatalkan seperti dokumen transaksional biasa — begitu submitted, satu-satunya jalan keluar adalah lewat status operasional eksplisit seperti scrap/sell, bukan pembatalan dokumen). `AssetService::cancel()` SHALL melempar exception, dan `Asset::canCancel()`/`canDelete()` SHALL selalu mengembalikan `false` sebagai guard tambahan di level Controller generik. (Kriteria asli meminta cancel men-soft-delete GL/StockLedger otomatis — direvisi total setelah dikonfirmasi bahwa Asset tidak boleh di-cancel sama sekali, bukan hanya soal mekanisme cancel-nya.)
6. THE `Asset` SHALL mendukung `amend()` bawaan `Submitable` untuk merevisi data Asset, mengikuti pola `amended_from_id` dan `revision_number` yang sama dengan dokumen submitable lain.

### Requirement 9: Model Asset — status operasional berbasis aksi (di luar Submitable)

**User Story:** As staf aset, I want mengubah status operasional sebuah aset (rusak, dipinjamkan, dihapuskan, dijual) melalui aksi eksplisit, so that transisi status aset selalu tervalidasi dan tercatat.

#### Acceptance Criteria

1. THE `Asset` SHALL menyediakan method `scrap()`, `sell()`, `setInMaintenance()`, `setOutOfOrder()`, dan `reactivate()` yang menangani transisi status bisnis Asset SETELAH Asset berstatus aktif (di luar cakupan siklus hidup dokumen `Submitable`).
2. WHEN method transisi status dipanggil pada status Asset asal yang tidak valid untuk transisi tersebut (mis. `scrap()` dipanggil pada Asset berstatus `Draft`), THE system SHALL menolak dan melempar exception yang menjelaskan status asal dan status tujuan yang tidak valid.
3. THE `Asset` SHALL memiliki field `maintenance_required` (boolean, default `false`) sebagai penanda independen dari status `In Maintenance` (menandakan "aset ini perlu dijadwalkan maintenance", bukan status aktual sedang diservis).
4. THE `Asset` SHALL memiliki field `journal_entry_for_scrap_id` (FK, nullable) yang disiapkan untuk diisi otomatis oleh Fase 3 saat method `scrap()` dipanggil.
5. THE system SHALL TIDAK mengimplementasikan logic bisnis penuh method `sell()` (pembuatan Sales Invoice otomatis dan kalkulasi gain/loss on disposal) pada fase ini — method disiapkan sebagai kontrak/placeholder untuk Fase 4.

### Requirement 10: Konvensi struktur dan konsistensi kode

**User Story:** As seorang developer, I want modul Asset mengikuti struktur folder dan konvensi model yang sudah ada di codebase, so that modul baru mudah dipahami dan dipelihara bersama modul lain.

#### Acceptance Criteria

1. THE system SHALL menempatkan model baru pada `app/Models/Asset/{Asset,AssetCategory,AssetLocation}.php`, mengikuti struktur flat per-model (bukan nested Feature) karena setiap model hanya membutuhkan satu file per layer pada fase ini.
2. THE system SHALL menempatkan Controller baru pada `app/Http/Controllers/Asset/{Asset,AssetCategory,AssetLocation}Controller.php` dan mendaftarkannya di `routes/web.php` mengikuti pola modul `Inventory`.
3. THE `Asset`, `AssetCategory`, dan `AssetLocation` SHALL menggunakan trait `DataTable`, `HasUlids`, dan `SoftDeletes`, konsisten dengan model lain seperti `Category` dan `Item`.
4. THE system SHALL TIDAK membuat model baru untuk audit log Asset — aktivitas Asset SHALL tercatat melalui model `Log` generik (`App\Models\Core\Log`) yang sudah dipakai lintas modul.
5. THE system SHALL menambahkan dokumentasi modul baru pada `docs/modules/asset.md`.

### Requirement 11: File terjemahan (lang) untuk Asset, Asset Category, dan Asset Location

**User Story:** As a pengguna aplikasi, I want antarmuka modul Asset tersedia dalam bahasa Indonesia dan Inggris, so that saya dapat menggunakan modul ini seperti modul lain di aplikasi.

#### Acceptance Criteria

1. THE system SHALL menyediakan file `lang/id/asset/category.php`, `lang/id/asset/location.php`, dan `lang/id/asset/asset.php`, masing-masing dengan padanan di `lang/en/asset/`.
2. EACH file lang SHALL mengikuti struktur kunci yang sama dengan modul `Inventory` yang sudah ada (`title`, `add`, `new`, `delete`, `delete.description`, `delete.confirm`, `cancel`, `columns.*`), sebagaimana dicontohkan `lang/id/inventory/category.php` dan `lang/id/inventory/warehouse.php`.
3. THE `columns` key pada `lang/*/asset/asset.php` SHALL mencakup label untuk seluruh field yang ditampilkan di form dan `configColumns` Requirement 1-9 (identitas, ownership, pembelian, depresiasi, asuransi, status) — SATU key per field, TIDAK digabung menjadi label generik.
4. THE `lang/*/asset/category.php` SHALL menyediakan key `columns.is_rentable` dan `columns.non_depreciable_category` dengan penjelasan singkat yang dapat dipahami pengguna non-teknis.
5. THE system SHALL menambahkan key `ownership_field_must_be_empty` dan `rentable_must_be_single_unit` ke `lang/*/asset/asset.php`, diakses backend sebagai `__('asset/asset.ownership_field_must_be_empty')` (format `{folder}/{file}.{key}`, BUKAN `{folder}.{file}.{key}` — dipakai oleh pesan validasi `AssetRequest` dan `Asset::assertStatusTransition()`, dideklarasikan namun belum diterjemahkan pada Fase 1 backend, sempat salah format saat pertama ditulis).
6. THE system SHALL menambahkan terjemahan untuk sembilan value `FormStatus` baru (`SCRAPPED`, `SOLD`, `OUT_OF_ORDER`, `IN_MAINTENANCE`, `ISSUED`, `PARTIALLY_DEPRECIATED`, `FULLY_DEPRECIATED`, `CAPITALIZED`, `WORK_IN_PROGRESS`) pada file lang status generik yang sudah ada (pola `status.{value}` dipakai `FormStatus::label()`), BUKAN file baru khusus Asset.

### Requirement 12: Halaman Inertia untuk Asset Category dan Asset Location

**User Story:** As administrator aset, I want mengelola Asset Category dan Asset Location melalui antarmuka web, so that saya tidak perlu berinteraksi langsung dengan API atau database.

#### Acceptance Criteria

1. THE system SHALL menyediakan `resources/js/Pages/Asset/Categories/{Index,Form}.jsx` dan `resources/js/Pages/Asset/Locations/{Index,Form}.jsx`, mengikuti pola struktur dan komponen (`DataTable2`, `FormPageContent`, `useFormPage`, `FormInput`) yang sama dengan `resources/js/Pages/Inventory/Categories/` dan `resources/js/Pages/Inventory/Warehouses/`.
2. THE `Asset/Categories/Form.jsx` SHALL menyediakan input untuk `category_name`, `is_rentable`, `non_depreciable_category`, dan `enable_cwip_accounting` (Requirement 1). Input untuk `accounts` (child table `AssetCategoryAccount`) dan `finance_books`/default depresiasi SHALL ditunda ke Fase 3 (Depreciation), TANPA membuat placeholder kosong yang membingungkan pengguna pada fase ini.
3. THE `Asset/Locations/Form.jsx` SHALL menyediakan input untuk `location_name`, `parent_id` (pemilihan lokasi induk untuk hierarki pohon), `is_group`, dan `branch_id`, mengikuti pola `LinkModel` yang sama dengan `WarehouseLinkModel.jsx` untuk field relasi.
4. THE system SHALL menyediakan `resources/js/Pages/Asset/Categories/AssetCategoryLinkModel.jsx` dan `resources/js/Pages/Asset/Locations/AssetLocationLinkModel.jsx`, mengikuti pola `WarehouseLinkModel.jsx`, agar `AssetCategory`/`AssetLocation` dapat dipilih sebagai relasi dari form Asset (Requirement 13) dan form lain di fase mendatang.

### Requirement 13: Halaman Inertia untuk Asset

**User Story:** As staf aset, I want mencatat dan melihat data aset melalui antarmuka web, so that pekerjaan pencatatan aset tidak bergantung pada akses langsung ke database.

#### Acceptance Criteria

1. THE system SHALL menyediakan `resources/js/Pages/Asset/Assets/{Index,Form}.jsx`, mengikuti pola struktur yang sama dengan modul lain.
2. THE `Asset/Assets/Form.jsx` SHALL menampilkan field Requirement 3-9 (identitas, ownership, pembelian, depresiasi, asuransi) dikelompokkan menjadi bagian-bagian yang jelas (mis. menggunakan `Tabs` atau `Section`, konsisten pola form kompleks lain di codebase seperti `resources/js/Pages/Finances/Accounts/Form.jsx`), BUKAN daftar field datar tunggal.
3. THE `Asset/Assets/Form.jsx` SHALL menggunakan `AssetCategoryLinkModel` dan `AssetLocationLinkModel` (Requirement 12.4) untuk field `asset_category_id` dan `asset_location_id`.
4. THE `Asset/Assets/Form.jsx` SHALL menampilkan input kondisional untuk field ownership (`ownership_company_id`/`ownership_supplier_id`/`ownership_customer_id`) berdasarkan `ownership_type` yang dipilih, mengikuti pola `depends_on` ERPNext yang sudah diverifikasi pada riset sebelumnya — HANYA satu field ownership yang ditampilkan sesuai `ownership_type` aktif.
5. THE `Asset/Assets/Index.jsx` SHALL menampilkan `status` Asset menggunakan label terjemahan (Requirement 11.6), BUKAN value mentah enum.
6. THE system SHALL TIDAK menampilkan tombol atau UI untuk aksi `sell()` pada fase ini (Requirement 9.5 — method masih placeholder), TETAPI SHALL menampilkan tombol untuk `submit()`, `scrap()`, `setInMaintenance()`, `setOutOfOrder()`, dan `reactivate()` sesuai status Asset saat ini.
