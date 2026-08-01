# Requirements Document

## Introduction

`Route::resourceDetail()` (routes/web.php) selalu mendaftarkan route `show` untuk setiap resource yang didaftarkan lewat macro tersebut, termasuk `generalLedgers.show` dan `stockLedgers.show`. Namun `GeneralLedgerController` dan `StockLedgerController` hanya mengimplementasikan `__construct()` dan `index()` — tidak ada method `show()`. Ini dua-duanya dari sekitar 40 controller di aplikasi yang didaftarkan lewat pola yang sama.

Akibatnya:
- **General Ledger**: kolom `code` di `GeneralLedger::$configColumns` diberi `isLink: true`, sehingga tabel index (`Table2.jsx`) otomatis merender link ke route `generalLedgers.show`. Klik baris General Ledger dari halaman index memicu `Error: Call to undefined method App\Http\Controllers\Finances\GeneralLedgerController::show()` — fatal error, bukan 404.
- **Stock Ledger**: kolom utama tidak `isLink: true`, sehingga index tidak otomatis crash, tapi halaman detail (`stockLedgers.show`) tetap sama sekali tidak ada — link mana pun yang mengarah ke sana (mis. panel Connections via `ModelConnection::search`, breadcrumb via `templateLink()`) akan memicu error yang sama. Secara praktis, user tidak punya cara melihat detail satu baris Stock Ledger.

Kedua model (`GeneralLedger`, `StockLedgerEntry`) sudah siap dipakai untuk halaman detail: keduanya sudah mendefinisikan `loadRelationsOnShow()` dengan daftar relasi yang lengkap, relasi Eloquent-nya sudah ada, dan keduanya `canDelete() === false` (read-only ledger entry, tidak pernah diedit/dihapus lewat UI — hanya dibuat otomatis oleh sistem sebagai jejak transaksi).

Spec ini menambahkan method `show()` pada kedua controller mengikuti pola yang sudah dipakai controller lain (`AccountController::show()`, `StockEntryController::show()`), dan membuat halaman frontend detail baru untuk masing-masing. Karena kedua model read-only (tidak ada create/edit/delete dari UI), halaman detail yang dibuat adalah tampilan baca-saja, bukan form yang bisa disunting — berbeda dari pola `Show.jsx` yang sudah ada di modul lain (Account, PaymentEntry, dll.) yang semuanya form editable.

## Glossary

- **General Ledger (Buku Besar)**: model `App\Models\Finances\GeneralLedger`, baris jurnal akuntansi (debit/credit) yang dibuat otomatis oleh sistem sebagai efek dari transaksi lain (invoice, payment, dll).
- **Stock Ledger Entry (Kartu Stok)**: model `App\Models\Inventory\StockLedgerEntry`, baris mutasi stok (quantity, valuation) yang dibuat otomatis oleh sistem sebagai efek dari transaksi inventori (stock entry, delivery note, dll).
- **`resourceDetail` macro**: helper route di `routes/web.php` yang mendaftarkan sekumpulan route standar (index, create, store, show, update, destroy, comments, tags, files, assignees) untuk satu resource sekaligus.
- **`showDetail()`**: method dari trait `DataTable` yang dipanggil di awal method `show()` controller lain — menyiapkan state model untuk ditampilkan (mis. permission check level `read`).
- **`loadRelations()`**: method dari trait `DataTable` yang me-load semua relasi hasil `loadRelationsOnShow()` ke instance model sebelum dikirim ke frontend.

## Requirements

### Requirement 1: General Ledger — method `show()` pada controller

**User Story:** As a pengguna dengan akses modul Finances, I want membuka detail satu baris General Ledger dari halaman index, so that saya bisa melihat rincian jurnal (akun, akun lawan, debit, credit, cabang) tanpa aplikasi crash.

#### Acceptance Criteria

1. THE `GeneralLedgerController` SHALL memiliki method `show(GeneralLedger $generalLedger)`.
2. WHEN route `GET /generalLedgers/{generalLedger}` diakses oleh user dengan permission `read` pada model `GeneralLedger`, THE `GeneralLedgerController::show()` SHALL memanggil `$generalLedger->showDetail()` lalu me-render `Inertia::render('Finances/GeneralLedgers/Show', [...])`.
3. THE response Inertia SHALL menyertakan prop `generalLedger` berisi model dengan seluruh relasi dari `GeneralLedger::loadRelationsOnShow()` (`account`, `againstAccount`, `branch`) sudah di-load.
4. WHEN user tanpa permission `read` pada model `GeneralLedger` mengakses `GET /generalLedgers/{generalLedger}`, THE sistem SHALL mengembalikan 403, bukan fatal error.
5. THE `GeneralLedgerController::show()` SHALL memanggil `$this->setBreadcrumbs($generalLedger)` mengikuti pola controller lain.

### Requirement 2: General Ledger — halaman frontend detail (read-only)

**User Story:** As a pengguna, I want melihat detail satu baris General Ledger dalam tampilan yang jelas, so that saya paham jurnal apa yang tercatat tanpa risiko tidak sengaja mengubah data.

#### Acceptance Criteria

1. THE frontend SHALL menyediakan halaman baru di `resources/js/Pages/Finances/GeneralLedgers/Show.jsx`.
2. THE halaman SHALL menampilkan field: `code`, `account`, `againstAccount`, `debit`, `credit`, `branch`, `created_at` dalam mode baca-saja (tanpa input yang bisa diedit, tanpa tombol submit/save).
3. THE halaman SHALL TIDAK menampilkan tombol delete atau edit, konsisten dengan `GeneralLedger::canDelete()` yang mengembalikan `false`.
4. WHEN halaman dibuka lewat klik baris dari index (`isLink: true` pada kolom `code`), THE navigasi SHALL berhasil menampilkan halaman detail tanpa error di console maupun di layar.

### Requirement 3: Stock Ledger — method `show()` pada controller

**User Story:** As a pengguna dengan akses modul Inventory, I want membuka detail satu baris Stock Ledger, so that saya bisa melihat rincian mutasi stok (item, quantity, valuation, referenceable) untuk keperluan audit/tracing.

#### Acceptance Criteria

1. THE `StockLedgerController` SHALL memiliki method `show(StockLedgerEntry $stockLedger)`.
2. WHEN route `GET /stockLedgers/{stockLedger}` diakses oleh user dengan permission `read` pada model `StockLedgerEntry`, THE `StockLedgerController::show()` SHALL memanggil `$stockLedger->showDetail()` lalu me-render `Inertia::render('Inventory/StockLedgers/Show', [...])`.
3. THE response Inertia SHALL menyertakan prop `stockLedger` berisi model dengan seluruh relasi dari `StockLedgerEntry::loadRelationsOnShow()` (`item`, `unit`, `warehouse`, `referenceable`) sudah di-load.
4. WHEN user tanpa permission `read` pada model `StockLedgerEntry` mengakses `GET /stockLedgers/{stockLedger}`, THE sistem SHALL mengembalikan 403, bukan fatal error.
5. THE `StockLedgerController::show()` SHALL memanggil `$this->setBreadcrumbs($stockLedger)` mengikuti pola controller lain.

### Requirement 4: Stock Ledger — halaman frontend detail (read-only)

**User Story:** As a pengguna, I want melihat detail satu baris Stock Ledger dalam tampilan yang jelas, so that saya paham mutasi stok apa yang tercatat dan dari transaksi mana asalnya.

#### Acceptance Criteria

1. THE frontend SHALL menyediakan halaman baru di `resources/js/Pages/Inventory/StockLedgers/Show.jsx`.
2. THE halaman SHALL menampilkan field: `code`, `item`, `unit`, `warehouse`, `quantity_change`, `quantity_after_transaction`, `valuation_rate`, `balance_stock_value`, `change_in_stock_value`, `referenceable` dalam mode baca-saja (tanpa input yang bisa diedit, tanpa tombol submit/save).
3. THE halaman SHALL TIDAK menampilkan tombol delete atau edit, konsisten dengan `StockLedgerEntry::canDelete()` yang mengembalikan `false`.
4. WHEN kolom `referenceable` merujuk ke dokumen sumber yang sudah dihapus permanen, THE halaman SHALL menampilkan fallback yang wajar (bukan error/crash).

### Requirement 5: Tidak ada perubahan di luar scope

**User Story:** As a maintainer, I want perbaikan ini terbatas pada penambahan `show()` dan halaman detail, so that tidak ada efek samping ke fitur index/create/update/delete yang sudah berjalan.

#### Acceptance Criteria

1. THE perubahan SHALL TIDAK mengubah `GeneralLedgerController::index()` maupun `StockLedgerController::index()` yang sudah berfungsi.
2. THE perubahan SHALL TIDAK menambah route baru di luar `show` (tidak ada create/store/update/destroy baru untuk kedua resource ini) — route-route tersebut sudah terdaftar via `resourceDetail` macro tapi handler-nya boleh tetap kosong/tidak diimplementasikan karena kedua model bersifat read-only.
3. THE perubahan SHALL TIDAK mengubah `$configColumns`, relasi, atau `loadRelationsOnShow()` pada `GeneralLedger` maupun `StockLedgerEntry` — struktur data yang sudah ada dipakai apa adanya.

## Out of Scope

- Tidak ada perubahan pada mekanisme pencatatan otomatis General Ledger / Stock Ledger Entry (proses yang membuat baris-baris ini tetap seperti sekarang).
- Tidak ada penambahan aksi create/edit/delete manual untuk kedua model lewat UI — keduanya tetap read-only.
- Tidak ada perbaikan terhadap controller lain yang mungkin punya pola serupa (spec ini spesifik untuk General Ledger dan Stock Ledger sesuai laporan bug).
