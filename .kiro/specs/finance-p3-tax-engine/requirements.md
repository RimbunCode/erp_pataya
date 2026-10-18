# Requirements Document

## Introduction

Fase 3 dari 7 fase program **Finance Engine** (lihat `docs/prd/finance-engine-prd.md`). Tujuan: aturan pajak menjadi **data berversi dengan tanggal berlaku**, perhitungan pajak dapat **dijelaskan**, dan jurnal **memisahkan baris pajak** (PPN Keluaran/Masukan) ke akun sendiri sehingga laporan pajak dan neraca dapat diturunkan dari ledger (F-03).

Kondisi nyata yang membentuk fase ini (diverifikasi di kode):

- `taxes` hanya berisi `name` dan `rate` (F-14). Spec `dpp-discount-and-tax-compliance` Requirement 4 (kolom `category`/`behavior`/`use_dpp_nilai_lain`) **belum diimplementasi** — Task 11 spec itu opsional dan dilewati. Karena itu fase ini **menyerap** pekerjaan tersebut (keputusan D-15).
- Pada item Sales Invoice dan Purchase Invoice, `dpp_amount = (basic_amount − discount_amount) × 11/12` dan `tax_amount = dpp_amount × tax_rate / 100` adalah **kolom generated** dengan faktor 11/12 *tetap untuk semua jenis pajak* (F-17). Perhitungan di dokumen tidak dapat berubah lewat aturan data sebelum kolom itu dikonversi.
- Data contoh memakai PPN `rate = 11`; dengan DPP 11/12 hasil efektif ≈ 10,08%, bukan 11% atau 12% × 11/12. Semantik `rate` pada data produksi harus diaudit (Q-P3-1).
- `assignTaxInvoice` mengisi `tax_invoice_ppn_amount` dari `sum(items.tax_amount)` — seluruh jenis pajak, termasuk yang bukan PPN.
- GL hari ini menerima satu `totalAmount` (dasar + pajak) ke satu pasang akun (F-03); seeder COA hanya memiliki satu `account_type = tax`.

**Struktur fase dua bagian:**

- **Bagian A (aman, default)** — tidak mengubah angka di dokumen. Menambah master pajak berklasifikasi, versi aturan, snapshot versi, `TaxEngine` yang *menjelaskan* perhitungan, dan pemisahan baris pajak di jurnal berdasarkan nilai yang **sudah tersimpan** di item.
- **Bagian B (GATED D-15)** — mengonversi `dpp_amount`/`tax_amount`/`amount` dari kolom generated menjadi kolom biasa yang dihitung `TaxEngine`, agar faktor DPP dan pemotongan (withholding) benar-benar ditentukan aturan data.

**Prasyarat:** Fase 2 selesai untuk Sales Invoice dan Purchase Invoice (mode `on` dan stabil), karena pemisahan pajak menambah baris pada rule posting kedua dokumen itu. D-12 (kebijakan posting pajak, disetujui akuntan) dan Q-P3-1…3 terjawab sebelum Task 6.

**Di luar scope:**
- Pajak pada dokumen order (Sales/Purchase Order) dan perhitungan diskon DPP (ditangani spec `dpp-discount-and-tax-compliance` Requirement 1–3).
- PPnBM/barang mewah, e-Faktur API, SPT, bukti potong.
- Multi-jurisdiksi; hanya Indonesia (`jurisdiction_code = 'ID'` sebagai titik ekstensi, D-5).
- Restatement jurnal historis: invoice yang sudah diposting dengan bentuk lama tidak diubah; bentuk baru berlaku mulai tanggal cutover.

## Glossary

- **Tax Rule Version**: satu versi aturan pajak (tarif, faktor DPP, pembulatan, peran akun) untuk satu `Tax`, berlaku pada rentang tanggal.
- **Faktor DPP**: pecahan (numerator/denominator) pengali basis sebelum tarif; `11/12` untuk DPP Nilai Lain, `1/1` untuk basis penuh.
- **Behavior**: `additive` (menambah total, seperti PPN) atau `withholding` (dipotong dari pembayaran, seperti PPh).
- **Category**: klasifikasi pajak (`ppn_standard`, `ppn_luxury`, `pph_21`, `pph_22`, `pph_23`, `pph_4_2`, `other`, `unclassified`).
- **TaxResult / TaxComponent**: hasil perhitungan yang dapat dijelaskan: per komponen (pajak, versi, basis, faktor, tarif, jumlah, pembulatan).
- **Cutover pajak**: tanggal mulai invoice diposting dengan baris pajak terpisah (per jenis dokumen).
- **Unclassified**: pajak yang belum diklasifikasi; tidak dipisah di jurnal (tetap tertanam di total seperti perilaku lama).
- **PKP**: Pengusaha Kena Pajak; menentukan apakah PPN Masukan dikreditkan (akun piutang pajak) atau dibebankan ke biaya/persediaan.

## Requirements

### Requirement 1: Master pajak berklasifikasi (menyerap DPP spec Requirement 4)

**User Story:** Sebagai akuntan, saya ingin master pajak membedakan PPN dari PPh dan arahnya, so that sistem tahu pajak mana yang ditambahkan ke total dan mana yang dipotong.

#### Acceptance Criteria

1. THE sistem SHALL menambah kolom pada `taxes`: `category` (default `unclassified`), `behavior` (`additive`/`withholding`, default `additive`), `jurisdiction_code` (default `ID`), `is_creditable` (boolean, default true; hanya bermakna untuk pajak masukan).
2. THE migration SHALL TIDAK menebak klasifikasi pajak yang sudah ada: seluruh baris existing diberi `category = unclassified` dan `behavior = additive` (menyamai perilaku hitung sekarang), sesuai peringatan DPP spec Requirement 8.1.
3. THE halaman master Pajak SHALL memungkinkan pengisian `category` dan `behavior`, menampilkan peringatan bila ada pajak `unclassified` yang dipakai transaksi 12 bulan terakhir, dan melarang `behavior = withholding` pada kategori PPN.
4. THE sistem SHALL menyediakan seed `PPN 12% (DPP Nilai Lain 11/12)` hanya bila belum ada pajak `ppn_standard`; seed tidak menimpa data.
5. THE field `use_dpp_nilai_lain` dari DPP spec SHALL digantikan oleh faktor DPP pada versi aturan (Requirement 2) dan tidak dibuat di `taxes`; DPP spec Requirement 4 dinyatakan *disupersede* oleh spec ini setelah D-15 disetujui.

### Requirement 2: Versi aturan pajak berlaku-tanggal

**User Story:** Sebagai akuntan, saya ingin perubahan tarif menjadi versi baru dengan tanggal berlaku, so that transaksi lama tetap dihitung dengan aturan saat itu dan perubahan regulasi tidak butuh perubahan kode.

#### Acceptance Criteria

1. THE sistem SHALL membuat tabel `tax_rule_versions` dengan: `tax_id`, `version`, `effective_from` (date), `effective_to` (date nullable), `rate` (`decimal(9,4)`), `dpp_numerator` & `dpp_denominator` (smallint unsigned, default 1/1, denominator > 0), `rounding_mode` (`per_line`/`per_document`), `output_role` & `input_role` (string, default `tax_output`/`tax_input`), `status` (`draft`/`active`/`retired`), `notes`, `created_by_id`, timestamps; unik `(tax_id, version)`.
2. THE sistem SHALL menolak dua versi `active` untuk `tax_id` yang sama dengan rentang tanggal tumpang-tindih.
3. THE versi `active` yang sudah dirujuk dokumen SHALL tidak diedit; perubahan dibuat sebagai versi baru dengan `effective_from` baru dan versi sebelumnya diberi `effective_to`.
4. THE `output_role`/`input_role` SHALL merujuk kunci peran Posting Profile (Fase 2), bukan akun; Tax Engine tidak mengetahui akun.
5. THE perubahan versi SHALL tercatat (siapa, kapan, sebelum/sesudah) dan memerlukan izin `manage_rule_versions`.
6. THE `taxes.rate` SHALL tetap ada sebagai nilai tampilan/default; untuk perhitungan baru, sumber kebenaran adalah versi yang berlaku (Requirement 3).
7. UNTIL Bagian B (Requirement 12) aktif, THE sistem SHALL menolak penyimpanan versi `active` yang faktor DPP-nya bukan `11/12`, dengan pesan yang menjelaskan bahwa kolom hitung dokumen masih memakai 11/12 tetap (F-17). Guard ini dikendalikan preferensi `finance_tax_engine_calc_enabled` (default `false`, diaktifkan oleh migrasi Bagian B). Ini mencegah data aturan menyimpang diam-diam dari angka yang benar-benar dihitung dokumen.

### Requirement 3: Resolusi versi pada tanggal transaksi

**User Story:** Sebagai auditor, saya ingin tahu aturan mana yang dipakai untuk setiap transaksi, so that perhitungan dapat ditelusuri.

#### Acceptance Criteria

1. THE sistem SHALL menyediakan `TaxRuleResolver::resolve(Tax|string $tax, CarbonInterface $date): TaxRuleVersion`.
2. THE resolver SHALL memilih versi `active` dengan `effective_from <= date <= effective_to (atau null)`; bila tidak ada, melempar `NoEffectiveTaxRuleException` yang menyebut pajak dan tanggal.
3. THE resolver SHALL deterministik dan men-cache hasil per `(tax_id, date)` dalam satu request/job.
4. THE `date` yang dipakai untuk invoice SHALL `transaction_date`/tanggal dokumen, bukan `now()`.

### Requirement 4: `TaxEngine` dan hasil yang dapat dijelaskan

**User Story:** Sebagai pengguna, saya ingin tahu mengapa pajak suatu invoice bernilai sekian, so that saya dapat memverifikasi dan mempertanggungjawabkannya.

#### Acceptance Criteria

1. THE sistem SHALL menyediakan `TaxEngine::calculate(TaxInput $input): TaxResult` untuk satu baris (basis bersih setelah diskon, `tax`, tanggal, mata uang dasar) dan `TaxEngine::calculateDocument(list<TaxInput>): TaxResult` yang mengagregasi.
2. THE `TaxResult` SHALL berisi `components` (per komponen: `tax_id`, `tax_code/nama`, `category`, `behavior`, `rule_version_id`, `base_amount`, `dpp_factor`, `dpp_amount`, `rate`, `tax_amount`, `rounding_adjustment`), `total_additive`, `total_withholding`, dan `explanation` (daftar langkah berbahasa terstruktur yang dapat dirender).
3. THE perhitungan SHALL: `dpp = base × numerator/denominator`; `tax = dpp × rate/100`; pembulatan ke minor unit mata uang dasar HALF_UP sesuai `rounding_mode` (per baris, atau sekali di akhir per komponen dokumen) dengan sisa pembulatan dibebankan pada baris terbesar sehingga jumlah komponen = jumlah dokumen (selaras DPP spec Req. 1.7).
4. THE `TaxEngine` SHALL murni (tanpa DB) selain pemanggilan resolver, dan TIDAK memanggil kelas model Sales/Purchase.
5. THE `TaxEngine` SHALL TIDAK mengetahui akun; ia mengembalikan peran (`output_role`/`input_role`) untuk dipetakan Posting Engine.
6. THE `TaxResult` SHALL dapat diserialisasi ke JSON dan diverifikasi ulang (`TaxEngine::verify(json)` menghitung ulang dari versi yang disnapshot dan membandingkan).

### Requirement 5: Snapshot versi pada dokumen dan jurnal

**User Story:** Sebagai auditor, saya ingin dokumen dan jurnal menyimpan versi aturan yang dipakai, so that perubahan aturan di masa depan tidak mengubah penjelasan transaksi lama.

#### Acceptance Criteria

1. THE sistem SHALL menambah `tax_rule_version_id` (nullable, FK) pada `sales_invoice_items` dan `purchase_invoice_items`, dan `tax_breakdown` (JSON nullable) pada `sales_invoices` dan `purchase_invoices`.
2. WHEN item invoice dibuat/diubah, THE service SHALL me-resolve versi pada tanggal dokumen, mengisi `tax_rate` dari versi tersebut (kolom tetap ada untuk kompatibilitas) dan menyimpan `tax_rule_version_id`.
3. WHEN invoice disetujui (`onApproved`), THE service SHALL menyimpan `TaxResult` serial ke `tax_breakdown` (immutable setelah approved).
4. THE sistem SHALL menambah `general_ledgers.tax_rule_version_id` (nullable, FK) yang diisi pada baris jurnal pajak.
5. THE invoice yang dibuat sebelum fase ini (tanpa snapshot) SHALL tetap valid; `tax_rule_version_id` null diperlakukan sebagai "legacy" dan penjelasannya dibangun dari `tax_rate`/`dpp_amount` tersimpan dengan label legacy.
6. WHEN versi yang dirujuk tidak ada (dihapus lewat jalur tak terduga), THE tampilan penjelasan SHALL tidak error dan menampilkan pesan "versi tidak tersedia".

### Requirement 6: Backfill versi awal dan audit semantik tarif

**User Story:** Sebagai pemilik produk, saya ingin data pajak yang ada tetap menghasilkan angka yang sama, so that transisi tidak mengubah dokumen lama.

#### Acceptance Criteria

1. THE sistem SHALL menyediakan perintah `finance:init-tax-rules {--dry-run}` yang membuat versi 1 per pajak existing: `effective_from` = `1970-01-01`, `rate` = `taxes.rate`, faktor DPP `11/12` (menyamai formula generated saat ini), `rounding_mode = per_line`, status `active`, ditandai `notes = 'migrated; needs review'`.
2. THE perintah SHALL idempoten dan tidak menimpa versi yang sudah ada.
3. THE perintah SHALL melaporkan pajak dengan `rate` yang mencurigakan terhadap faktor 11/12 (mis. `rate = 11` dengan DPP 11/12 → tarif efektif ≈ 10,083%) agar ditinjau (Q-P3-1); laporan TIDAK mengubah data.
4. FOR setiap item invoice historis, THE test paritas SHALL menunjukkan `TaxEngine` (versi 1, per_line) menghasilkan `tax_amount` yang sama dengan nilai tersimpan dalam toleransi satu minor unit.
5. THE seluruh perubahan tarif lanjutan (mis. dari 11 menjadi 12) SHALL dilakukan sebagai versi baru dengan tanggal berlaku, bukan edit versi 1.

### Requirement 7: Pemisahan baris pajak pada jurnal (Bagian A)

**User Story:** Sebagai akuntan, saya ingin PPN Keluaran dan PPN Masukan tercatat di akunnya sendiri, so that Neraca dan rekap pajak benar tanpa hitung manual.

#### Acceptance Criteria

1. THE rule posting Sales Invoice SHALL (untuk invoice bertanggal ≥ cutover) menghasilkan: Debit `receivable` sebesar total; Kredit `revenue` sebesar total dikurangi jumlah pajak yang dipisah; dan satu Kredit per komponen pajak `additive` terklasifikasi pada peran `output_role` versinya, bernilai `tax_amount` tersimpan komponen itu (dikelompokkan per versi dan peran).
2. THE rule posting Purchase Invoice (jurnal `expense`) SHALL (untuk invoice bertanggal ≥ cutover) menghasilkan: Debit `expense` sebesar total dikurangi pajak yang dipisah; Debit peran `input_role` per komponen pajak `additive` terklasifikasi yang `is_creditable`; Kredit `payable` sebesar total. Jurnal `stock` (stok/SRNB) TIDAK berubah.
3. THE komponen pajak `unclassified`, atau `is_creditable = false`, atau `withholding` (sebelum Bagian B), SHALL tetap tertanam di baris `revenue`/`expense` (perilaku lama) dan dilaporkan sebagai `unsplit_tax` pada log posting agar terlihat.
4. THE jurnal SHALL tetap seimbang secara konstruksi (baris `revenue`/`expense` dihitung sebagai sisa, bukan dijumlahkan ulang) dan setiap baris pajak mengisi `general_ledgers.tax_rule_version_id`.
5. THE cutover SHALL dikendalikan preferensi per jenis dokumen `finance_tax_split_from.{sales_invoice|purchase_invoice}` (tanggal; kosong = tidak aktif, default kosong). Invoice bertanggal sebelum cutover memakai bentuk lama.
6. THE invoice retur SHALL memakai rule yang sama dengan sisi ditukar; pembatalan (Fase 2 D-13) membalik jurnal asli apa adanya sehingga invoice lama berbentuk lama tetap dibalik dengan bentuk lamanya.
7. THE peran `tax_output`/`tax_input` (dan peran kustom dari versi) SHALL ter-resolve lewat Posting Profile; profil tanpa pemetaan peran tersebut membuat posting gagal dengan `UnresolvedAccountRoleException` (bukan fallback ke total), kecuali preferensi cutover masih kosong.
8. THE `finance:init-posting-profile` (Fase 2) SHALL diperluas untuk melaporkan akun `tax` ambigu dan *tidak* menebak pemisahan PPN Masukan/Keluaran; COA harus dilengkapi akuntan (Q-P2-2).
9. THE kebijakan PKP (`finance_company_is_pkp`, default true) SHALL menentukan apakah PPN Masukan dipisah (true) atau tertanam di biaya (false), menunggu D-12.

### Requirement 8: Pembulatan jurnal pajak

#### Acceptance Criteria

1. THE jurnal pajak SHALL membulatkan jumlah tiap komponen ke minor unit mata uang dasar (HALF_UP) sebelum dikirim ke `JournalService`.
2. IF pembulatan menyebabkan ketidakseimbangan, THEN THE selisih (≤ 1 minor unit per komponen) SHALL diserap oleh baris `revenue`/`expense` (karena dihitung sebagai sisa), bukan oleh akun pembulatan, sehingga tidak ada baris pembulatan di Bagian A.
3. WHERE Bagian B aktif dan `rounding_mode = per_document` menghasilkan selisih terhadap jumlah item, THE selisih SHALL diposting ke peran `rounding` (peran dari Fase 2).

### Requirement 9: Tautan ke Faktur Pajak

#### Acceptance Criteria

1. WHEN `assignTaxInvoice` mengisi `tax_invoice_dpp_amount` dan `tax_invoice_ppn_amount`, THE nilai SHALL berasal dari komponen `ppn_standard`/`ppn_luxury` pada `TaxResult` bila ada klasifikasi, dan dari seluruh `sum(items)` (perilaku lama) bila invoice legacy/`unclassified`.
2. THE perubahan ini SHALL tidak mengubah nomor seri, kode transaksi, atau alokasi `TaxInvoiceSerialAllocator`.
3. THE test `TaxInvoiceAssignmentTest` yang ada SHALL tetap hijau.

### Requirement 10: Antarmuka dan penjelasan

**User Story:** Sebagai pengguna, saya ingin melihat rincian perhitungan pajak dan mengelola versi aturan dari UI, so that saya tidak perlu developer untuk perubahan tarif.

#### Acceptance Criteria

1. THE halaman master Pajak SHALL menampilkan field baru (kategori, behavior) dan tab/tabel **Versi Aturan** (tambah versi baru, tanggal berlaku, aktivasi, lihat riwayat) di balik izin.
2. THE halaman detail Sales Invoice dan Purchase Invoice SHALL menampilkan panel **Rincian Pajak** (komponen, versi, basis, faktor DPP, tarif, jumlah, pembulatan) dari `tax_breakdown`/rekonstruksi legacy.
3. THE halaman jurnal (Fase 1) SHALL menampilkan tautan versi aturan pada baris pajak.
4. THE kunci terjemahan baru SHALL tersedia di `lang/id` dan `lang/en`; komponen React baru memiliki test `.rtl.test.jsx`.
5. THE laporan "Pajak tak terklasifikasi" (daftar pajak `unclassified` yang dipakai + jumlah transaksi) SHALL tersedia sebagai perintah dan tampilan sederhana.

### Requirement 11: Golden tests dan migrasi tarif

#### Acceptance Criteria

1. THE test suite SHALL memuat skenario *golden* yang masing-masing menyatakan input, `TaxResult`, dan jurnal yang diharapkan: (a) PPN dengan DPP 11/12, (b) tarif lama vs tarif baru di sekitar tanggal berlaku, (c) invoice dengan diskon baris, (d) banyak baris dengan tarif berbeda, (e) retur, (f) pajak `unclassified` (tetap tertanam), (g) pembulatan banyak baris, (h) mata uang minor unit 0.
2. WHEN tarif berubah, THE prosedur SHALL: tambah versi baru + tambah/ubah golden test; tidak ada perubahan kode (diverifikasi dengan test yang menambah versi lewat data saja).
3. THE test paritas Requirement 6.4 SHALL dijalankan atas sampel data staging sebagai bagian checkpoint.

### Requirement 12: Konversi perhitungan dokumen (Bagian B — GATED D-15)

**User Story:** Sebagai pemilik produk, saya ingin faktor DPP dan pemotongan PPh benar-benar ditentukan oleh aturan data, so that perubahan regulasi tidak lagi membutuhkan perubahan skema.

#### Acceptance Criteria

1. IF D-15 tidak disetujui, THEN Requirement 12 SHALL dikeluarkan dari fase ini tanpa memengaruhi requirement lain.
2. IF D-15 disetujui, THEN THE kolom `dpp_amount`, `tax_amount` (dan `amount` pada Purchase Invoice) pada `sales_invoice_items` dan `purchase_invoice_items` SHALL dikonversi dari *stored generated column* menjadi kolom biasa bertipe sama, dengan nilai tersalin dan diverifikasi sama persis sebelum kolom lama dilepas.
3. THE perhitungan SHALL berpindah ke `TaxEngine` pada `SalesInvoiceService`/`PurchaseInvoiceService` (`fillItemRelations`), dengan faktor DPP dan `rate` dari versi aturan.
4. THE pajak `withholding` SHALL dikeluarkan dari `tax_amount` yang menambah total dokumen dan ditampilkan sebagai pemotongan terpisah, selaras DPP spec Requirement 4.3; jurnal SHALL memetakannya ke peran `withholding_receivable` (penjualan) atau `withholding_payable` (pembelian) sesuai D-12.
5. THE migrasi SHALL memuat pra-pemeriksaan paritas (jumlah baris dengan selisih > 1 minor unit harus nol atau disetujui), jendela pemeliharaan, dan `down()` terdokumentasi.
6. THE seluruh pemakai kolom (view laporan `report_sales_invoice_view`, laporan invoice, `assignTaxInvoice`, cetak) SHALL diaudit sebelum konversi.
7. THE konversi SHALL TIDAK mengubah dokumen order (di luar scope).

### Requirement 13: Non-fungsional

#### Acceptance Criteria

1. THE penambahan resolver/engine SHALL tidak menambah lebih dari 15% waktu pembuatan/approve invoice pada dataset uji.
2. THE tabel/model baru SHALL mendeklarasikan kolom eksplisit di migration dan diuji terhadap `initPermissions()` (F-12).
3. THE izin baru: `TaxRuleVersion` (`select`, `read`, `write`, `manage_rule_versions`).
4. THE semua migration aditif dengan `down()`; Bagian B terdokumentasi terpisah.
5. THE characterization Fase 0, test Fase 1–2, dan test pajak existing (`TaxInvoiceAssignmentTest`, `PurchaseInvoiceMissingTaxItemTest`, `*DiscountPersistenceTest`, `InvoiceDppMigrationTest`) SHALL tetap hijau.

## Pertanyaan yang Menunggu Konfirmasi

| ID | Pertanyaan | Dampak |
|---|---|---|
| D-12 | Kebijakan posting pajak (PPN Masukan/Keluaran terpisah; PPh sebagai utang/piutang pajak) — validasi akuntan | Requirement 7, 12.4 |
| D-15 | Konversi kolom generated invoice ke kolom biasa (Bagian B) disetujui? Spec DPP Requirement 4 dinyatakan disupersede? | Requirement 1.5, 12 |
| Q-P3-1 | Semantik `taxes.rate` di data produksi: apakah 11 dengan DPP 11/12 (≈10,08%), atau seharusnya 12? Apakah invoice historis bernilai benar? | Requirement 6.3 |
| Q-P3-2 | Apakah perusahaan PKP? Apakah PPN Masukan seluruhnya dapat dikreditkan? | Requirement 7.2, 7.9 |
| Q-P3-3 | Tanggal cutover pemisahan pajak per jenis dokumen (awal bulan/periode terbuka) | Requirement 7.5 |
| Q-P3-4 | Akun COA PPN Keluaran/Masukan/PPh yang akan dipakai (akuntan melengkapi COA) | Requirement 7.7–7.8 |
