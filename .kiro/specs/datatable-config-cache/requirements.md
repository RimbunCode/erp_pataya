# Requirements Document

## Introduction

Caching hasil `Model::getColumns()` (config kolom DataTable) ke DB untuk menghilangkan re-scan mahal (refleksi relasi + introspeksi skema + rekursi) yang terjadi tiap request DataTable/lookup. Cache disimpan sebagai **flat per-model** di table `cache` Laravel (driver `database`), dengan invalidasi **signature-based** + self-healing saat request, dan command artisan `model:cache` untuk warm/clear di muka yang sekaligus memvalidasi config secara strict.

Turunan dari `design.md` (workflow design-first).

## Glossary

- **getColumns**: method static di trait `LinkModel` yang menghasilkan metadata kolom sebuah model (skalar, append/accessor, relasi) untuk DataTable/filter/lookup.
- **Flat per-model**: representasi cache di mana 1 model = daftar kolomnya sendiri saja; entri relasi memiliki `columns: []` (tidak menyertakan kolom anak/nested).
- **Perakitan nested (runtime assembly)**: proses merangkai struktur nested (`columns` relasi terisi) dari beberapa cache flat saat runtime, sesuai `maxDepth` yang diminta.
- **Signature**: `md5` dari hash skema kolom DB + `filemtime` file model + `filemtime` `LinkModel.php`; dipakai sebagai bagian cache key agar perubahan skema/kode otomatis meng-invalidasi cache.
- **Self-healing**: bila request mendeteksi signature berbeda (cache miss), config di-recompute dan cache di-overwrite tanpa menunggu command.
- **Warm**: mengisi cache di muka (sebelum request user) via command, biasanya saat deploy.
- **Superset includeHidden**: payload flat selalu disimpan dengan `includeHidden=true` (memuat FK/ignored ber-flag hidden); varian not-includeHidden diturunkan dengan membuang baris hidden.
- **Validasi strict**: pengecekan config (#1–#5) yang dijalankan command untuk mendeteksi kesalahan seperti append tanpa `dependsOn`, relasi belum terdaftar, token templateLink tak resolvable.

## Requirements

### Requirement 1: Cache flat per-model untuk getColumns

**User Story:** As a developer, I want config kolom tiap model di-cache flat ke DB, so that request DataTable tidak perlu re-scan skema & refleksi tiap kali.

#### Acceptance Criteria

1. THE sistem SHALL menyimpan hasil compute kolom flat tiap model ke cache Laravel dengan driver `database` (table `cache` existing), TANPA membuat table/migration baru.
2. THE cache flat SHALL berisi kolom model itu saja (skalar + append + relasi), DENGAN entri relasi memiliki `columns` kosong (`[]`) — tidak nested.
3. THE cache flat SHALL disimpan sebagai superset `includeHidden=true`.
4. THE payload cache SHALL berupa array murni tanpa Closure.
5. THE sistem SHALL menyimpan cache per model dengan key memuat `(modelClass, signature)`.

### Requirement 2: getColumns tetap mengembalikan struktur nested (output tak berubah)

**User Story:** As a developer, I want `getColumns()` tetap mengembalikan struktur yang sama seperti sebelumnya, so that tidak ada call site atau test existing yang perlu diubah.

#### Acceptance Criteria

1. WHEN `getColumns($maxDepth, $includeHidden, ...$excepts)` dipanggil, THE sistem SHALL mengembalikan struktur identik dengan implementasi lama (termasuk urutan `usort`, isi nested per `maxDepth`, flag hidden, dan cycle-guard `$excepts`).
2. THE sistem SHALL merakit struktur nested di runtime dari cache flat (induk + flat tiap relasi anak ditempel ke `columns`).
3. WHEN `$includeHidden` bernilai false, THE sistem SHALL menurunkan hasil dari superset dengan membuang baris ber-flag hidden.
4. THE sistem SHALL menjaga semantik `maxDepth` lama: `0` → semua level; `1` → relasi `columns:[]`; `2` → 1 level kolom anak; dst.
5. THE perakitan nested SHALL menjaga cycle-guard memakai `$excepts`/visited saat runtime, dan TIDAK menyimpan guard tersebut di cache.
6. THE `PrintTemplate::columns` yang memanggil `getColumns(2)` SHALL tetap menerima kolom anak nested tanpa perubahan pada `PrintTemplate`.

### Requirement 3: Invalidasi signature-based & self-healing

**User Story:** As a developer, I want cache otomatis ter-invalidasi saat skema atau kode model berubah, so that config tidak basi meski lupa menjalankan command.

#### Acceptance Criteria

1. THE signature SHALL dihitung dari `md5` gabungan hash skema kolom DB model, `filemtime` file model, dan `filemtime` `LinkModel.php`.
2. THE signature SHALL menjadi bagian dari cache key.
3. WHEN request mendeteksi cache miss (termasuk akibat signature berbeda), THE sistem SHALL me-recompute flat dan menyimpannya kembali (overwrite) — self-healing.
4. WHEN cache dinonaktifkan via config ATAU terjadi error cache, THE sistem SHALL fallback menghitung `computeColumnsFlat` langsung sehingga perilaku tetap sama seperti tanpa cache.

### Requirement 4: Command artisan `model:cache`

**User Story:** As an operator, I want command untuk warm/clear cache config, so that cache panas tersedia di muka (saat deploy) tanpa user pertama kena cold-start.

#### Acceptance Criteria

1. THE command `model:cache` tanpa flag SHALL melakukan warm (mengisi cache) untuk semua model yang ditemukan.
2. THE command SHALL menemukan model dengan memindai `app/Models` dan memfilter kelas yang memakai trait `LinkModel` (via `class_uses_recursive`).
3. WHEN flag `--model=X` diberikan, THE command SHALL membatasi aksi ke model X saja.
4. WHEN flag `--clear` diberikan TANPA `--model`, THE command SHALL mengosongkan cache semua model; WHEN diberikan DENGAN `--model=X`, THE command SHALL mengosongkan cache model X saja.
5. THE command SHALL secara default melakukan warm setelah clear; WHEN flag `--no-warm` diberikan, THE command SHALL TIDAK melakukan warm setelah clear.

### Requirement 5: Validasi config strict oleh command

**User Story:** As a developer, I want command mendeteksi kesalahan config (relasi belum terdaftar, `dependsOn` tak ada di attribute, dll) saat warm, so that error config ketahuan saat deploy/CI, bukan saat user kena di production.

#### Acceptance Criteria

1. THE command SHALL menjalankan validasi strict secara default saat warm; WHEN flag `--no-validate` diberikan, THE command SHALL melewati validasi.
2. THE validasi SHALL memeriksa: (#1) append (`type=attribute`, bukan kolom DB, bukan `forceAppend`) tanpa `dependsOn` non-kosong; (#2) `dependsOn` yang merujuk kolom/relasi tak ada/tak resolvable; (#3) key configColumns yang `method_exists` tapi bukan `Relation`; (#4) token `templateLink` tak resolvable; (#5) relasi anak yang `related` class-nya tak punya `getColumns`.
3. THE validasi SHALL **mengumpulkan** seluruh pelanggaran (tidak throw di pelanggaran pertama) dan melaporkannya per-model.
4. WHEN ditemukan pelanggaran DAN flag `--strict` diberikan, THE command SHALL keluar dengan exit code non-zero.
5. WHEN ditemukan pelanggaran TANPA flag `--strict`, THE command SHALL tetap menyelesaikan warm dan keluar dengan exit code 0 (warn).
6. THE strict-check runtime existing (`collectAppendStrict` saat request) SHALL tetap dipertahankan sebagai defense-in-depth.

### Requirement 6: Konfigurasi cache

**User Story:** As an operator, I want bisa mengatur enable/disable, TTL, dan prefix cache config, so that perilaku cache dapat disesuaikan per environment.

#### Acceptance Criteria

1. THE sistem SHALL menyediakan config: `config_cache_enabled` (default true, env-overridable), `config_cache_ttl_seconds` (default longgar, mis. 86400), `config_cache_prefix` (default `datatable_columns`).
2. WHEN `config_cache_enabled` bernilai false, THE sistem SHALL tidak menggunakan cache (compute langsung).

### Requirement 7: Integrasi deploy

**User Story:** As an operator, I want cache warm + validasi otomatis saat deploy, so that setiap rilis langsung punya cache panas dan config rusak menghentikan deploy.

#### Acceptance Criteria

1. THE deploy script (`deploy-staging.sh` & `deploy-production.sh`) SHALL menjalankan `php artisan model:cache --strict` SETELAH `php artisan optimize`.
2. WHEN command keluar non-zero (pelanggaran strict), THE deploy script SHALL berhenti (karena `set -e`).
