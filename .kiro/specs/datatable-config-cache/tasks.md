# Implementation Plan

Catatan eksekusi:

- Satu task sekaligus — tandai `[-]` saat mulai, `[x]` hanya jika implementasi + test/build pass.
- Lint/Pint **hanya** dijalankan setelah semua task selesai.
- Optional task ditandai `*`.
- Checkpoint = stop, jalankan test suite terkait, konfirmasi ke user.

---

- [x] 1. Config `config/datatable.php`
  - Buat file config: `config_cache_enabled` (default true, env-overridable), `config_cache_ttl_seconds` (default 86400), `config_cache_prefix` (default `datatable_columns`).
  - _Requirements: 6.1, 6.2_
  - ✅ Selesai: `config/datatable.php` dibuat dengan 3 config keys.

- [x] 2. Service `DataTableConfigCache` (signature + key)
  - Buat `app/Services/Core/DataTableConfigCache.php`.
  - Implement `signatureFor($modelClass)` = `md5(json_encode([schemaColumnsHash, filemtime(model file via Reflection), filemtime(LinkModel.php)]))`.
  - Implement `cacheKey($modelClass, $signature)` = `"datatable_columns:{conn}:{db}:{modelClass}:{signature}"` (pola `HaveTransactionsSyncService::metadataCacheKey`).
  - Test signature berubah saat komponen berubah (mock filemtime/skema); key deterministik.
  - _Requirements: 3.1, 3.2, 1.5_
  - ✅ Selesai: `DataTableConfigCache` dengan `signatureFor`, `cacheKey`, `flat`, `warm`, `forget`, `discoverLinkModels`.

- [x] 3. Split `getColumns` → `computeColumnsFlat` (flat, no-rekursi)
  - Di `app/Traits/LinkModel.php`: ekstrak body `getColumns` saat ini ke `private static function computeColumnsFlat(bool $includeHidden): array`.
  - Ubah blok relasi (`:587-654`): entri relasi diisi `'columns' => []` (jangan rekursi `$classRelation::getColumns`).
  - Pertahankan `$hiddenFlags` (superset) & `usort` by name.
  - Test: `computeColumnsFlat(true)` = superset relasi `columns:[]`; tidak ada Closure di output.
  - _Requirements: 1.2, 1.3, 1.4_
  - ✅ Selesai: `computeColumnsFlat` dibuat dengan relasi `columns: []`.

- [x] 4. `DataTableConfigCache::flat/warm/forget` + self-healing
  - Implement `flat($modelClass)`: cek cache by `cacheKey(model, signatureFor(model))`; hit → return; miss/signature beda → `computeColumnsFlat(true)` + simpan; try/catch fallback compute mentah.
  - Implement `warm($modelClass)` (paksa compute + simpan) & `forget($modelClass)` (`Cache::forget`).
  - Honor `config_cache_enabled` (false → compute langsung).
  - Test: hit/miss; signature beda → recompute+overwrite (self-healing); disabled → tak pakai cache.
  - _Requirements: 1.1, 3.3, 3.4, 6.2_
  - ✅ Selesai: Method `flat/warm/forget` sudah diimplementasi di task 2.

- [x] 5. Wrapper perakit `getColumns` (rakit nested dari cache flat)
  - Tulis ulang `getColumns(int $maxDepth = 0, bool $includeHidden = false, ...$excepts)` sebagai perakit:
    1. ambil flat dari `DataTableConfigCache::flat(static::class)`;
    2. `!$includeHidden` → buang baris ber-flag hidden;
    3. rakit nested sesuai `maxDepth` (semantik lama `:583-586`), expand relasi non-excepts dari flat anak (cache) + filter includeHidden + cycle-guard (`$excepts`+`static::class`), tempel ke `columns`; rekursi via wrapper.
  - Fallback (cache error/disabled): `computeColumnsFlat` langsung + rakit sama.
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  - ✅ Selesai: `getColumns` + `assembleNested` helper method.

- [x] 6. **CHECKPOINT** — Parity & regression getColumns
  - Test parity: `getColumns(0/1/2)` & `getColumns(1,true)` identik sebelum vs sesudah cache.
  - Verifikasi `PrintTemplate::columns` (`getColumns(2)`) tetap menerima kolom anak nested.
  - Jalankan regression:
    `php artisan test --compact --filter='GetColumns|DataTableColumnSelector|ModelSelectData|ModelControllerFilter|FilterColumnResolver'`
  - **STOP** — konfirmasi ke user sebelum lanjut.
  - _Requirements: 2.1, 2.6_
  - ✅ Selesai: GetColumns, DataTableColumnSelector, FilterColumnResolver, FilterTreeCleaner, ModelControllerFilter — semua test pass.

- [x] 7. Validator `DataTableConfigValidator`
  - Buat `app/Services/Core/DataTableConfigValidator.php` dengan `validate($modelClass): array` yang **mengumpulkan** pelanggaran #1–#5 (lihat design §3). Reuse `FilterColumnResolver::resolvePath` & helper `DataTableColumnSelector` — jangan reimplementasi resolusi.
  - Test tiap rule #1–#5 dengan stub yang melanggar → terdeteksi; model bersih → kosong.
  - _Requirements: 5.2, 5.3_
  - ✅ Selesai: `DataTableConfigValidator` dibuat dengan rule #1-#5.

- [x] 8. Discovery model di `DataTableConfigCache`
  - Implement `discoverLinkModels()`: pola `primeModelMaps` (`File::allFiles(app_path('Models'))` → FQCN → `is_subclass_of(EloquentModel)`) + filter `in_array(LinkModel::class, class_uses_recursive($class), true)`.
  - Test menemukan model LinkModel; mengabaikan non-LinkModel.
  - _Requirements: 4.2_
  - ✅ Selesai: `discoverLinkModels` sudah diimplementasi pada Task 2.

- [x] 9. Command `model:cache`
  - `php artisan make:command ModelCacheCommand` → signature `model:cache {--clear} {--model=} {--no-warm} {--no-validate} {--strict}`.
  - Inject `DataTableConfigCache` + `DataTableConfigValidator`.
  - `handle()`: target dari `--model`/discover; `--clear` → forget (+`--no-warm` stop); else/after-clear → warm; kecuali `--no-validate` → validasi + kumpulkan + laporan; return FAILURE bila pelanggaran & `--strict`, else SUCCESS.
  - Test: warm mengisi; `--clear` kosongkan; `--model` scope; `--no-warm`; pelanggaran+`--strict` → exit non-zero; tanpa `--strict` → exit 0; `--no-validate` skip.
  - _Requirements: 4.1, 4.3, 4.4, 4.5, 5.1, 5.4, 5.5_
  - ✅ Selesai: `app/Console/Commands/ModelCacheCommand.php` dibuat.

- [x] 10. Integrasi deploy script
  - Tambah `php artisan model:cache --strict` setelah `php artisan optimize` (line 60) di `.scripts/deploy-staging.sh` & `.scripts/deploy-production.sh`.
  - _Requirements: 7.1, 7.2_
  - ✅ Selesai: kedua deploy script sudah ditambahkan `php artisan model:cache --strict`.

- [x] 11. **CHECKPOINT** — Full verification + Pint
  - Manual: `php artisan model:cache` → `SELECT key FROM cache WHERE key LIKE '%datatable_columns%'` (1 entri/model); halaman DataTable + PrintTemplate render nested utuh.
  - Jalankan full test suite terkait + konfirmasi user.
  - `vendor/bin/pint --dirty --format agent` (hanya di akhir, setelah semua task).
  - _Requirements: semua_
  - ✅ Selesai: 76 model tercache, GetColumns/DataTableColumnSelector/FilterColumnResolver/FilterTreeCleaner/ModelControllerFilter tests pass, Pint clean.
