# Laporan Audit Finance Engine — Fase 0

| | |
|---|---|
| **Status** | **Fase 0 selesai 2026-11-04.** Laporan disetujui pemilik produk 2026-11-03 (versi PR #272/#273), tambahan staging dan N-4…N-9 (PR #274), serta keputusan penanganan per bug. Skema aktual staging (Req 6.2) dan `APP_ENV` (`staging`) terisi 2026-11-04 (Bagian 1.5.2). DV-D (Task 2.6) selesai 2026-11-04 (PR #275). Tersisa hanya query SQL tambahan paparan (Bagian 5.1 butir 1b): **opsional, tidak memblokir** (produksi kosong, Q1). |
| **Tanggal** | Draft dan persetujuan 2026-11-03; angka staging ditambahkan 2026-11-03; skema staging dan penutupan Fase 0 2026-11-04 |
| **Spec** | [`finance-p0-foundation-audit`](../../.kiro/specs/finance-p0-foundation-audit/requirements.md) — Requirement 6 (audit skema), Requirement 7.1, 7.3, 7.4 (laporan) |
| **Dokumen terkait** | [`finance-engine-prd.md`](finance-engine-prd.md) (Lampiran A dan B), [`finance-decision-log.md`](finance-decision-log.md) |
| **Penyusun** | Pembacaan kode dan test (branch `docs/finance-p0-audit-report`); angka staging dari dua berkas yang diserahkan pemilik produk (branch `docs/finance-p0-staging-audit`). Tidak ada data produksi yang dipakai (GL produksi kosong, Q1) |

> **Cara membaca dokumen ini.** Angka **staging** di Bagian 2 sampai 4 berasal dari `audit-20261103-155516.json` (`generated_at` 2026-11-03T15:55:16+00:00) dan `baseline-20261103-155540.csv`, keduanya diserahkan pemilik produk (Task 6.5). Lingkungan sumber **diasumsikan staging** (sesuai Q-P0-1); penyerahan tidak menyebut lingkungannya secara eksplisit. Produksi tidak diperlukan (GL produksi kosong, Q1). Skema aktual (Req 6.2) dan `APP_ENV` staging diisi 2026-11-04 dari keluaran `db:table` dan `env` yang diserahkan pemilik produk (Bagian 1.5.2). Yang masih berlabel **MENUNGGU** (query SQL tambahan paparan F-10, F-11, N-2, N-5, `is_example`, `gl_posting_statuses`) tetap **sengaja dikosongkan**, bersifat opsional dan tidak memblokir, dan tidak boleh diisi dari perkiraan. ID baris GL, ID dokumen, dan nama pihak dari berkas tidak disalin ke dokumen ini. Semua klaim perilaku kode lain dirujuk ke `file:baris` atau ke test yang menjalankannya; klaim yang hanya berasal dari pembacaan kode (belum diuji) diberi label **belum diuji**.

---

## 0. Ringkasan

### 0.1 Yang sudah dapat disimpulkan

1. **Skema runtime (Req 6).** Trait `DataTable::initPermissions()` menambah kolom langsung ke tabel saat `PermissionSeeder` dijalankan, dan seeder itu **berjalan di setiap deploy** staging dan produksi (`db:seed --force`, lihat Bagian 1.1). Untuk dua tabel Finance yang relevan: `general_ledgers` memperoleh `is_example`, `code` (unik), dan `have_transactions` yang **tidak ada di migration**; `accounts` memperoleh `is_example`, `have_transactions`, `parent_id`, `lft`, `rgt`, `depth` beserta lima indeks, juga tidak ada di migration. Kode produksi sudah bergantung pada kolom runtime itu (mis. `GeneralLedger::creating` menulis `code`; `StockEntryService` menulis `accounts.have_transactions`). **Skema aktual staging diverifikasi 2026-11-04: sama dengan migration ditambah kolom runtime tersebut, tanpa *drift*** (Bagian 1.5.2). **Konvensi yang disimpulkan:** kolom tabel baru Finance wajib dideklarasikan eksplisit di migration (Bagian 1.4).
2. **Penghapusan kolom tidak seluruhnya hanya di lokal.** Penghapusan `have_transactions` pada model submitable berjalan **di semua lingkungan** (`DataTable.php:648-652`). Hanya penghapusan kolom Submitable pada model non-submitable dan kolom tree pada model non-tree yang dibatasi `app()->isLocal()`. Karena `db:seed --force` ikut dalam setiap deploy, **pemeriksaan** itu dijalankan pada setiap deploy ke staging dan produksi; kolom dihapus bila masih ada, sehingga penghapusan efektif hanya terjadi sekali per tabel (selanjutnya no-op), dengan `APP_ENV` yang bukan `local`: **dikonfirmasi 2026-11-04 untuk staging (`APP_ENV` = `staging`)**; produksi tidak dikonfirmasi (Bagian 1.5.2). Ini **tidak sama** dengan uraian PRD F-12 (lihat Bagian 5.2; PRD sudah dikoreksi).
3. **Dugaan bug terkonfirmasi oleh test** (Bagian 3): F-04, F-10, F-11 (bagian FX), F-16. Ditambah dua temuan baru dari PR #271 (tanda laba/rugi disposal aset; Purchase Invoice tanpa PO) dan satu temuan tambahan metode (pemecahan kelompok akibat `now()` per baris, Bagian 3.7). Keputusan penanganan tiap bug sudah disetujui pemilik produk pada 2026-11-03 (decision log: PB-1 s.d. PB-15 dan DV-C); hotfix Payment Entry sudah digabung (PR #277), sisanya ditangani di fase yang ditetapkan tabel PB.
4. **Hasil audit staging (Bagian 2 dan 4, 2026-11-03).** 60 baris GL aktif dalam 28 kelompok (rentang 2026-07-26 sampai 2026-10-28), Σdebit = Σkredit, dan **semua kategori anomali bernilai 0** kecuali 4 baris soft-delete yang diharapkan (dokumen sumber `canceled`: satu Sales Invoice dan satu Payment Entry). Tidak ada kelompok tak seimbang, sehingga beban backfill staging kecil. Angka ini kecil dan **tidak membuktikan kebenaran jurnal**: F-10, F-11, dan temuan N-4 menghasilkan jurnal seimbang tetapi salah.
5. **Temuan baru dari analisis baseline saldo dan matriks cakupan (Bagian 2.6 dan 3.8 sampai 3.13):** N-4 (arah jurnal Payment Entry tampak terbalik terhadap konvensi umum), N-5 (akun SRNB 2214 bersaldo debit), N-6 (HPP 4210 berklasifikasi income), N-7 (akun selisih Stock Entry), N-8 (baris GL bernilai nol), N-9 (kolom `approved` matriks cakupan tidak bermakna pada data nyata). Status verifikasi tiap butir ditulis di bagiannya. `balance_amount` hanya terisi pada dua akun, konsisten dengan F-09.
6. **Peringatan untuk estimasi backfill (Bagian 4).** F-10 dan F-11 menghasilkan jurnal yang **seimbang tetapi salah**, sehingga persentase kelompok tak seimbang dari `finance:audit-gl` tidak mendeteksinya. Persentase itu juga dapat membengkak karena baris satu dokumen terpecah lintas detik.

### 0.2 Status dan yang masih menunggu

| # | Menunggu | Pemilik | Dampak |
|---|---|---|---|
| 1 | **Task 6.5**: **sudah dijalankan dan diterima 2026-11-03** (`finance:audit-gl --json` dan `finance:snapshot-balances`, berkas tersimpan di `storage/app/finance-audit/`, ter-ignore git). **Sudah diterima 2026-11-04:** (a) skema aktual Req 6.2 (Bagian 1.5.2), (b) konfirmasi `APP_ENV` staging = `staging`. **Sisa, opsional dan tidak memblokir:** (c) query SQL tambahan pada Bagian 2.3, 3.2, 3.3, 3.6, 3.9, 3.13 (paparan F-10, F-11, N-2, N-5; tidak diperlukan karena GL produksi kosong) | Pemilik produk (pelaksana staging) | Hanya paparan F-10, F-11, N-2, N-5 |
| 2 | ~~**Q1** versi PRD~~ **Dijawab 2026-11-03**: belum ada data sama sekali (GL produksi kosong). Tidak lagi menunggu | Pemilik produk | Sudah tertutup; tidak memblokir Fase 1 |
| 3 | **Q-P0-1** dijawab 2026-11-03: pemilik produk sendiri menjalankan perintah di staging dan menyerahkan hasilnya. Produksi tidak untuk sekarang | Pemilik produk | Task 6.5 dapat dilaksanakan; checkbox tetap terbuka sampai hasil diterima |
| 4 | ~~**Keputusan pemilik produk** atas tiap temuan di Bagian 3 (F-04, F-10, F-11, F-16, N-1 sampai N-9)~~ **Disetujui 2026-11-03** (lihat Bagian 3 dan decision log, Keputusan Penanganan per Bug) | Pemilik produk | Fase atau hotfix tiap temuan sudah ditetapkan |
| 4a | ~~**Keputusan DV-D (Req 2.2/N-9), dibutuhkan sebelum Task 8:** MENUNGGU~~ **DV-D disetujui opsi (a) 2026-11-03; implementasi Task 2.6 selesai 2026-11-04 (PR #275)** | Pemilik produk | Perbaikan auditor cakupan dokumen (Bagian 3.13); lihat DV-D di `finance-decision-log.md` |
| 5 | ~~**Persetujuan laporan ini** (Requirement 7.5)~~ **Disetujui 2026-11-03** (versi PR #272/#273). Tambahan PR #274 (angka staging, N-4 sampai N-9) disetujui 2026-11-03 (AP-2); keputusan penanganan per bug disetujui 2026-11-03 | Pemilik produk | Gerbang Fase 1 (Req 7.5) untuk persetujuan laporan dan decision log terpenuhi; Fase 1 tetap mensyaratkan Fase 0 selesai |
| 6 | ~~**Penutupan Fase 0 (Task 8)**~~ **Selesai 2026-11-04**: skema staging dan `APP_ENV` diterima; `tests/Feature/Finances` lulus; exit criteria Fase 0 terpenuhi (lihat PRD Bagian 10 dan `tasks.md` Fase 0). Fase 0 tidak lagi menunggu | Pemilik produk, pengembang | Gerbang Fase 1 terbuka; keputusan Fase 1 (D-3, D-8, D-14, Q-P1-1, Q-P1-2) diputuskan 2026-11-04 (decision log) |

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

**Catatan asumsi (dikonfirmasi 2026-11-04 untuk staging).** Kesimpulan bahwa di staging/produksi hanya `have_transactions` pada model submitable yang dihapus mengandaikan `APP_ENV` di sana bukan `local`. Staging: `APP_ENV` = `staging`, sehingga dua penghapusan yang dibatasi `isLocal()` tidak berlaku di sana (Bagian 1.5.2). Produksi: tidak dikonfirmasi; asumsi yang sama dipakai sampai ada konfirmasi, dan tidak memblokir karena GL produksi kosong (Q1).

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
8. **Bentuk deklarasi persis dan flag model pemicunya** (skema staging 2026-11-04, Bagian 1.5.2; flag diverifikasi ke `app/Traits/DataTable.php`): (a) `is_example` untuk **semua** model `DataTable` (baris 559-563): `boolean` default `false` + `index()` (nama bawaan `<tabel>_is_example_index`); (b) `code` (`string` NOT NULL + `unique()`, nama bawaan `<tabel>_code_unique`) **hanya bila `$is_submitable` atau `$generateCodeSeries`** (baris 565 dan 594-598); (c) `have_transactions` (`boolean` default `false`) **hanya untuk model non-submitable** (baris 693-697); untuk model submitable kolom ini dihapus di semua lingkungan (baris 648-652); (d) kolom Submitable hanya bila `$is_submitable` (baris 600), kolom tree hanya bila `$is_tree_view` (baris 699). Konvensi: tabel jurnal Fase 1 (`journals`, `fiscal_years`, `fiscal_periods`; baris jurnal tetap di `general_ledgers`, tidak ada tabel `journal_lines`) mendeklarasikan eksplisit **persis kolom yang akan ditambahkan `initPermissions()` menurut flag modelnya**, sehingga `initPermissions()` no-op karena setiap penambahan dijaga `hasColumn`. Contoh: `Journal` memakai kode series (Req 1.6 Fase 1), jadi `code` wajib dideklarasikan; bila sengaja nullable, test Task 2.5 Fase 1 membuktikan `initPermissions()` tidak mengubahnya.
9. **Verifikasi staging:** pada `general_ledgers` dan `accounts` tidak ada kolom di luar migration dan `initPermissions()` (tanpa *drift*), sehingga konvensi di atas tidak memerlukan pembersihan tabel yang ada sebelum Fase 1.

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

#### 1.5.2 Skema aktual staging dan selisihnya terhadap migration (terisi 2026-11-04)

**Sumber.** Keluaran `php artisan env`, `php artisan db:table general_ledgers`, dan `php artisan db:table accounts` yang dijalankan pemilik produk di staging dan diserahkan 2026-11-04. Hanya **struktur** yang disalin ke sini (kolom, tipe, indeks, FK); tidak ada ID atau data baris. Query SQL yang disiapkan semula (`SHOW CREATE TABLE`, `information_schema`) tidak dijalankan: `db:table` menggantikannya dan memadai untuk Req 6.2, kecuali hal-hal yang tidak tampak pada keluarannya (daftar di bawah tabel).

**`APP_ENV` staging = `staging`** (bukan `local`). Akibatnya dua jalur penghapusan yang dibatasi `app()->isLocal()` (kolom Submitable pada model non-submitable; kolom tree pada model non-tree) **tidak berlaku di staging**; yang tetap berlaku hanya penghapusan `have_transactions` pada model submitable (Bagian 1.3). `APP_ENV` produksi **tidak dikonfirmasi** (produksi tidak diperlukan sekarang, Q1 dan Q-P0-1); skrip deploy produksi menjalankan seeder yang sama (Bagian 5.2 butir 1).

**Tabel.** `general_ledgers`: 18 kolom, InnoDB, `utf8mb4_unicode_ci`, ukuran 128,00 KB. `accounts`: 22 kolom, InnoDB, `utf8mb4_unicode_ci`, ukuran 128,00 KB. Jumlah baris pasti tidak ditampilkan `db:table`; baris GL ada pada audit (60 aktif, 4 soft-deleted, Bagian 2) dan jumlah akun ada pada baseline (Bagian 2.5). Kolom "Asal": **M** = ada di migration, **R** = hanya dari `initPermissions()` (diharapkan, bukan *drift*), **?** = tidak ada di keduanya (*drift* sungguhan).

| Objek | Asal | Menurut migration | Aktual staging | Selisih / catatan |
|---|---|---|---|---|
| `general_ledgers.is_example` | R | tidak ada | `tinyint(1)` default 0; indeks `general_ledgers_is_example_index` | Sesuai harapan. Ditambahkan `initPermissions()`, diletakkan setelah `deleted_at` |
| `general_ledgers.code` | R | tidak ada | `varchar(255)` NOT NULL (tanpa default); indeks unik `general_ledgers_code_unique` | Sesuai harapan. Terisi per baris (F-15) dan unik per baris |
| `general_ledgers.have_transactions` | R | tidak ada | `tinyint(1)` default 0 | Sesuai harapan. Tidak dihapus karena `GeneralLedger` bukan model submitable |
| `general_ledgers.transaction_date` | M | `datetime NOT NULL` | `datetime` NOT NULL, tanpa default, tanpa pecahan detik | Sesuai migration |
| `general_ledgers.against_account_id` | M | `char(26) NOT NULL` | `char(26)` NOT NULL | Sesuai migration (Fase 1 menjadikannya nullable, Req 1.3) |
| `general_ledgers.debit`, `credit` | M | `double` default 0 | `double` default 0 | Sesuai migration (Fase 1 Task 8 mengubah ke `decimal(20,4)`) |
| FK `account_id` dan `against_account_id` | M | `CASCADE` saat hapus (PRD F-02) | `account_id -> accounts.id`, ubah `restrict`, hapus `cascade`; `against_account_id -> accounts.id`, ubah `restrict`, hapus `cascade` | Sesuai migration. **F-02 terkonfirmasi di staging**: menghapus akun menghapus baris GL |
| FK `branch_id` | M | `nullOnDelete` | `branch_id -> branches.id`, ubah `restrict`, hapus `set null` | Sesuai migration |
| FK masuk `assets.journal_entry_for_scrap_id -> general_ledgers.id` | M | `SET NULL` | **tidak tampak** (`db:table` hanya mencantumkan FK keluar) | Tetap berdasarkan pembacaan migration (Bagian 1.5.1); belum diverifikasi di DB |
| Indeks `transaction_date` / `deleted_at` | tidak ada | tidak ada | tidak ada | Sesuai migration. Indeks aktual: PK, `referenceable_index`, `partyable_index`, `general_ledgers_code_unique`, `general_ledgers_is_example_index`, dan tiga indeks FK (`account_id`, `against_account_id`, `branch_id`) |
| `accounts.is_example` | R | tidak ada | `tinyint(1)` default 0; indeks `accounts_is_example_index` | Sesuai harapan |
| `accounts.have_transactions` | R | tidak ada | `tinyint(1)` default 0 | Sesuai harapan |
| `accounts.parent_id` | R | tidak ada | `char(26)` NULL; FK `parent_id -> accounts.id`, ubah `restrict`, hapus `set null` | Sesuai harapan (self-FK) |
| `accounts.lft`, `rgt`, `depth` | R | tidak ada | `int unsigned` default 0 masing-masing | Sesuai harapan |
| Indeks tree | R | tidak ada | `lft_index`, `rgt_index`, `depth_index`, `idx_depth_lft (depth, lft)`, `idx_parent_lft (parent_id, lft)` | Kelima indeks yang diperkirakan ada. Indeks FK `parent_id` dipenuhi `idx_parent_lft` |
| `accounts.is_contra` | M | `tinyint(1) NOT NULL` default false | `tinyint(1)` default 0 | Sesuai migration (dihapus pada Fase 2 Task 14.2, D-26) |
| FK `accounts.currency_code` | M | `nullOnDelete` | `currency_code -> currencies.code`, ubah `restrict`, hapus `set null`; indeks `accounts_currency_code_foreign` | Sesuai migration |
| Kolom lain di DB yang tidak ada di migration maupun `initPermissions()` | ? | tidak ada | **tidak ada**: 15 kolom migration + 3 kolom runtime = 18 (`general_ledgers`); 16 kolom migration + 6 kolom runtime = 22 (`accounts`) | **Tidak ada *drift*** |
| Jumlah baris, ukuran, mesin, kolasi | — | — | InnoDB, `utf8mb4_unicode_ci`, 128,00 KB per tabel; jumlah baris pasti tidak ditampilkan | Baris GL dari audit (60 aktif, 4 soft-deleted) |
| Versi server DB | — | — | **tidak tampak** pada keluaran | Tidak memblokir; lihat di bawah |

**Kesimpulan Req 6.2.** Skema aktual staging **sama dengan migration ditambah kolom runtime yang diharapkan**, tanpa *drift*. Kolom runtime diletakkan setelah kolom migration (urutan `is_example`, `code`, `have_transactions` pada `general_ledgers`). Konsekuensinya bagi Fase 1:

1. **Konvensi deklarasi eksplisit (Bagian 1.4) menjadi konkret.** Agar `initPermissions()` no-op pada tabel baru, migration harus mendeklarasikan kolom persis seperti hasil staging: `is_example` `boolean` default `false` dengan indeks bernama `<tabel>_is_example_index`; `have_transactions` `boolean` default `false` (model non-submitable); `code` `string` (varchar 255) NOT NULL dengan indeks unik `<tabel>_code_unique` bila model memakai `$generateCodeSeries`. Nama indeks default Laravel itulah yang dibuat `initPermissions()`, sehingga deklarasi migration yang memakai `->index()`/`->unique()` bawaan akan cocok.
2. **`general_ledgers.code` tetap NOT NULL unik per baris** (F-15). Adapter Fase 1 tidak mengubahnya; baris jurnal baru tetap memperoleh `code` lewat `GeneralLedger::creating`.
3. **Kolom baru `journal_id`, `line_no`, `foreign_*`, `exchange_rate` pada `general_ledgers` harus nullable** (tabel staging berisi 64 baris termasuk soft-deleted); kolom nullable tidak terpengaruh kegagalan NOT NULL pada tabel terisi (Bagian 1.2).
4. **Perubahan FK (Req 13.3)** menyasar dua FK `ON DELETE CASCADE` yang terkonfirmasi di staging; nama FK tidak tampak pada keluaran, dan nama indeks FK (`general_ledgers_account_id_foreign` dan `general_ledgers_against_account_id_foreign`) sesuai pola nama default Laravel, sehingga nama FK **diduga** sama. Verifikasi nama FK dilakukan di Fase 1 Task 8.3 sebelum `dropForeign`.
5. **Tidak ada kolom tak terduga** pada tabel yang akan dimodifikasi, sehingga migration Fase 1 tidak perlu menangani *drift*.

**Hal yang tidak tampak pada keluaran `db:table` (opsional, tidak memblokir penutupan Fase 0).** (a) FK masuk dari tabel lain, termasuk `assets.journal_entry_for_scrap_id` dan seluruh tabel yang merujuk `accounts`; (b) versi server DB; (c) nama FK; (d) isi tabel `migrations`. Bila diperlukan sebelum Fase 1 Task 8.3, query read-only berikut mengisinya:

```sql
SELECT k.TABLE_NAME, k.CONSTRAINT_NAME, k.COLUMN_NAME,
       k.REFERENCED_TABLE_NAME, r.UPDATE_RULE, r.DELETE_RULE
FROM information_schema.KEY_COLUMN_USAGE k
JOIN information_schema.REFERENTIAL_CONSTRAINTS r
  ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA
 AND r.TABLE_NAME = k.TABLE_NAME
 AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
WHERE k.TABLE_SCHEMA = DATABASE()
  AND k.REFERENCED_TABLE_NAME IN ('accounts', 'general_ledgers')
ORDER BY k.TABLE_NAME, k.CONSTRAINT_NAME;

SELECT VERSION();
```

---

## 2. Hasil `finance:audit-gl` dan `finance:snapshot-balances` (Requirement 7.1)

**Status: terisi dari data staging (Task 6.5, diterima 2026-11-03).** Sumber: `audit-20261103-155516.json` (`generated_at` 2026-11-03T15:55:16+00:00) dan `baseline-20261103-155540.csv`. Lingkungan **diasumsikan staging** (Q-P0-1); penyerahan tidak menyebutnya secara eksplisit, dan konfirmasi `APP_ENV` masih MENUNGGU (Bagian 1.5.2). Angka tidak berasal dari DB lokal.

### 2.1 Perintah yang dijalankan (Task 6.5)

Kedua perintah read-only (`SELECT` saja). Jalankan di luar jam sibuk; gunakan `--connection=<replika baca>` bila tersedia. Simpan keluaran di `storage/app/finance-audit/` dan **jangan di-commit**.

> **Larangan untuk pelaksana Task 6.5.** Jangan menjalankan `db:seed`, `PermissionSeeder`, `migrate`, atau `tinker` di staging/produksi sebagai bagian Task 6.5. Yang dijalankan hanyalah dua perintah `finance:*` di bawah ini dan query `SELECT`/`SHOW` yang tercantum di dokumen ini. (Deploy sendiri sudah menjalankan `db:seed --force`, lihat Bagian 1.1; Task 6.5 tidak perlu dan tidak boleh menambahnya.)

**Penanganan berkas hasil.** Berkas JSON dan CSV memuat data keuangan internal (ID dokumen, nominal, nama dan saldo akun). Kirim hanya lewat kanal internal yang terbatas; jangan diunggah ke tiket publik atau chat umum; hapus dari server setelah diserahkan kepada penerima. Berkas tidak dimaksudkan memuat data pribadi, tetapi tetap diperlakukan sebagai rahasia. **Retensi salinan lokal:** salinan berkas hasil audit di `storage/app/finance-audit/` pada workspace pengembang (ter-ignore git) memuat ID baris GL, ID dokumen, dan ID akun; hapus salinan itu setelah Task 8 (checkpoint akhir Fase 0) selesai.

```bash
# Audit integritas GL + matriks cakupan dokumen -> JSON (limit contoh per kategori default 20)
php artisan finance:audit-gl --limit=50 --json=storage/app/finance-audit/audit-staging-<tanggal>.json

# Baseline saldo per akun -> CSV
php artisan finance:snapshot-balances --path=storage/app/finance-audit/baseline-staging-<tanggal>.csv
```

Catatan opsi: `--json=<berkas>.json` menulis ke berkas itu; `--json=<folder>` atau `--json` tanpa nilai menulis `audit-<Ymd-His>.json` ke folder tersebut (default `storage/app/finance-audit/`). Tanpa opsi `--json`, hanya tabel konsol yang dicetak. Pelaksana mencatat tanggal/jam run, lingkungan, dan koneksi yang dipakai. **Catatan pelaksanaan 2026-11-03:** pemilik produk menjalankan kedua perintah dan menyerahkan dua berkas; opsi `--limit` dan `--connection` yang dipakai tidak dicatat dalam penyerahan.

Slot hasil dipisah per lingkungan: **Staging** (wajib) dan **Produksi** tidak diperlukan: belum ada data sama sekali (GL produksi kosong) (Q1 dijawab 2026-11-03).

### 2.2 Field JSON yang dibaca per kategori anomali

Struktur: `AuditReport::toArray()` → `generated_at`, `totals`, `sections`, `coverage` (`app/Services/Finances/Audit/AuditReport.php`). Satuan hitungan berbeda antar kategori; baca sesuai kolom "Satuan".

| Req | Kategori | Field JSON | Satuan | Staging | Produksi |
|---|---|---|---|---|---|
| 1.3 | Jumlah baris GL aktif | `totals.rows` | baris | **60** | tidak diperlukan (Q1) |
| 1.3 | Baris GL soft-deleted | `totals.rows_soft_deleted` | baris | **4** | tidak diperlukan (Q1) |
| 1.3 | Jumlah kelompok posting (aktif) | `totals.groups` | kelompok (`referenceable_type`, `referenceable_id`, `transaction_date`) | **28** | tidak diperlukan (Q1) |
| 1.3 | Rentang `transaction_date` | `totals.date_min`, `totals.date_max` | tanggal | 2026-07-26 07:48:57 sampai 2026-10-28 07:58:43 | tidak diperlukan (Q1) |
| 1.3 | Σdebit, Σkredit, selisih | `totals.sum_debit`, `totals.sum_credit`, `totals.diff` | nominal (4 desimal) | Σdebit = Σkredit = **11.857.398.471,6758**; selisih **0** | tidak diperlukan (Q1) |
| 1.2.1 | Kelompok tak seimbang | `sections.unbalanced_groups.count`, `.total_diff`, `.samples[]` (`referenceable_type`, `referenceable_id`, `transaction_date`, `line_count`, `sum_debit`, `sum_credit`, `diff`) | kelompok; `total_diff` = Σ\|selisih\| per kelompok | **0** kelompok; `total_diff` 0; contoh kosong | tidak diperlukan (Q1) |
| 1.2.2 | Debit dan kredit sama-sama nol, atau salah satunya negatif | `sections.zero_or_negative.count`, `.samples[]` | baris | **0** (hanya baris aktif; lihat 2 baris bernilai 0 yang soft-deleted di N-8) | tidak diperlukan (Q1) |
| 1.2.3a | Soft-delete **diharapkan** (dokumen sumber `canceled`) | `sections.soft_deleted_expected.count` | baris | **4** (2 baris Payment Entry bernilai 2.420.000 per sisi; 2 baris Sales Invoice bernilai 0) | tidak diperlukan (Q1) |
| 1.2.3b | Soft-delete **anomali** (dokumen tidak `canceled`, tidak ditemukan, atau jenis tanpa kolom `status`) | `sections.soft_deleted_unexpected.count` | baris | **0** | tidak diperlukan (Q1) |
| 1.2.4 | Akun hilang atau soft-deleted | `sections.dangling_account.count` | baris; **baris yang kedua kolomnya (`account_id` dan `against_account_id`) bermasalah terhitung dua kali** | **0** | tidak diperlukan (Q1) |
| 1.2.5 | `referenceable` tidak ditemukan | `sections.orphan_reference.count` (catatan `tipe tidak dikenal` pada contoh) | baris | **0** | tidak diperlukan (Q1) |
| 1.2.6 | Dokumen `canceled` dengan GL aktif (F-16) | `sections.canceled_active_gl.count` | **dokumen** | **0** dokumen | tidak diperlukan (Q1) |
| 1.2.7 | Duplikasi posting | `sections.duplicates.count`, `.extra_rows` | kelompok kombinasi duplikat; baris berlebih | **0** kelompok; `extra_rows` **0** | tidak diperlukan (Q1) |

Catatan pembacaan:

- Total baris GL di tabel = 60 aktif + 4 soft-deleted = 64. Jumlah dokumen berGL menurut matriks (Bagian 2.4) = 7 + 10 + 3 + 6 + 4 = 30; dua di antaranya `canceled` (GL-nya soft-deleted), sehingga 28 dokumen berGL aktif = **28 kelompok**: tiap dokumen membentuk tepat satu kelompok (konsisten secara aritmetika; tidak ada dokumen yang terpecah ke beberapa `transaction_date`).
- Dua baris Sales Invoice yang di-soft-delete bernilai debit 0 dan kredit 0. Kategori `zero_or_negative` hanya melihat baris aktif sehingga keduanya tidak terhitung. Penjelasan dan implikasinya ada di N-8 (Bagian 3.12).
- Seluruh kategori selain `rows_soft_deleted` dan `soft_deleted_*` menghitung **baris aktif** (`deleted_at IS NULL`) saja.
- `soft_deleted_unexpected` memasukkan seluruh baris soft-deleted milik jenis dokumen yang tidak punya kolom `status` (mis. jadwal depresiasi aset) karena status `canceled` tidak dapat diperiksa (`ReferenceChecks.php:29-37`). Angka pada jenis itu dibaca sebagai "tidak dapat dikategorikan".
- `orphan_reference` dan kategori lain memakai `referenceable_type` sebagai nama kelas; tipe yang kelasnya tidak ada dihitung yatim dengan catatan `tipe tidak dikenal`.

### 2.3 Batasan metode audit yang perlu diketahui pembaca hasil

1. **Data contoh ikut terhitung.** Auditor memakai query builder (`DB::table`), sehingga scope `exclude_example_data` (`is_example = false`) pada Eloquent **tidak berlaku**. Baris GL berstatus `is_example = 1` (bila ada) ikut dihitung. **Status staging: MENUNGGU**; berkas yang diserahkan tidak memuat distribusi `is_example`, jadi belum diketahui apakah 60 baris itu seluruhnya data bisnis. Periksa dengan query berikut (jalankan hanya bila kolom `is_example` ada di `general_ledgers`, lihat Bagian 1.5.2):

   ```sql
   SELECT is_example, COUNT(*) AS jumlah_baris FROM general_ledgers GROUP BY is_example;
   ```

2. **JSON tidak memuat rincian per jenis dokumen untuk kelompok tak seimbang**, hanya total dan contoh sebanyak `--limit`. Rincian per jenis diambil dengan query pada Bagian 4.3.
3. **Pengelompokan memakai `transaction_date` penuh (datetime), bukan tanggal.** Lihat Bagian 3.7 dan 4.3.
4. **F-10 dan F-11 tidak terdeteksi** oleh kategori mana pun karena jurnalnya seimbang (Bagian 4.2).

### 2.4 Matriks cakupan dokumen (Req 2): `coverage[]`

**Terisi dari data staging** (`audit-20261103-155516.json` (`generated_at` 2026-11-03T15:55:16+00:00)). Satu baris per jenis dokumen (`DocumentCoverageMatrix::DOCUMENT_TYPES`). Field JSON: `type`, `available`, `approved`, `canceled`, `with_gl`, `canceled_gl_softdeleted`, `canceled_active_gl`, `tracked`, `posting_not_posted`, `posting_missing`.

| `type` | `tracked` (desain) | `approved` | `canceled` | `with_gl` | `canceled_gl_softdeleted` | `canceled_active_gl` | `posting_not_posted` | `posting_missing` |
|---|---|---|---|---|---|---|---|---|
| `sales_invoice` | ya | 0 | 1 | 7 | 1 | 0 | 0 | 0 |
| `purchase_invoice` | ya | 0 | 0 | 10 | 0 | 0 | 0 | 0 |
| `purchase_receipt` | ya | 0 | 0 | **0** | 0 | 0 | 0 | 0 |
| `delivery_note` | ya | 0 | 0 | 3 | 0 | 0 | 0 | 0 |
| `payment_entry` | **tidak dilacak** | 0 | 1 | 6 | 1 | 0 | (kosong) | (kosong) |
| `stock_entry` | **tidak dilacak** | 0 | 0 | 4 | 0 | 0 | (kosong) | (kosong) |
| `asset_depreciation_schedule` | ya | (tanpa kolom `status`: null) | (null) | 0 | 0 (selalu 0) | 0 (selalu 0) | 0 | 0 |
| `asset_value_adjustment` | ya | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `asset` | ya | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

Catatan pembacaan matriks:

- `payment_entry` dan `stock_entry` dilaporkan "tidak dilacak", **bukan anomali** (Req 2.3).
- Baris **`asset`** kemungkinan tampak tidak lengkap secara palsu: aset berstatus `active`, bukan `approved` (fixture `tests/Support/BuildsAssetFixtures.php:29` memakai status `[ACTIVE]`), sehingga kolom `approved` dan `posting_*` bermakna terbatas; dan `GlPostingStatus` untuk disposal aset dikaitkan ke **`SalesInvoiceItem`**, bukan ke `Asset` (`PostAssetDisposalGainLoss.php:96-101`), sehingga `posting_missing` pada baris `asset` tidak otomatis berarti kegagalan posting. **Belum diverifikasi terhadap data**; pembaca hasil perlu memperlakukan baris ini dengan hati-hati.
- Dokumen yang di-soft-delete tetap dihitung (tabel dokumen dibaca apa adanya).
- **Kolom `approved` tidak bermakna pada data nyata (terverifikasi; temuan N-9, Bagian 3.13).** `approved` bernilai 0 untuk delapan jenis yang memiliki kolom `status` padahal `with_gl` > 0 pada lima di antaranya (jadwal depresiasi aset tanpa kolom `status`, nilainya null). Matriks menghitung `approved` dengan `whereJsonContains('status', 'approved')` (`DocumentCoverageMatrix.php:81`), sedangkan `onApproved` setiap service menimpa status dokumen dengan status lanjutan (Sales dan Purchase Invoice menjadi `unpaid` atau `returned`, Purchase Receipt `received` atau `returned`, Delivery Note `delivered` atau `returned`, Stock Entry `completed`, Payment Entry `paid`). Akibatnya **`posting_not_posted` = 0 dan `posting_missing` = 0 dihitung atas himpunan kosong untuk delapan jenis berkolom `status`** (`DocumentCoverageMatrix.php:97-100`) (kode versi PR #274, sebelum Task 2.6) dan **bukan bukti bahwa semua posting berhasil**. Jenis `asset_depreciation_schedule` tidak terdampak: tanpa kolom `status`, subjeknya seluruh jadwal (`DocumentCoverageMatrix.php:97`), tetapi tabelnya kosong di staging. Kolom `canceled`, `with_gl`, `canceled_gl_softdeleted`, dan `canceled_active_gl` tetap bermakna karena status `canceled` memang tersimpan. Definisi `approved` diperbaiki di Task 2.6 (DV-D opsi a, 2026-11-03); lihat tabel *Definisi `approved` pada matriks* di `design.md`. `posting_missing` adalah kolom informasi (DV-E, 2026-11-04).
- `purchase_receipt.with_gl` = 0: tidak ada Purchase Receipt yang menghasilkan GL. Ini konsisten dengan kode (Purchase Receipt memposting GL hanya pada ALUR-2 dan pada retur, lihat N-5, Bagian 3.9), tetapi berkas tidak memuat jumlah Purchase Receipt yang ada, jadi tidak dapat disimpulkan apakah ada receipt tanpa GL yang seharusnya memilikinya.
- Baris `asset`, `asset_value_adjustment`, dan `asset_depreciation_schedule` seluruhnya 0: belum ada posting aset di staging. Dengan demikian jalur disposal (N-1) dan pemecahan kelompok akibat `now()` (N-3) tidak teramati di data ini.

### 2.5 Baseline saldo (`finance:snapshot-balances`)

**Terisi dari data staging** (`baseline-20261103-155540.csv`; ID akun tidak disalin, hanya nomor dan nama akun CoA seeder). Kolom CSV: `account_id`, `account_number`, `account_name`, `root_type`, `balance_type`, `sum_debit`, `sum_credit`, `net`, `balance_amount`, `difference`, `note`. Rumus terkunci: `net = Σdebit − Σkredit` (baris aktif), `difference = net − balance_amount`.

| Ringkasan yang diambil dari CSV | Staging | Produksi |
|---|---|---|
| Jumlah akun (baris CSV), termasuk akun tanpa transaksi dan akun soft-deleted | **44** akun (45 baris dengan header) | tidak diperlukan (Q1) |
| Jumlah akun dengan `difference` ≠ 0 (toleransi 0,005) | **7** dari 44. Delapan akun memiliki transaksi GL; satu di antaranya (5110) `difference` = 0 | tidak diperlukan (Q1) |
| Σ `difference` seluruh akun | **0**; Σnet juga 0, konsisten dengan Σdebit = Σkredit | tidak diperlukan (Q1) |
| Jumlah akun dengan `note` `balance_type kosong` / `akun soft-deleted` | **0** (tidak ada akun ber-`balance_type` kosong atau soft-deleted) | tidak diperlukan (Q1) |
| Konfirmasi konvensi tanda `balance_amount` terhadap data nyata (debit − kredit untuk semua akun; rumus terkunci di design.md bagian 4, Task 3.1) | **terkonfirmasi sebagian (2026-11-03):** sesuai untuk akun ber-`balance_type` debit yang ditulis `StockEntryService` (5110, 1241); akun ber-`balance_type` kredit tidak punya cache di staging, sehingga belum teruji data. Pada 5110, `balance_amount` −11.341.940.000 sama persis dengan net (debit − kredit), `difference` 0; Σ`balance_amount` seluruh akun = 0 | tidak diperlukan (Q1) |

Akun yang memiliki transaksi GL (8 dari 44; 36 akun lain bernilai nol di semua kolom):

| Akun | Nama | `root_type` | `balance_type` | Σdebit | Σkredit | `net` | `balance_amount` | `difference` |
|---|---|---|---|---|---|---|---|---|
| 1221 | Bank Rupiah | asset | debit | 7.951.666,67 | 4.392.325,00 | 3.559.341,67 | 0 | 3.559.341,67 |
| 1231 | Piutang Dagang | asset | debit | 88.249.325,84 | 0 | 88.249.325,84 | 0 | 88.249.325,84 |
| 1241 | Persediaan Barang | asset | debit | 11.348.640.000 | 49.670.000 | 11.298.970.000 | 11.341.940.000 | **−42.970.000** |
| 2211 | Hutang Dagang Dalam Negeri | liability | credit | 1.210.000 | 369.629.145,84 | −368.419.145,84 | 0 | −368.419.145,84 |
| 2214 | Stock Diterima Tapi Belum Dibayar | liability | credit | 361.677.479,17 | 7.910.000 | **+353.767.479,17 (debit)** | 0 | 353.767.479,17 |
| 4110 | Penjualan | income | credit | 0 | 83.857.000,84 | −83.857.000,84 | 0 | −83.857.000,84 |
| 4210 | HPP Pembelian | income | credit | 49.670.000 | 0 | 49.670.000 | 0 | 49.670.000 |
| 5110 | Penyesuaian Stok | expense | debit | 0 | 11.341.940.000 | −11.341.940.000 | −11.341.940.000 | 0 |

`net` bertanda debit − kredit (negatif = bersaldo kredit). Σ`balance_amount` seluruh akun = 0. Angka dibulatkan ke dua desimal; nilai asli memiliki empat desimal di CSV.

### 2.6 Analisis pola pada baseline saldo

Setiap dugaan dicek ke kode. Label: **terverifikasi** = dibuktikan oleh kode dan/atau aritmetika dari dua berkas; **dugaan, perlu verifikasi** = konsisten dengan data tetapi tidak dapat dibuktikan tanpa rincian per dokumen (berkas yang diserahkan hanya agregat).

**P1. `balance_amount` hanya terisi pada 1241 dan 5110 (konsisten dengan F-09): terverifikasi.**

- `grep` `balance_amount` di `app/` menunjukkan satu-satunya penulis adalah `StockEntryService` (`StockEntryService.php:572, 577, 601, 606, 635, 639`). Listener posting invoice, receipt, delivery note, aset, dan `PaymentEntryService` tidak menyentuhnya. Maka enam akun lain (1221, 1231, 2211, 2214, 4110, 4210) wajar bercache 0 dan `difference` = `net`. Ini bukti data untuk F-09 (cache dijadikan sumber), bukan temuan baru.
- Dashboard "Total Saldo Account" menjumlahkan `accounts.balance_amount` (`database/seeders/DeskSeeder.php:893`). Pada data ini kartu itu menampilkan 0 (Σ`balance_amount` = 0), tidak mencerminkan GL.
- **Arti `difference` 1241 = −42.970.000 (terverifikasi secara aritmetika dan kode).** Kolom `balance_amount` 1241 (11.341.940.000) sama dengan debit dari Stock Entry: pasangan GL Stock Entry mendebit 1241 dan mengkredit akun selisih dengan nilai yang sama, dan akun 5110 hanya bergerak sebesar itu (kredit 11.341.940.000 = cache −11.341.940.000, `difference` 0). Maka debit non-Stock-Entry pada 1241 = 11.348.640.000 − 11.341.940.000 = **6.700.000**, dan seluruh kredit 1241 (**49.670.000**) berasal dari Delivery Note: listener Delivery Note mengkredit akun stok dan mendebit akun HPP (`PostDeliveryNoteGeneralLedger.php:26-34, 36-53`), dan debit 4210 = 49.670.000 sama persis. Jadi `difference` = net − cache = (6.700.000 − 49.670.000) = −42.970.000, yaitu mutasi stok yang tidak melewati `StockEntryService` dan karenanya tidak masuk cache. Asumsi: 5110 hanya menerima Stock Entry.
- **6.700.000 berasal dari jurnal stok/SRNB Purchase Invoice: dugaan, perlu verifikasi.** Jalur lain yang mendebit akun stok adalah Purchase Receipt (0 dokumen berGL) dan retur Delivery Note (tidak ada: 4210 tidak pernah dikredit). Secara aritmetika konsisten dengan 2214: kredit 7.910.000 = 6.700.000 (pasangan stok/SRNB) + 1.210.000 (kredit retur Purchase Invoice yang mendebit 2211 sebesar 1.210.000).

**P2. 2214 (SRNB, liability) bersaldo net debit 353,77 juta sementara `purchase_receipt.with_gl` = 0: terverifikasi sebagai konsekuensi kode dan form; sebab bisnisnya dugaan.**

- Purchase Invoice memposting dua pasang: (a) stok/SRNB sebesar `totalStockGL`, hanya bila > 0 dan bukan retur (`PostPurchaseInvoiceGeneralLedger.php:26-55`); (b) **selalu** debit "akun beban/expense head" dan kredit akun kredit sebesar total invoice (`PostPurchaseInvoiceGeneralLedger.php:57-76`). Akun (b) dipilih pengguna (wajib, `PurchaseInvoiceRequest.php:43-44`) dan **form mengisinya otomatis dengan akun SRNB** untuk expense head dan akun `payable` untuk akun kredit (`resources/js/Pages/Finances/PurchaseInvoice/Form.jsx:54-72`). Jadi tiap Purchase Invoice yang memakai default mendebit 2214 dan mengkredit 2211 sebesar total.
- Data cocok persis: Σkredit 2211 (369.629.145,84) − Σdebit 2214 (361.677.479,17) = 7.951.666,67 = Σdebit 1221 (lihat N-4). Itu konsisten dengan seluruh Purchase Invoice (total 361.677.479,17) mendebit 2214 dan mengkredit 2211, dan kredit 2214 hanya 7.910.000 yang berasal dari jurnal stok/SRNB dan kredit retur (dugaan pada tingkat dokumen; berkas hanya agregat).
- Purchase Receipt memposting GL **hanya pada ALUR-2 dan pada retur** (invoice di-approve lebih dulu): `$totalRatesForGL` "hanya ALUR-2 yang mengisi ini" dan kondisi posting adalah `$returnAgainst || $totalRatesForGL > 0` (`PurchaseReceiptService.php:271-272`, 447, 540). Pada ALUR-1 (receipt lebih dulu) receipt tidak memposting GL dan jurnal stok/SRNB baru dibuat saat invoice di-approve (`PurchaseInvoiceService.php:322-340`). Maka `purchase_receipt.with_gl` = 0 **tidak berarti** tidak ada penerimaan barang, dan **tidak ada kredit SRNB dari Purchase Receipt** pada alur mana pun yang terjadi di data ini.
- **Dugaan, perlu verifikasi:** saldo debit 353,77 juta = total invoice yang didebit ke SRNB dikurangi nilai stok yang dikreditkan (6,7 juta). Penyebabnya bisa invoice yang menagih barang yang belum diterima (ALUR-2 belum disusul receipt), item non-stok yang mengikuti default akun, atau data uji. Query penentu ada di Bagian 3.9 (MENUNGGU). Ini bukan kesalahan data staging semata: pola yang sama akan terjadi di produksi selama default form dan aturan ALUR dipertahankan (N-5).

**P3. 4210 "HPP Pembelian" ber-`root_type` income menerima debit COGS 49,67 juta: klasifikasi terverifikasi berasal dari seeder, bukan dari data staging; benar-tidaknya klasifikasi itu dugaan, perlu verifikasi akuntan.**

- `AccountSeeder` menempatkan 4210 di bawah grup 4200 "Harga Pokok Pembelian" di bawah akar 4000 "Income" (`root_type` income, `report_type` profit_and_loss, `balance_type` credit), dan anak mewarisi `root_type`, `report_type`, `balance_type` induknya (`AccountSeeder.php:19-31, 240-283`). Karena itu CSV menampilkan `balance_type` = credit pada akun yang menerima debit.
- Listener Delivery Note **mensyaratkan** klasifikasi ini: akun HPP dicari dengan `root_type = 'income'` dan `account_type = 'cost_of_goods_sold'` (`app/Listeners/Inventory/Ledger/PostDeliveryNoteGeneralLedger.php:31-34`). Mengubah klasifikasi di seeder tanpa mengubah listener membuat akun tidak ditemukan dan posting Delivery Note gagal (dan `AccountSeeder` memakai `updateOrCreate`, sehingga perubahan itu ikut ke data yang ada pada deploy berikutnya).
- Dampak penyajian: akun bersaldo debit pada akar berwatak kredit akan tampil sebagai pengurang pendapatan; angka laba kotor tetap sama secara aritmetika, tetapi pengelompokan laporan (HPP sebagai beban pokok) bergantung pada kebijakan akuntan. Lihat N-6 (Bagian 3.10).

**P4. Stock Entry pembukaan (11,34 miliar) mengkredit 5110 "Penyesuaian Stok" (expense) alih-alih 3110 "Pembukaan Stock" (equity): terverifikasi sebagai perilaku default form, bukan bug kode posting; bahwa dokumen itu adalah pembukaan stok adalah dugaan.**

- `StockEntryService` mendebit akun stok pertama yang `root_type` asset dan `account_type` stock (`.latest()->first()`, F-06) dan mengkredit **akun selisih yang dipilih pengguna** (`StockEntryService.php:562-566`; `StockEntryRequest.php:31`). Tidak ada akun yang dipilih otomatis oleh kode di sisi layanan.
- Form Stock Entry mengisi akun selisih otomatis dengan akun pertama ber-`root_type` expense dan `account_type` stock_adjustment (yaitu 5110), untuk semua jenis termasuk `item_receipt` (`resources/js/Pages/Inventory/StockEntries/Form.jsx:19-34`). Pilihan akun dibatasi ke liability, equity, atau expense (baris 490-494), sehingga 3110 dapat dipilih tetapi tidak menjadi default. Tidak ada jenis Stock Entry "pembukaan": jenis yang diterima hanya `item_transfer`, `item_issue`, `item_consumption`, `item_receipt` (`StockEntryRequest.php:25`).
- Akun 3110 ber-`account_type` stock tetapi berakar equity, sehingga tidak tertukar dengan akun stok yang dicari kode (`root_type` asset). Berkas yang diserahkan tidak memuat jenis Stock Entry, sehingga bahwa 4 Stock Entry itu adalah "pembukaan" adalah dugaan.
- Dampak: kredit 11,34 miliar masuk ke akun beban sehingga laba tampak meningkat sebesar itu pada laporan laba rugi alih-alih menambah ekuitas. Lihat N-7 (Bagian 3.11).

---

## 3. Hasil known-issue test dan temuan baru (Requirement 7.3)

Test known-issue dan characterization berada di `tests/Feature/Finances/Characterization/` (grup `known-issue` untuk perilaku yang masih salah). Test Payment Entry yang perilakunya kini benar dipindah ke `tests/Feature/Finances/` oleh hotfix (2026-11-04). Fase 0 tidak memperbaiki bug produksi (Requirement 5.7): perbaikan dikerjakan terpisah di hotfix `finance-payment-entry-hotfix` (N-4, F-10, bagian `paid_amount` F-04, N-10, N-11, N-12) dan Task 2.6 (auditor, N-9). Kolom keputusan per temuan (Bagian 3) berisi keputusan pemilik produk tanggal 2026-11-03, dan untuk N-10 sampai N-12 tanggal 2026-11-04. Temuan N-4 sampai N-9 ditambahkan 2026-11-03 setelah data staging diterima (bukan bagian persetujuan laporan versi PR #272/#273).

Ringkasan:

| ID | Temuan singkat | Status bukti | Usulan penanganan |
|---|---|---|---|
| F-04 | Cancel men-soft-delete GL/SLE, tanpa jurnal pembalik; saldo cache dan `paid_amount` tidak dikoreksi | Terkonfirmasi (test) | **Diperbaiki 2026-11-04** untuk bagian `paid_amount` (hotfix `finance-payment-entry-hotfix`); bagian GL: Fase 2 (reversal, D-13); `balance_amount`: Fase 2/5. |
| F-10 | GL pembayaran parsial ke-2 dst. memposting total kumulatif | Terkonfirmasi (test) | **Diperbaiki 2026-11-04** (hotfix `finance-payment-entry-hotfix`). F-11 (FX, temuan terpisah) tetap terbuka (Fase 4). Koreksi data historis diputuskan terpisah. |
| F-11 (FX) | GL pembayaran memposting jumlah mata uang dokumen, bukan dasar; tanpa selisih kurs | Terkonfirmasi (test) | Fase 4 (D-16, D-17); hotfix hanya bila data staging menunjukkan pembayaran FX nyata |
| F-16 | Cancel sebelum job posting → GL aktif untuk dokumen `canceled` | Terkonfirmasi (test) | Fase 2 (FR-P3); hotfix guard bila audit menemukan kasus nyata |
| N-1 | Tanda laba/rugi disposal aset tampak terbalik; jurnal disposal tidak menghapus nilai buku | Terbaca dari kode + test karakterisasi | Tinjau akuntan sebelum Fase 2 (Asset); koreksi dalam Fase 2 |
| N-2 | Purchase Invoice tanpa PO gagal `TypeError` di `onApproved` | Dibaca dari kode; **belum diuji** sebagai kegagalan | Hotfix kecil atau Fase 2 setelah ukuran paparan diketahui |
| N-3 | Baris satu dokumen dapat terpecah lintas detik (`now()` per baris) | Dibaca dari kode; tidak teramati di data staging (0 kelompok tak seimbang) | Tentukan granularitas D-8 sebelum Fase 1 |
| N-4 | Arah jurnal Payment Entry tampak terbalik terhadap konvensi umum bila akun dipilih sesuai filter form | Terverifikasi dari kode; data staging konsisten secara aritmetika (dugaan pada tingkat dokumen) | **Diperbaiki 2026-11-04** (hotfix `finance-payment-entry-hotfix`, satu paket dengan F-10); semantik `account_paid_from`/`account_paid_to` diputuskan 2026-11-04. |
| N-5 | Akun SRNB (2214) bersaldo debit: default akun Purchase Invoice dan jurnal stok/SRNB bergantung pada ALUR | Terverifikasi dari kode dan form; sebab bisnis dugaan | Fase 2 (aturan posting pembelian), dengan akuntan |
| N-6 | HPP (4210) berklasifikasi income di seeder dan diwajibkan listener Delivery Note | Terverifikasi dari seeder dan listener | Fase 2 (peran akun) dengan keputusan akuntan |
| N-7 | Akun selisih Stock Entry default ke 5110 (expense) untuk semua jenis | Terverifikasi dari form; data staging dugaan | Fase 2 (D-26); koreksi data staging oleh pemilik |
| N-8 | Listener Sales/Purchase Invoice memposting baris GL bernilai 0 untuk invoice bernilai 0; Fase 1 akan menolaknya (FR-L2) | Terverifikasi dari kode; 2 baris di staging (soft-deleted) | Fase 1 (adapter harus menanganinya) |
| N-9 | Kolom `approved` dan `posting_*` matriks cakupan tidak bermakna pada data nyata | Terverifikasi (kode dan data) | Diputuskan 2026-11-03 (DV-D a): perbaikan alat audit, Task 2.6, Fase 0 |
| N-10 | Jadwal pembayaran (`PaymentSchedule.paid_amount`) ditimpa, bukan ditambah (3.14) | Terverifikasi dari kode; dibuktikan dengan test yang gagal sebelum perbaikan | **Diperbaiki 2026-11-04** (hotfix `finance-payment-entry-hotfix`) |
| N-11 | Server tidak menjaga status Payment Entry (update, submit ulang, approve di sela commit) (3.15) | Terverifikasi dari kode | **Diperbaiki 2026-11-04** (hotfix; Q10 opsi a dan c, Q11) |
| N-12 (Q12) | Default `paid_amount` tombol bayar invoice (3.16) | Terverifikasi dari kode | **Diperbaiki 2026-11-04** (hotfix) |
| TL-a…TL-d | Temuan lanjutan hotfix (3.17) | Terbuka, belum diputuskan | Lihat 3.17 |

### 3.1 F-04: pembatalan men-soft-delete GL dan SLE

**Bukti test.** `KnownIssues/CancelSoftDeletesLedgerTest` (tiga test):

- `test_f04_cancel_sales_invoice_soft_deletes_ledger_and_leaves_posting_status_posted`: dua baris GL tetap ada tetapi seluruhnya soft-deleted (tidak ada jurnal pembalik); query standar melihat 0 baris; `GlPostingStatus` tetap `posted`.
- `test_f04_cancel_payment_entry_soft_deletes_ledger_but_does_not_restore_invoice_paid_amount`: GL pembayaran di-soft-delete; `paid_amount` faktur **tidak dikembalikan** (tetap 1.000.000) dan status faktur tetap `paid`.
- `test_f04_cancel_stock_entry_soft_deletes_gl_and_sle_but_keeps_cached_account_balances`: GL dan SLE di-soft-delete; `accounts.balance_amount` (+10.000 / −10.000) **tidak dikoreksi**, sehingga snapshot baseline menampilkan `difference` −10.000 pada akun persediaan.

**Mekanisme.** Hook `saving` pada trait `Submitable` meng-`update(['deleted_at' => now()])` massal untuk GL dan SLE dokumen yang statusnya baru berubah ke `canceled` (`app/Traits/Submitable.php:98-106`). `cancel()` pada service hanya mengubah status (`PaymentEntryService.php:159-167`; `SalesInvoiceService::cancel` di baris 604; `StockEntryService::cancel` di baris 684).

**Bukti data staging (2026-11-03).** Dua dokumen `canceled` (satu Sales Invoice dan satu Payment Entry) memiliki seluruh baris GL-nya soft-deleted: `coverage[].canceled_gl_softdeleted` = 1 pada masing-masing jenis, `soft_deleted_expected` = 4 baris, `soft_deleted_unexpected` = 0, tanpa jurnal pembalik. Jadi perilaku F-04 terjadi pada data nyata, bukan hanya di test.

**Dampak.**
- Riwayat ledger hilang dari laporan standar; periode lampau dapat berubah diam-diam (tidak ada pembalik yang diposting di periode terbuka).
- Pembatalan Payment Entry meninggalkan faktur tampak lunas: `paid_amount` dan status tidak dikembalikan (dampak langsung ke AR/AP, terlihat pengguna hari ini).
- Pembatalan Stock Entry membuat `balance_amount` menyimpang dari GL aktif (F-09).
- Update massal lewat Eloquent builder (`GeneralLedger::where(...)->update(...)`) tetap melewati event model, sehingga guard immutability di level model (D-7) tidak akan menangkapnya; perbaikannya harus mengganti hook, bukan hanya menambah guard.
- **Belum diuji:** karena update itu melalui Eloquent builder, global scope `SoftDeletes` dan `exclude_example_data` tetap berlaku pada query-nya. Akibatnya baris GL berstatus `is_example = 1` kemungkinan **tidak ikut di-soft-delete** saat dokumen dibatalkan (bila kolom `is_example` ada), dan baris yang sudah soft-deleted tidak disentuh ulang.

**Usulan penanganan.**
- *Bagian GL (soft-delete → reversal):* **Fase 2**, per D-13 (PENDING). Alasan: mengubah perilaku yang terlihat pengguna dan membutuhkan jurnal pembalik dari Fase 1.
- *Bagian `paid_amount` saat Payment Entry dibatalkan:* **diperbaiki 2026-11-04** (hotfix `finance-payment-entry-hotfix`, satu paket dengan F-10 dan N-4). Alasan: bug AR/AP yang nyata dan lokal pada satu alur, tidak bergantung pada jurnal baru.
- *Bagian `balance_amount`:* **Fase 2**/**Fase 5** (saldo cache dipensiunkan sebagai sumber, FR-R2).

Bentuk usulan diizinkan (DV-C, 2026-11-03); keputusan penanganan disetujui 2026-11-03 (lihat di bawah).

Bukti data untuk bagian `balance_amount`: baseline staging menunjukkan 7 dari 8 akun bertransaksi bercache menyimpang dari GL (Bagian 2.6, P1).

**Keputusan pemilik produk (2026-11-03): disetujui, dipecah menurut bagian.** GL (soft-delete → reversal): Fase 2 (D-13). `paid_amount` saat Payment Entry dibatalkan: hotfix, digabung ke paket hotfix pembayaran (F-10, N-4). `balance_amount`: Fase 2/Fase 5. **Bagian `paid_amount` diperbaiki 2026-11-04** (hotfix `finance-payment-entry-hotfix`). Tetap terbuka: bagian GL (Fase 2) dan `balance_amount` (Fase 2/5).

### 3.2 F-10: pembayaran parsial memposting total kumulatif

**Bukti (2026-11-01, sebelum hotfix):** `KnownIssues/PartialPaymentPostsCumulativeAmountTest::test_f10_second_partial_payment_posts_cumulative_amount_instead_of_its_own` memposting 700.000; kini dikonversi menjadi test regresi `tests/Feature/Finances/PaymentEntryPartialPaymentTest.php::test_each_partial_payment_posts_its_own_amount`, yang menegaskan 300.000. Kasus: pembayaran 400.000 lalu 300.000 atas satu faktur 1.000.000. GL pembayaran pertama memposting 400.000 (benar); GL pembayaran kedua (sebelum hotfix) memposting **700.000**, bukan 300.000. Total debit kas 1.100.000 untuk pembayaran total 700.000. `paid_amount` faktur benar (700.000); hanya GL yang berlebih (keadaan sebelum hotfix).

**Mekanisme.** `PaymentEntryService::onApproved` men-dispatch `PaymentApplied` (baris 109; kode sebelum hotfix, induk commit `abb2dbd0`) yang membuat listener `UpdatePaymentableStatus` mengisi `paymentable->paid_amount = newPaidAmount` (kumulatif); kemudian GL diposting dari `$paymentable->paid_amount` (baris 122–139; kode sebelum hotfix, induk commit `abb2dbd0`), bukan dari `$paymentEntry->paid_amount`.

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
| `jumlah_payment_terdampak`, `total_kelebihan_gl` | **MENUNGGU** (query SQL belum dijalankan). Konteks: hanya 6 Payment Entry berGL (1 `canceled`), jadi paparan di staging paling banyak 5 pembayaran aktif; berkas tidak menunjukkan berapa yang parsial | tidak diperlukan (Q1) |

**Usulan penanganan: hotfix terpisah, dikerjakan sebelum backfill Fase 1.** Alasan: (1) perbaikan kecil dan terlokalisasi (memposting jumlah pembayaran ini, bukan jumlah kumulatif); (2) bila tidak diperbaiki, backfill D-8 akan membawa nilai salah ke jurnal baru sebagai jurnal "seimbang"; (3) Fase 4 akan mengganti model alokasi pembayaran sehingga menunggu Fase 4 berarti membiarkan GL baru terus salah. **Koreksi data historis** (jurnal penyesuaian atas selisih yang sudah terposting) adalah keputusan akuntansi terpisah dan memerlukan jurnal manual (D-14).

**Keputusan pemilik produk (2026-11-03): disetujui.** Hotfix satu paket dengan N-4 dan bagian `paid_amount` F-04 (spec `finance-payment-entry-hotfix`, sebelum Fase 1). Data GL staging yang salah tidak dikoreksi otomatis oleh hotfix. **Diperbaiki 2026-11-04** (hotfix `finance-payment-entry-hotfix`). F-11 (FX, temuan terpisah) tetap terbuka (Fase 4).

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
| `jumlah_payment_asing`, total | **MENUNGGU** (query SQL belum dijalankan; berkas `finance:*` tidak memuat mata uang) | tidak diperlukan (Q1) |

**Usulan penanganan: Fase 4**, bukan hotfix. *Bentuk usulan diizinkan (DV-C, 2026-11-03); keputusan penanganan disetujui 2026-11-03 (Fase 4).* Alasan: perbaikan yang benar menyangkut kebijakan tipe kurs (D-16) dan pengakuan selisih kurs terealisasi (D-17), keduanya PENDING dan memerlukan akuntan; tambalan sepihak (mis. memposting `base_paid_amount`) berisiko tidak konsisten dengan jurnal invoice. **Pengecualian:** bila query di atas menemukan pembayaran valuta asing nyata di staging, atau produksi mulai menerima pembayaran valuta asing sebelum Fase 4, ajukan keputusan hotfix sementara atau peringatan operasional.

**Keputusan pemilik produk (2026-11-03): disetujui.** Fase 4 (D-16, D-17), bukan hotfix.

### 3.4 F-16: cancel sebelum job posting dieksekusi

**Bukti test.** `KnownIssues/CancelBeforeQueuedPostingTest::test_f16_listener_running_after_cancel_posts_active_ledger_for_canceled_document`: listener ditahan dengan `Event::fake`, faktur dibatalkan, lalu listener asli (`PostSalesInvoiceGeneralLedger`) dijalankan dengan event yang dibuat sebelum pembatalan. Hasil: dokumen `canceled` memiliki **dua baris GL aktif** dan `GlPostingStatus` `posted`; `finance:audit-gl` melaporkan `canceled_active_gl.count = 1`. Test hanya mencakup Sales Invoice; jenis lain yang memakai listener queued serupa (Purchase Invoice, Receipt, Delivery Note, aset) **belum diuji**.

**Mekanisme.** Hook cancel (F-04, `Submitable.php:98-106`) hanya men-soft-delete baris GL yang sudah ada saat itu; listener queued tidak memeriksa status dokumen sebelum memposting (`PostSalesInvoiceGeneralLedger.php:22-51`).

**Dampak.** GL aktif untuk dokumen yang dibatalkan, tidak terdeteksi oleh pemilik dokumen; saldo akun menggelembung sampai ditemukan. Jendela waktu bergantung pada kelambatan queue (`tries=3`, `backoff` 10/30/60 detik juga memperlebar jendela saat percobaan ulang).

**Ukuran paparan:** hasil `sections.canceled_active_gl.count` dan `coverage[].canceled_active_gl` (Bagian 2).

| Hasil | Staging | Produksi |
|---|---|---|
| `canceled_active_gl.count` (dokumen) | **0** (`sections.canceled_active_gl.count` = 0 dan `coverage[].canceled_active_gl` = 0 untuk seluruh sembilan jenis). **Tidak ada kasus F-16 di staging per 2026-11-03**; hanya 2 dokumen `canceled`, sehingga ini tidak membuktikan bahwa jendela balapan tidak ada | tidak diperlukan (Q1) |

**Usulan penanganan: Fase 2** (FR-P3: job posting yang menemukan dokumen `canceled` tidak memposting). **Hotfix guard** (periksa status dokumen di dalam transaksi listener) bila audit menemukan kasus nyata. Alasan: perbaikan kecil, tetapi baru bermakna bila disertai pembalik untuk kasus yang sudah terjadi (keputusan D-13).

**Keputusan pemilik produk (2026-11-03): disetujui.** Fase 2 (FR-P3), dengan hotfix guard bila ada kasus nyata. Staging: 0 kasus.

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

**Keputusan pemilik produk (2026-11-03): disetujui.** Ditinjau akuntan sebelum Fase 2.

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
| Jumlah PI tanpa PO, per status | **MENUNGGU** (query SQL belum dijalankan; berkas `finance:*` tidak memuat `purchase_order_id`) | tidak diperlukan (Q1) |

**Usulan penanganan.** Bila query menunjukkan PI tanpa PO nyata, **hotfix kecil terpisah** (event menerima PO nullable dan listener melewati rekalkulasi bila tidak ada PO). Bila tidak ada, masukkan ke **Fase 2** (refactor `PurchaseInvoiceService`), dan tambahkan test yang mengunci kegagalan terlebih dahulu. Alasan menunggu data: tanpa jalur nyata, risikonya rendah.

**Keputusan pemilik produk (2026-11-03): disetujui.** Hotfix kecil bila ada Purchase Invoice tanpa PO nyata; selain itu Fase 2.

### 3.7 N-3 (tambahan, dari verifikasi kode): baris satu dokumen dapat terpecah lintas detik

Bukan bagian permintaan awal; dicatat karena memengaruhi akurasi estimasi backfill (Bagian 4).

**Bukti (kode).** `StockEntryService` (baris 587, 596, 616, dan seterusnya) dan `PostAssetDisposalGainLoss` (baris 63, 71, 81, 89) memanggil `now()` **terpisah untuk setiap baris GL**, sedangkan `transaction_date` bertipe `datetime` tanpa pecahan detik. Jika dua baris pasangan jatuh di sisi berbeda batas detik, keduanya tersimpan dengan `transaction_date` berbeda. Listener lain memakai satu `$event->transactionDate` untuk seluruh baris sehingga tidak terpengaruh.

**Dampak.** Pengelompokan D-8 dan auditor (`GROUP BY referenceable_type, referenceable_id, transaction_date`) memperlakukan baris yang terpisah itu sebagai dua kelompok yang masing-masing **tampak tak seimbang**, padahal dokumennya seimbang. Frekuensinya **belum dapat diukur dari data ini**; diagnosis ada di Bagian 4.3.

**Data staging (2026-11-03).** Tidak ada kelompok tak seimbang, dan 28 kelompok = 28 dokumen berGL aktif (Bagian 2.2), sehingga tidak ada pemecahan yang teramati. Cakupannya sempit: hanya 4 Stock Entry yang berpotensi terpengaruh dan tidak ada disposal aset (`asset.with_gl` = 0). Ini tidak membuktikan risikonya tidak ada pada volume lebih besar.

**Usulan penanganan.** Ukur di staging (Bagian 4.3) lalu tentukan granularitas pengelompokan D-8 (per dokumen, atau per tanggal, atau per `datetime` dengan toleransi) **sebelum** spec Fase 1 difinalkan. Tidak ada perubahan kode di fase ini.

**Keputusan pemilik produk (2026-11-03): disetujui.** Fase 1; granularitas D-8 ditentukan sebelum spec Fase 1 final.

**Granularitas D-8 diputuskan 2026-11-04 (pemilik produk):** backfill mengelompokkan per dokumen (`referenceable_type` + `referenceable_id`), dan kelompok dipecah per **tanggal** hanya bila dokumen punya posting pada hari berbeda. Pasangan baris yang hanya berbeda detik (N-3) karenanya tetap satu jurnal. Lihat D-8 di decision log dan PRD Bagian 7 dan 11. Auditor Fase 0 tetap mengelompokkan per (`referenceable_type`, `referenceable_id`, `transaction_date`) penuh dan tidak diubah (alat ukur Fase 0); pada data staging hasilnya sama dengan pengelompokan baru (28 kelompok = 28 dokumen).

### 3.8 N-4 (baru, dari baseline staging): arah jurnal Payment Entry tampak terbalik

**Status verifikasi: terverifikasi dari kode; data staging konsisten secara aritmetika, tetapi pada tingkat dokumen itu dugaan, perlu verifikasi (berkas hanya agregat).**

**Bukti (kode).**
- `PaymentEntryService::onApproved` mendebit `accountPaidFrom` dan mengkredit `accountPaidTo` untuk semua jenis pembayaran (`PaymentEntryService.php:117-139`; kode sebelum hotfix, induk commit `abb2dbd0`). Test karakterisasi mengunci ini: "Debit = `account_paid_from`, kredit = `account_paid_to`, tanpa memandang payment_type" (`PaymentEntryPostingTest::test_full_payment_debits_paid_from_and_credits_paid_to_with_payment_date`).
- Form membatasi pilihan akun menurut jenis: untuk **`receive`**, `account_paid_from` harus akun `receivable` dan `account_paid_to` akun asset (kas/bank); untuk **`pay`**, `account_paid_from` akun asset (kas/bank) dan `account_paid_to` akun `payable` (`resources/js/Pages/Finances/PaymentEntries/Form.jsx:439-470`).
- Maka pembayaran yang dipilih sesuai filter form menghasilkan: terima dari pelanggan = **debit Piutang, kredit Bank**; bayar ke pemasok = **debit Bank, kredit Utang**. Keduanya berlawanan dengan konvensi umum (terima: debit Bank, kredit Piutang; bayar: debit Utang, kredit Bank). Fixture test memakai kas sebagai `paid_from` untuk pembayaran `receive` (`tests/Support/BuildsFinanceFixtures.php:231-247`), yang tidak sesuai filter form, sehingga test tidak memperlihatkan inversi ini.
- **Default sistem juga berarah sama.** Untuk Sales Invoice non-retur, default server mengisi `account_paid_from` = `$salesInvoice->debitAccount` (piutang) dan `account_paid_to` = bank (`app/Http/Controllers/Finances/PaymentEntryController.php:80-81`). Form klien memberi default yang sama: untuk pihak pemasok `account_paid_to` diisi `credit_account` (utang), selain itu `account_paid_from` diisi `debit_account` (`resources/js/Pages/Finances/PaymentEntries/Form.jsx:391-411`). Jadi pengguna yang menerima default menghasilkan debit Piutang/kredit Bank tanpa memilih akun sendiri.
- **Label tidak membalik makna.** Label "Akun Dibayar Dari" dan "Akun Dibayar Kepada" (`lang/id/finances/paymentEntry.php:28-29`; berkas ini berada di folder `finances`) menegaskan bahwa tidak ada konvensi penamaan yang membuat "dari" berarti sisi debit; "dibayar dari" tetap sisi pembayar.
- **Catatan sampingan (terverifikasi kode, belum diuji):** (a) default server Purchase Invoice memakai `$purchaseInvoice->debitAccount` (`PaymentEntryController.php:108`), padahal model `PurchaseInvoice` tidak memiliki relasi itu (relasi akunnya `expenseHeadAccount` dan `creditAccount`, `PurchaseInvoice.php:184, 188`), sehingga hasilnya `null`; (b) default yang sama mengisi `account_paid_to` = bank (`:109`), berlawanan dengan filter jenis `pay` (`paid_to` = akun utang); (c) untuk dokumen retur, `account_paid_to` diisi `customer_id` (`:81` dan `:109`): pada Sales Invoice itu ID pelanggan, bukan akun; pada Purchase Invoice atribut `customer_id` tidak ditemukan di migration maupun model, sehingga hasilnya `null`.

**Bukti (data staging, dugaan, perlu verifikasi).** Piutang 1231 menerima debit 4.392.325,00 di luar total Sales Invoice (Σdebit 1231 88.249.325,84 − Σkredit 4110 83.857.000,84 = 4.392.325,00), dan nilai yang sama persis dikredit ke Bank 1221 (Σkredit 1221 = 4.392.325,00): pola debit Piutang/kredit Bank. Utang 2211 menerima kredit 7.951.666,67 di luar total Purchase Invoice (369.629.145,84 − 361.677.479,17), sama dengan Σdebit Bank 1221 (7.951.666,67): pola debit Bank/kredit Utang. Kedua pola cocok dengan inversi di atas. Tidak ada kredit pada 1231 dan tidak ada debit pada 2211 selain retur Purchase Invoice, jadi tidak ada pembayaran yang mengurangi piutang atau utang di GL.

**Dampak.** Pelunasan piutang justru menambah saldo debit Piutang dan mengurangi Bank, sedangkan pembayaran utang menambah saldo kredit Utang dan menambah Bank. Saldo Kas/Bank, Piutang, dan Utang di GL melenceng dari subledger dokumen (`paid_amount` faktur benar). Jurnal tetap seimbang sehingga **tidak terdeteksi** oleh `finance:audit-gl`. Bila arah ini tertanam ke parity test Fase 2, kesalahan terkunci di engine.

**Usulan penanganan: hotfix terpisah, satu paket dengan F-10** (kedua bug berada di `PaymentEntryService::onApproved` baris 117-139 (kode sebelum hotfix, induk commit `abb2dbd0`); memperbaikinya sekali lebih aman daripada dua kali). Alasan: dampaknya langsung ke saldo Kas/Bank, Piutang, dan Utang; perbaikan terlokalisasi. Syarat sebelum dikerjakan: (1) pemilik produk dan akuntan mengonfirmasi semantik `account_paid_from`/`account_paid_to` pada form; (2) test karakterisasi dan fixture yang mengunci arah lama dibalik bersamaan; (3) koreksi data historis (staging bernilai kecil; produksi kosong) diputuskan terpisah. Bila pemilik produk memilih menunggu, minimal sebelum backfill Fase 1 dan sebelum parity Fase 2 untuk Payment. Status 2026-11-04: Syarat (1): semantik diputuskan pemilik produk 2026-11-04 (Q1 hotfix); syarat konfirmasi akuntan dikesampingkan oleh pemilik produk 2026-11-04.

**Keputusan pemilik produk (2026-11-03): disetujui.** Hotfix satu paket dengan F-10 (spec `finance-payment-entry-hotfix`, sebelum Fase 1). Data GL staging yang salah tidak dikoreksi otomatis oleh hotfix. **Diperbaiki 2026-11-04** (hotfix `finance-payment-entry-hotfix`); semantik `account_paid_from`/`account_paid_to` diputuskan 2026-11-04 (debit `account_paid_to`, kredit `account_paid_from`).

### 3.9 N-5 (baru, dari baseline staging): akun SRNB 2214 bersaldo debit

**Status verifikasi: perilaku kode dan form terverifikasi; sebab bisnis pada data staging dugaan, perlu verifikasi.**

**Bukti.** Lihat Bagian 2.6, P2. Ringkasnya: (a) form Purchase Invoice mengisi expense head dengan akun SRNB (`Form.jsx:54-72`) dan `PostPurchaseInvoiceGeneralLedger` mendebitnya sebesar total invoice (baris 57-76); (b) jurnal stok/SRNB dibuat hanya sebesar `totalStockGL` (baris 26-55); (c) Purchase Receipt memposting GL hanya pada ALUR-2 dan pada retur (`PurchaseReceiptService.php:271-272, 540`: `$returnAgainst || $totalRatesForGL > 0`), dan pada ALUR-1 jurnal stok baru dibuat saat invoice di-approve (`PurchaseInvoiceService.php:322-340`). Data staging: `purchase_receipt.with_gl` = 0 dan 2214 net debit 353.767.479,17 (angka berkas); bahwa Σdebit 2214 sama dengan total Purchase Invoice adalah **dugaan, perlu verifikasi** (inferensi dari aritmetika agregat, lihat P2).

**Dampak.** (1) Penerimaan barang yang belum ditagih (ALUR-1 sebelum invoice) tidak muncul di GL: stok di GL tertinggal dari SLE dan kewajiban "diterima belum ditagih" tidak tercatat. (2) Akun liabilitas bersaldo debit pada Neraca, dan sebagian nilainya (pajak, item non-stok) tidak pernah dikliringkan oleh jurnal stok. (3) Perilaku ini berbeda dari pola umum (penerimaan barang mendebit stok dan mengkredit SRNB saat receipt), sehingga Fase 2 harus memutuskan perlakuan sebelum jurnal pembelian diposting lewat engine (terkait Q-P2-5 untuk diskon pembelian stok).

**Ukuran paparan (read-only, staging; MENUNGGU).** Distribusi akun expense head pada Purchase Invoice dan status dokumen:

```sql
SELECT a.account_number, COUNT(*) AS jumlah_pi, ROUND(SUM(pi.amount), 4) AS total_amount
FROM purchase_invoices pi
JOIN accounts a ON a.id = pi.expanse_head_account_id
WHERE pi.deleted_at IS NULL
GROUP BY a.account_number;

SELECT status, COUNT(*) AS jumlah FROM purchase_invoices WHERE deleted_at IS NULL GROUP BY status;
```

| Hasil | Staging | Produksi |
|---|---|---|
| Distribusi `expanse_head_account_id` dan status Purchase Invoice | MENUNGGU (query belum dijalankan) | tidak diperlukan (Q1) |

**Usulan penanganan: Fase 2** (aturan posting pembelian dan peran akun, D-26/D-27), dengan masukan akuntan (R-4). Alasan: menyangkut kebijakan perlakuan penerimaan barang yang belum ditagih dan default akun; bukan perbaikan lokal. Data staging adalah data uji; tidak ada koreksi data yang diusulkan di sini.

**Keputusan pemilik produk (2026-11-03): disetujui.** Fase 2.

### 3.10 N-6 (baru, dari baseline staging): HPP 4210 berklasifikasi income

**Status verifikasi: klasifikasi seeder dan keterkaitannya dengan listener terverifikasi; apakah klasifikasi itu keliru adalah dugaan, perlu verifikasi akuntan.**

**Bukti.** Bagian 2.6, P3: `AccountSeeder.php:240-283` (4210 di bawah akar income, balance_type credit) dan `app/Listeners/Inventory/Ledger/PostDeliveryNoteGeneralLedger.php:31-34` (mencari akun dengan `root_type = 'income'` dan `account_type = 'cost_of_goods_sold'`). Ini klasifikasi default seeder, bukan keanehan data staging.

**Dampak.** Akun HPP bersaldo debit berada pada akar berwatak kredit; penyajian laporan (Fase 5, D-26: saldo bertanda menurut `balance_type`) akan menampilkannya sebagai pengurang pendapatan, bukan beban pokok. Mengubah klasifikasi tanpa mengubah listener memutus posting Delivery Note.

**Usulan penanganan: Fase 2** (peran akun `cost_of_goods_sold` melalui resolver, tidak lagi dicari lewat `root_type`) bersama keputusan akuntan atas bagan akun (D-11/Q2 ditunda). Tidak ada hotfix: perubahan seeder sepihak berisiko memutus posting.

**Keputusan pemilik produk (2026-11-03): disetujui.** Fase 2.

### 3.11 N-7 (baru, dari baseline staging): akun selisih Stock Entry default ke 5110

**Status verifikasi: perilaku default form terverifikasi; bahwa Stock Entry pada data staging adalah pembukaan stok adalah dugaan, perlu verifikasi.**

**Bukti.** Bagian 2.6, P4: `Form.jsx:19-34` (default akun selisih = akun expense bertipe stock_adjustment untuk semua jenis), `StockEntryService.php:562-566`, `StockEntryRequest.php:25, 31`. Tidak ada jenis Stock Entry "pembukaan".

**Dampak.** Stok awal yang dimasukkan lewat `item_receipt` dengan akun default mengkredit akun beban (11,34 miliar di staging), sehingga laba tampak meningkat alih-alih ekuitas bertambah (akun 3110 tersedia tetapi harus dipilih manual). Pada produksi, hal yang sama berlaku untuk saldo awal.

**Usulan penanganan: Fase 2** (D-26: akun ditentukan konfigurasi, termasuk akun selisih per jenis Stock Entry atau jenis "pembukaan"). Untuk staging, koreksi data (memilih 3110) adalah tindakan pemilik data, bukan perubahan kode. Pertimbangkan panduan operasional sebelum produksi menginput saldo awal.

**Keputusan pemilik produk (2026-11-03): disetujui.** Fase 2.

### 3.12 N-8 (baru, dari audit staging): baris GL bernilai nol untuk invoice bernilai nol

**Status verifikasi: perilaku kode terverifikasi; bahwa kedua baris staging berasal dari invoice bernilai nol adalah dugaan, perlu verifikasi (berkas tidak memuat total dokumen).**

**Bukti.** Dua baris GL Sales Invoice yang di-soft-delete bernilai debit 0 dan kredit 0 (Bagian 2.2). `SalesInvoiceService::onApproved` membuat `GlPostingStatus` dan men-dispatch event posting tanpa memeriksa `totalAmount` (`SalesInvoiceService.php:337-350`), dan `PostSalesInvoiceGeneralLedger` menulis pasangan baris dengan `totalAmount` apa adanya (`PostSalesInvoiceGeneralLedger.php:22-51`). Pasangan expense/kredit Purchase Invoice "selalu dibuat" (`PostPurchaseInvoiceGeneralLedger.php:57-76`). Berbeda dengan Purchase Receipt yang memposting bila total > 0 atau retur (`PurchaseReceiptService.php:540`: `$returnAgainst || $totalRatesForGL > 0`).

**Dampak.** Pada kode sekarang baris nol aktif akan lolos (kategori `zero_or_negative` akan menandainya). Pada Fase 1, `JournalService` menolak baris bernilai nol pada kedua sisi (FR-L2), sehingga adapter yang memanggil `JournalService` dari listener existing **akan gagal saat approve invoice bernilai nol** bila tidak ditangani (regresi perilaku). Auditor tidak menandai dua baris staging karena keduanya sudah soft-deleted.

**Usulan penanganan: Fase 1** (adapter dan aturan backfill harus melewati atau menandai jurnal bernilai nol secara eksplisit, dan spec Fase 1 mencatat keputusannya). Alasan: dampak langsung pada rancangan adapter FR-L2; bukan bug produksi yang mendesak.

**Keputusan pemilik produk (2026-11-03): disetujui.** Fase 1.

### 3.13 N-9 (baru, dari matriks staging): kolom `approved` matriks cakupan tidak bermakna

**Status verifikasi: terverifikasi (kode dan data).**

**Bukti.** Data: `approved` = 0 pada delapan jenis berkolom `status` (jadwal depresiasi aset tanpa kolom `status`: null) sementara `with_gl` > 0 pada lima jenis (Bagian 2.4). Kode: matriks menghitung `approved` dan himpunan subjek `posting_not_posted`/`posting_missing` dengan `whereJsonContains('status', 'approved')` (`DocumentCoverageMatrix.php:81, 97-100`); `onApproved` menimpa status: Sales Invoice (`SalesInvoiceService.php:357-359`) dan Purchase Invoice (`PurchaseInvoiceService.php:376`) menjadi `unpaid`/`returned`, Purchase Receipt (`PurchaseReceiptService.php:152`) `received`/`returned`, Delivery Note (`DeliveryNoteService.php:192`) `delivered`/`returned`, Stock Entry (`StockEntryService.php:316`) `completed`, Payment Entry (`PaymentEntryService.php:111-115`) `paid`. Test auditor lulus karena fixture menyetel status `approved` secara manual (`GeneralLedgerAuditorTest.php:103-163`) (kode versi PR #274, sebelum Task 2.6).

**Dampak.** Requirement 2.2 (menandai dokumen approved yang `GlPostingStatus`-nya bukan `posted`) tidak terpenuhi pada data nyata; `posting_not_posted` = 0 dan `posting_missing` = 0 pada delapan jenis berkolom `status` tidak menjadi bukti bahwa tidak ada posting `pending`/`failed`/hilang (jenis `asset_depreciation_schedule` tidak terdampak: subjeknya seluruh jadwal). Ini hanya memengaruhi alat audit, bukan perilaku produksi. Kolom `canceled*` tidak terdampak. `posting_missing` juga hanya kolom informasi (DV-E, 2026-11-04): baris `gl_posting_statuses` dibuat bersyarat pada empat jenis selain Sales dan Purchase Invoice, sehingga nilai > 0 belum tentu anomali.

**Usulan penanganan: perbaikan alat audit** (kode baru Fase 0, bukan perilaku produksi; satu perubahan kecil pada `DocumentCoverageMatrix` dan test-nya: subjek = dokumen berstatus pasca-`onApproved` menurut daftar **per jenis** pada tabel *Definisi `approved` pada matriks* di `design.md`, bukan satu himpunan bersama; `submitted` berarti pasca-persetujuan hanya untuk Asset dan Asset Value Adjustment). Verifikasi: status tiap jenis ada di `FormStatus.php`; `onApproved` menetapkan `unpaid`/`returned` (Sales dan Purchase Invoice), `received`/`returned` (Purchase Receipt), `delivered`/`returned` (Delivery Note), `completed` (Stock Entry), `paid` (Payment Entry), dan `UpdatePaymentableStatus` menetapkan `partially_paid`/`paid` pada faktur; `overdue` ada di enum tetapi tidak ditemukan diset oleh kode (satu-satunya rujukan dikomentari di `StockEntry.php:48`) dan dicantumkan hanya agar aman. **Jangan** memakai definisi negatif ("bukan draft/canceled/rejected"), karena `need_approval` dan status lain di luar daftar ikut terhitung; gunakan daftar positif per jenis. `need_approval` adalah status pra-persetujuan di alur approval (`ApprovalService.php:37`); `submitted` baru pasca-persetujuan pada Asset dan Asset Value Adjustment. **Keputusan: diputuskan pemilik produk 2026-11-03 (DV-D a); diimplementasikan Task 2.6**, yaitu perbaikan auditor di Fase 0 sebelum Task 8 (auditor adalah kode Fase 0; bentuk "fase terkait" pada Req 7.3, DV-C). Lihat DV-D di `finance-decision-log.md`. Sementara itu, indikator posting `pending`/`failed` dapat dibaca langsung dari tabel `gl_posting_statuses` (query MENUNGGU):

```sql
SELECT referenceable_type, status, COUNT(*) AS jumlah FROM gl_posting_statuses GROUP BY referenceable_type, status;
```

| Hasil | Staging | Produksi |
|---|---|---|
| Distribusi `gl_posting_statuses` per jenis dan status | MENUNGGU (query belum dijalankan) | tidak diperlukan (Q1) |

**Keputusan pemilik produk (2026-11-03): disetujui.** Perbaikan alat audit, Task 2.6 (DV-D opsi a), dikerjakan sebelum Task 8; selesai 2026-11-04 (PR #275).

---

### 3.14 N-10 (baru, dari hotfix 2026-11-04): jadwal pembayaran ditimpa, bukan ditambah

**Status verifikasi: terverifikasi dari kode; dibuktikan dengan test yang gagal sebelum perbaikan** (spec `finance-payment-entry-hotfix` Requirement 3).

**Bukti.** `outstanding_amount` adalah kolom generated `payment_amount - paid_amount` (`database/migrations/2025_09_06_094005_create_payment_schedules_table.php:22`). Kode lama (`PaymentEntryService.php:93-106`) membaca sisa jadwal lalu menetapkan `paid_amount` jadwal ke jumlah pembayaran terakhir, tanpa menambahkan ke nilai sebelumnya. Contoh: 400.000 lalu 300.000 menghasilkan 300.000, seharusnya 700.000; jadwal yang sudah lunas di-reset ke 0 pada pembayaran berikutnya. Rujukan baris kode di bukti ini adalah kode sebelum hotfix (induk commit `abb2dbd0`).

**Dampak.** Sisa tagihan per termin tidak akurat, dan pembatalan pembayaran tidak dapat mengembalikan jadwal dengan benar.

**Usulan penanganan.** Hotfix, ikut paket pembayaran. Alokasi dihitung dari total dengan urutan `due_date` lalu `id`.

**Keputusan pemilik produk (2026-11-04): diperbaiki di hotfix** (Q3). Diperbaiki 2026-11-04 (`finance-payment-entry-hotfix`, Requirement 3).

### 3.15 N-11 (baru, dari hotfix 2026-11-04): server tidak menjaga status Payment Entry

**Status verifikasi: terverifikasi dari kode** (spec hotfix Requirement 5, butir F16 dan F17).

**Bukti.** Route `PUT /paymentEntries/{paymentEntry}/{level?}` (`routes/web.php:110-111`) diteruskan ke `PaymentEntryController::update` lalu `PaymentEntryService::update` tanpa pemeriksaan status `draft`. Di jalur approver, `DB::commit()` dijalankan sebelum `onApproved` (`ApprovalInstanceController.php:174-182`), dan `onApproved` tidak memeriksa ulang status Payment Entry di bawah kunci (`PaymentEntryService.php:75-144`). Submit ulang atas Payment Entry non-draft menerapkan efek samping lagi: nomor baru lewat `FormatingSeries::generate` dan `DocumentSubmitted` dikirim ulang. Rujukan baris kode di bukti ini adalah kode sebelum hotfix (induk commit `abb2dbd0`).

**Dampak.** Pembayaran dapat tercatat dua kali, dan pembatalan tidak selalu membalik nilai yang sama dengan yang diterapkan.

**Usulan penanganan.** Guard di server: `update` menolak Payment Entry non-draft (opsi a); `onApproved` memeriksa ulang status di bawah kunci (opsi c); guard `submit` ikut (Q11). Opsi (b) tidak dipakai.

**Keputusan pemilik produk (2026-11-04): diperbaiki di hotfix** (Q10 opsi a dan c, Q11).

### 3.16 N-12 (Q12, baru 2026-11-04): default `paid_amount` tombol bayar invoice

ID N-12 ditetapkan di bagian ini pada 2026-11-04 (Q12 pada spec hotfix).

**Status verifikasi: terverifikasi dari kode** (spec hotfix Requirement 10, butir F22).

**Bukti.** `PaymentSchedule::getDetailPayment` menjumlahkan `payment_amount` jadwal yang `outstanding_amount`-nya masih positif (`PaymentSchedule.php:107-127`), bukan sisanya. `PaymentEntryController::create` memakainya sebagai `paid_amount` default untuk Sales Invoice dan Purchase Invoice. Rujukan baris kode di bukti ini adalah kode sebelum hotfix (induk commit `abb2dbd0`).

**Dampak.** Setelah pembayaran parsial 400.000 atas faktur 1.000.000, default tetap 1.000.000 dan ditolak validasi batas atas (Requirement 7).

**Keputusan pemilik produk (2026-11-04): diperbaiki di hotfix**, default menjadi `min(total sisa jadwal, sisa faktur)` (Q12).

### 3.17 Temuan lanjutan dari pengerjaan hotfix ((a) s.d. (d) belum diputuskan; (e) sudah diputuskan, PB-9)

Temuan (a) s.d. (d) ditemukan saat mengerjakan hotfix dan belum diputuskan. Status verifikasi mengikuti spec hotfix; butir (d) berstatus belum diuji. Butir (e) sudah diputuskan (PB-9) dan belum dikerjakan.

- **(a)** Default `paid_amount` = 0 bila jadwal pertama lunas dan cicilan berikutnya belum jatuh tempo; kandidat perbaikan UX.
- **(b)** `DB::commit()` eksplisit di `Submitable::checkApproval` (DV-4 di design hotfix). Perubahan generik yang memengaruhi semua dokumen submitable; tidak diubah oleh hotfix.
- **(c)** Dua berkas test menyebut `print_templates` tanpa `RefreshDatabase`/`DatabaseTransactions`/`DatabaseMigrations` di berkasnya sendiri: `tests/Feature/Core/PrintTemplate/PrintPdfControllerTest.php` dan `tests/Feature/Core/PrintTemplateRequestTest.php` (kriteria diverifikasi dengan grep; PR #276 hanya mengubah `tests/TestCase.php`, sehingga butir ini tetap terbuka).
- **(d)** Jalur retur dan `internal_transfer` di Payment Entry (Q4 hotfix): dugaan `ModelNotFoundException` pada retur (belum diuji); `internal_transfer` lolos validasi tanpa pengecekan `partyable` dan `paymentable`. Hotfix tidak boleh menambah kegagalan pada jalur ini.
- **(e)** TL-e: N-2 tetap terbuka (sudah diputuskan PB-9; belum dikerjakan; lihat 3.6).

## 4. Estimasi beban backfill Fase 1 (Requirement 7.4)

**Status: angka staging terisi (uji coba migrasi), sumber `audit-20261103-155516.json` (`generated_at` 2026-11-03T15:55:16+00:00).** Rumus dan metode tetap seperti di bawah. Angka tidak berasal dari DB lokal dan bukan perkiraan. Produksi: **nol** (GL produksi kosong, Q1 dijawab 2026-11-03), sehingga beban backfill produksi per 2026-11-03 = 0; estimasi ini berlaku sebagai uji coba pada staging. Ukuran batch (B) dan waktu per batch (t_batch) **tidak diukur** dan tidak diisi.

### 4.1 Metode dan sumber angka

Dasar: D-8 (PRD Bagian 7 dan 11; **diubah 2026-11-04**: semula per (`referenceable_type`, `referenceable_id`, `transaction_date`), kini per (`referenceable_type`, `referenceable_id`) dengan pemecahan per tanggal hanya bila dokumen punya posting di hari berbeda). Angka di bawah dihitung auditor dengan pengelompokan lama yang lebih rinci; pada staging keduanya sama (28 kelompok = 28 dokumen). Baris `general_ledgers` menjadi satu `journal` per kelompok; kelompok seimbang → `posted`; kelompok tak seimbang → `legacy_unbalanced = true`, tidak dikoreksi otomatis; backfill idempoten dan tidak mengubah `debit`/`credit` lama. Baris yang sudah soft-deleted (`totals.rows_soft_deleted`) **dikecualikan** dari backfill (catatan D-13: data lama yang soft-deleted tetap apa adanya). Semua angka di bawah berasal dari baris **aktif**.

Simbol: **R** = `totals.rows`; **G** = `totals.groups`; **U** = `sections.unbalanced_groups.count`; **D** = `sections.unbalanced_groups.total_diff`.

| Besaran | Rumus | Field JSON sumber | Staging | Produksi |
|---|---|---|---|---|
| Jumlah baris yang diberi `journal_id` | R | `totals.rows` | **60** | tidak diperlukan (Q1) |
| Jumlah `journal` yang dibuat | G | `totals.groups` | **28** | tidak diperlukan (Q1) |
| Rata-rata baris per kelompok | R ÷ G | `totals.rows`, `totals.groups` | **2,14** (60 ÷ 28) | tidak diperlukan (Q1) |
| Kelompok seimbang (`posted`) | G − U | (turunan) | **28** (28 − 0) | tidak diperlukan (Q1) |
| Kelompok tak seimbang (`legacy_unbalanced`) | U | `sections.unbalanced_groups.count` | **0** | tidak diperlukan (Q1) |
| Persentase kelompok tak seimbang | U ÷ G × 100 % | (turunan) | **0 %** (0 ÷ 28) | tidak diperlukan (Q1) |
| Total selisih kelompok tak seimbang | D | `sections.unbalanced_groups.total_diff` | **0** | tidak diperlukan (Q1) |
| Selisih Σdebit − Σkredit seluruh GL | — | `totals.diff` | **0** | tidak diperlukan (Q1) |
| Jumlah batch | ⌈G ÷ B⌉ | (B = ukuran batch) | tidak diisi (B belum ditetapkan; G = 28) | tidak diperlukan (Q1) |
| Durasi backfill | jumlah batch × t_batch | t_batch diukur | tidak diisi (t_batch tidak terukur) | tidak diperlukan (Q1) |

**B dan t_batch bukan asumsi:** keduanya ditetapkan dari uji coba backfill pada salinan data staging pada saat Fase 1, dan baru kemudian durasi dihitung. Tidak ada nilai default yang dipakai di dokumen ini. Ambang yang menentukan kategori beban (ringan/sedang/berat) juga ditetapkan pemilik produk dan pengembang **setelah** angka tersedia.

Komponen yang membutuhkan penanganan khusus (bukan bagian dari persentase di atas):

| Komponen | Field JSON sumber | Perlakuan yang perlu diputuskan di spec Fase 1 | Staging | Produksi |
|---|---|---|---|---|
| GL yatim (dokumen sumber tidak ada) | `sections.orphan_reference.count` (baris) | `journals.source_*` menggantung; dibackfill atau ditandai | **0** | tidak diperlukan (Q1) |
| Akun hilang atau soft-deleted | `sections.dangling_account.count` (baris; dihitung ganda bila keduanya bermasalah) | Jurnal merujuk akun soft-deleted | **0** | tidak diperlukan (Q1) |
| Baris nol atau negatif | `sections.zero_or_negative.count` (baris) | FR-L2 menolak jurnal baru semacam ini; baris lama perlu aturan lolos/ditandai | **0** aktif (2 baris nol **soft-deleted**, dikecualikan dari backfill; lihat N-8) | tidak diperlukan (Q1) |
| Duplikasi posting | `sections.duplicates.count`, `.extra_rows` | Kandidat posting ganda; **jangan dihapus otomatis** | **0** kelompok, **0** baris berlebih | tidak diperlukan (Q1) |
| Dokumen `canceled` dengan GL aktif | `sections.canceled_active_gl.count` (dokumen) | Aturan backfill untuk GL aktif milik dokumen batal (F-16) | **0** | tidak diperlukan (Q1) |
| GL soft-deleted | `totals.rows_soft_deleted`; `sections.soft_deleted_expected.count`, `soft_deleted_unexpected.count` | Dikecualikan dari backfill; yang `unexpected` perlu dijelaskan | **4** baris (4 diharapkan, 0 anomali), dikecualikan | tidak diperlukan (Q1) |

**Kesimpulan estimasi staging.** Beban backfill staging kecil: 60 baris menjadi 28 jurnal, seluruhnya seimbang, tanpa yatim, akun menggantung, duplikasi, atau GL aktif milik dokumen batal. Backfill staging praktis hanya menguji mekanisme migrasi, bukan kasus sulit. Angka ini **tidak menunjukkan kebenaran jurnal**: lihat F-10, F-11, N-4 sampai N-7 yang menghasilkan jurnal seimbang tetapi salah. Catatan N-3 (`now()` per baris): tidak teramati di data ini (0 kelompok tak seimbang; 28 kelompok = 28 dokumen). Granularitas D-8 telah diubah 2026-11-04 menjadi per dokumen dengan pemecahan per tanggal (Bagian 3.7), sehingga risiko pemecahan lintas detik pada volume lebih besar sudah ditangani oleh aturan backfill; persentase tak seimbang dari auditor (pengelompokan lama) tetap dapat membengkak oleh N-3 dan tidak boleh dibaca sebagai beban backfill baru.

### 4.2 Keterbatasan yang harus dibaca bersama angka

1. **Persentase tak seimbang tidak menggambarkan kebenaran data.** F-10 (GL pembayaran memposting total kumulatif) dan F-11 (pembayaran asing tercatat dalam mata uang dokumen) menghasilkan jurnal yang **seimbang tetapi salah**: kedua sisi sama-sama berlebih atau sama-sama dalam mata uang asing. Kelompok seperti ini lolos sebagai "seimbang" dan akan di-backfill sebagai `posted`. Ukur paparannya dengan query Bagian 3.2 dan 3.3, terpisah dari persentase U ÷ G.
2. **Kelompok tak seimbang dapat membengkak akibat pemecahan lintas detik** (N-3, Bagian 3.7): pasangan baris dengan `now()` terpisah dapat menjadi dua kelompok tak seimbang. Gunakan diagnosis Bagian 4.3 sebelum memakai U sebagai ukuran beban. (Pengelompokan backfill D-8 yang baru, per dokumen, tidak terpengaruh pemecahan ini.)
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
| Kelompok tak seimbang per `referenceable_type` (granularitas auditor) | **0** (turunan dari U = 0; query tidak perlu dijalankan) | tidak diperlukan (Q1) |
| Dokumen tak seimbang per `referenceable_type` (tanpa `transaction_date`) | **0** (turunan: jumlah kelompok seimbang per dokumen juga seimbang; query tidak perlu dijalankan) | tidak diperlukan (Q1) |

---

## 5. Hal yang menunggu dan ketidaksesuaian spec

### 5.1 Daftar persetujuan (Requirement 7.5)

| # | Item | Status |
|---|---|---|
| 1 | Task 6.5: dua berkas `finance:*` dijalankan di staging dan Bagian 2 dan 4 terisi | **SELESAI 2026-11-03** (lingkungan diasumsikan staging) |
| 1a | Hasil skema Req 6.2 (Bagian 1.5.2) dan konfirmasi `APP_ENV` staging ≠ `local` | **SELESAI 2026-11-04** (`APP_ENV` = `staging`; skema sama dengan migration + kolom runtime, tanpa *drift*) |
| 1b | Query SQL tambahan: paparan F-10, F-11, N-2, N-5, `is_example`, dan `gl_posting_statuses` | MENUNGGU (opsional, tidak memblokir; tidak diperlukan karena GL produksi kosong, Q1) |
| 2 | Q1 versi PRD dijawab 2026-11-03: belum ada data sama sekali (GL produksi kosong) | DIJAWAB |
| 3 | Q-P0-1 dijawab 2026-11-03 (pemilik produk menjalankan di staging) | DIJAWAB |
| 4 | Keputusan atas F-04, F-10, F-11, F-16, N-1 sampai N-9 | **DISETUJUI 2026-11-03** (lihat Bagian 3) |
| 4a | Keputusan DV-D (Req 2.2/N-9): opsi (a) disetujui 2026-11-03; implementasi Task 2.6 selesai 2026-11-04 (PR #275) | SELESAI 2026-11-04 |
| 5 | **Persetujuan laporan ini oleh pemilik produk** | **DISETUJUI 2026-11-03** (versi PR #272/#273) |
| 6 | Penutupan Fase 0 (Task 8): exit criteria terpenuhi dan `tests/Feature/Finances` lulus | **SELESAI 2026-11-04** |

Persetujuan pemilik produk: **disetujui, 2026-11-03**, untuk versi laporan hasil PR #272 dan #273 dan, melalui PR #274, untuk tambahan angka staging (Bagian 2 sampai 4) dan temuan N-4 sampai N-9. Keputusan penanganan per bug juga disetujui 2026-11-03 (lihat Bagian 3 dan decision log). Tanggal persetujuan: 2026-11-03.

### 5.2 Ketidaksesuaian dengan dokumen spec yang ditemukan saat penyusunan

Butir 1 sampai 3 sudah **dikoreksi di PRD** (`finance-engine-prd.md`, Lampiran A, bertanda koreksi 2026-11-03), bukan sekadar diusulkan. Butir 4 sampai 7 tetap dicatat untuk keputusan pemilik produk (butir 6 dan 7 ditambahkan 2026-11-03 bersama data staging). Laporan ini tidak mengubah dokumen lain.

1. **PRD F-12** (sudah dikoreksi) menyebut kolom runtime "di lingkungan lokal **menghapusnya** bila flag trait dicabut". Pada kode, penghapusan `have_transactions` pada model submitable berjalan **di semua lingkungan** (`DataTable.php:648-652`); hanya dua penghapusan lainnya yang dibatasi `app()->isLocal()`. Pemeriksaan penambahan dan penghapusan itu dijalankan pada setiap deploy karena `db:seed --force` berjalan otomatis (`.scripts/deploy-staging.sh:67`, `.scripts/deploy-production.sh:68`).
2. **PRD F-12** (sudah dikoreksi) mencantumkan kolom `accounts` saja; `general_ledgers` juga memperoleh `is_example`, `code` (unik), dan `have_transactions` yang tidak ada di migration (Bagian 1.2).
3. **PRD F-04** (sudah dikoreksi) merujuk `SalesInvoiceService::cancel` di sekitar baris 386; posisi aktualnya baris 604.
4. **Req 7.1** menyebut laporan merangkum hasil audit staging dan produksi, sedangkan Req 6.2 hanya menyebut staging; Q1 di PRD dan di spec dirumuskan berbeda (lihat catatan di [`finance-decision-log.md`](finance-decision-log.md)); keduanya dijawab 2026-11-03 (versi PRD: belum ada data sama sekali (GL produksi kosong); versi spec: untuk sekarang staging saja).
5. Rumus baseline saldo pada `design.md` bagian 4 (Task 3.1) **terkonfirmasi sebagian (2026-11-03):** sesuai untuk akun ber-`balance_type` debit yang ditulis `StockEntryService` (5110, 1241); akun ber-`balance_type` kredit tidak punya cache di staging, sehingga belum teruji data (Bagian 2.5; pada 5110 `difference` 0). Akun lain bercache 0 karena hanya `StockEntryService` yang menulis `balance_amount` (F-09).
6. **Requirement 2.2 dan bagian `DocumentCoverageMatrix` pada `design.md`** mengandaikan dokumen "berstatus `approved`", padahal `onApproved` setiap service menimpa status dengan status lanjutan; pada data nyata `approved` selalu 0 (N-9, Bagian 3.13). Disetujui (DV-D 2026-11-03, DV-E 2026-11-04); Req 2.1/2.2 dan `design.md` sudah disesuaikan; auditor diperbaiki di Task 2.6.
7. **Test karakterisasi Payment Entry** (`PaymentEntryPostingTest`, kini `tests/Feature/Finances/PaymentEntryPostingTest.php` setelah hotfix 2026-11-04) dan fixture `makePaymentEntry` (sebelum hotfix) memakai kas sebagai `account_paid_from` untuk pembayaran `receive`, berbeda dengan filter form (`receive`: `paid_from` = piutang). Sebelum hotfix, test mengunci arah debit = `paid_from` tanpa memperlihatkan inversi terhadap konvensi umum (N-4, Bagian 3.8). Catatan tindak lanjut fixture dan test ada pada entri **DV-D** di `finance-decision-log.md`. Diselesaikan hotfix 2026-11-04 (Req 8.1, 8.2): fixture dan test kini mengikuti filter form.
