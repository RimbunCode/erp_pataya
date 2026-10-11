# Requirements Document

## Introduction

Requirements ini diturunkan dari [design.md](design.md) (alur `design-first`). Ownership `Asset` kini memakai tiga kolom FK terpisah (`ownership_company_id`, `ownership_supplier_id`, `ownership_customer_id`) plus dispatch manual `ownershipEntity()`. Spec ini mengubahnya menjadi satu relasi morph (`ownership_type` + `ownership_id`), menghapus `ownership_company_id` (sistem tidak multi-company), dan membuat grup berdasarkan ownership menampilkan langsung nama pemilik: nama Customer/Supplier untuk pemilik eksternal, dan nama perusahaan (Preference `company_name`) untuk Asset milik perusahaan, grup perusahaan di urutan teratas.

Ketergantungan: mesin grup `datatable2-group-tree` dan gerbang kolom aman `linkmodel-grouping-search` (`LinkModelGroupGate`).

## Glossary

- **Ownership**: pemilik Asset: `company` (perusahaan sendiri), `supplier`, atau `customer`.
- **Relasi morph khusus Asset**: relasi `Asset::ownership()` (subclass `MorphTo`) yang menerjemahkan `ownership_type` ke model lewat peta lokal, tanpa `morphMap` global.
- **Grup ownership**: level grup `ownership` yang kuncinya `ownership_id`.
- **Grup company**: grup dengan `ownership_id` NULL (`ownership_type = 'company'`).
- **`groupMorph`**: flag opt-in per kolom relasi morph yang mengizinkan `GroupColumnGate` memakainya sebagai level grup.

## Requirements

### Requirement 1: Skema ownership morph dan migrasi data

**User Story:** As pengembang, I want ownership disimpan dalam satu pasangan kolom morph, so that Supplier dan Customer tidak tersebar di kolom berbeda dan kolom company yang tak berguna hilang.

#### Acceptance Criteria

1. THE migration baru SHALL menambah kolom `ownership_id` (`ulid`, nullable, index) pada tabel `assets`.
2. THE migration SHALL mengonversi data: `ownership_type = 'supplier'` → `ownership_id = ownership_supplier_id`; `'customer'` → `ownership_id = ownership_customer_id`; `'company'` → `ownership_id = NULL`; `ownership_type` SHALL tidak berubah nilainya.
3. THE migration SHALL menghapus `ownership_company_id`, `ownership_supplier_id`, dan `ownership_customer_id` setelah konversi.
4. THE `down()` SHALL memulihkan ketiga kolom dan menyalin balik `ownership_id` ke kolom sesuai `ownership_type`; `ownership_company_id` dibiarkan NULL (didokumentasikan lossy).
5. THE konversi SHALL berjalan dalam transaksi dan memproses data set-based (satu UPDATE per jenis pemilik), bukan per chunk.
6. IF ada baris dengan `ownership_type` di luar `company|supplier|customer`, THEN THE migration SHALL berhenti dengan pesan yang menyebut baris bermasalah tanpa mengubah data.
7. THE kolom `ownership_customer_branch_id` SHALL tetap ada.

### Requirement 2: Relasi morph `ownership` pada `Asset`

**User Story:** As pengembang, I want relasi tunggal `ownership`, so that kode tidak perlu dispatch manual per tipe.

#### Acceptance Criteria

1. THE `Asset::ownership()` SHALL mengembalikan relasi morph yang me-resolve Supplier untuk `ownership_type = 'supplier'` dan Customer untuk `'customer'`, termasuk saat eager-load banyak baris bertipe campuran.
2. FOR `ownership_type = 'company'` atau `ownership_id` NULL, THE relasi SHALL menghasilkan `null` tanpa error dan tanpa query ke tabel lain.
3. THE aplikasi SHALL TIDAK mendaftarkan `morphMap` global untuk Supplier/Customer; morph lain SHALL tidak berubah perilakunya.
4. THE `ownership_type` SHALL tetap di-cast ke enum `AssetOwnershipType` (`company|supplier|customer`).
5. THE `ownershipEntity()`, `ownershipSupplier()`, dan `ownershipCustomer()` SHALL dihapus; seluruh pemakai SHALL dialihkan ke `ownership`.
6. THE `loadRelationsOnShow` SHALL memuat `ownership` menggantikan `ownershipSupplier`/`ownershipCustomer`.
7. THE accessor `ownershipName` SHALL mengembalikan nama pemilik; untuk `company` SHALL mengembalikan nilai Preference `company_name`.

### Requirement 3: Branch customer

**User Story:** As user, I want cabang customer hanya relevan untuk pemilik Customer, so that data tidak inkonsisten.

#### Acceptance Criteria

1. THE `AssetRequest` SHALL menolak `ownership_customer_branch_id` terisi bila `ownership_type` bukan `customer`.
2. WHEN `ownership_type` Asset berubah dari `customer` ke tipe lain, THE model SHALL mengosongkan `ownership_customer_branch_id` saat disimpan.
3. THE relasi `ownershipCustomerBranch()` SHALL tetap tersedia.

### Requirement 4: Validasi request dan service

**User Story:** As user API/form, I want validasi ownership yang jelas, so that data pemilik selalu konsisten.

#### Acceptance Criteria

1. THE `AssetRequest` SHALL menerima `ownership_type` (`in:company,supplier,customer`) dan `ownership` (objek LinkModel atau null), menggantikan `ownership_company_id`, `ownership_supplier_id`, `ownership_customer_id`.
2. WHEN `ownership_type` adalah `supplier` atau `customer`, THE request SHALL mewajibkan `ownership` dan SHALL menolak (422) bila model objek tidak sesuai tipe (Supplier untuk supplier, Customer untuk customer).
3. WHEN `ownership_type` adalah `company`, THE request SHALL menolak `ownership` yang terisi.
4. THE `prepareForValidation` SHALL memetakan objek `ownership` menjadi `ownership_id`.
5. THE `AssetService` SHALL memakai `ownership_type` dan `ownership_id` pada daftar field dan snapshot menggantikan tiga kolom lama.
6. THE `validateOwnershipExclusivity()` SHALL dihapus dan digantikan aturan Requirement 4.2–4.3.

### Requirement 5: Konsumen SalesOrder

**User Story:** As user sales, I want customer billing dari Asset tetap ter-resolve, so that fitur Service/Billing Asset tidak rusak.

#### Acceptance Criteria

1. THE `SalesOrderController` SHALL memuat `asset.ownership` (bukan `asset.ownershipCustomer`) dan mem-resolve customer billing hanya bila `ownership_type` Asset adalah `customer`.
2. THE hasil resolve customer dan cabangnya SHALL identik dengan sebelum perubahan untuk Asset ber-ownership customer.
3. THE `Asset::configColumns` SHALL mengekspos relasi `ownership` (hidden) untuk kebutuhan `with` LinkModel, menggantikan `ownershipCustomer`.

### Requirement 6: Form Asset

**User Story:** As user, I want satu isian pemilik, so that form lebih sederhana.

#### Acceptance Criteria

1. THE `Form.jsx` SHALL menampilkan `ownership_type` (select) dan satu `LinkModel` pemilik yang modelnya mengikuti tipe (Supplier/Customer).
2. WHEN `ownership_type` adalah `company`, THE form SHALL tidak menampilkan pemilih dan SHALL menampilkan nama perusahaan read-only.
3. WHEN user mengganti tipe, THE nilai `ownership` SHALL dikosongkan.
4. THE form SHALL mengirim `ownership_type` dan `ownership` (objek) menggantikan `ownership_supplier`/`ownership_customer`.
5. THE field `ownership_customer_branch_id` SHALL tampil hanya untuk tipe customer.

### Requirement 7: Gerbang grup morph (`groupMorph`)

**User Story:** As pengembang, I want mengizinkan relasi morph tertentu sebagai level grup, so that ownership dapat dikelompokkan.

#### Acceptance Criteria

1. THE `GroupColumnGate` SHALL menerima kolom relasi `MorphTo` sebagai level grup HANYA bila config kolom memuat `groupMorph: true`, dengan kolom SQL grup = `{nama}_id`.
2. THE kolom morph TANPA `groupMorph` SHALL tetap ditolak (perilaku lama tidak berubah).
3. THE `ResolvedGroupLevel` untuk kolom morph SHALL diperlakukan sebagai level relasi (label dari baris sampel).
4. THE `LinkModelGroupGate` SHALL meloloskan level morph yang sudah lolos Requirement 7.1 tanpa syarat `linkable` (sama relasi lain).

### Requirement 8: Label dan urutan grup ownership

**User Story:** As user, I want grup ownership menampilkan nama pemilik langsung, so that saya tak perlu menebak dari jenis kepemilikan.

#### Acceptance Criteria

1. THE deskriptor grup level `ownership` SHALL membawa `label` berupa objek pemilik (Customer/Supplier) dari baris sampel via relasi `ownership`, disaring kolom aman model targetnya.
2. THE grup NULL (company) SHALL membawa `label = {name: <Preference company_name>, templateLink: ':name'}` melalui config kolom `groupNullLabel`.
3. THE grup company SHALL berada di urutan pertama pada `groupSort = asc` tanpa kode urutan tambahan.
4. IF Preference `company_name` kosong, THEN THE label SHALL memakai teks `core.datatable.no_group_value`.
5. THE pemilik yang soft-delete SHALL tetap berlabel (relasi dimuat `withTrashed`).
6. THE kolom tanpa `groupNullLabel` SHALL berperilaku seperti sebelumnya.

### Requirement 9: Grup bawaan Asset

**User Story:** As user, I want index Asset dan dropdown terkelompok sesuai ownership, so that pencarian cepat.

#### Acceptance Criteria

1. THE model `Asset` SHALL mendeklarasikan `$defaultGroups = ['ownership', 'asset_type']` dan kolom `ownership` (`groupable`, `groupMorph`, `groupNullLabel`).
2. THE `AssetLinkModel` SHALL memakai `group={["ownership"]}` (menimpa default model).
3. THE kolom `ownership_type` SHALL tetap `groupable` untuk grup kasar manual.
4. THE `ownership_type`/`asset_type` SHALL tetap `linkable` dan ber-`valueTrans`.

### Requirement 10: Lang, factory, seeder, tes lama

**User Story:** As pengembang, I want seluruh artefak pendukung konsisten, so that tidak ada referensi ke kolom yang dihapus.

#### Acceptance Criteria

1. THE lang id/en SHALL menghapus `ownership_company_id|supplier_id|customer_id`, menambah `ownership` dan pesan validasi baru; `LocaleKeysTest` SHALL lulus.
2. THE `AssetFactory` dan seeder SHALL memakai `ownership_type`/`ownership_id`.
3. THE tes lama (`AssetControllerTest`, `AssetTest`, `AssetOwnershipCustomerResolutionTest`, `AssetServiceLinkModelSearchTest`) SHALL diperbarui ke skema baru tanpa menghapus tes.
4. THE tidak ada kode, tes, atau lang SHALL tersisa yang merujuk ketiga kolom lama.

### Requirement 11: Pengujian dan verifikasi

**User Story:** As pengembang, I want cakupan tes dan verifikasi browser, so that regresi tertangkap.

#### Acceptance Criteria

1. THE test SHALL mencakup: konversi migrasi tiga tipe + `down()` + baris tak dikenal; relasi `ownership` (supplier/customer/company, eager-load campuran); auto-clear branch; eksklusivitas request; SalesOrder billing; `groupMorph` (diterima/ditolak); label grup dan urutan company pertama; lookup `model` (`LinkModelGroupGate`) menyaring label morph; `AllModelsGroupableConfigTest`.
2. THE test FE SHALL mencakup `Form.jsx` (ganti tipe, payload `ownership`) dan `AssetLinkModel`.
3. THE verifikasi browser (`npm run build`) SHALL memeriksa dropdown Asset (grup nama pemilik, company di atas), index Asset (`ownership > asset_type`), dan form Asset.
4. THE full suite BE dan FE SHALL dijalankan; Pint/ESLint sekali di akhir.

## Keputusan (dikonfirmasi user)

1. Refactor penuh lewat spec; migration baru + konversi data.
2. Company tetap string `'company'`; nama perusahaan dari Preference `company_name`.
3. `ownership_customer_branch_id` dirapikan: validasi hanya untuk customer + auto-clear.
4. `AssetLinkModel`: `["ownership"]`; index Asset: `[ownership, asset_type]`.
5. Tanpa `morphMap` global (rekomendasi diikuti; konfirmasi akhir user masih terbuka).
