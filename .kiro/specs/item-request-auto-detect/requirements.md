# Requirements Document

## Introduction

Fitur **Item Request** mendeteksi otomatis kebutuhan Item yang tidak tersedia (shortage) di Stock namun dibutuhkan oleh dokumen transaksi — SalesOrder, InternalOrder, AssetService, dan dokumen lain yang mengkonsumsi Stock. User dapat memfilter deteksi ini per Warehouse/Branch dan per jenis dokumen sumber, memilih baris item mana yang ingin ditindaklanjuti, lalu membuat Purchase Request atau Purchase Order dengan data (item, quantity, itemUnit) sudah terisi otomatis. Setelah PR/PO dibuat, quantity yang sudah "di-cover" hilang dari daftar Item Request meski status PR/PO belum selesai.

**Module & Desk placement** (berdasar riset pola existing di codebase — lihat `docs/modules/purchase.md` dan `database/seeders/DeskSeeder.php`):
- Model utama di `Domain::Purchase` (`app/Models/Purchase/`), karena output fitur ini (PurchaseRequest/PurchaseOrder) sudah punya home di situ.
- Menu tampil di 5 Desk sekaligus — Purchase, Inventory, Sales, Service, Asset — via pola `desks()` multi-assign yang sudah ada (contoh: `Item` → `[Inventory, Sales, Purchase]`, `Asset` → `[Asset, Service]`), bukan domain/module baru.

## Glossary

| Istilah | Definisi |
|---|---|
| Item Request | Baris kebutuhan item yang terdeteksi shortage, ditampilkan di halaman Item Request |
| Shortage | Selisih quantity dibutuhkan dokumen sumber vs quantity tersedia di Stock warehouse target |
| Source Document | Dokumen yang memicu kebutuhan: SalesOrderItem, InternalOrderItem, AssetServiceConsumedItem |
| Covered Quantity | Quantity dari suatu Item Request yang sudah dibuatkan PR/PO (terlepas dari status approval PR/PO tsb) |
| Desk | Pengelompokan menu per domain kerja (existing — `app/Models/Core/Desk.php`) |

## Requirements

### Requirement 1: Deteksi Otomatis Kebutuhan Item

**User Story:** As a Purchasing/Inventory Officer, I want sistem otomatis mendeteksi item yang shortage dari dokumen SO/IO/AssetService, so that saya tidak perlu mengecek manual satu per satu dokumen.

#### Acceptance Criteria

0. **[TEMUAN KRUSIAL — mengubah premis fitur]** `SalesOrderService`/`InternalOrderService` (method submit, sekitar baris 268-287 & 122-140) **memblokir keras** submit dengan `DB::rollBack()` + `ValidationException` kalau `Stock.ready_quantity < quantity` yang dibutuhkan baris manapun. Akibatnya: SalesOrder/InternalOrder yang kekurangan stock **tidak pernah mencapai status `submitted`** — dokumen itu tetap `draft` selamanya (gagal submit berkali-kali) sampai stock cukup. Kalau Requirement 1 ini hanya mendeteksi dokumen yang SUDAH `submitted` (seperti draft awal spec ini), fitur Item Request **tidak akan pernah punya data untuk dideteksi** — sirkular: SO butuh Item Request untuk dapat PR/PO penutup shortage, tapi SO itu sendiri tidak akan pernah "ada" (submitted) tanpa PR/PO itu duluan. **Kesimpulan:** THE System SHALL mendeteksi Item Request dari SalesOrderItem/InternalOrderItem milik dokumen berstatus **`draft`** (bukan `submitted`) — persis dokumen yang gagal/akan gagal submit karena shortage. Ini use-case UTAMA fitur: user bikin SO draft, coba submit, gagal karena kurang stock, buka Item Request, buatkan PR/PO, tunggu stock masuk, balik ke SO draft itu, submit ulang (kali ini lolos).
1. WHEN suatu SalesOrderItem/InternalOrderItem milik dokumen berstatus `draft` memiliki `quantity` melebihi `available_quantity` di `source_warehouse_id`-nya, THE System SHALL menampilkan baris tersebut di daftar Item Request.
2. THE System SHALL menghitung shortage sebagai `required_quantity - available_quantity`.
3. **[TERJAWAB DARI KODE — bukan lagi asumsi]** Formula `available_quantity` SHALL sama persis dengan kriteria yang dipakai validasi submit di atas: `Stock.ready_quantity` (`actual_quantity - reserved_quantity`, TIDAK menghitung `incoming_quantity`/PO yang belum diterima — lihat `database/migrations/2025_03_12_061639_create_stocks_table.php`). Sengaja BUKAN `projected_quantity` (yang menghitung incoming) — kalau pakai itu, Item Request bisa bilang "aman" padahal SO tetap gagal submit karena barang inbound belum diterima secara fisik.
4. **[REVISI FINAL — klarifikasi user]** `AssetServiceConsumedItem` TETAP jadi Source Document mandiri (bukan digantikan SO/IO) — alasan bisnis: Purchasing perlu tahu part apa yang dibutuhkan Work Order **sebelum** teknisi bisa mulai kerja, yaitu sebelum SalesOrderItem/InternalOrderItem billing dibuat (`docs/modules/service.md`: *"Tiap komponen/bahan Work Order punya progres bertahap: diminta → dipesan → diterima → siap dipakai"*). User menolak menambah kolom `warehouse_id` ke `AssetService`/`AssetServiceConsumedItem` (tidak boleh ubah struktur data AssetService). **Solusi tanpa kolom baru**: warehouse diturunkan lewat chain existing — `AssetService::resolvedAsset()` (accessor yang sudah menangani 2 jenis AssetService: `repair` langsung via `asset_id`, `maintenance_task` via chain `assetMaintenanceTask.assetMaintenance.asset`) → `Asset::branch()` (accessor delegasi ke `AssetLocation.branch_id` — Asset sendiri tidak punya kolom `branch_id`) → `Warehouse::where('branch_id', ...)` (Branch bisa punya banyak Warehouse). THE System SHALL menghitung `available_quantity` untuk baris AssetServiceConsumedItem sebagai **SUM stock item tsb di SEMUA Warehouse milik Branch hasil resolusi itu** (bukan 1 warehouse spesifik, karena memang tidak ada penanda warehouse tunggal).
5. **[REVISI FINAL — exclusion rule]** WHEN suatu SalesOrderItem atau InternalOrderItem memiliki `referenceable_type` bernilai `AssetService::class` ATAU `AssetServiceConsumedItem::class`, THE System SHALL mengecualikan baris tersebut dari deteksi Item Request (Requirement 1.1) — supaya kebutuhan yang sama tidak dihitung dua kali: sekali dari `AssetServiceConsumedItem` asli (Requirement 1.4), sekali lagi dari baris billing SO/IO yang mengacu baliknya.
6. Filter "Source Document Type: AssetService" pada Requirement 2.3 SHALL query langsung ke `AssetServiceConsumedItem` (bukan lewat SO/IO, sesuai poin 4-5 di atas).
7. THE System SHALL mengecualikan baris Source Document yang sudah fully covered (lihat Requirement 4) dari daftar.

### Requirement 2: Filtering

**User Story:** As a Purchasing Officer, I want memfilter daftar Item Request per Warehouse/Branch dan per jenis dokumen sumber, so that saya bisa fokus ke area kerja saya.

#### Acceptance Criteria

1. THE System SHALL menyediakan filter Warehouse (multi-select).
2. THE System SHALL menyediakan filter Branch.
3. THE System SHALL menyediakan filter Source Document Type (SalesOrder / InternalOrder / AssetService / ...).
4. WHEN filter diterapkan, THE System SHALL menampilkan hanya baris Item Request yang cocok dengan kombinasi filter tersebut.

### Requirement 3: Selection & Create PR/PO

**User Story:** As a Purchasing Officer, I want memilih beberapa baris Item Request lalu klik "Buat PR" atau "Buat PO", so that saya bisa langsung membuat dokumen procurement tanpa input ulang manual.

#### Acceptance Criteria

1. THE System SHALL menyediakan checkbox multi-select per baris Item Request.
2. WHEN user memilih minimal satu baris dan klik tombol **"Buat PR"**, THE System SHALL mengarahkan ke halaman create PurchaseRequest dengan baris item (item, quantity, itemUnit) sudah ter-prefill dari baris yang dipilih.
3. WHEN user memilih minimal satu baris dan klik tombol **"Buat PO"**, THE System SHALL mengarahkan ke halaman create PurchaseOrder dengan baris item (item, quantity, itemUnit) sudah ter-prefill dari baris yang dipilih.
4. Tombol "Buat PR" dan "Buat PO" SHALL tersedia terpisah dan independen — user memutuskan mana yang dipakai per situasi (bukan salah satu dipaksa oleh sistem).
5. **[TERJAWAB DARI SKEMA — bukan lagi TODO]** Baris terpilih dari >1 Warehouse/Branch berbeda SHALL tetap boleh digabung jadi satu PR/PO — TIDAK perlu split paksa. `PurchaseOrderItem` punya `target_warehouse_id` PER BARIS (lihat `app/Models/Purchase/PurchaseOrderItem.php`), jadi tiap baris independen soal warehouse. `PurchaseRequestItem` malah TIDAK punya kolom warehouse sama sekali (lihat `create_purchase_request_items_table` migration) — warehouse baru ditentukan nanti saat PR di-convert jadi PO — jadi constraint ini otomatis tidak berlaku di level PR.

### Requirement 4: Tracking Covered Quantity (Partial)

**User Story:** As a Purchasing Officer, I want quantity yang sudah saya buatkan PR/PO otomatis berkurang dari daftar Item Request, so that saya tidak membuat PR/PO duplikat untuk kebutuhan yang sama.

#### Acceptance Criteria

1. WHEN PR atau PO berhasil dibuat dari baris Item Request terpilih, THE System SHALL mencatat quantity yang di-cover pada baris Item Request tersebut, terlepas dari status approval PR/PO itu (Draft/Diajukan/Disetujui semua dihitung sebagai "sudah di-cover").
2. WHEN total covered quantity suatu baris Item Request mencapai atau melebihi shortage quantity-nya, THE System SHALL menghilangkan baris tersebut dari daftar.
3. WHEN covered quantity kurang dari shortage quantity, THE System SHALL tetap menampilkan baris tersebut dengan quantity tersisa (shortage dikurangi covered).
4. **[DIPUTUSKAN di design.md]** Struktur penyimpanan covered quantity: tabel log terpisah `item_request_coverages` (morphTo `source` ke Source Document item, morphTo `covering` ke `PurchaseRequestItem`/`PurchaseOrderItem`) — TIDAK menambah kolom ke Source Document item existing, mendukung audit trail multi-PR per baris.
5. **[DIPUTUSKAN di design.md — DIKOREKSI saat implementasi]** WHEN PR/PO yang dibuat dari suatu Item Request kemudian di-cancel atau ditolak (reject), THE System SHALL mengembalikan covered quantity (baris shortage muncul lagi). **Bukan** via listener pada event `DocumentCanceled` (event itu TERBUKTI kondisional — tidak terpicu tanpa ApprovalScheme aktif, lihat design.md) — restorasi terjadi otomatis lewat pengecekan status LIVE di `ItemRequestService::isCoveringActive()` setiap `getShortageRows()` dipanggil, tanpa perlu event/listener/penghapusan row sama sekali.
6. THE System SHALL menggunakan locking (mis. `lockForUpdate`) saat mencatat covered quantity untuk mencegah race condition dua user membuat PR/PO dari baris shortage yang sama secara bersamaan.

### Requirement 5: Module & Desk Placement

#### Acceptance Criteria

1. THE System SHALL menempatkan model dan controller utama di `Domain::Purchase` (`app/Models/Purchase/`, `app/Http/Controllers/Purchase/`).
2. THE System SHALL menampilkan menu "Item Request" di Desk: Purchase, Inventory, Sales, Service, Asset — mengikuti pola `desks()` multi-assign existing di `DeskSeeder`.

## Non-Functional Requirements

| NFR | Deskripsi |
|-----|-----------|
| NFR1 | Query deteksi shortage harus efisien untuk volume dokumen besar — hindari N+1, pertimbangkan agregasi per item+warehouse |
| NFR2 | Operasi pencatatan covered quantity dibungkus `DB::transaction` dengan `lockForUpdate` (lihat Requirement 4.6) |
| NFR3 | **[REVISI saat implementasi]** Halaman Item Request TIDAK bisa pakai komponen `<DataTable>`/`Table2` generik — mekanisme itu (`Model::dataTable()` macro) spesifik untuk 1 Eloquent Builder fisik (column-pruning cookie, `SavedFilter`, `templateLink`), sedang Item Request adalah union 3 tabel berbeda struktur. Halaman ini SHALL jadi tabel custom (reuse primitif UI umum — Button/Checkbox/Select/Pagination — tapi bukan komponen DataTable generik) |

## Out of Scope (v1)

- Dokumen sumber selain SalesOrder/InternalOrder/AssetService (mis. WorkOrder lama, StockEntry) — menyusul kalau dibutuhkan.
- Notifikasi otomatis/reminder ke Purchasing saat shortage baru terdeteksi (murni halaman on-demand di v1).
- Shortage pada SalesOrder/InternalOrder yang SUDAH berstatus `submitted` (mis. stock ikut diserobot dokumen lain setelah submit-nya lolos) — v1 fokus ke dokumen `draft` yang gagal submit karena shortage (skenario utama, lihat Requirement 1.0). Re-validasi shortage pada dokumen submitted adalah perluasan terpisah.
- Row Item Request yang hilang dari daftar TIDAK berarti SO/IO sumbernya otomatis bisa disubmit — itu baru terjadi setelah PurchaseReceipt benar-benar menambah `actual_quantity` (PR/PO yang baru dibuat/di-approve belum menyentuh stock fisik). Menghilang dari daftar murni mencegah pembuatan PR/PO duplikat untuk kebutuhan yang sama.
