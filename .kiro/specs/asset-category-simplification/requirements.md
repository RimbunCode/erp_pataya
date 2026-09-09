# Requirements Document

## Introduction

Ditemukan saat mengerjakan spec `asset-management-purchase-integration-v2`: ada 2 validasi redundan dengan field berbeda untuk semangat yang sama — `AssetRequest::validateRentableQuantity()` mengecek `AssetCategory.is_rentable`, sedangkan `Asset::booted()` (saving hook, sumber kebenaran nyata) mengecek `AssetCategory.allow_bulk_quantity`. User bisa lolos satu validasi tapi ditolak validasi lain dengan pesan error yang identik — membingungkan.

Solusi yang diputuskan: pindahkan `is_rentable` dan `allow_bulk_quantity` dari `AssetCategory` (per-kategori) ke `Asset` (per-unit fisik). Alasan: satu kategori (mis. "Kendaraan") bisa berisi sebagian unit yang disewakan dan sebagian tidak — field ini secara semantik adalah properti unit, bukan kategori. `AssetCategory` setelah ini murni untuk pengkategorian: `category_name`, `non_depreciable_category`, `enable_cwip_accounting` (dan setting default depresiasi) — TIDAK disentuh, tetap per-kategori karena wajar semua unit dalam satu kategori sama-sama (non-)depreciable.

**Temuan penting yang memperluas scope**: `AssetCategory.is_rentable` (via `$asset->assetCategory?->is_rentable`) ternyata bukan cuma dipakai untuk validasi quantity di form Asset — ia adalah **gatekeeper workflow rental**, dipakai di spec `asset-rental-migration` (sudah selesai, live):
- `DeliveryNoteRequest.php` — validasi baris rental sebelum submit: baris `asset_lines` ditolak kalau `Asset` yang dipilih kategorinya tidak `is_rentable`.
- `DeliveryNoteService.php` — enforcement ulang saat approve, sebelum benar-benar memproses rental (defense-in-depth, tidak cuma percaya validasi request).

Kedua titik ini **wajib** diupdate jadi baca `$asset->is_rentable` langsung — bukan opsional, karena begitu kolom `is_rentable` dihapus dari `asset_categories`, kode lama akan error (relasi/kolom tidak ada). Perubahan ini juga memperbaiki cacat desain di rental workflow: sebelumnya SEMUA unit dalam kategori rentable otomatis dianggap boleh disewakan, padahal seharusnya per-unit.

**Di luar scope**: `non_depreciable_category`, `enable_cwip_accounting`, dan seluruh default setting depresiasi tetap di `AssetCategory`, tidak disentuh. Modul lain yang TIDAK ditemukan memakai `is_rentable`/`allow_bulk_quantity` (di luar 4 titik: `Asset.php`, `AssetRequest.php`, `DeliveryNoteRequest.php`, `DeliveryNoteService.php`) dianggap tidak ada — perlu audit ulang di tahap design untuk memastikan tidak ada titik lain yang terlewat.

## Glossary

- **Per-kategori (lama)**: `is_rentable`/`allow_bulk_quantity` disimpan di `AssetCategory`, berlaku untuk SEMUA unit `Asset` dalam kategori itu.
- **Per-unit (baru)**: `is_rentable`/`allow_bulk_quantity` disimpan di `Asset`, berlaku untuk unit itu sendiri saja.
- **Gatekeeper rental**: pemeriksaan `is_rentable` yang menentukan boleh-tidaknya sebuah `Asset` masuk alur `DeliveryNote` bertipe rental (`SalesOrder.is_rent`).

## Requirements

### Requirement 1: Migrasi skema — kolom pindah dari `asset_categories` ke `assets`

**User Story:** As pengembang, I want `is_rentable`/`allow_bulk_quantity` tersimpan di level `Asset`, so that satu kategori bisa berisi campuran unit rentable dan non-rentable.

#### Acceptance Criteria

1. THE migration SHALL menambahkan kolom `is_rentable` (boolean, default `false`) dan `allow_bulk_quantity` (boolean, default `false`) ke tabel `assets`.
2. THE migration data SHALL mengisi kedua kolom baru pada setiap `Asset` existing dengan nilai `is_rentable`/`allow_bulk_quantity` dari `AssetCategory` induknya saat ini (`$asset->asset_category_id`) — Asset tanpa kategori (`asset_category_id` null) mendapat nilai default `false`. Dijalankan inline di `up()` migration Laravel (UPDATE query langsung via query builder, satu kali jalan searah) — TIDAK lewat Artisan command terpisah, karena ini murni transformasi skema+data satu-arah yang wajar dibungkus di migration.
3. THE migration SHALL menghapus kolom `is_rentable` dan `allow_bulk_quantity` dari tabel `asset_categories` (migration terpisah, dijalankan SETELAH migration data Requirement 1.2 selesai — urutan penting, data harus ter-copy dulu sebelum sumbernya dihapus).

### Requirement 2: Validasi quantity>1 pakai `Asset.allow_bulk_quantity`

**User Story:** As pengembang, I want satu sumber kebenaran untuk validasi "quantity>1 hanya boleh kalau diizinkan", so that tidak ada lagi 2 validasi dengan field berbeda yang membingungkan.

#### Acceptance Criteria

1. THE `Asset::booted()` saving hook SHALL memvalidasi `$asset->allow_bulk_quantity` (bukan lagi query ke `AssetCategory`) sebagai guard terakhir sebelum mengizinkan `asset_quantity > 1`.
2. THE `AssetRequest::validateRentableQuantity()` SHALL TETAP ADA, tapi diubah membaca `allow_bulk_quantity` dari input `Asset` itu sendiri (bukan lagi query ke `AssetCategory`) — mempertahankan error 422 yang rapi di request-level, bukan bergantung sepenuhnya pada `LogicException` (HTTP 500) dari Model-level hook di Requirement 2.1.

### Requirement 3: Form `AssetCategory` — hapus 2 checkbox

**User Story:** As administrator aset, I want form Kategori Aset hanya berisi pengaturan yang benar-benar per-kategori, so that saya tidak bingung field mana yang berlaku per-unit vs per-kategori.

#### Acceptance Criteria

1. THE `resources/js/Pages/Asset/Categories/Form.jsx` SHALL menghapus checkbox `is_rentable` dan `allow_bulk_quantity`.
2. THE `AssetCategoryRequest::rules()` SHALL menghapus rule `is_rentable` dan `allow_bulk_quantity`.

### Requirement 4: Form `Asset` — tambah 2 checkbox baru

**User Story:** As administrator aset, I want mengatur is_rentable/allow_bulk_quantity langsung di form Asset, so that saya bisa membedakan unit yang disewakan dari unit lain dalam kategori yang sama.

#### Acceptance Criteria

1. THE `resources/js/Pages/Asset/Assets/Form.jsx` SHALL menambahkan checkbox `is_rentable` dan `allow_bulk_quantity`, default `false` untuk Asset baru.
2. THE `AssetRequest::rules()` SHALL menambahkan rule `is_rentable` dan `allow_bulk_quantity` (boolean).
3. Kedua checkbox ini SHALL independen dari `asset_category` — TIDAK memerlukan kategori dipilih dulu (berbeda dari desain lama yang built-in ke kategori).

### Requirement 5: Update gatekeeper rental (`DeliveryNote`)

**User Story:** As pengembang, I want validasi rental tetap berfungsi benar setelah field pindah, so that tidak ada regresi pada workflow rental yang sudah live.

#### Acceptance Criteria

1. THE `DeliveryNoteRequest.php` (baris ~103, validasi `asset_lines`) SHALL memeriksa `$asset->is_rentable` langsung, BUKAN `$asset->assetCategory?->is_rentable`.
2. THE `DeliveryNoteService.php` (baris ~431, enforcement saat approve) SHALL memeriksa `$asset->is_rentable` langsung dengan cara yang sama.
3. THE lang key `asset/asset.category_not_rentable` SHALL di-rename menjadi `asset/asset.asset_not_rentable` (di `lang/id/asset/asset.php` dan `lang/en/asset/asset.php`) dengan teks pesan disesuaikan agar merujuk ke Asset itu sendiri, bukan kategorinya — seluruh pemakai key lama (`DeliveryNoteRequest.php`, `DeliveryNoteService.php`) SHALL diupdate ke key baru.

### Requirement 6: Audit & update test existing

**User Story:** As pengembang, I want seluruh test yang bergantung pada `is_rentable`/`allow_bulk_quantity` di `AssetCategory` tetap valid, so that tidak ada regresi tak terdeteksi.

#### Acceptance Criteria

1. THE `AssetCategoryFactory` SHALL menghapus definisi `is_rentable`/`allow_bulk_quantity` dan state `rentable()`/`bulkQuantity()` terkait.
2. THE `AssetFactory` SHALL menambahkan default `is_rentable`/`allow_bulk_quantity` (`false`), dengan state baru (mis. `rentable()`, `bulkQuantity()`) setara yang dihapus dari `AssetCategoryFactory`.
3. Seluruh test existing (termasuk yang baru ditulis di `tests/Feature/Asset/AssetControllerTest.php` dari spec `asset-management-purchase-integration-v2`) yang memanggil `AssetCategory::factory()->create(['is_rentable' => ..., 'allow_bulk_quantity' => ...])` SHALL diaudit dan diupdate untuk set field itu di `Asset::factory()` sebagai gantinya.
4. Test terkait `DeliveryNoteRequest`/`DeliveryNoteService` yang menguji skenario rental SHALL diaudit — pastikan `Asset` test fixture mereka mengisi `is_rentable` langsung (bukan lewat `AssetCategory`).

## Keputusan (dikonfirmasi user)

1. **Requirement 2.2** — `validateRentableQuantity()` TETAP ADA di `AssetRequest`, baca `allow_bulk_quantity` dari `Asset` sendiri (422 rapi, bukan 500 dari `LogicException` model).
2. **Requirement 5.3** — lang key `category_not_rentable` DI-RENAME jadi `asset_not_rentable`, teks disesuaikan, semua pemakai key lama diupdate.
3. **Requirement 1.2** — migrasi data INLINE di `up()` migration Laravel, bukan Artisan command terpisah.

## Catatan untuk design phase

- Audit lanjutan: pastikan tidak ada titik BACA `AssetCategory.is_rentable`/`allow_bulk_quantity` lain di luar 4 file yang sudah ditemukan (mis. dashboard widget, report export, API resource) — grep awal sudah dilakukan tapi perlu dikonfirmasi lengkap saat implementasi.
