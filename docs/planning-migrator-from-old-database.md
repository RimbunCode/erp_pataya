# Planning Migrator From Old Database

Rencana ini menguraikan strategi komprehensif untuk memigrasikan fitur dari aplikasi lama ke sistem ERP saat ini. Fokus utamanya adalah menjaga integritas data (terutama saat terjadi perubahan tipe *Primary Key*) dan menyesuaikan *form* UI.

## Catatan Scope Saat Ini

> [!NOTE]
> Scope migrasi saat ini fokus pada data master + dokumen operasional inti. Mapping detail `status` masih disiapkan sebagai placeholder agar bisa disesuaikan manual sesuai bisnis lama.

## Update Implementasi (26 April 2026)

Perbaikan berikut sudah diterapkan pada fondasi migrasi agar lebih aman saat dipakai di data riil:

1. **Perbaikan Transform Mapping**
   - Mekanisme `transform()` kini konsisten dengan format mapping pada stub: `kolom_baru => kolom_lama / closure`.
   - Mencegah kasus nilai kolom tujuan menjadi `null` karena arah mapping terbalik.

2. **Hardening Pencatatan Log Migrasi**
   - `recordModelLog()` kini aman saat membaca `logableFields()` yang bersifat `protected`.
   - Ditambahkan validasi class model agar proses migrasi tidak gagal total jika class target tidak valid.

3. **Optimasi Resolusi Relasi (`old_id` -> `new_ulid`)**
   - Lookup `getNewId()` kini menggunakan cache in-memory per proses migrasi.
   - Mengurangi query berulang ke tabel `migration_mappings` pada data besar.

4. **Hardening Command Runner (`erp:migrate-legacy`)**
   - Opsi `--step` sekarang tervalidasi wajib numerik non-negatif.
   - Instansiasi migrator lewat service container (`app(...)`) dan validasi harus turunan `BaseMigrator`.
   - Error per migrator ditangani eksplisit agar kegagalan mudah dilacak.

5. **Ketahanan Model Log Saat Migrasi via Console**
   - Accessor `Log::code` kini aman untuk `user_id = null` (mis. migrasi dijalankan tanpa user login).

6. **Migrator Sudah Diterapkan ke Model Scope Legacy**
   - Runner `php artisan erp:migrate-legacy` sudah memuat migrator berikut:
     - Master: `UserMigrator`, `UnitMigrator`, `CategoryMigrator`, `WarehouseMigrator`, `CustomerMigrator`, `SupplierMigrator`, `ItemMigrator`
     - Operasional Header: `WorkOrderMigrator`, `InternalOrderMigrator`, `PurchaseRequestMigrator`, `SalesOrderMigrator`, `PurchaseOrderMigrator`, `DeliveryNoteMigrator`, `PurchaseReceiptMigrator`, `SalesInvoiceMigrator`
     - Operasional Detail: `WorkOrderItemMigrator`, `InternalOrderItemMigrator`, `PurchaseRequestItemMigrator`, `SalesOrderItemMigrator`, `PurchaseOrderItemMigrator`, `DeliveryNoteItemMigrator`, `PurchaseReceiptItemMigrator`, `SalesInvoiceItemMigrator`
     - Koneksi Dokumen: `ModelConnectionMigrator` (dibuat sebagai tahap terakhir setelah semua dokumen termigrasi)
   - Migrasi `roles` dan relasi `user_role` tetap tidak termasuk (dibuat terpisah sesuai arahan).
   - Mapping `status` per tabel tetap melalui hook `mapLegacyStatus()` untuk disesuaikan manual.

7. **Penyesuaian Aturan Dokumen Legacy**
   - `branch_id` dokumen diarahkan ke **main branch company** (branch yang dibuat dari seeder `PreferenceSeeder`).
   - `code` dokumen mempertahankan pola legacy (mengutamakan `reference`/`shipment_reference` legacy). Fallback code menggunakan pola lama berbasis tahun (`.../YY`), bukan format generator dokumen ERP baru.

8. **Keamanan Resume Saat Error di Tengah Chunk**
   - Ditambahkan tabel `migration_checkpoints` untuk menyimpan posisi terakhir per migrator + scope proses.
   - `BaseMigrator` memiliki helper `processChunkedWithCheckpoint(...)` agar proses dapat lanjut otomatis dari key terakhir yang sukses.
   - `ModelConnectionMigrator` sudah memakai mekanisme ini pada seluruh proses koneksi dokumen.
   - Jika terjadi error, jalankan ulang migrator yang sama; proses akan lanjut dari checkpoint terakhir, bukan dari awal.

---

## Strategi Utama Migrasi

Proses migrasi dibagi menjadi beberapa fase agar berjalan aman dan terstruktur.

### Fase 1: Analisis & Pemetaan Skema (Mapping)

Pada fase ini, kita akan membuat tabel perbandingan antara struktur lama dan baru.

**Contoh Pemetaan Database:**
*   **Tabel Asal**: `tabel_lama`
*   **Model Tujuan**: `NamaModelBaru`
| Kolom Lama | Kolom Baru | Logika Transformasi |
| :--- | :--- | :--- |
| `id` (Integer) | `id` (ULID) | Akan di-*generate* ULID baru. ID lama dicatat. |
| `parent_id` (Integer) | `parent_id` (ULID) | Akan dicari ke tabel riwayat *mapping* untuk mendapatkan ULID milik *parent*. |
| `status_kode` | `status` | Mengubah kode integer menjadi teks/JSON. |

---

### Fase 2: Strategi Integritas Relasi (Penanganan Perubahan Primary Key)

Karena aplikasi lama menggunakan *Primary Key* tipe ID (misal: Auto Increment Integer) dan aplikasi baru menggunakan ULID (`char(26)`), relasi antar tabel akan rusak jika tidak ditangani khusus.

> [!TIP]
> **Solusi:** Kita menggunakan tabel bantuan `migration_mappings` (sudah berhasil dibuat di sistem). Tabel ini mencatat riwayat perubahan ID.

**Skenario Pemecahan Masalah Relasi (Contoh Induk & Anak):**

1.  **Tahap Migrasi Induk (Misal: `Pelanggan`)**
    *   Sistem membaca `Pelanggan` lama dengan `id = 123`.
    *   Sistem membuat `Pelanggan` baru dengan ULID `01HQXXXXXXX`.
    *   Sistem menyimpan catatan ke `migration_mappings`: 
        *   `table_name`: `customers`
        *   `old_id`: `123`
        *   `new_ulid`: `01HQXXXXXXX`

2.  **Tahap Migrasi Anak (Misal: `Pesanan Penjualan`)**
    *   Sistem membaca `Pesanan` lama yang memiliki `customer_id = 123`.
    *   Sistem mencari ke tabel `migration_mappings` untuk tabel `customers` dengan `old_id = 123`.
    *   Sistem menemukan ULID `01HQXXXXXXX`.
    *   Sistem menyimpan `Pesanan` baru dan memasukkan `01HQXXXXXXX` ke dalam kolom `customer_id`.
    *   *Hasilnya: Relasi antara Pesanan dan Pelanggan tetap terjaga di sistem baru.*

---

### Fase 3: Pembuatan Script ETL (Backend)

Kita telah membuat fondasi yang kuat untuk mengeksekusi perpindahan data:

1.  **`BaseMigrator` (Selesai)**: Class dasar (`app/Services/Migration/BaseMigrator.php`) yang memiliki kemampuan:
    *   Mengatur pencatatan riwayat ULID ke `migration_mappings`.
    *   Otomatis mencatat aktivitas migrasi ke tabel Log (`App\Models\Core\Log`) dan menyaring kolom yang tidak perlu menggunakan filter `logableFields()`.
    *   Menangani perbedaan tipe data kompleks lewat fungsi *Closure*.
2.  **`MakeMigratorCommand` & Stub (Selesai)**: Generator Artisan (`php artisan make:migrator`) yang mempercepat pembuatan *script* migrasi baru menggunakan *template* (`stubs/migrator.stub`). Template ini dirancang untuk:
    *   Memproses data secara mencicil menggunakan `->chunk(500)` untuk mencegah aplikasi kehabisan RAM.
    *   Mendukung *Closure* saat *mapping* sehingga nilai `String` bisa diubah ke `Integer`, `Date`, dsb dengan mudah.
3.  **`RunLegacyMigrationCommand` (Selesai)**: *Master Runner* (`php artisan erp:migrate-legacy`) untuk menjalankan seluruh *class* migrator secara terpusat dan berurutan (misal: jalankan tabel Master dulu, baru tabel Transaksi).
4.  **Script Spesifik Fitur (Berjalan)**: Class migrator per fitur sudah dibuat dan dijalankan terpusat lewat `RunLegacyMigrationCommand`; penyesuaian lanjutan fokus ke mapping status dan edge-case data legacy.

---

### Fase 4: Penyesuaian UI & Form (Frontend)

Karena ada perbedaan struktur, komponen *Frontend* (React) juga harus disesuaikan.

1.  **Form Model**: Memetakan *input form* lama ke *state* baru di React/Inertia.
2.  **Penanganan Nilai Kosong**: Memastikan UI tidak *error* jika data lama ada yang kosong (*null*) padahal di sistem baru sifatnya wajib (*mandatory*).
3.  **Standarisasi Komponen**: Menggunakan komponen UI standar ERP (seperti *dropdown* pencarian relasi berdasarkan ULID) alih-alih ID konvensional.

---

## Koreksi Status Migrator (25 Juli 2026)

> [!IMPORTANT]
> Bagian "Update Implementasi (26 April 2026)" di atas — khususnya poin 6 — sudah **tidak akurat** dan diluruskan di sini berdasarkan isi aktual `app/Console/Commands/RunLegacyMigrationCommand.php` per tanggal koreksi ini. Histori di atas tetap dipertahankan sebagai catatan, bukan dihapus.

**Yang keliru di poin 6 sebelumnya:**
- Klaim *"Migrasi `roles` dan relasi `user_role` tetap tidak termasuk (dibuat terpisah sesuai arahan)"* — **sudah tidak berlaku**. `RoleMigrator`, `RolePermissionMigrator`, dan `UserRoleMigrator` sudah ditulis dan aktif terdaftar.
- Klaim bahwa migrator operasional (WorkOrder, InternalOrder, PurchaseRequest, SalesOrder, PurchaseOrder, DeliveryNote, PurchaseReceipt, SalesInvoice, ModelConnection, dst.) *"sudah diterapkan ke model scope legacy"* — **belum benar**. File-file migrator tersebut belum ditulis sama sekali.

**Status aktual (per isi `$migrators` di `RunLegacyMigrationCommand`):**

| Tahap | Migrator | Status |
|---|---|---|
| Tahap 0 — Master Data Utama | `UserMigrator`, `RoleMigrator`, `RolePermissionMigrator`, `UserRoleMigrator`, `UnitMigrator`, `CategoryMigrator`, `WarehouseMigrator`, `CustomerMigrator`, `SupplierMigrator`, `ItemMigrator` | ✅ Aktif — 10 file sudah ditulis dan terdaftar, dijalankan berurutan |
| Tahap 1 — Master Data Turunan | `InternalOrderMigrator`, `InternalOrderItemMigrator`, `PurchaseRequestMigrator`, `PurchaseRequestItemMigrator` | ⛔ Belum ditulis — hanya ter-comment sebagai rencana |
| Tahap 2 — Transaksi Header+Item | `SalesOrderMigrator`, `SalesOrderItemMigrator`, `PurchaseOrderMigrator`, `PurchaseOrderItemMigrator`, `DeliveryNoteMigrator`, `DeliveryNoteItemMigrator`, `PurchaseReceiptMigrator`, `PurchaseReceiptItemMigrator` | ⛔ Belum ditulis |
| Tahap 3 — Replay Approval Kronologis | (belum ada nama class spesifik) | ⛔ Belum ditulis |
| Tahap 4 — Generate Invoice | `SalesInvoiceMigrator`, `SalesInvoiceItemMigrator` | ⛔ Belum ditulis |
| Tahap 5 — Koneksi Antar Dokumen | `ModelConnectionMigrator` | ⛔ Belum ditulis |

**Untuk maintainer**: jangan berasumsi migrator Tahap 1-5 bisa langsung dijalankan — cek dulu isi `RunLegacyMigrationCommand::$migrators` untuk daftar yang benar-benar aktif sebelum menjalankan `php artisan erp:migrate-legacy`. Detail command & opsi `--step`: [Artisan Commands · run-legacy-migration](artisan-commands.md#run-legacy-migration).

---

## Rencana Verifikasi Akhir (Verification Plan)

### Pengujian Otomatis
*   Menggunakan *flag* `--step=0` pada command `erp:migrate-legacy` untuk menguji satu tabel saja sebelum memigrasi semuanya secara berurutan.

### Pengecekan Manual
*   Mengecek tabel `migration_mappings` untuk memastikan ID lama dan baru tercatat dengan benar.
*   Memastikan setiap *record* yang masuk terekam di sistem Log aplikasi.
*   Membuka halaman web fitur terkait dan memastikan form edit mampu membaca dan menampilkan relasi (misal: *dropdown* Pelanggan terpilih otomatis pada form Pesanan).
