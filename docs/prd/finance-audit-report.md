# Laporan Audit Finance Engine — Fase 0

| | |
|---|---|
| **Status** | **Draft — sebagian MENUNGGU Task 6.5 (data staging/produksi)**; belum disetujui pemilik produk |
| **Tanggal draft** | 2026-11-03 |
| **Spec** | [`finance-p0-foundation-audit`](../../.kiro/specs/finance-p0-foundation-audit/requirements.md) — Requirement 6 (audit skema), Requirement 7.1, 7.3, 7.4 (laporan) |
| **Dokumen terkait** | [`finance-engine-prd.md`](finance-engine-prd.md) (Lampiran A dan B), [`finance-decision-log.md`](finance-decision-log.md) |
| **Penyusun** | Pembacaan kode dan test pada branch `docs/finance-p0-audit-report`. Tidak ada data staging atau produksi yang dipakai |

> **Cara membaca dokumen ini.** Bagian yang berlabel **MENUNGGU Task 6.5** memerlukan angka dari DB staging (produksi tidak diperlukan; lihat Q1). Angka tersebut **sengaja dikosongkan** dan tidak boleh diisi dari perkiraan. Semua klaim perilaku kode lain dirujuk ke `file:baris` atau ke test yang menjalankannya; klaim yang hanya berasal dari pembacaan kode (belum diuji) diberi label **belum diuji**.

---

## 0. Ringkasan

### 0.1 Yang sudah dapat disimpulkan (tanpa data staging)

1. **Skema runtime (Req 6).** Trait `DataTable::initPermissions()` menambah kolom langsung ke tabel saat `PermissionSeeder` dijalankan, dan seeder itu **berjalan di setiap deploy** staging dan produksi (`db:seed --force`, lihat Bagian 1.1). Untuk dua tabel Finance yang relevan: `general_ledgers` memperoleh `is_example`, `code` (unik), dan `have_transactions` yang **tidak ada di migration**; `accounts` memperoleh `is_example`, `have_transactions`, `parent_id`, `lft`, `rgt`, `depth` beserta lima indeks, juga tidak ada di migration. Kode produksi sudah bergantung pada kolom runtime itu (mis. `GeneralLedger::creating` menulis `code`; `StockEntryService` menulis `accounts.have_transactions`). **Konvensi yang disimpulkan:** kolom tabel baru Finance wajib dideklarasikan eksplisit di migration (Bagian 1.4).
2. **Penghapusan kolom tidak seluruhnya hanya di lokal.** Penghapusan `have_transactions` pada model submitable berjalan **di semua lingkungan** (`DataTable.php:648-652`). Hanya penghapusan kolom Submitable pada model non-submitable dan kolom tree pada model non-tree yang dibatasi `app()->isLocal()`. Karena `db:seed --force` ikut dalam setiap deploy, **pemeriksaan** itu dijalankan pada setiap deploy ke staging dan produksi; kolom dihapus bila masih ada, sehingga penghapusan efektif hanya terjadi sekali per tabel (selanjutnya no-op), dengan asumsi `APP_ENV` di sana bukan `local` (belum dikonfirmasi, lihat Bagian 1.5.2). Ini **tidak sama** dengan uraian PRD F-12 (lihat Bagian 5.2; PRD sudah dikoreksi).
3. **Dugaan bug terkonfirmasi oleh test** (Bagian 3): F-04, F-10, F-11 (bagian FX), F-16. Ditambah dua temuan baru dari PR #271 (tanda laba/rugi disposal aset; Purchase Invoice tanpa PO) dan satu temuan tambahan metode (pemecahan kelompok akibat `now()` per baris, Bagian 3.7). Semuanya menunggu keputusan pemilik produk.
4. **Peringatan untuk estimasi backfill (Bagian 4).** F-10 dan F-11 menghasilkan jurnal yang **seimbang tetapi salah**, sehingga persentase kelompok tak seimbang dari `finance:audit-gl` tidak mendeteksinya. Persentase itu juga dapat membengkak karena baris satu dokumen terpecah lintas detik.

### 0.2 Yang menunggu

| # | Menunggu | Pemilik | Dampak |
|---|---|---|---|
| 1 | **Task 6.5**: menjalankan `finance:audit-gl --json` dan `finance:snapshot-balances` di staging (produksi tidak diperlukan; Q1 dijawab 2026-11-03), menyimpan keluaran di `storage/app/finance-audit/` | Pemilik produk (Q-P0-1 dijawab 2026-11-03: menjalankan di staging) | Bagian 1.5 (skema aktual), Bagian 2 (hasil audit), Bagian 4 (angka backfill) |
| 2 | ~~**Q1** versi PRD~~ **Dijawab 2026-11-03**: belum ada data sama sekali (GL produksi kosong). Tidak lagi menunggu | Pemilik produk | Sudah tertutup; tidak memblokir Fase 1 |
| 3 | **Q-P0-1** dijawab 2026-11-03: pemilik produk sendiri menjalankan perintah di staging dan menyerahkan hasilnya. Produksi tidak untuk sekarang | Pemilik produk | Task 6.5 dapat dilaksanakan; checkbox tetap terbuka sampai hasil diterima |
| 4 | **Keputusan pemilik produk** atas tiap temuan di Bagian 3 (F-04, F-10, F-11, F-16, N-1, N-2, N-3) | Pemilik produk | Menentukan apakah ada hotfix terpisah dan apa yang masuk Fase 1, Fase 2, atau fase terkait |
| 5 | **Persetujuan laporan ini** (Requirement 7.5). Fase 1 tidak dimulai sebelum laporan disetujui (Q1 versi PRD sudah dijawab 2026-11-03) | Pemilik produk | Gerbang Fase 1 |

---

## 1. Audit skema runtime (Task 7.1, Requirement 6)

### 1.1 Kolom yang ditambahkan `initPermissions()` per jenis model (Req 6.1)

Sumber: `app/Traits/DataTable.php`, metode `initPermissions()` (baris 546–753). Metode ini dipanggil untuk setiap kelas `App\Models\*` yang memakai trait `DataTable` oleh `database/seeders/PermissionSeeder.php:127-145` (juga dipanggil langsung oleh beberapa test dan factory). **Seeder ini berjalan otomatis pada setiap deploy:** `.scripts/deploy-staging.sh:67` dan `.scripts/deploy-production.sh:68` menjalankan `php artisan db:seed --force` tanpa syarat (setelah `migrate --force`; skrip produksi juga memanggilnya pada baris 62 untuk deploy pertama); kedua skrip dipanggil lewat `.scripts/deploy.sh` dari `.github/workflows/deploy-cpanel.yml:101-108` (merge PR ke `dev-1` tanpa label `skip-deploy`, tag `v*`, atau `workflow_dispatch`); `database/seeders/DatabaseSeeder.php:13` memanggil `PermissionSeeder`. Jadi `initPermissions()` menyentuh skema staging dan produksi pada setiap deploy.

Penambahan kolom dijaga `Schema::hasColumn()` sehingga idempoten; penghapusan (Bagian 1.3) dapat menyentuh kolom yang dideklarasikan di migration.

| Jenis model | Kondisi (flag statis pada model) | Kolom/objek yang ditambahkan | Tipe dan sifat | Baris |
|---|---|---|---|---|
| **Semua model `DataTable`** | selalu | `is_example` + indeks `is_example` | boolean, default `false`, indeks biasa | 558–564 |
| **Generate kode series** | `$is_submitable` **atau** `$generateCodeSeries` benar | Baris `FormatingSeries` (data, bukan kolom): dibuat bila belum ada; bila sudah ada, `logs` diperbarui, dan **di lokal** `name` dan `format` ikut ditimpa | data | 565–593 |
| | (sama) dan kolom `code` belum ada | `code` | string (varchar 255), **NOT NULL, unique** | 594–598 |
| **Submitable** | `$is_submitable` benar (trait `Submitable`, `Submitable.php:33`) | `branch_id` | foreignUlid nullable, FK ke `branches`, `nullOnDelete` | 601–605 |
| | | `status` | json nullable | 607–611 |
| | | `created_by_id` | foreignUlid **NOT NULL**, FK ke `users`, `restrictOnDelete` | 612–616 |
| | | `submitted_at`, `canceled_at` | timestamp nullable | 617–626 |
| | | `revision_number` | unsignedTinyInteger, default 0 | 627–631 |
| | | `amended_from_id` | foreignUlid nullable, FK ke tabel itu sendiri, `nullOnDelete` | 632–636 |
| | | `additional_data` | json nullable | 637–641 |
| | | `submitted_format` | string nullable | 642–646 |
| | | **menghapus** `have_transactions` bila ada | **di semua lingkungan** | 648–652 |
| **Non-submitable** | `$is_submitable` salah/tidak ada | menambah `have_transactions` bila belum ada | boolean, default `false` (semua lingkungan) | 693–697 |
| | | **menghapus** `submitted_at`, `canceled_at`, `revision_number`, `amended_from_id`, `additional_data`, `submitted_format` bila ada | hanya bila `app()->isLocal()` | 654–691 |
| **Tree view** | `$is_tree_view` benar (trait `TreeView`, `TreeView.php:10`) | `parent_id` | foreignUlid nullable, FK ke tabel itu sendiri, `nullOnDelete` | 700–704 |
| | dan ketiga kolom `lft`,`rgt`,`depth` **belum ada seluruhnya** | `lft`, `rgt`, `depth` | unsignedInteger, default 0 | 705–716 |
| | | indeks `lft_index`, `rgt_index`, `depth_index`, `idx_depth_lft` (`depth`,`lft`), `idx_parent_lft` (`parent_id`,`lft`) | indeks biasa | 710–714 |
| **Bukan tree** | `$is_tree_view` salah/tidak ada | **menghapus** `parent_id`; menghapus lima indeks di atas dan `lft`,`rgt`,`depth` bila ketiganya ada | hanya bila `app()->isLocal()` | 718–734 |
| **Semua model** | selalu | `Permission` (`updateOrCreate` per model) | data | 737–751 |

Catatan teknis:

- `initPermissions()` **menulis data, bukan hanya DDL**: membuat baris `FormatingSeries` (565–593) dan `Permission` (737–751).
- Kolom `created_by_id` pada model non-submitable sengaja **tidak** dihapus (kode penghapusan dikomentari, baris 655–659).
- Cabang tree memeriksa `hasColumns(['lft','rgt','depth'])` secara semua-atau-tidak: bila hanya sebagian kolom yang ada, penambahan ketiganya akan bentrok pada kolom yang sudah ada (**belum diuji**).
- Cabang penghapusan indeks tree memanggil `dropIndex` untuk lima nama tetap; bila salah satu indeks tidak ada, `ALTER` gagal di tengah dan hanya sebagian yang terhapus (**belum diuji**). Seeder menangkap galat per kelas (`PermissionSeeder.php:141-144`), jadi kegagalan hanya tercetak sebagai `(ERROR)`.
- Penghapusan `parent_id` yang memiliki FK pada MySQL berpotensi gagal sebelum FK dilepas (**belum diuji**).

### 1.2 Dampak pada dua tabel Finance yang ada (Req 6.1, 6.2)

| Tabel | Flag model | Kolom runtime yang diharapkan ada di DB, tetapi **tidak ada di migration** |
|---|---|---|
| `general_ledgers` (`GeneralLedger.php:12-20`: `DataTable`, `HasUlids`, `SoftDeletes`; `$generateCodeSeries = true`; bukan submitable; bukan tree) | non-submitable, kode series | `is_example` (+ indeks), `code` (varchar 255, NOT NULL, **unique**), `have_transactions` |
| `accounts` (`Account.php:12-14`: `DataTable`, `HasUlids`, `SoftDeletes`, `TreeView`; tidak ada `$generateCodeSeries`; bukan submitable) | non-submitable, tree | `is_example` (+ indeks), `have_transactions`, `parent_id` (self-FK), `lft`, `rgt`, `depth`, dan lima indeks tree |

Hal yang perlu dicatat:

- `GeneralLedger::boot()` mengisi `code` pada setiap `creating` (`GeneralLedger.php:36-38`, di dalam `boot()` baris 34-39). Maka **insert GL gagal pada DB yang belum pernah menjalankan `initPermissions()`** untuk model itu. Karena kode dibuat per baris (PRD F-15), kolom `code` yang `unique` juga menjadi latar bagi F-15.
- `Account.code` pada model adalah *accessor* (`Account.php:35-39`), **bukan kolom**.
- Model `HasExampleData` menambahkan *global scope* `is_example = false` pada query Eloquent, tetapi **melewatinya bila kolom `is_example` tidak ada** (`HasExampleData.php:27-39`). Query `DB::table(...)` pada auditor **tidak** terkena scope ini (Bagian 2.3).
- Kode produksi sudah bergantung pada kolom runtime: `StockEntryService` menulis `accounts.have_transactions` (baris 571, 576, 600, 605, 634, 638).
- Pada tabel berisi data, penambahan kolom `code` (NOT NULL unique) atau `created_by_id` (NOT NULL + FK) oleh `initPermissions()` kemungkinan **gagal** (MySQL mengisi nilai implisit `''` untuk baris lama, sehingga indeks unik/FK tidak dapat dibuat bila ada lebih dari satu baris). Kemungkinan ini **belum diuji**; ia relevan bila model jurnal baru memakai `$generateCodeSeries` atau `Submitable` dan tabelnya sudah terisi (mis. setelah backfill).

### 1.3 Perilaku penghapusan kolom dan risikonya (Req 6.3)

Tiga perilaku penghapusan, dengan cakupan lingkungan yang berbeda:

| Penghapusan | Lingkungan | Baris |
|---|---|---|
| `have_transactions` pada model **submitable** | **Semua lingkungan** (bukan hanya lokal) | `DataTable.php:648-652` |
| Kolom Submitable (`submitted_at`, `canceled_at`, `revision_number`, `amended_from_id`, `additional_data`, `submitted_format`) pada model **non-submitable** | Hanya `app()->isLocal()` | `DataTable.php:654-691` |
| `parent_id`, `lft`, `rgt`, `depth` + lima indeks pada model **non-tree** | Hanya `app()->isLocal()` | `DataTable.php:718-734` |

`app()->isLocal()` bernilai benar bila `APP_ENV=local`. Seeder berjalan pada setiap deploy (Bagian 1.1) dan pada pengembangan lokal (`db:seed`). Akibatnya: pemeriksaan `have_transactions` pada model submitable **dijalankan pada setiap deploy staging/produksi** dan kolom dihapus bila masih ada (penghapusan efektif hanya sekali, selanjutnya no-op); dua penghapusan lainnya hanya terjadi pada mesin ber-`APP_ENV=local`, tetapi di sana dapat **menghapus kolom yang dideklarasikan eksplisit di migration** apabila namanya sama dengan kolom di atas dan model tidak memiliki flag yang bersangkutan.

**Catatan asumsi.** Kesimpulan bahwa di staging/produksi hanya `have_transactions` pada model submitable yang dihapus mengandaikan `APP_ENV` di sana bukan `local`. Hal itu tidak terlihat dari repo; dikonfirmasi pada Task 6.5 (baris terakhir tabel Bagian 1.5.2).

Risiko bagi model jurnal baru (Fase 1):

1. **Divergensi antar lingkungan.** Bila tabel jurnal non-submitable memakai nama kolom `submitted_at`, `canceled_at`, `revision_number`, `amended_from_id`, `additional_data`, atau `submitted_format` (nama yang wajar untuk jurnal), kolom itu akan dihapus di lokal tetapi bertahan di staging/produksi. Test lokal dan kode lokal menjadi tidak mewakili produksi.
2. **Kolom bernama `parent_id`, `lft`, `rgt`, `depth`** pada model non-tree (mis. `journal_lines` bila memodelkan hierarki) dihapus di lokal dengan cara yang sama.
3. **Kolom `have_transactions`** pada model submitable dihapus **di semua lingkungan**, termasuk produksi: pemeriksaan berjalan pada setiap deploy (seeder berjalan otomatis di sana) dan kolom dihapus bila ada.
4. **Kolom yang tidak dideklarasikan** (`is_example`, `code`, `have_transactions` untuk non-submitable) akan muncul belakangan di tabel jurnal baru dan membuat skema aktual berbeda dari migration; `HasExampleData` mengabaikan scope bila `is_example` belum ada sehingga perilaku query berubah setelah seeder dijalankan.
5. **Penambahan NOT NULL pada tabel terisi** (Bagian 1.2) dapat gagal.
6. **Penimpaan `FormatingSeries` di lokal** (`DataTable.php:584-589`): `name` dan `format` series ditimpa dari `$defaultFormatCode`; di non-lokal hanya `logs` yang diperbarui.

### 1.4 Kesimpulan konvensi (Req 6.4)

**Setiap kolom pada tabel baru Finance wajib dideklarasikan eksplisit di migration; jangan bergantung pada `initPermissions()`.** Rincian aturan untuk spec Fase 1 dan seterusnya:

1. Deklarasikan di migration: `is_example` (boolean default `false` + indeks), `code` bila model memakai kode series (string unique), `have_transactions` untuk model non-submitable, dan seluruh kolom Submitable bila model submitable. Dengan begitu `initPermissions()` menjadi no-op untuk tabel itu (setiap penambahan dijaga `hasColumn`).
2. **Jangan memberi nama kolom bisnis** `submitted_at`, `canceled_at`, `revision_number`, `amended_from_id`, `additional_data`, `submitted_format`, `parent_id`, `lft`, `rgt`, `depth` pada model yang bukan submitable/tree; gunakan nama lain (mis. `posted_at`, `reverses_journal_id`) atau pastikan flag model sesuai.
3. **Jangan memberi nama kolom bisnis `have_transactions`** pada model submitable.
4. Tambahkan test Fase 1 yang memanggil `initPermissions()` terhadap model jurnal baru dan memastikan skema sebelum dan sesudahnya identik (sudah disebut di PRD F-12).
5. Migration yang menambah kolom NOT NULL ke `general_ledgers` (mis. `journal_id`) harus nullable atau berdefault, karena tabel sudah berisi data.
6. Kode aplikasi tidak boleh memakai kolom yang hanya ada lewat `initPermissions()` pada tabel jurnal baru tanpa deklarasi migration.
7. **Konsekuensi bagi deploy Fase 1:** `migrate --force` berjalan sebelum `db:seed --force` dalam skrip deploy. Bila model jurnal baru memakai `DataTable` dan migration-nya tidak mendeklarasikan kolom yang dicakup Bagian 1.1, `initPermissions()` akan mengubah tabel jurnal baru itu pada **deploy pertamanya** (menambah `is_example`, `code`, `have_transactions`, dst.). Penghapusan di staging/produksi terbatas pada `have_transactions` pada model submitable, bila kolom itu ada; dua jalur penghapusan lain (kolom Submitable pada model non-submitable, kolom tree pada model non-tree) dibatasi `app()->isLocal()` dan tidak berlaku di sana. Pada tabel yang sudah terisi (mis. setelah backfill di dalam migration), penambahan kolom NOT NULL berisiko gagal (Bagian 1.2). Karena itu deklarasi eksplisit di migration bukan sekadar kerapian, melainkan syarat agar deploy pertama tidak mengubah skema yang sudah diuji.

### 1.5 Skema `accounts` dan `general_ledgers` (Req 6.2)

#### 1.5.1 Menurut migration (dibaca dari berkas)

Tipe di kolom "Tipe MySQL yang diharapkan" adalah terjemahan standar Laravel 12 untuk MySQL, **belum diverifikasi** terhadap DB aktual.

**`accounts`** (`2025_08_29_093841_create_accounts_table.php`; tidak ada migration lain yang mengubah tabel ini)

| Kolom | Definisi migration | Tipe MySQL yang diharapkan |
|---|---|---|
| `id` | `ulid`, primary | `char(26)` PK |
| `account_name` | `string` | `varchar(255) NOT NULL` |
| `account_number` | `string` (tanpa indeks unik) | `varchar(255) NOT NULL` |
| `is_group` | `boolean` default `false` | `tinyint(1) NOT NULL` |
| `root_type` | `string` | `varchar(255) NOT NULL` |
| `report_type` | `string` | `varchar(255) NOT NULL` |
| `balance_type` | `string` nullable | `varchar(255) NULL` |
| `account_type` | `string` nullable | `varchar(255) NULL` |
| `currency_code` | `string` nullable, FK `currencies.code`, `nullOnDelete` | `varchar(255) NULL` + FK |
| `tax_rate` | `double` default 0 | `double NOT NULL` |
| `is_disabled` | `boolean` default `false` | `tinyint(1) NOT NULL` |
| `balance_amount` | `double` default 0 | `double NOT NULL` |
| `is_contra` | `boolean` default `false` | `tinyint(1) NOT NULL` |
| `deleted_at`, `created_at`, `updated_at` | `softDeletes`, `timestamps` | `timestamp NULL` |

Indeks menurut migration: PK `id`; indeks FK otomatis untuk `currency_code`. **Tidak ada** indeks pada `account_number`, `root_type`, atau `account_type`. Kolom runtime (bukan migration): lihat Bagian 1.2.

**`general_ledgers`** (`2025_10_26_064210_create_general_ledgers_table.php` dan `2026_08_09_084201_add_transaction_date_to_general_ledgers_table.php`)

| Kolom | Definisi migration | Tipe MySQL yang diharapkan |
|---|---|---|
| `id` | `ulid`, primary | `char(26)` PK |
| `referenceable_type`, `referenceable_id` | `ulidMorphs('referenceable', 'referenceable_index')` | `varchar(255) NOT NULL`, `char(26) NOT NULL`; indeks `referenceable_index` (`referenceable_type`,`referenceable_id`) |
| `account_id` | `foreignUlid`, FK `accounts.id`, **`cascadeOnDelete`** | `char(26) NOT NULL` + FK |
| `against_account_id` | `foreignUlid`, FK `accounts.id`, **`cascadeOnDelete`**, **NOT NULL** | `char(26) NOT NULL` + FK |
| `branch_id` | `foreignUlid` nullable, FK `branches.id`, `nullOnDelete` | `char(26) NULL` + FK |
| `partyable_type`, `partyable_id` | `nullableUlidMorphs('partyable', 'partyable_index')` | nullable; indeks `partyable_index` |
| `debit`, `credit` | `double` default 0 | `double NOT NULL` |
| `transaction_date` | `dateTime`, ditambahkan setelah `credit`, diisi dari `created_at`, lalu NOT NULL | `datetime NOT NULL` (tanpa pecahan detik) |
| `description` | `text` nullable | `text NULL` |
| `created_at`, `updated_at`, `deleted_at` | `timestamps`, `softDeletes` | `timestamp NULL` |

Indeks menurut migration: PK, `referenceable_index`, `partyable_index`, dan indeks FK otomatis untuk `account_id`, `against_account_id`, `branch_id`. **Tidak ada** indeks pada `transaction_date` atau `deleted_at`. Konsekuensi untuk auditor: pengelompokan per (`referenceable_type`, `referenceable_id`, `transaction_date`) hanya dapat memanfaatkan prefiks `referenceable_index`; query berat sebaiknya dijalankan di luar jam sibuk atau lewat `--connection` replika baca (Req 8.1).

FK **masuk** ke `general_ledgers` yang terbaca dari migration: `assets.journal_entry_for_scrap_id` -> `general_ledgers.id`, `nullOnDelete` (`2026_08_08_000004_create_assets_table.php:68`; kolomnya nullable). Menghapus baris GL (mis. oleh `ON DELETE CASCADE` dari akun) karenanya mengosongkan rujukan scrap pada aset. Banyak tabel lain merujuk `accounts` (mis. `payment_entries.account_paid_to_id` dan `account_paid_from_id` dengan `restrictOnDelete`); daftar lengkap diambil dengan query 4 pada Bagian 1.5.2.

Kolom runtime (bukan migration): lihat Bagian 1.2.

#### 1.5.2 **MENUNGGU Task 6.5 (staging)**: skema aktual dan selisihnya

Bagian ini **belum terisi**. Jalankan query read-only berikut di DB staging (pelaksana: pemilik produk, Q-P0-1 dijawab 2026-11-03). Semua query hanya `SELECT`/`SHOW`; memakai `DATABASE()` agar nama skema tidak ditulis di sini. **Jangan menjalankan `db:seed`, `PermissionSeeder`, `migrate`, atau `tinker`** sebagai bagian Task 6.5; hanya query di bawah ini dan dua perintah `finance:*` pada Bagian 2.1 (deploy sudah menjalankan seeder sendiri).

```sql
-- 1. Definisi lengkap
SHOW CREATE TABLE accounts;
SHOW CREATE TABLE general_ledgers;

-- 2. Kolom (tipe, nullable, default, kolom generated)
SELECT TABLE_NAME, ORDINAL_POSITION, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE,
       COLUMN_DEFAULT, EXTRA, COLUMN_KEY, GENERATION_EXPRESSION
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('accounts', 'general_ledgers')
ORDER BY TABLE_NAME, ORDINAL_POSITION;

-- 3. Indeks
SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME, INDEX_TYPE
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('accounts', 'general_ledgers')
ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;

-- 4. Foreign key beserta aturan hapus/ubah (tabel itu sendiri dan tabel yang merujuknya)
SELECT k.TABLE_NAME, k.CONSTRAINT_NAME, k.COLUMN_NAME,
       k.REFERENCED_TABLE_NAME, k.REFERENCED_COLUMN_NAME, r.UPDATE_RULE, r.DELETE_RULE
FROM information_schema.KEY_COLUMN_USAGE k
JOIN information_schema.REFERENTIAL_CONSTRAINTS r
  ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA
 AND r.TABLE_NAME = k.TABLE_NAME
 AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
WHERE k.TABLE_SCHEMA = DATABASE()
  AND k.REFERENCED_TABLE_NAME IS NOT NULL
  AND (k.TABLE_NAME IN ('accounts', 'general_ledgers')
       OR k.REFERENCED_TABLE_NAME IN ('accounts', 'general_ledgers'))
ORDER BY k.TABLE_NAME, k.CONSTRAINT_NAME;

-- 5. Ukuran dan mesin tabel; migration yang tercatat sudah dijalankan.
--    TABLE_ROWS pada InnoDB hanya PERKIRAAN; angka pasti jumlah baris GL aktif ada di
--    `totals.rows` keluaran finance:audit-gl, dan jumlah akun ada di CSV baseline.
SELECT TABLE_NAME, ENGINE, TABLE_ROWS, DATA_LENGTH, INDEX_LENGTH, TABLE_COLLATION
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('accounts', 'general_ledgers');

SELECT migration, batch FROM migrations
WHERE migration LIKE '%accounts%' OR migration LIKE '%general_ledgers%'
ORDER BY id;

-- 6. Versi server (pengaruh pada perilaku DDL dan kolom generated)
SELECT VERSION();
```

Tabel hasil, **MENUNGGU Task 6.5 (staging)**. Kolom "Asal" memakai: **M** = ada di migration, **R** = hanya dari `initPermissions()` (diharapkan, bukan *drift*), **?** = tidak ada di keduanya (*drift* sungguhan yang perlu diselidiki).

| Objek | Asal yang diharapkan | Menurut migration | Aktual staging | Selisih / catatan |
|---|---|---|---|---|
| `general_ledgers.is_example` (+ indeks) | R | tidak ada | MENUNGGU | MENUNGGU |
| `general_ledgers.code` (NOT NULL, unique) | R | tidak ada | MENUNGGU | MENUNGGU |
| `general_ledgers.have_transactions` | R | tidak ada | MENUNGGU | MENUNGGU |
| `general_ledgers.transaction_date` | M | `datetime NOT NULL` | MENUNGGU | MENUNGGU |
| `general_ledgers.against_account_id` | M | `char(26) NOT NULL` | MENUNGGU | MENUNGGU |
| FK `account_id` dan `against_account_id`: `DELETE_RULE` | M | `CASCADE` (PRD F-02) | MENUNGGU | MENUNGGU |
| FK masuk `assets.journal_entry_for_scrap_id` -> `general_ledgers.id`: `DELETE_RULE` | M | `SET NULL` | MENUNGGU | MENUNGGU |
| Indeks `transaction_date` / `deleted_at` | tidak ada | tidak ada | MENUNGGU | MENUNGGU |
| `accounts.is_example` (+ indeks) | R | tidak ada | MENUNGGU | MENUNGGU |
| `accounts.have_transactions` | R | tidak ada | MENUNGGU | MENUNGGU |
| `accounts.parent_id` (self-FK) | R | tidak ada | MENUNGGU | MENUNGGU |
| `accounts.lft`, `rgt`, `depth` | R | tidak ada | MENUNGGU | MENUNGGU |
| Indeks `lft_index`, `rgt_index`, `depth_index`, `idx_depth_lft`, `idx_parent_lft` | R | tidak ada | MENUNGGU | MENUNGGU |
| `accounts.is_contra` | M | `tinyint(1) NOT NULL` | MENUNGGU | MENUNGGU (dihapus pada Fase 2 Task 14.2, D-26) |
| Kolom lain yang ada di DB tetapi tidak di migration maupun `initPermissions()` | ? | tidak ada | MENUNGGU | MENUNGGU |
| Jumlah baris, ukuran data dan indeks, mesin, kolasi | — | — | MENUNGGU | MENUNGGU |
| Versi server DB | — | — | MENUNGGU | MENUNGGU |
| **Konfirmasi `APP_ENV` staging/produksi ≠ `local`** (kesimpulan Bagian 1.3 bahwa hanya `have_transactions` pada model submitable yang dihapus di sana mengandaikan ini; `APP_ENV` tidak terlihat dari repo; jangan menyalin nilai `.env` lain ke laporan, cukup catat "≠ local" atau "local") | — | — | MENUNGGU | MENUNGGU |

---

## 2. Hasil `finance:audit-gl` dan `finance:snapshot-balances` (Requirement 7.1)

**Status: MENUNGGU Task 6.5.** Tidak ada angka di bagian ini. Hasil `finance:audit-gl` **tidak** berasal dari DB lokal: DB lokal tidak dapat dijangkau pada sesi penyusunan draft ini, dan data lokal tidak mewakili staging maupun produksi.

### 2.1 Perintah yang dijalankan (Task 6.5)

Kedua perintah read-only (`SELECT` saja). Jalankan di luar jam sibuk; gunakan `--connection=<replika baca>` bila tersedia. Simpan keluaran di `storage/app/finance-audit/` dan **jangan di-commit**.

> **Larangan untuk pelaksana Task 6.5.** Jangan menjalankan `db:seed`, `PermissionSeeder`, `migrate`, atau `tinker` di staging/produksi sebagai bagian Task 6.5. Yang dijalankan hanyalah dua perintah `finance:*` di bawah ini dan query `SELECT`/`SHOW` yang tercantum di dokumen ini. (Deploy sendiri sudah menjalankan `db:seed --force`, lihat Bagian 1.1; Task 6.5 tidak perlu dan tidak boleh menambahnya.)

**Penanganan berkas hasil.** Berkas JSON dan CSV memuat data keuangan internal (ID dokumen, nominal, nama dan saldo akun). Kirim hanya lewat kanal internal yang terbatas; jangan diunggah ke tiket publik atau chat umum; hapus dari server setelah diserahkan kepada penerima. Berkas tidak dimaksudkan memuat data pribadi, tetapi tetap diperlakukan sebagai rahasia.

```bash
# Audit integritas GL + matriks cakupan dokumen -> JSON (limit contoh per kategori default 20)
php artisan finance:audit-gl --limit=50 --json=storage/app/finance-audit/audit-staging-<tanggal>.json

# Baseline saldo per akun -> CSV
php artisan finance:snapshot-balances --path=storage/app/finance-audit/baseline-staging-<tanggal>.csv
```

Catatan opsi: `--json=<berkas>.json` menulis ke berkas itu; `--json=<folder>` atau `--json` tanpa nilai menulis `audit-<Ymd-His>.json` ke folder tersebut (default `storage/app/finance-audit/`). Tanpa opsi `--json`, hanya tabel konsol yang dicetak. Pelaksana mencatat tanggal/jam run, lingkungan, dan koneksi yang dipakai.

Slot hasil dipisah per lingkungan: **Staging** (wajib) dan **Produksi** tidak diperlukan: belum ada data sama sekali (GL produksi kosong) (Q1 dijawab 2026-11-03).

### 2.2 Field JSON yang dibaca per kategori anomali

Struktur: `AuditReport::toArray()` → `generated_at`, `totals`, `sections`, `coverage` (`app/Services/Finances/Audit/AuditReport.php`). Satuan hitungan berbeda antar kategori; baca sesuai kolom "Satuan".

| Req | Kategori | Field JSON | Satuan | Staging | Produksi |
|---|---|---|---|---|---|
| 1.3 | Jumlah baris GL aktif | `totals.rows` | baris | MENUNGGU | tidak diperlukan (Q1) |
| 1.3 | Baris GL soft-deleted | `totals.rows_soft_deleted` | baris | MENUNGGU | tidak diperlukan (Q1) |
| 1.3 | Jumlah kelompok posting (aktif) | `totals.groups` | kelompok (`referenceable_type`, `referenceable_id`, `transaction_date`) | MENUNGGU | tidak diperlukan (Q1) |
| 1.3 | Rentang `transaction_date` | `totals.date_min`, `totals.date_max` | tanggal | MENUNGGU | tidak diperlukan (Q1) |
| 1.3 | Σdebit, Σkredit, selisih | `totals.sum_debit`, `totals.sum_credit`, `totals.diff` | nominal (4 desimal) | MENUNGGU | tidak diperlukan (Q1) |
| 1.2.1 | Kelompok tak seimbang | `sections.unbalanced_groups.count`, `.total_diff`, `.samples[]` (`referenceable_type`, `referenceable_id`, `transaction_date`, `line_count`, `sum_debit`, `sum_credit`, `diff`) | kelompok; `total_diff` = Σ\|selisih\| per kelompok | MENUNGGU | tidak diperlukan (Q1) |
| 1.2.2 | Debit dan kredit sama-sama nol, atau salah satunya negatif | `sections.zero_or_negative.count`, `.samples[]` | baris | MENUNGGU | tidak diperlukan (Q1) |
| 1.2.3a | Soft-delete **diharapkan** (dokumen sumber `canceled`) | `sections.soft_deleted_expected.count` | baris | MENUNGGU | tidak diperlukan (Q1) |
| 1.2.3b | Soft-delete **anomali** (dokumen tidak `canceled`, tidak ditemukan, atau jenis tanpa kolom `status`) | `sections.soft_deleted_unexpected.count` | baris | MENUNGGU | tidak diperlukan (Q1) |
| 1.2.4 | Akun hilang atau soft-deleted | `sections.dangling_account.count` | baris; **baris yang kedua kolomnya (`account_id` dan `against_account_id`) bermasalah terhitung dua kali** | MENUNGGU | tidak diperlukan (Q1) |
| 1.2.5 | `referenceable` tidak ditemukan | `sections.orphan_reference.count` (catatan `tipe tidak dikenal` pada contoh) | baris | MENUNGGU | tidak diperlukan (Q1) |
| 1.2.6 | Dokumen `canceled` dengan GL aktif (F-16) | `sections.canceled_active_gl.count` | **dokumen** | MENUNGGU | tidak diperlukan (Q1) |
| 1.2.7 | Duplikasi posting | `sections.duplicates.count`, `.extra_rows` | kelompok kombinasi duplikat; baris berlebih | MENUNGGU | tidak diperlukan (Q1) |

Catatan pembacaan:

- Seluruh kategori selain `rows_soft_deleted` dan `soft_deleted_*` menghitung **baris aktif** (`deleted_at IS NULL`) saja.
- `soft_deleted_unexpected` memasukkan seluruh baris soft-deleted milik jenis dokumen yang tidak punya kolom `status` (mis. jadwal depresiasi aset) karena status `canceled` tidak dapat diperiksa (`ReferenceChecks.php:29-37`). Angka pada jenis itu dibaca sebagai "tidak dapat dikategorikan".
- `orphan_reference` dan kategori lain memakai `referenceable_type` sebagai nama kelas; tipe yang kelasnya tidak ada dihitung yatim dengan catatan `tipe tidak dikenal`.

### 2.3 Batasan metode audit yang perlu diketahui pembaca hasil

1. **Data contoh ikut terhitung.** Auditor memakai query builder (`DB::table`), sehingga scope `exclude_example_data` (`is_example = false`) pada Eloquent **tidak berlaku**. Baris GL berstatus `is_example = 1` (bila ada) ikut dihitung. Periksa dengan query berikut (jalankan hanya bila kolom `is_example` ada di `general_ledgers`, lihat Bagian 1.5.2):

   ```sql
   SELECT is_example, COUNT(*) AS jumlah_baris FROM general_ledgers GROUP BY is_example;
   ```

2. **JSON tidak memuat rincian per jenis dokumen untuk kelompok tak seimbang**, hanya total dan contoh sebanyak `--limit`. Rincian per jenis diambil dengan query pada Bagian 4.3.
3. **Pengelompokan memakai `transaction_date` penuh (datetime), bukan tanggal.** Lihat Bagian 3.7 dan 4.3.
4. **F-10 dan F-11 tidak terdeteksi** oleh kategori mana pun karena jurnalnya seimbang (Bagian 4.2).

### 2.4 Matriks cakupan dokumen (Req 2): `coverage[]`

**MENUNGGU Task 6.5.** Satu baris per jenis dokumen (`DocumentCoverageMatrix::DOCUMENT_TYPES`). Field JSON: `type`, `available`, `approved`, `canceled`, `with_gl`, `canceled_gl_softdeleted`, `canceled_active_gl`, `tracked`, `posting_not_posted`, `posting_missing`.

| `type` | `tracked` (desain) | `approved` | `canceled` | `with_gl` | `canceled_gl_softdeleted` | `canceled_active_gl` | `posting_not_posted` | `posting_missing` |
|---|---|---|---|---|---|---|---|---|
| `sales_invoice` | ya | MENUNGGU | MENUNGGU | MENUNGGU | MENUNGGU | MENUNGGU | MENUNGGU | MENUNGGU |
| `purchase_invoice` | ya | MENUNGGU | MENUNGGU | MENUNGGU | MENUNGGU | MENUNGGU | MENUNGGU | MENUNGGU |
| `purchase_receipt` | ya | MENUNGGU | MENUNGGU | MENUNGGU | MENUNGGU | MENUNGGU | MENUNGGU | MENUNGGU |
| `delivery_note` | ya | MENUNGGU | MENUNGGU | MENUNGGU | MENUNGGU | MENUNGGU | MENUNGGU | MENUNGGU |
| `payment_entry` | **tidak dilacak** | MENUNGGU | MENUNGGU | MENUNGGU | MENUNGGU | MENUNGGU | (kosong) | (kosong) |
| `stock_entry` | **tidak dilacak** | MENUNGGU | MENUNGGU | MENUNGGU | MENUNGGU | MENUNGGU | (kosong) | (kosong) |
| `asset_depreciation_schedule` | ya | (tanpa kolom `status`: null) | (null) | MENUNGGU | 0 (selalu 0) | 0 (selalu 0) | MENUNGGU | MENUNGGU |
| `asset_value_adjustment` | ya | MENUNGGU | MENUNGGU | MENUNGGU | MENUNGGU | MENUNGGU | MENUNGGU | MENUNGGU |
| `asset` | ya | MENUNGGU | MENUNGGU | MENUNGGU | MENUNGGU | MENUNGGU | MENUNGGU | MENUNGGU |

Catatan pembacaan matriks:

- `payment_entry` dan `stock_entry` dilaporkan "tidak dilacak", **bukan anomali** (Req 2.3).
- Baris **`asset`** kemungkinan tampak tidak lengkap secara palsu: aset berstatus `active`, bukan `approved` (fixture `tests/Support/BuildsAssetFixtures.php:29` memakai status `[ACTIVE]`), sehingga kolom `approved` dan `posting_*` bermakna terbatas; dan `GlPostingStatus` untuk disposal aset dikaitkan ke **`SalesInvoiceItem`**, bukan ke `Asset` (`PostAssetDisposalGainLoss.php:96-101`), sehingga `posting_missing` pada baris `asset` tidak otomatis berarti kegagalan posting. **Belum diverifikasi terhadap data**; pembaca hasil perlu memperlakukan baris ini dengan hati-hati.
- Dokumen yang di-soft-delete tetap dihitung (tabel dokumen dibaca apa adanya).

### 2.5 Baseline saldo (`finance:snapshot-balances`)

**MENUNGGU Task 6.5.** Kolom CSV: `account_id`, `account_number`, `account_name`, `root_type`, `balance_type`, `sum_debit`, `sum_credit`, `net`, `balance_amount`, `difference`, `note`. Rumus terkunci: `net = Σdebit − Σkredit` (baris aktif), `difference = net − balance_amount`.

| Ringkasan yang diambil dari CSV | Staging | Produksi |
|---|---|---|
| Jumlah akun (baris CSV), termasuk akun tanpa transaksi dan akun soft-deleted | MENUNGGU | tidak diperlukan (Q1) |
| Jumlah akun dengan `difference` ≠ 0 (toleransi 0,005) | MENUNGGU | tidak diperlukan (Q1) |
| Σ `difference` seluruh akun | MENUNGGU | tidak diperlukan (Q1) |
| Jumlah akun dengan `note` `balance_type kosong` / `akun soft-deleted` | MENUNGGU | tidak diperlukan (Q1) |
| Konfirmasi konvensi tanda `balance_amount` terhadap data nyata (debit − kredit untuk semua akun; design.md bagian 4 (Task 3.1) belum diverifikasi terhadap data staging) | MENUNGGU | tidak diperlukan (Q1) |

---

## 3. Hasil known-issue test dan temuan baru (Requirement 7.3)

Semua test berada di `tests/Feature/Finances/Characterization/` dan menegaskan perilaku **aktual** (grup `known-issue`). Tidak ada perbaikan di fase ini (Requirement 5.7). Untuk tiap temuan, kolom keputusan pemilik produk berisi **MENUNGGU**.

Ringkasan:

| ID | Temuan singkat | Status bukti | Usulan penanganan |
|---|---|---|---|
| F-04 | Cancel men-soft-delete GL/SLE, tanpa jurnal pembalik; saldo cache dan `paid_amount` tidak dikoreksi | Terkonfirmasi (test) | Fase 2 (reversal, D-13); `paid_amount` pembayaran dibatalkan: kandidat hotfix |
| F-10 | GL pembayaran parsial ke-2 dst. memposting total kumulatif | Terkonfirmasi (test) | **Hotfix terpisah** (sebelum backfill Fase 1); koreksi data historis diputuskan terpisah |
| F-11 (FX) | GL pembayaran memposting jumlah mata uang dokumen, bukan dasar; tanpa selisih kurs | Terkonfirmasi (test) | Fase 4 (D-16, D-17); hotfix hanya bila data staging menunjukkan pembayaran FX nyata |
| F-16 | Cancel sebelum job posting → GL aktif untuk dokumen `canceled` | Terkonfirmasi (test) | Fase 2 (FR-P3); hotfix guard bila audit menemukan kasus nyata |
| N-1 | Tanda laba/rugi disposal aset tampak terbalik; jurnal disposal tidak menghapus nilai buku | Terbaca dari kode + test karakterisasi | Tinjau akuntan sebelum Fase 2 (Asset); koreksi dalam Fase 2 |
| N-2 | Purchase Invoice tanpa PO gagal `TypeError` di `onApproved` | Dibaca dari kode; **belum diuji** sebagai kegagalan | Hotfix kecil atau Fase 2 setelah ukuran paparan diketahui |
| N-3 | Baris satu dokumen dapat terpecah lintas detik (`now()` per baris) | Dibaca dari kode; **belum diukur** | Ukur di staging; tentukan granularitas D-8 sebelum Fase 1 |

### 3.1 F-04: pembatalan men-soft-delete GL dan SLE

**Bukti test.** `KnownIssues/CancelSoftDeletesLedgerTest` (tiga test):

- `test_f04_cancel_sales_invoice_soft_deletes_ledger_and_leaves_posting_status_posted`: dua baris GL tetap ada tetapi seluruhnya soft-deleted (tidak ada jurnal pembalik); query standar melihat 0 baris; `GlPostingStatus` tetap `posted`.
- `test_f04_cancel_payment_entry_soft_deletes_ledger_but_does_not_restore_invoice_paid_amount`: GL pembayaran di-soft-delete; `paid_amount` faktur **tidak dikembalikan** (tetap 1.000.000) dan status faktur tetap `paid`.
- `test_f04_cancel_stock_entry_soft_deletes_gl_and_sle_but_keeps_cached_account_balances`: GL dan SLE di-soft-delete; `accounts.balance_amount` (+10.000 / −10.000) **tidak dikoreksi**, sehingga snapshot baseline menampilkan `difference` −10.000 pada akun persediaan.

**Mekanisme.** Hook `saving` pada trait `Submitable` meng-`update(['deleted_at' => now()])` massal untuk GL dan SLE dokumen yang statusnya baru berubah ke `canceled` (`app/Traits/Submitable.php:98-106`). `cancel()` pada service hanya mengubah status (`PaymentEntryService.php:159-167`; `SalesInvoiceService::cancel` di baris 604; `StockEntryService::cancel` di baris 684).

**Dampak.**
- Riwayat ledger hilang dari laporan standar; periode lampau dapat berubah diam-diam (tidak ada pembalik yang diposting di periode terbuka).
- Pembatalan Payment Entry meninggalkan faktur tampak lunas: `paid_amount` dan status tidak dikembalikan (dampak langsung ke AR/AP, terlihat pengguna hari ini).
- Pembatalan Stock Entry membuat `balance_amount` menyimpang dari GL aktif (F-09).
- Update massal lewat Eloquent builder (`GeneralLedger::where(...)->update(...)`) tetap melewati event model, sehingga guard immutability di level model (D-7) tidak akan menangkapnya; perbaikannya harus mengganti hook, bukan hanya menambah guard.
- **Belum diuji:** karena update itu melalui Eloquent builder, global scope `SoftDeletes` dan `exclude_example_data` tetap berlaku pada query-nya. Akibatnya baris GL berstatus `is_example = 1` kemungkinan **tidak ikut di-soft-delete** saat dokumen dibatalkan (bila kolom `is_example` ada), dan baris yang sudah soft-deleted tidak disentuh ulang.

**Usulan penanganan.**
- *Bagian GL (soft-delete → reversal):* **Fase 2**, per D-13 (PENDING). Alasan: mengubah perilaku yang terlihat pengguna dan membutuhkan jurnal pembalik dari Fase 1.
- *Bagian `paid_amount` saat Payment Entry dibatalkan:* **kandidat hotfix terpisah**. Alasan: bug AR/AP yang nyata dan lokal pada satu alur, tidak bergantung pada jurnal baru. Perlu keputusan apakah dikerjakan sebelum Fase 2.
- *Bagian `balance_amount`:* **Fase 2**/**Fase 5** (saldo cache dipensiunkan sebagai sumber, FR-R2).

Bentuk usulan diizinkan (DV-C, 2026-11-03); keputusan penanganan tetap menunggu.

**Keputusan pemilik produk: MENUNGGU.**

### 3.2 F-10: pembayaran parsial memposting total kumulatif

**Bukti test.** `KnownIssues/PartialPaymentPostsCumulativeAmountTest::test_f10_second_partial_payment_posts_cumulative_amount_instead_of_its_own`: pembayaran 400.000 lalu 300.000 atas satu faktur 1.000.000. GL pembayaran pertama memposting 400.000 (benar); GL pembayaran kedua memposting **700.000**, bukan 300.000. Total debit kas 1.100.000 untuk pembayaran total 700.000. `paid_amount` faktur benar (700.000); hanya GL yang berlebih.

**Mekanisme.** `PaymentEntryService::onApproved` men-dispatch `PaymentApplied` (baris 109) yang membuat listener `UpdatePaymentableStatus` mengisi `paymentable->paid_amount = newPaidAmount` (kumulatif); kemudian GL diposting dari `$paymentable->paid_amount` (baris 122–139), bukan dari `$paymentEntry->paid_amount`.

**Dampak.**
- Setiap pembayaran ke-2 dan seterusnya atas dokumen yang sama memposting nominal berlebih ke akun kas dan piutang/utang, dengan besar kelebihan sama dengan total pembayaran sebelumnya.
- Kedua sisi jurnal sama-sama berlebih, sehingga jurnal **tetap seimbang** dan **tidak terdeteksi** oleh pemeriksaan keseimbangan `finance:audit-gl` (Bagian 4.2). Saldo kas/piutang di laporan GL melenceng dari subledger faktur.
- Karena Payment Entry masih 1:1 ke dokumen (F-11), perilaku ini berlaku untuk semua pembayaran bertahap.

**Ukuran paparan (read-only, staging).** Query ini membandingkan nominal GL tiap Payment Entry dengan `paid_amount`-nya; baris dengan selisih ≠ 0 terdampak. Pada literal string MySQL, `'\\'` dibaca sebagai satu karakter `\` selama `sql_mode` tidak memuat `NO_BACKSLASH_ESCAPES`; bila mode itu aktif, tulis satu `\` per pemisah namespace.

```sql
SELECT COUNT(*) AS jumlah_payment_terdampak,
       ROUND(SUM(g.gl_debit - pe.paid_amount), 4) AS total_kelebihan_gl
FROM payment_entries pe
JOIN (
  SELECT referenceable_id, SUM(debit) AS gl_debit
  FROM general_ledgers
  WHERE referenceable_type = 'App\\Models\\Finances\\PaymentEntry' AND deleted_at IS NULL
  GROUP BY referenceable_id
) g ON g.referenceable_id = pe.id
WHERE ABS(g.gl_debit - pe.paid_amount) > 0.005;
```

| Hasil | Staging | Produksi |
|---|---|---|
| `jumlah_payment_terdampak`, `total_kelebihan_gl` | MENUNGGU Task 6.5 | tidak diperlukan (Q1) |

**Usulan penanganan: hotfix terpisah, dikerjakan sebelum backfill Fase 1.** Alasan: (1) perbaikan kecil dan terlokalisasi (memposting jumlah pembayaran ini, bukan jumlah kumulatif); (2) bila tidak diperbaiki, backfill D-8 akan membawa nilai salah ke jurnal baru sebagai jurnal "seimbang"; (3) Fase 4 akan mengganti model alokasi pembayaran sehingga menunggu Fase 4 berarti membiarkan GL baru terus salah. **Koreksi data historis** (jurnal penyesuaian atas selisih yang sudah terposting) adalah keputusan akuntansi terpisah dan memerlukan jurnal manual (D-14).

**Keputusan pemilik produk: MENUNGGU.**

### 3.3 F-11 (bagian FX): GL pembayaran mengabaikan kurs

**Bukti test.** `KnownIssues/ForeignCurrencyPaymentPostingTest::test_f11_foreign_currency_payment_posts_document_currency_amount_ignoring_exchange_rate`: pembayaran 100 pada kurs 15.000 (`base_paid_amount` 1.500.000) menghasilkan dua baris GL bernilai **100** (mata uang dokumen), bukan 1.500.000 (dasar); tidak ada baris selisih kurs; nilai dasar tersimpan di dokumen tetapi tidak sampai ke GL.

**Mekanisme.** `PaymentEntryService::onApproved` memposting `$paymentable->paid_amount` tanpa memakai `exchange_rate` atau `base_paid_amount` (baris 122–139).

**Dampak.** Untuk dokumen bermata uang asing, GL memuat nominal mata uang asing dalam buku bermata uang dasar. Tidak ada realized FX gain/loss. Laporan keuangan (Fase 5) akan salah pada akun terkait bila pembayaran asing dalam volume berarti. Catatan kolom: `payment_entries.exchange_rate` berdefault **0**, bukan 1 (`create_payment_entries_table.php`), sehingga penyaringan paparan harus mengecualikan 0 dan 1.

**Ukuran paparan (read-only, staging).** Dibatasi pada pembayaran yang belum dibatalkan dan memiliki GL aktif. Penulisan garis miring terbalik ganda mengikuti catatan `sql_mode` pada Bagian 3.2.

```sql
SELECT COUNT(*) AS jumlah_payment_asing, SUM(paid_amount) AS total_paid_mata_uang_dokumen,
       SUM(base_paid_amount) AS total_paid_dasar
FROM payment_entries
WHERE deleted_at IS NULL
  AND currency_code IS NOT NULL AND base_currency_code IS NOT NULL
  AND currency_code <> base_currency_code
  AND exchange_rate NOT IN (0, 1)
  AND COALESCE(JSON_CONTAINS(status, '"canceled"'), 0) = 0
  AND EXISTS (
    SELECT 1 FROM general_ledgers gl
    WHERE gl.referenceable_type = 'App\\Models\\Finances\\PaymentEntry'
      AND gl.referenceable_id = payment_entries.id
      AND gl.deleted_at IS NULL
  );
```

| Hasil | Staging | Produksi |
|---|---|---|
| `jumlah_payment_asing`, total | MENUNGGU Task 6.5 | tidak diperlukan (Q1) |

**Usulan penanganan: Fase 4**, bukan hotfix. *Bentuk usulan diizinkan (DV-C, 2026-11-03); keputusan penanganan tetap menunggu.* Alasan: perbaikan yang benar menyangkut kebijakan tipe kurs (D-16) dan pengakuan selisih kurs terealisasi (D-17), keduanya PENDING dan memerlukan akuntan; tambalan sepihak (mis. memposting `base_paid_amount`) berisiko tidak konsisten dengan jurnal invoice. **Pengecualian:** bila query di atas menemukan pembayaran valuta asing nyata di staging, atau produksi mulai menerima pembayaran valuta asing sebelum Fase 4, ajukan keputusan hotfix sementara atau peringatan operasional.

**Keputusan pemilik produk: MENUNGGU.**

### 3.4 F-16: cancel sebelum job posting dieksekusi

**Bukti test.** `KnownIssues/CancelBeforeQueuedPostingTest::test_f16_listener_running_after_cancel_posts_active_ledger_for_canceled_document`: listener ditahan dengan `Event::fake`, faktur dibatalkan, lalu listener asli (`PostSalesInvoiceGeneralLedger`) dijalankan dengan event yang dibuat sebelum pembatalan. Hasil: dokumen `canceled` memiliki **dua baris GL aktif** dan `GlPostingStatus` `posted`; `finance:audit-gl` melaporkan `canceled_active_gl.count = 1`. Test hanya mencakup Sales Invoice; jenis lain yang memakai listener queued serupa (Purchase Invoice, Receipt, Delivery Note, aset) **belum diuji**.

**Mekanisme.** Hook cancel (F-04, `Submitable.php:98-106`) hanya men-soft-delete baris GL yang sudah ada saat itu; listener queued tidak memeriksa status dokumen sebelum memposting (`PostSalesInvoiceGeneralLedger.php:22-51`).

**Dampak.** GL aktif untuk dokumen yang dibatalkan, tidak terdeteksi oleh pemilik dokumen; saldo akun menggelembung sampai ditemukan. Jendela waktu bergantung pada kelambatan queue (`tries=3`, `backoff` 10/30/60 detik juga memperlebar jendela saat percobaan ulang).

**Ukuran paparan:** hasil `sections.canceled_active_gl.count` dan `coverage[].canceled_active_gl` (Bagian 2).

| Hasil | Staging | Produksi |
|---|---|---|
| `canceled_active_gl.count` (dokumen) | MENUNGGU Task 6.5 | tidak diperlukan (Q1) |

**Usulan penanganan: Fase 2** (FR-P3: job posting yang menemukan dokumen `canceled` tidak memposting). **Hotfix guard** (periksa status dokumen di dalam transaksi listener) bila audit menemukan kasus nyata. Alasan: perbaikan kecil, tetapi baru bermakna bila disertai pembalik untuk kasus yang sudah terjadi (keputusan D-13).

**Keputusan pemilik produk: MENUNGGU.**

### 3.5 N-1 (baru, PR #271): tanda laba/rugi disposal aset tampak terbalik

**Bukti.** `AssetDisposalGainLossPostingTest` (docblock dan dua test pertama) dan `app/Listeners/Asset/Rental/PostAssetDisposalGainLoss.php:39-94`. Listener menghitung `gainLoss = harga − nilai buku`. Bila `gainLoss ≥ 0` (**laba**), listener **mengkredit akun aset tetap** dan **mendebit akun laba/rugi pelepasan**; bila rugi, sebaliknya (baris 58–94). Fixture test memberi akun laba/rugi tipe `income`/`credit`; mendebit akun pendapatan untuk sebuah laba mengurangi pendapatan, berlawanan dengan konvensi umum (laba pelepasan dikredit ke akun laba/rugi).

**Dampak (diverifikasi dari kode yang dibaca).**
1. Laba/rugi pelepasan pada akun laba/rugi tampil dengan tanda berlawanan terhadap konvensi umum.
2. Listener memposting **hanya selisih** (harga − nilai buku) terhadap akun aset tetap; **tidak ada baris yang menghapus biaya perolehan dan akumulasi penyusutan** dalam listener ini.
3. Sementara itu, invoice menyertakan baris aset dalam `totalAmount` (`SalesInvoiceService.php:299-340`: semua item, termasuk baris `asset_id`, dijumlahkan ke `$basicAmount`), sehingga `PostSalesInvoiceGeneralLedger` mengkredit akun pendapatan sebesar **harga penuh**. Jadi pendapatan penuh dan selisih laba/rugi sama-sama masuk; kelengkapan jurnal pelepasan perlu ditinjau akuntan. Pembacaan ini hanya dari kode; **belum ditelusuri** apakah ada jalur posting lain untuk penghapusan nilai buku.
4. Referensi GL adalah **Asset**, bukan invoice. Pembatalan Sales Invoice hanya men-soft-delete GL milik invoice (`Submitable.php:98-106`), sehingga **GL disposal tetap aktif** setelah invoice dibatalkan.
5. `transaction_date` = `now()` saat listener berjalan, bukan tanggal invoice.
6. Event `AssetSoldViaInvoice` juga di-dispatch pada baris retur (`SalesInvoiceService.php:321-328` tidak membedakan retur) sedangkan listener tidak membedakan retur: retur invoice aset **berpotensi memposting laba/rugi lagi** (**belum diuji**).

**Usulan penanganan.** Tinjau oleh akuntan **sebelum** Fase 2 memindahkan Asset ke engine (urutan migrasi PRD Bagian 11 menaruh Asset paling awal): bila parity test menyalin perilaku ini apa adanya, tanda yang salah terkunci dalam engine. Koreksi dikerjakan dalam Fase 2 sebagai bagian aturan posting Asset dengan pembalikan eksplisit ekspektasi test karakterisasi; koreksi data historis diputuskan terpisah. Tidak ada hotfix diusulkan sebelum akuntan mengonfirmasi desain yang dimaksud.

**Keputusan pemilik produk: MENUNGGU.**

### 3.6 N-2 (baru, PR #271): Purchase Invoice tanpa PO gagal `TypeError` saat `onApproved`

**Bukti.** Docblock dan komentar `setUp()` di `PurchaseInvoicePostingTest` (semua fixture memakai satu PO karena PI tanpa PO gagal `TypeError`). Diverifikasi dari kode: `PurchaseInvoiceService::onApproved` mengambil `$purchaseOrder = $purchaseInvoice->purchaseOrder` (baris 295; `purchase_invoices.purchase_order_id` bersifat `nullable`, `create_purchase_invoices_table.php:22`) lalu men-dispatch `new PurchaseOrderBillStatusRecalculationRequested($purchaseOrder, $returnAgainst)` (baris 372), sedangkan konstruktor event menuntut `PurchaseOrder` non-null (`app/Events/Purchase/Order/PurchaseOrderBillStatusRecalculationRequested.php:11-14`). Kegagalan itu sendiri **belum diuji** dalam test khusus; ia disimpulkan dari tipe konstruktor dan komentar test.

**Dampak (dari kode, belum diuji).**
1. `onApproved` dibungkus `try ... catch (\Exception $e)` yang memanggil `DB::rollBack()` (blok `try` mulai baris 279, `catch` baris 416–419). `TypeError` adalah `\Error`, **bukan** `\Exception`, sehingga catch itu **tidak berjalan** dan `DB::rollBack()` tidak dipanggil oleh kode ini; transaksi yang dibuka di baris 277 dibiarkan terbuka sampai koneksi ditutup.
2. Sebelum baris 372, kode sudah membuat `GlPostingStatus` berstatus `pending` dan men-dispatch `PurchaseInvoiceGeneralLedgerPostingRequested` (baris 356–371) ke listener berantrian dengan `after_commit => false` (`config/queue.php`). **Apakah job GL tetap berjalan setelah approve gagal bergantung pada driver queue**: pada driver `database` yang memakai koneksi sama, baris job ikut batal bersama transaksi; pada driver lain (mis. redis) job tetap ada. **Belum diverifikasi.**
3. Jalur UI: `purchase_order.id` pada `PurchaseInvoiceRequest` bersifat `nullable` (baris 40), tetapi `validateOffPoRows` mewajibkan PO untuk baris receipt dan item bebas (baris 281–283). Keterjangkauan PI tanpa PO lewat UI/API **belum diverifikasi**; DB mengizinkannya.

**Ukuran paparan (read-only, staging).**

```sql
SELECT status, COUNT(*) AS jumlah
FROM purchase_invoices
WHERE purchase_order_id IS NULL AND deleted_at IS NULL
GROUP BY status;
```

| Hasil | Staging | Produksi |
|---|---|---|
| Jumlah PI tanpa PO, per status | MENUNGGU Task 6.5 | tidak diperlukan (Q1) |

**Usulan penanganan.** Bila query menunjukkan PI tanpa PO nyata, **hotfix kecil terpisah** (event menerima PO nullable dan listener melewati rekalkulasi bila tidak ada PO). Bila tidak ada, masukkan ke **Fase 2** (refactor `PurchaseInvoiceService`), dan tambahkan test yang mengunci kegagalan terlebih dahulu. Alasan menunggu data: tanpa jalur nyata, risikonya rendah.

**Keputusan pemilik produk: MENUNGGU.**

### 3.7 N-3 (tambahan, dari verifikasi kode): baris satu dokumen dapat terpecah lintas detik

Bukan bagian permintaan awal; dicatat karena memengaruhi akurasi estimasi backfill (Bagian 4).

**Bukti (kode).** `StockEntryService` (baris 587, 596, 616, dan seterusnya) dan `PostAssetDisposalGainLoss` (baris 63, 71, 81, 89) memanggil `now()` **terpisah untuk setiap baris GL**, sedangkan `transaction_date` bertipe `datetime` tanpa pecahan detik. Jika dua baris pasangan jatuh di sisi berbeda batas detik, keduanya tersimpan dengan `transaction_date` berbeda. Listener lain memakai satu `$event->transactionDate` untuk seluruh baris sehingga tidak terpengaruh.

**Dampak.** Pengelompokan D-8 dan auditor (`GROUP BY referenceable_type, referenceable_id, transaction_date`) memperlakukan baris yang terpisah itu sebagai dua kelompok yang masing-masing **tampak tak seimbang**, padahal dokumennya seimbang. Frekuensinya **belum diukur**; diagnosis ada di Bagian 4.3.

**Usulan penanganan.** Ukur di staging (Bagian 4.3) lalu tentukan granularitas pengelompokan D-8 (per dokumen, atau per tanggal, atau per `datetime` dengan toleransi) **sebelum** spec Fase 1 difinalkan. Tidak ada perubahan kode di fase ini.

**Keputusan pemilik produk: MENUNGGU.**

---

## 4. Estimasi beban backfill Fase 1 (Requirement 7.4)

**Status: MENUNGGU Task 6.5.** Bagian ini menetapkan **rumus dan metode**; seluruh angka dikosongkan. Tidak ada angka dari DB lokal atau perkiraan yang boleh dimasukkan.

### 4.1 Metode dan sumber angka

Dasar: D-8 (PRD Bagian 7 dan 11): baris `general_ledgers` dikelompokkan per (`referenceable_type`, `referenceable_id`, `transaction_date`) menjadi satu `journal`; kelompok seimbang → `posted`; kelompok tak seimbang → `legacy_unbalanced = true`, tidak dikoreksi otomatis; backfill idempoten dan tidak mengubah `debit`/`credit` lama. Baris yang sudah soft-deleted (`totals.rows_soft_deleted`) **dikecualikan** dari backfill (catatan D-13: data lama yang soft-deleted tetap apa adanya). Semua angka di bawah berasal dari baris **aktif**.

Simbol: **R** = `totals.rows`; **G** = `totals.groups`; **U** = `sections.unbalanced_groups.count`; **D** = `sections.unbalanced_groups.total_diff`.

| Besaran | Rumus | Field JSON sumber | Staging | Produksi |
|---|---|---|---|---|
| Jumlah baris yang diberi `journal_id` | R | `totals.rows` | MENUNGGU | tidak diperlukan (Q1) |
| Jumlah `journal` yang dibuat | G | `totals.groups` | MENUNGGU | tidak diperlukan (Q1) |
| Rata-rata baris per kelompok | R ÷ G | `totals.rows`, `totals.groups` | MENUNGGU | tidak diperlukan (Q1) |
| Kelompok seimbang (`posted`) | G − U | (turunan) | MENUNGGU | tidak diperlukan (Q1) |
| Kelompok tak seimbang (`legacy_unbalanced`) | U | `sections.unbalanced_groups.count` | MENUNGGU | tidak diperlukan (Q1) |
| Persentase kelompok tak seimbang | U ÷ G × 100 % | (turunan) | MENUNGGU | tidak diperlukan (Q1) |
| Total selisih kelompok tak seimbang | D | `sections.unbalanced_groups.total_diff` | MENUNGGU | tidak diperlukan (Q1) |
| Selisih Σdebit − Σkredit seluruh GL | — | `totals.diff` | MENUNGGU | tidak diperlukan (Q1) |
| Jumlah batch | ⌈G ÷ B⌉ | (B = ukuran batch) | MENUNGGU | tidak diperlukan (Q1) |
| Durasi backfill | jumlah batch × t_batch | t_batch diukur | MENUNGGU | tidak diperlukan (Q1) |

**B dan t_batch bukan asumsi:** keduanya ditetapkan dari uji coba backfill pada salinan data staging pada saat Fase 1, dan baru kemudian durasi dihitung. Tidak ada nilai default yang dipakai di dokumen ini. Ambang yang menentukan kategori beban (ringan/sedang/berat) juga ditetapkan pemilik produk dan pengembang **setelah** angka tersedia.

Komponen yang membutuhkan penanganan khusus (bukan bagian dari persentase di atas):

| Komponen | Field JSON sumber | Perlakuan yang perlu diputuskan di spec Fase 1 | Staging | Produksi |
|---|---|---|---|---|
| GL yatim (dokumen sumber tidak ada) | `sections.orphan_reference.count` (baris) | `journals.source_*` menggantung; dibackfill atau ditandai | MENUNGGU | tidak diperlukan (Q1) |
| Akun hilang atau soft-deleted | `sections.dangling_account.count` (baris; dihitung ganda bila keduanya bermasalah) | Jurnal merujuk akun soft-deleted | MENUNGGU | tidak diperlukan (Q1) |
| Baris nol atau negatif | `sections.zero_or_negative.count` (baris) | FR-L2 menolak jurnal baru semacam ini; baris lama perlu aturan lolos/ditandai | MENUNGGU | tidak diperlukan (Q1) |
| Duplikasi posting | `sections.duplicates.count`, `.extra_rows` | Kandidat posting ganda; **jangan dihapus otomatis** | MENUNGGU | tidak diperlukan (Q1) |
| Dokumen `canceled` dengan GL aktif | `sections.canceled_active_gl.count` (dokumen) | Aturan backfill untuk GL aktif milik dokumen batal (F-16) | MENUNGGU | tidak diperlukan (Q1) |
| GL soft-deleted | `totals.rows_soft_deleted`; `sections.soft_deleted_expected.count`, `soft_deleted_unexpected.count` | Dikecualikan dari backfill; yang `unexpected` perlu dijelaskan | MENUNGGU | tidak diperlukan (Q1) |

### 4.2 Keterbatasan yang harus dibaca bersama angka

1. **Persentase tak seimbang tidak menggambarkan kebenaran data.** F-10 (GL pembayaran memposting total kumulatif) dan F-11 (pembayaran asing tercatat dalam mata uang dokumen) menghasilkan jurnal yang **seimbang tetapi salah**: kedua sisi sama-sama berlebih atau sama-sama dalam mata uang asing. Kelompok seperti ini lolos sebagai "seimbang" dan akan di-backfill sebagai `posted`. Ukur paparannya dengan query Bagian 3.2 dan 3.3, terpisah dari persentase U ÷ G.
2. **Kelompok tak seimbang dapat membengkak akibat pemecahan lintas detik** (N-3, Bagian 3.7): pasangan baris dengan `now()` terpisah dapat menjadi dua kelompok tak seimbang. Gunakan diagnosis Bagian 4.3 sebelum memakai U sebagai ukuran beban.
3. **JSON tidak memuat rincian per jenis dokumen** untuk kelompok tak seimbang (hanya total dan contoh sejumlah `--limit`). Pakai query Bagian 4.3.
4. **Data contoh (`is_example`)** ikut terhitung oleh auditor (Bagian 2.3); angka R dan G mungkin lebih besar dari data bisnis nyata.
5. Angka staging tidak otomatis mewakili produksi. Belum ada data sama sekali (GL produksi kosong) (Q1 dijawab 2026-11-03), sehingga estimasi beban backfill produksi per 2026-11-03 nol (GL produksi kosong). Estimasi berbasis staging berlaku sebagai uji coba migrasi dan harus ditandai demikian.
6. `double` pada `debit`/`credit`: perbandingan memakai toleransi 0,005 (`GeneralLedgerAuditor`), sehingga selisih di bawah ambang tidak dihitung sebagai tak seimbang.

### 4.3 Query diagnosis (read-only, staging; jalankan di luar jam sibuk)

Rincian per jenis dokumen untuk kelompok tak seimbang (granularitas persis seperti auditor):

```sql
SELECT referenceable_type, COUNT(*) AS kelompok_tak_seimbang, ROUND(SUM(diff), 4) AS total_selisih
FROM (
  SELECT referenceable_type, referenceable_id, transaction_date,
         ABS(SUM(debit) - SUM(credit)) AS diff
  FROM general_ledgers
  WHERE deleted_at IS NULL
  GROUP BY referenceable_type, referenceable_id, transaction_date
  HAVING ABS(SUM(debit) - SUM(credit)) > 0.005
) x
GROUP BY referenceable_type;
```

Diagnosis pemecahan lintas detik: hitung ulang tanpa `transaction_date` (per dokumen). Jika hasilnya jauh lebih kecil daripada hasil query di atas, selisihnya sebagian besar adalah artefak pemecahan, bukan ketidakseimbangan sungguhan. Query ini hanya diagnosis; ia dapat menyembunyikan ketidakseimbangan lintas tanggal dalam satu dokumen.

```sql
SELECT referenceable_type, COUNT(*) AS dokumen_tak_seimbang, ROUND(SUM(diff), 4) AS total_selisih
FROM (
  SELECT referenceable_type, referenceable_id, ABS(SUM(debit) - SUM(credit)) AS diff
  FROM general_ledgers
  WHERE deleted_at IS NULL
  GROUP BY referenceable_type, referenceable_id
  HAVING ABS(SUM(debit) - SUM(credit)) > 0.005
) x
GROUP BY referenceable_type;
```

| Hasil | Staging | Produksi |
|---|---|---|
| Kelompok tak seimbang per `referenceable_type` (granularitas auditor) | MENUNGGU Task 6.5 | tidak diperlukan (Q1) |
| Dokumen tak seimbang per `referenceable_type` (tanpa `transaction_date`) | MENUNGGU Task 6.5 | tidak diperlukan (Q1) |

---

## 5. Hal yang menunggu dan ketidaksesuaian spec

### 5.1 Daftar persetujuan (Requirement 7.5)

| # | Item | Status |
|---|---|---|
| 1 | Task 6.5 dijalankan dan Bagian 1.5.2, 2, dan 4 terisi | MENUNGGU |
| 2 | Q1 versi PRD dijawab 2026-11-03: belum ada data sama sekali (GL produksi kosong) | DIJAWAB |
| 3 | Q-P0-1 dijawab 2026-11-03 (pemilik produk menjalankan di staging) | DIJAWAB |
| 4 | Keputusan atas F-04, F-10, F-11, F-16, N-1, N-2, N-3 | MENUNGGU |
| 5 | **Persetujuan laporan ini oleh pemilik produk** | **MENUNGGU** |

Persetujuan pemilik produk: _(belum ada)_. Tanggal persetujuan: _(belum ada)_.

### 5.2 Ketidaksesuaian dengan dokumen spec yang ditemukan saat penyusunan

Butir 1 sampai 3 sudah **dikoreksi di PRD** (`finance-engine-prd.md`, Lampiran A, bertanda koreksi 2026-11-03), bukan sekadar diusulkan. Butir 4 dan 5 tetap dicatat untuk keputusan pemilik produk. Laporan ini tidak mengubah dokumen lain.

1. **PRD F-12** (sudah dikoreksi) menyebut kolom runtime "di lingkungan lokal **menghapusnya** bila flag trait dicabut". Pada kode, penghapusan `have_transactions` pada model submitable berjalan **di semua lingkungan** (`DataTable.php:648-652`); hanya dua penghapusan lainnya yang dibatasi `app()->isLocal()`. Pemeriksaan penambahan dan penghapusan itu dijalankan pada setiap deploy karena `db:seed --force` berjalan otomatis (`.scripts/deploy-staging.sh:67`, `.scripts/deploy-production.sh:68`).
2. **PRD F-12** (sudah dikoreksi) mencantumkan kolom `accounts` saja; `general_ledgers` juga memperoleh `is_example`, `code` (unik), dan `have_transactions` yang tidak ada di migration (Bagian 1.2).
3. **PRD F-04** (sudah dikoreksi) merujuk `SalesInvoiceService::cancel` di sekitar baris 386; posisi aktualnya baris 604.
4. **Req 7.1** menyebut laporan merangkum hasil audit staging dan produksi, sedangkan Req 6.2 hanya menyebut staging; Q1 di PRD dan di spec dirumuskan berbeda (lihat catatan di [`finance-decision-log.md`](finance-decision-log.md)); keduanya dijawab 2026-11-03 (versi PRD: belum ada data sama sekali (GL produksi kosong); versi spec: untuk sekarang staging saja).
5. Rumus baseline saldo pada `design.md` bagian 4 (Task 3.1) sudah dikunci dari kode, tetapi belum dikonfirmasi terhadap data staging (Bagian 2.5).
