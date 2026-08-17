# Implementation Plan: dpp-discount-and-tax-compliance

## Overview

Task 1-5 = perbaikan bug kritis (Diskon Tambahan tidak menurunkan DPP). Task 6-9 = perluasan data model (kategori tax, DPP Nilai Lain, NPWP/NITKU). Task 10 = Faktur Pajak, digated di belakang konfirmasi scope. Task 11-13 = test & verifikasi manual. Urutan wajib: migration kolom item (Task 1) sebelum service calculator (Task 2) sebelum FE (Task 4-5), karena tiap layer bergantung pada bentuk data dari layer sebelumnya.

## Tasks

- [x] 1. Migration — kolom item PO/SO jadi non-generated
  - [x] 1.1 Migration `convert_purchase_order_items_amounts_to_stored_columns`
    - Backfill nilai existing via baca-simpan PHP (bukan raw SQL) sebelum drop generated: capture `id/basic_amount/tax_amount/amount` seluruh baris, drop generated (`amount`→`tax_amount`→`basic_amount`, tiap drop `Schema::table()` terpisah), re-add sebagai `double` biasa `default(0)`, lalu tulis balik nilai captured per-row
    - `down()`: drop plain, re-add sebagai `storedAs()` seperti semula (tidak perlu restore manual — formula otomatis recompute dari `quantity`/`rate`/`tax_rate` yang tidak berubah)
    - File: `database/migrations/2026_08_16_130520_convert_purchase_order_items_amounts_to_stored_columns.php`
    - Dijalankan di DB live (dev/staging, non-SQLite): 8 baris existing, sum basic_amount/tax_amount/amount terverifikasi utuh setelah migrasi (`22.850.641` / `2.423.353,075` / `25.273.994,075`)
    - _Requirements: 3.2_

  - [x] 1.2 Migration `convert_sales_order_items_amounts_to_stored_columns`
    - Perubahan identik dengan 1.1, target `sales_order_items` — tambahan kompleksitas: tabel ini punya 3 generated column base-currency (`basic_amount_base_currency`/`tax_amount_base_currency`/`amount_base_currency`) yang mereferensikan kolom utama, harus di-drop dulu (urutan: amount_base_currency → tax_amount_base_currency → basic_amount_base_currency) sebelum kolom utama bisa di-drop, lalu di-re-add sebagai `storedAs()` (tetap generated, mengikuti nilai plain column baru)
    - File: `database/migrations/2026_08_16_130521_convert_sales_order_items_amounts_to_stored_columns.php`
    - Dijalankan di DB live: 12 baris existing, sum terverifikasi utuh (`10.547.200` / `992.750` / `11.539.950`, `amount_base_currency` ikut karena `exchange_rate` NULL)
    - _Requirements: 3.2_

  - [x] 1.3 Migration test — backfill correctness kedua tabel
    - File: `tests/Feature/OrderItemStoredColumnMigrationTest.php` — 2 test, 16 assertions, PASSED
    - Assert nilai insert tersimpan benar, assert kolom writable manual (update() langsung mengubah value — generated column akan reject/override, test ini membuktikan konversi berhasil), assert rantai `*_base_currency` generated di `sales_order_items` tetap ikut kolom utama yang sudah plain
    - **Klarifikasi (dikonfirmasi user)**: kolom `code`/`created_by_id`/`status`/dll bukan migration yang hilang — ditambahkan saat runtime oleh `DataTable::initPermissions` (bukan migration file), pola yang sama dengan `is_example` (juga ditambahkan runtime, makanya test `InvoiceDppMigrationTest` sebelumnya sudah punya workaround serupa di `setUp()`). Test ini menambahkan `code`/`created_by_id` secara manual di `setUp()` (nullable, scoped ke test ini) sebagai pengganti `initPermissions` supaya test migration bisa jalan terisolasi tanpa bootstrap penuh trait tsb — bukan indikasi bug/drift.
    - _Requirements: 3.2_

- [x] 2. Checkpoint — migration tests pass
  - `OrderItemStoredColumnMigrationTest` (2 test, 16 assertions) + `InvoiceDppMigrationTest` + `InvoiceDppModelConfigTest` dijalankan bersama: 9 passed (37 assertions), 0 failed, tidak ada regresi terhadap spec `invoice-dpp-adjustment`
  - Pint dijalankan (`--dirty --format agent`) — 1 file dirapikan, test di-rerun setelahnya, tetap 2 passed

- [x] 3. `DocumentDiscountCalculator` service
  - [x] 3.1 Buat `app/Services/Finances/DocumentDiscountCalculator.php`
    - `allocate()` statis: basis Total Bersih (pro-rata dari `basic_amount`) & Total Keseluruhan (pro-rata dari gross, gross-down `/(1+tax_rate/100)` sebelum reduksi basic_amount), rounding per baris + residual ke baris `basic_amount` terbesar, guard `discountValue > basis` lempar `ValidationException`, `discount_on` null/tidak dikenal → lines dikembalikan apa adanya (tidak ada diskon)
    - `latestDiscountKey` menentukan input otoritatif (`discount_rate` vs `discount_amount`), mengikuti pola `latestDiscountKey` yang sudah ada di `AdditionalDiscount.jsx`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6, 1.7, 1.8_

  - [x] 3.2 Unit test `DocumentDiscountCalculator` — seluruh acceptance case
    - File: `tests/Unit/DocumentDiscountCalculatorTest.php` — 11 test, 55 assertions, PASSED
    - Case A-F persis sesuai tabel Part 5 requirements.md, linearitas B==C, 100% discount, diskon melebihi basis (reject via `ValidationException`), rounding residual pada split 33%/3 baris (tidak habis dibagi), basic_amount 0 (guard divide-by-zero), `discount_on` null (lines unchanged)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

- [x] 4. Checkpoint — calculator unit tests pass
  - 13 passed (71 assertions) — `DocumentDiscountCalculatorTest` + `OrderItemStoredColumnMigrationTest` dijalankan bersama, tidak ada regresi
  - Pint dijalankan (`--dirty --format agent`) — 2 file dirapikan (formatting only), test di-rerun, tetap hijau

- [x] 5. Integrasi calculator ke Service layer
  - [x] 5.1 Update `PurchaseOrderService::create()`/`update()`/`syncItems()`
    - Loop akumulasi manual diganti panggilan `applyDiscountToItems()` (helper baru, membungkus `DocumentDiscountCalculator::allocate()`), tulis `basic_amount`/`tax_amount`/`amount` hasil alokasi ke tiap item via `forceFill()->save()` (guard tidak masalah di `PurchaseOrderItem`, tidak ada `basic_amount`/`tax_amount` di `$guarded`-nya)
    - `discount_amount` selalu jadi nilai otoritatif ke calculator (bukan `discount_rate`) — FE (`AdditionalDiscount.jsx`) sudah menyinkronkan `discount_amount` di setiap edit, jadi tidak perlu transport `latestDiscountKey` (state FE-only, tanpa kolom DB) ke backend
    - `fillItemRelations()` sekarang menghitung `basic_amount = quantity * rate` eksplisit (dulu generated column, sekarang harus PHP yang isi sebelum insert)
    - `syncItems()` (2 tempat: single-group update & multi-group split) ditambah `basic_amount` eksplisit saat `rate`/`quantity` berubah, lalu recalc akhir diganti `applyDiscountToItems()` juga (dulu cuma `sum('basic_amount')` polos, sekarang ikut realokasi diskon ke item hasil sync)
    - **Bug diperbaiki**: `update()` dulu nulis key `total_amount`/`total_amount_base_currency` (tidak match kolom `amount`/`amount_base_currency`) — update PO tidak pernah persist total baru sama sekali (Eloquent diam-diam buang attribute yang bukan kolom). Sekarang pakai `amount`/`amount_base_currency` yang benar.
    - File: `app/Services/Purchase/PurchaseOrderService.php`
    - _Requirements: 1.1, 1.2, 3.1, 3.3_

  - [x] 5.2 Update `SalesOrderService::create()`/`update()`/`syncItems()`
    - Pola identik 5.1. Tambahan: `SalesOrderItem::$guarded` awalnya berisi `basic_amount`/`tax_amount` eksplisit (peninggalan pola generated-column) — dihapus dari guard (`app/Models/Sales/SalesOrderItem.php`) supaya `forceFill()` (dan `fill()` biasa) bisa menulisnya, karena Service layer sekarang jadi satu-satunya penulis nilai tsb
    - `sales_orders.amount_base_currency` tetap `storedAs()` (tidak diubah Task 1, beda dari `purchase_orders.amount_base_currency` yang plain) — jadi `create()`/`update()` SO cukup set `amount`, base-currency ikut otomatis
    - File: `app/Services/Sales/SalesOrderService.php`, `app/Models/Sales/SalesOrderItem.php`
    - _Requirements: 1.1, 1.2, 3.1, 3.3_

  - [x] 5.3 Cek pemakaian lain `Utils::countAmount()` di luar PO/SO
    - Masih dipakai `SalesInvoiceService`/`PurchaseInvoiceService` (modul Invoice, di luar scope Requirement 1) — dibiarkan apa adanya, tidak dihapus/deprecate. PO/SO tidak lagi memanggilnya sama sekali (dikonfirmasi via grep).
    - _Requirements: 1.1, 1.2_

  - [x] 5.4 Feature test — persistensi hasil kalkulasi
    - File: `tests/Feature/PurchaseOrderDiscountPersistenceTest.php`, `tests/Feature/SalesOrderDiscountPersistenceTest.php` — 4 test tiap file (Case A/B/C dari fixture baku + 1 test `update()` dengan item quantity berubah), assert `basic_amount`/`tax_amount` per item, header `amount`, dan hasil `fresh()`-reload identik dengan in-memory (Requirement 3.4)
    - **Cakupan `syncItems()` — TIDAK ditest langsung**: kode path-nya diperbaiki (lihat 5.1) tapi tidak ada test end-to-end untuk `syncItems()` karena butuh fixture PurchaseReceipt/PurchaseInvoice/DeliveryNote yang kompleks, di luar waktu yang tersedia untuk task ini. Direkomendasikan ditambah di Task 9 (E2E test) atau task terpisah sebelum rilis produksi.
    - Ditemukan & didokumentasikan 2 drift environment pre-existing selama menulis test (kolom `code`/`created_by_id`/`lft`/`rgt`/`depth` di-provision runtime oleh `DataTable::initPermissions()`/`TreeView`, bukan migration — pola sudah ada presedennya di `PurchaseOrderPermissionTest`), dan 1 bug pre-existing baru: `DataTable::logForCreated()`/`logForUpdated()` set `$this->dataAfter` tanpa property terdeklarasi (beda dari `$dataBefore` yang `private array`), sehingga Eloquent's `__set()` magic menganggapnya atribut model dan menandai instance dirty untuk kolom yang tidak ada di tabel — `save()` berikutnya pada instance yang sama akan gagal. Di-workaround di test dengan `fresh()` sebelum `update()` kedua; **tidak diperbaiki di source** karena di luar scope DPP.
    - _Requirements: 1.1, 1.2, 3.1, 3.2, 3.3, 3.4_

- [x] 6. Checkpoint — service integration tests pass
  - 47 passed (164 assertions): `DocumentDiscountCalculatorTest` + `OrderItemStoredColumnMigrationTest` + `PurchaseOrderDiscountPersistenceTest` + `SalesOrderDiscountPersistenceTest` + `InvoiceDppMigrationTest` + `InvoiceDppModelConfigTest` + `PurchaseOrderPermissionTest` + `SalesOrderPermissionTest` + `SalesOrderItemCastsTest` dijalankan bersama — tidak ada regresi terhadap spec `invoice-dpp-adjustment` maupun test permission/amend/submit PO-SO yang sudah ada
  - Pint dijalankan (`--dirty --format agent`) — 4 file dirapikan (2 service, 2 test file), full sweep di-rerun setelahnya, tetap 47 passed

- [x] 7. Frontend — kalkulasi reaktif & PO discount UI

  **[POST-CHECKPOINT FIX, ditemukan user via manual test]** Setelah 7.1-7.5 selesai, user melaporkan `Total (IDR)` tidak ter-update reaktif saat mengetik nilai diskon (padahal sudah `npm run build`). Root cause: header `net_amount`/`tax_amount` bergantung ke `calculateArray(data.items, "basic_amount", "+")`, tapi field itu HANYA di-refresh oleh `mapItem` FormTable, dan `mapItem` HANYA re-run saat referensi array `data.items` berubah (`FormTable.jsx` `useEffect` sekitar `applyMapItem`, guard `!isEqual(value, prevValueRef.current)`) — sedangkan `AdditionalDiscount`'s `setDiscount()` hanya mengubah `data.discount_on`/`discount_rate`/`discount_amount`, TIDAK menyentuh `data.items` sama sekali. Akibatnya `mapItem` tidak pernah ter-trigger ulang oleh perubahan input diskon, header tetap nilai lama.

  **Fix**: header `net_amount`/`tax_amount` di kedua Form.jsx (PO & SO) dipindah dari bergantung ke `data.items.basic_amount` (tidak reaktif) menjadi `useMemo` yang menghitung ulang langsung dari `quantity*rate`/`quantity*price` mentah + `allocateDiscount()`, dependency eksplisit ke `data.items` DAN `data.discount_on`/`discount_rate`/`discount_amount`/`latestDiscountKey` — sehingga reaktif terlepas dari kapan `mapItem` terakhir jalan.

  **Bug kedua ditemukan sekaligus** (sebelum sempat manifest di UI, ditemukan saat analisis root cause di atas): `AdditionalDiscount.jsx`'s `setDiscount()` menghitung basis diskon (`net_total`/`tax_amount` untuk derive `discount_amount` dari `discount_rate`) dari `calculateArray(prev.items, "basic_amount", "+")` — field yang sama yang bisa saja sudah berisi hasil alokasi diskon putaran sebelumnya, bukan `quantity*rate` mentah. Kalau tidak diperbaiki, basis akan "menyusut" tiap kali komponen re-render (bug feedback-loop, bukan cuma stale). Fix: parent (`Form.jsx`) sekarang menghitung `rawNetAmount`/`rawTaxAmount` (basis SEBELUM diskon, `useMemo` independen) dan mengirimkannya sebagai prop tambahan ke `AdditionalDiscount`; `setDiscount()` dan `useDidMountEffect`'s dependency array dan `max` NumberInput diskon-nominal semua dipindah dari `netAmount`/`taxAmount` (hasil alokasi, turunan dari `discount_amount` itu sendiri — sirkular kalau dipakai sebagai basis) ke `rawNetAmount`/`rawTaxAmount`.

  File terdampak (sama seperti 7.2-7.4, direvisi lagi): `resources/js/Pages/Finances/Components/AdditionalDiscount.jsx`, `resources/js/Pages/Purchase/PurchaseOrders/Form.jsx`, `resources/js/Pages/Sales/SalesOrders/Form.jsx`. ESLint bersih, `discountAllocation.test.js` tetap 11 passed (logic inti tidak berubah, hanya titik pemanggilan & sumber data di level komponen).

  - [x] 7.1 Port algoritma `DocumentDiscountCalculator` ke JS
    - File baru `resources/js/lib/discountAllocation.js` (`allocateDiscount()`), replikasi persis algoritma PHP: basis Total Bersih/Total Keseluruhan, gross-down, rounding + residual ke baris terbesar
    - **Deviasi disengaja dari PHP**: versi JS tidak `throw` saat diskon melebihi basis (PHP lempar `ValidationException`) — di FE, exception di tengah render akan merusak form; JS meng-clamp diam-diam ke basis untuk live preview, backend tetap jadi validator final saat submit
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 7.2 Update `resources/js/Pages/Finances/Components/AdditionalDiscount.jsx`
    - **Revisi desain dari rencana awal**: komponen ini TIDAK menulis `basic_amount`/`tax_amount` ke `data.items` (percobaan pertama begini, tapi ternyata langsung ditimpa lagi oleh `mapItem` milik `FormTable` setiap kali array `items` berubah referensi — lihat `FormTable.jsx` `useEffect` di sekitar `applyMapItem`). Realokasi per baris dipindah ke dalam `mapItem` masing-masing Form.jsx (7.3/7.4), yang punya akses closure ke `discount_on`/`discount_rate`/`discount_amount`. Komponen ini tetap hanya mengelola state header diskon (tidak berubah dari sebelumnya).
    - `amount` (Total yang ditampilkan) tidak lagi dikurangi `discount_amount` secara terpisah — karena `netAmount`/`taxAmount` yang diterima dari parent SUDAH hasil alokasi (dihitung dari `data.items` yang sudah direalokasi `mapItem`), pengurangan terpisah dulu = dikurangi dua kali secara konsep
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3_

  - [x] 7.3 Update `resources/js/Pages/Purchase/PurchaseOrders/Form.jsx`
    - `<AdditionalDiscount />` **sudah ter-render** (temuan investigasi awal Task 1 soal "di-import tapi tidak dipakai" ternyata sudah tidak berlaku di kode saat ini — dicek ulang, sudah ada di baris ~654)
    - `mapItem` diubah: hitung alokasi diskon untuk seluruh baris (`dataTable`) tiap kali salah satu baris berubah, pakai `index` yang sudah disediakan `FormTable` (bukan `findIndex` reference-equality yang sempat dicoba lalu diperbaiki — reference bisa berubah karena spread object)
    - Header `net_amount`/`tax_amount` tidak berubah (`calculateArray(data.items, ...)`) — otomatis benar begitu `mapItem` menulis nilai hasil alokasi
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 7.4 Update `resources/js/Pages/Sales/SalesOrders/Form.jsx`
    - `amount` diubah dari `net_amount + tax_amount - discount_amount` (lump-sum subtract, bug lama) jadi `net_amount + tax_amount` polos — sudah benar begitu `net_amount`/`tax_amount` hasil alokasi dari `mapItem`
    - `mapItem` diubah pola sama dengan 7.3 (field `price` bukan `rate`)
    - Grand Total display (dua `FormInput` terpisah) tidak perlu diubah eksplisit — otomatis benar karena sumbernya (`net_amount + tax_amount`) sudah hasil alokasi
    - _Requirements: 2.1, 2.2, 2.3, 2.5_

  - [x] 7.5 JS unit test `discountAllocation.js`
    - File: `resources/js/lib/discountAllocation.test.js` (vitest, pola sama `diffUtils.test.js`) — 11 test, PASSED, Case A-F + linearitas + rounding residual + zero-basis + discount_on null, angka identik dengan `DocumentDiscountCalculatorTest.php`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

- [x] 8. Checkpoint — frontend unit tests pass
  - `npx vitest run` untuk `discountAllocation.test.js` — 11 passed, tidak ada regresi terhadap `diffUtils.test.js` (dijalankan bersama)
  - `npx eslint` untuk kelima file yang disentuh (2 Form.jsx, `AdditionalDiscount.jsx`, `discountAllocation.js`, `discountAllocation.test.js`) — 0 error, 0 warning setelah `--fix`
  - **Manual smoke test di dev server BELUM dijalankan** — sesuai preferensi user (dicatat di memory: tunda `npm run build`/`dev` sampai seluruh rangkaian task selesai, bukan per task kecil). Direkomendasikan dijalankan sebelum Task 10 (checkpoint bug kritis) ditutup, atau di Task 6 (verifikasi manual staging).

- [ ] 9. E2E test — Task 1 regression proof
  - [ ] 9.1 Dusk/Playwright test: isi PO dengan 2 item beda tax rate, terapkan diskon 10% Total Bersih, assert `Jumlah Dasar`/`Jumlah Pajak`/`Total` di layar = Case B, submit, reload, assert angka tetap sama
    - File: `tests/Browser/PurchaseOrderDiscountTest.php` (sesuaikan dengan framework E2E yang dipakai project — cek dulu apakah Dusk terinstall atau perlu setup)
    - _Requirements: 1.1, 1.3, 1.4, 2.1, 2.4, 3.1, 3.4_

- [x] 10. Checkpoint — Task 1-9 (bug kritis) selesai
  - **Task 9 (E2E) di-skip** — dikonfirmasi user. Dusk maupun Playwright belum terinstall di project (dicek `composer.json`/`package.json`, `tests/Browser/` tidak ada), setup infra E2E baru di luar scope spec DPP. Coverage tetap kuat tanpa E2E: `PurchaseOrderDiscountPersistenceTest`/`SalesOrderDiscountPersistenceTest` (Task 5) sudah lewat Service layer asli dengan assert persisted+reload, `discountAllocation.test.js` (Task 7) buktikan FE-BE identik secara numerik. Task 6 (verifikasi manual staging) jadi circuit-breaker pengganti untuk risiko render-only.
  - **Task 11-12 (optional) di-skip untuk saat ini** — dikonfirmasi user, lanjut langsung ke Task 13/15 tanpa tax master/NPWP-NITKU. Bisa dikerjakan terpisah nanti.
  - Full sweep test terkait: PHP 47 passed (164 assertions) — `DocumentDiscountCalculatorTest` + `OrderItemStoredColumnMigrationTest` + `PurchaseOrderDiscountPersistenceTest` + `SalesOrderDiscountPersistenceTest` + `InvoiceDppMigrationTest` + `InvoiceDppModelConfigTest` + `PurchaseOrderPermissionTest` + `SalesOrderPermissionTest` + `SalesOrderItemCastsTest`. JS 35 passed — `discountAllocation.test.js` + `diffUtils.test.js`. Tidak ada regresi.

- [ ]* 11. Tax master — kategori & DPP Nilai Lain
  - [ ]* 11.1 Migration tambah `category`, `behavior`, `use_dpp_nilai_lain` ke `taxes`
    - File: `database/migrations/2026_08_xx_xxxxxx_add_category_and_behavior_to_taxes_table.php`
    - _Requirements: 4.1, 4.2, 4.4_

  - [ ]* 11.2 Update `app/Models/Finances/Tax.php`
    - Tambah field baru ke `$casts` dan `$configColumns`
    - _Requirements: 4.1, 4.2, 4.4_

  - [ ]* 11.3 Seeder `PPN 12% (DPP Nilai Lain 11/12)`
    - Cek apakah `TaxSeeder` sudah ada; tambah/buat entry default
    - _Requirements: 4.5_

  - [ ]* 11.4 Integrasi DPP Nilai Lain ke `DocumentDiscountCalculator`
    - Cabang tambahan: jika tax record baris punya `use_dpp_nilai_lain=true`, hitung `dpp = basic_amount_after_discount * 11/12` sebelum `tax_amount = dpp * rate/100`
    - _Requirements: 4.4, 4.6_

  - [ ]* 11.5 Integrasi behavior withholding
    - Baris dengan `behavior=withholding` dikeluarkan dari `tax_amount` yang nambah header Total, masuk kolom terpisah (`withholding_amount`) di header PO/SO — perlu migration tambahan
    - File: migration tambah `withholding_amount` ke `purchase_orders`/`sales_orders`, update `DocumentDiscountCalculator`, update FE header display
    - _Requirements: 4.3_

  - [ ]* 11.6 Test — Case Nilai Lain & withholding
    - Unit test: baris 12.000.000 @ PPN 12% Nilai Lain → DPP 11.000.000, PPN 1.320.000
    - Unit test: baris dengan tax withholding tidak menambah header Total
    - _Requirements: 4.6, 4.3_

- [ ]* 12. Party fields — NPWP/NITKU
  - [ ]* 12.1 Migration tambah `npwp`, `nitku` ke `suppliers`
    - File: `database/migrations/2026_08_xx_xxxxxx_add_npwp_nitku_to_suppliers_table.php`
    - _Requirements: 5.1, 5.2_

  - [ ]* 12.2 Migration rename `vat`→`npwp`, tambah `nitku` di `customers`
    - Grep dulu semua referensi `vat` (FE & BE) sebelum rename, update semua caller
    - File: `database/migrations/2026_08_xx_xxxxxx_rename_vat_to_npwp_add_nitku_to_customers_table.php`
    - _Requirements: 6.1, 6.2_

  - [ ]* 12.3 Validasi format NPWP (FormRequest Supplier & Customer)
    - Regex 15 atau 16 digit, pesan error jelas
    - _Requirements: 5.3, 6.3_

  - [ ]* 12.4 Update FE form Supplier/Customer — field baru + masking display
    - _Requirements: 5.1, 5.2, 6.1, 6.2_

  - [ ]* 12.5 Test — validasi format & persistensi NPWP/NITKU kedua party
    - _Requirements: 5.1, 5.2, 5.3, 6.1, 6.2, 6.3_

- [x] 13. Konfirmasi scope Faktur Pajak (GATE — wajib sebelum Task 14)
  - [x] 13.1 Tanyakan ke product owner: apakah modul Invoice existing tempat yang tepat untuk field Faktur Pajak, atau ada inisiatif lain
    - **Keputusan (dikonfirmasi user, 2026-08-16)**: IN-SCOPE. Field Faktur Pajak ditambahkan ke modul Invoice existing (`SalesInvoice`/`PurchaseInvoice`, controller `SalesInvoiceController`/`PurchaseInvoiceController` sudah ada), bukan modul terpisah/baru.
    - _Requirements: 7.1_

- [x] 14. Faktur Pajak data model (Task 13 dikonfirmasi in-scope, dikerjakan atas instruksi user)
  - [x] 14.1 Migration tambah kode transaksi, nomor seri, breakdown DPP/PPN/PPnBM ke invoice header
    - 2 migration baru: `add_faktur_pajak_fields_to_sales_invoices_table` dan `..._purchase_invoices_table`. Kolom: `tax_invoice_transaction_code`, `tax_invoice_serial_number` (unique), `tax_invoice_date`, `tax_invoice_dpp_amount`, `tax_invoice_ppn_amount`, `tax_invoice_ppnbm_amount` (default 0)
    - Kode transaksi disimpan **plain string** (`'01'`..`'10'`), BUKAN native PHP enum — revisi setelah user menegaskan preferensi project pakai string biasa untuk field opsi sederhana (pola sama seperti `discount_on`: `Rule::in()` di FormRequest/service, bukan enum class). Daftar kode valid disimpan sebagai `TaxInvoiceSerialAllocator::TRANSACTION_CODES` (const array), divalidasi via `in_array()` di kedua Service method. Label tampilan tetap lewat `configColumns.valueTrans` → `finances.taxInvoice.transaction_code.options` (pola sama `Log::configColumns['action']`)
    - **Gap disengaja, didokumentasikan**: `tax_invoice_ppnbm_amount` selalu 0 — kategori tax barang mewah/PPnBM (Requirement 4) tidak diimplementasi karena Task 11 di-skip. DPP/PPN breakdown bersumber dari `sum(items.dpp_amount)`/`sum(items.tax_amount)` yang SUDAH benar (generated column dari spec `invoice-dpp-adjustment`), bukan dari perhitungan withholding/Nilai-Lain kustom (itu Task 11, belum ada).
    - File: `database/migrations/2026_08_16_140254_...`, `2026_08_16_140255_...`, `app/Models/Finances/SalesInvoice.php`, `app/Models/Finances/PurchaseInvoice.php`, `lang/{id,en}/finances/{salesInvoice,purchaseInvoice,taxInvoice}.php`
    - _Requirements: 7.2, 7.3, 7.4_
  - [x] 14.2 Konfigurasi range alokasi nomor seri (bukan auto-generate bebas)
    - `App\Services\Finances\TaxInvoiceSerialAllocator` — baca `tax_invoice_serial_range_start`/`_end`/`_last_used` dari `Preference` (bukan tabel baru, pola sama seperti `default_currency_id`), alokasi berurutan dalam transaction+lock (`lockForUpdate`), tolak (`ValidationException`) kalau range belum dikonfigurasi, sudah habis, atau kode transaksi tidak ada di `TRANSACTION_CODES`. Hanya dipakai `SalesInvoiceService::assignTaxInvoice()` (Faktur Pajak Keluaran, sistem yang menerbitkan) — `PurchaseInvoiceService::recordTaxInvoice()` (Faktur Pajak Masukan) TIDAK memakainya, nomor seri direkam verbatim dari dokumen supplier
    - `PreferenceSeeder` ditambah 3 key baru (`tax_invoice_serial_range_start/end/last_used`, default null/null/0 — idempotent via `firstOrCreate`, tidak menimpa nilai existing)
    - File: `app/Services/Finances/TaxInvoiceSerialAllocator.php`, `database/seeders/PreferenceSeeder.php`
    - _Requirements: 7.3_
  - [x] 14.3 Test — format nomor seri, breakdown DPP/PPN/PPnBM benar sumbernya
    - File: `tests/Feature/TaxInvoiceAssignmentTest.php` — 6 test, 16 assertions, PASSED
    - Format nomor seri (regex `^01[0-9]\.\d{13}$`), increment berurutan, reject saat range belum dikonfigurasi, reject saat range habis, breakdown DPP/PPN ter-assign dari `assignTaxInvoice()` sama persis dengan sum item (termasuk assert PPnBM tetap 0 sebagai bukti gap di atas), `recordTaxInvoice()` simpan nomor seri supplier verbatim (tidak digenerate ulang)
    - _Requirements: 7.2, 7.3, 7.4_

- [x] 15. Final checkpoint
  - Pint: `{"result":"pass"}` — bersih, tidak ada file dirty tersisa
  - Full sweep test terisolasi (final): PHP **53 passed (180 assertions)** — `DocumentDiscountCalculatorTest`, `OrderItemStoredColumnMigrationTest`, `PurchaseOrderDiscountPersistenceTest`, `SalesOrderDiscountPersistenceTest`, `TaxInvoiceAssignmentTest`, `InvoiceDppMigrationTest`, `InvoiceDppModelConfigTest`, `PurchaseOrderPermissionTest`, `SalesOrderPermissionTest`, `SalesOrderItemCastsTest`. JS **35 passed** — `discountAllocation.test.js` + `diffUtils.test.js`. Tidak ada regresi di seluruh sesi (Task 1 s/d 14).
  - **Repro manual di staging — BELUM dijalankan**, di luar kemampuan sesi ini (tidak ada akses browser/staging langsung). Perlu dilakukan manual oleh user: buka PO/SO Baru di `erp.staging.ptpsn.co.id`, isi fixture Part 5 (10×100.000 @PPN 11% + 5×200.000 @10%), terapkan diskon 10% pada kedua basis (Total Bersih & Total Keseluruhan), bandingkan `Jumlah Dasar`/`Jumlah Pajak`/`Total` dengan tabel acceptance Case A-F.
  - **Open questions Requirement 8 — disurfaced ke user, TIDAK diputuskan sepihak oleh sesi ini:**
    1. **Strategi migrasi record Tax existing** (Requirement 8.1) — Task 11 (kategori PPN/PPh, behavior additive/withholding) di-skip sesi ini, jadi pertanyaan ini belum relevan sampai Task 11 dikerjakan. Dicatat sebagai prasyarat sebelum Task 11 dimulai.
    2. **Backfill vs freeze transaksi historis** (Requirement 8.2) — PO/SO yang sudah disimpan SEBELUM Task 1 (migration+service fix) memiliki `basic_amount`/`tax_amount` yang salah kalau dokumen tsb punya diskon (bug lama: DPP beku, Total dipotong lump-sum). Migration Task 1 hanya konversi tipe kolom (generated→plain), TIDAK menghitung ulang alokasi — dokumen lama akan tetap menampilkan angka lama sampai di-edit ulang dan disimpan. **Belum diputuskan**: apakah perlu backfill-recalculate dokumen lama, atau dibiarkan sebagai catatan historis. Butuh keputusan bisnis dari user/product owner.
    3. **Penyelarasan formula Nilai Lain tetap (invoice) vs opsional (Task 11, di-skip)** (Requirement 8.3) — karena Task 11 di-skip, `use_dpp_nilai_lain` per-tax-record belum ada. Formula tetap `dpp_amount = basic_amount * 11/12` dari spec `invoice-dpp-adjustment` (berlaku ke SEMUA baris invoice tanpa syarat) tetap berjalan apa adanya, tidak disentuh. Ketegangan konseptual (tetap vs opsional) masih terbuka, relevan kalau Task 11 dikerjakan nanti.
  - **Task 11-12 (tax master kategori, NPWP/NITKU) tetap belum dikerjakan** — dikonfirmasi user untuk di-skip di sesi ini, bisa dilanjutkan sebagai task/spec terpisah kapan saja.

## Notes

- Task 11-12 ditandai optional (`[ ]*`) — saat user minta mulai implementasi, tanyakan dulu: "Jalankan required task saja (Task 1-10, 13, 15), atau termasuk optional task (11-12, 14)?" sesuai konvensi project.
- Task 14 punya gate ganda: optional DAN bergantung hasil Task 13. Jangan mulai 14 sebelum 13 punya jawaban eksplisit.
- Task 1 dan 3 bisa paralel (migration vs unit test calculator berdiri sendiri), tapi Task 5 (integrasi service) butuh keduanya selesai.
- Rounding di calculator (Task 3.1) adalah bagian tersulit — alokasikan waktu ekstra, test dengan angka yang tidak habis dibagi rata (misal diskon 33% pada 3 baris).

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "3.1"] },
    { "id": 1, "tasks": ["1.3", "3.2"] },
    { "id": 2, "tasks": ["2", "4"] },
    { "id": 3, "tasks": ["5.1", "5.2", "5.3"] },
    { "id": 4, "tasks": ["5.4"] },
    { "id": 5, "tasks": ["6"] },
    { "id": 6, "tasks": ["7.1"] },
    { "id": 7, "tasks": ["7.2", "7.3", "7.4"] },
    { "id": 8, "tasks": ["7.5"] },
    { "id": 9, "tasks": ["8"] },
    { "id": 10, "tasks": ["9.1"] },
    { "id": 11, "tasks": ["10"] },
    { "id": 12, "tasks": ["11.1", "12.1", "13.1"] },
    { "id": 13, "tasks": ["11.2", "12.2"] },
    { "id": 14, "tasks": ["11.3", "12.3"] },
    { "id": 15, "tasks": ["11.4", "12.4"] },
    { "id": 16, "tasks": ["11.5", "12.5"] },
    { "id": 17, "tasks": ["11.6", "14.1"] },
    { "id": 18, "tasks": ["14.2"] },
    { "id": 19, "tasks": ["14.3"] },
    { "id": 20, "tasks": ["15"] }
  ]
}
```
