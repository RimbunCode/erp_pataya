# Artisan Commands

> Referensi semua custom Artisan commands dan scheduled tasks.

## Daftar Isi

- [Custom Commands](#custom-commands)
  - [make:feature](#makefeature)
  - [commands:index](#commandsindex)
  - [have-transactions:sync](#have-transactionssync)
  - [make:migrator](#makemigrator)
  - [run-legacy-migration](#run-legacy-migration)
- [Scheduled Commands](#scheduled-commands)
- [Commands Bawaan Laravel yang Sering Dipakai](#commands-bawaan-laravel-yang-sering-dipakai)

---

## Custom Commands

### make:feature

**File:** `app/Console/Commands/Feature.php`

**Signature:**
```
php artisan make:feature {name} {--M|module=} {--S|service} {--F|force}
```

**Deskripsi:** Generator scaffolding untuk membuat semua file yang diperlukan untuk sebuah feature/module sekaligus.

**Arguments & Options:**

| Argument/Option | Tipe | Deskripsi |
|---|---|---|
| `name` | argument | Nama feature/class dasar (mis. `Item`, `SalesOrder`) |
| `--module` / `-M` | option (wajib) | Nama module (mis. `Inventory`, `Sales`) |
| `--service` / `-S` | flag | Generate juga Service class |
| `--force` / `-F` | flag | Overwrite file yang sudah ada |

**File yang di-generate:**

| File | Path |
|---|---|
| Model + Migration | `app/Models/{Module}/{Name}.php` + `database/migrations/...` |
| Controller (resource) | `app/Http/Controllers/{Module}/{Name}Controller.php` |
| FormRequest | `app/Http/Requests/{Module}/{Name}Request.php` |
| Service (opsional) | `app/Services/{Module}/{Name}Service.php` |

**Contoh Penggunaan:**

```bash
# Buat Item di modul Inventory (tanpa service)
php artisan make:feature Item --module=Inventory

# Buat SalesOrder di modul Sales dengan service
php artisan make:feature SalesOrder --module=Sales --service

# Singkat
php artisan make:feature Item -M Inventory -S

# Overwrite file yang ada
php artisan make:feature Item -M Inventory --force
```

**Output:**
```
INFO  Model [app/Models/Inventory/Item.php] created successfully.
INFO  Migration [database/migrations/..._create_items_table.php] created successfully.
INFO  Controller [app/Http/Controllers/Inventory/ItemController.php] created successfully.
INFO  Request [app/Http/Requests/Inventory/ItemRequest.php] created successfully.
INFO  Class [app/Services/Inventory/ItemService.php] created successfully.
✅ Selesai. Files utama sudah dibuat.
```

**Catatan:**
- Setelah generate, tambahkan trait `DataTable`, `HasUlids`, `SoftDeletes` ke model secara manual
- Tambahkan route `Route::resourceDetail(...)` di `routes/web.php`
- Buat file lang di `lang/en/{module}/{entity}.php` dan `lang/id/{module}/{entity}.php`
- Jalankan `php artisan migrate` setelah membuat migration

---

### commands:index

**File:** `app/Console/Commands/CommandsIndexCommand.php`

**Signature:**
```
php artisan commands:index {--rebuild}
```

**Deskripsi:** Build atau rebuild search index untuk Command Palette (navigasi + record search).

**Options:**

| Option | Deskripsi |
|---|---|
| `--rebuild` | Full rebuild — hapus semua dan buat ulang dari awal |

**Kapan Dijalankan:**
- Otomatis setiap hari pukul 01:20 (scheduled)
- Manual setelah menambahkan model baru atau mengubah label dokumen
- Manual setelah seed data awal

**Contoh:**

```bash
# Incremental update (hanya yang baru/berubah)
php artisan commands:index

# Full rebuild (setelah major changes)
php artisan commands:index --rebuild
```

**Output:**
```
Mode: FULL REBUILD
+------------+-------+
| Type       | Count |
+------------+-------+
| Navigation | 45    |
| Records    | 1203  |
| Total      | 1248  |
+------------+-------+
```

---

### have-transactions:sync

**File:** `app/Console/Commands/HaveTransactionsSyncCommand.php`

**Signature:**
```
php artisan have-transactions:sync {--dry-run} {--only=} {--chunk=1000}
```

**Deskripsi:** Sinkronisasi kolom `have_transactions` di semua tabel. Kolom ini menandai apakah record memiliki relasi aktif (digunakan untuk proteksi delete data yang sedang dipakai).

**Options:**

| Option | Default | Deskripsi |
|---|---|---|
| `--dry-run` | false | Simulasi tanpa mengubah data |
| `--only` | — | Batasi ke model class atau nama tabel tertentu |
| `--chunk` | 1000 | Jumlah baris per chunk |

**Kapan Dijalankan:**
- Otomatis setiap hari pukul 01:00 (scheduled)
- Manual setelah data migration atau import massal
- Manual jika ada inkonsistensi data `have_transactions`

**Contoh:**

```bash
# Dry run untuk preview perubahan
php artisan have-transactions:sync --dry-run

# Sync hanya tabel items
php artisan have-transactions:sync --only=items

# Sync hanya model tertentu
php artisan have-transactions:sync --only="App\\Models\\Inventory\\Item"

# Chunk lebih kecil untuk server dengan memori terbatas
php artisan have-transactions:sync --chunk=500
```

**Output:**
```
Mode: APPLY
Target tables: items, categories, units, ...
Scanned tables: 24
References detected: 1847

+------------+-------+--------+
| Table      | Reset | Marked |
+------------+-------+--------+
| items      | 150   | 89     |
| categories | 30    | 18     |
+------------+-------+--------+
```

---

### make:migrator

**File:** `app/Console/Commands/MakeMigratorCommand.php`

**Signature:**
```
php artisan make:migrator {name}
```

**Deskripsi:** Membuat file migrator untuk migrasi legacy database.

**Kapan Dipakai:** Saat perlu migrasi data dari sistem lama ke ERP baru.

---

### run-legacy-migration

**File:** `app/Console/Commands/RunLegacyMigrationCommand.php`

**Deskripsi:** Menjalankan migrator legacy database. Digunakan untuk one-time data migration dari sistem lama.

---

## Scheduled Commands

Didefinisikan di `routes/console.php`:

```php
Schedule::command('have-transactions:sync')
    ->dailyAt('01:00')
    ->withoutOverlapping();

Schedule::command('commands:index --rebuild')
    ->dailyAt('01:20')
    ->withoutOverlapping();
```

| Command | Jadwal | Fungsi |
|---|---|---|
| `have-transactions:sync` | Setiap hari pukul 01:00 | Sinkronisasi `have_transactions` di semua model |
| `commands:index --rebuild` | Setiap hari pukul 01:20 | Rebuild Command Palette search index |

**Catatan:** Queue worker (`php artisan queue:listen`) dijalankan sebagai proses terpisah dan harus aktif agar scheduled jobs berjalan.

---

## Commands Bawaan Laravel yang Sering Dipakai

```bash
# Jalankan semua dev services sekaligus (rekomendasi)
composer run dev

# Jalankan dev (hanya server + vite)
composer run dev:simple

# Jalankan dev dengan Xdebug
composer run dev:debug

# Run test
php artisan test --compact

# Run test dengan filter
php artisan test --compact --filter=SalesOrderTest

# Lihat semua routes
php artisan route:list --except-vendor

# Lihat routes modul tertentu
php artisan route:list --path=salesOrders

# Jalankan migration
php artisan migrate

# Rollback migration
php artisan migrate:rollback

# Seed database
php artisan db:seed

# Clear semua cache
php artisan optimize:clear

# Generate permission (setelah tambah model baru)
php artisan tinker --execute 'App\Models\Inventory\Item::initPermissions();'

# Lihat konfigurasi
php artisan config:show app
php artisan config:show database.default

# Format PHP dengan Pint
./vendor/bin/pint --dirty

# Generate TypeScript types dari FormRequest (via laravel-zodgen)
npm run zodgen
```

---

## Dev Logs

**File:** `app/Console/Commands/DevLogs.php`

Command `php artisan dev:logs` dijalankan otomatis oleh `composer run dev`. Menampilkan log aplikasi di terminal dengan format yang lebih readable selama development.

---

*Lihat juga: [Arsitektur](architecture.md) | [Routes](routes.md)*
