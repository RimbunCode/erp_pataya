# Requirements Document

## Introduction

Saat ini satu item Sales Invoice atau Purchase Invoice hanya punya satu pajak (`tax_id`). Faktur jasa yang kena PPN 12% sekaligus dipotong PPh 23 2% atas basis yang sama harus ditulis sebagai dua baris, sehingga basis dan pendapatan tergandakan (terlihat pada simulasi Task 6.6 spek Fase 3, skenario S2).

Spek ini membuat satu item invoice dapat membawa **beberapa pajak sekaligus** (pajak majemuk per item), merujuk perilaku Odoo (`tax_ids` many2many pada baris faktur). Keputusan pemilik produk 2026-11-28: dikerjakan **per item** (bukan master pajak majemuk/grup pajak), dan field pajak pada item memakai komponen `LinkModel` dengan **mode multi value**.

Spek ini adalah kelanjutan kait D-28 dan Requirement 13.6 spek `finance-p3-tax-engine`: `TaxInput` sudah per pasangan (baris, pajak) dan `lineRef` boleh berulang, sehingga `TaxEngine` tidak perlu berubah perilakunya. Yang dibangun di sini: relasi banyak-pajak per item invoice, perhitungan dan penyimpanan per pasangan, jurnal, snapshot, cetak, laporan, dan form.

**Temuan penting saat menyusun spek (perlu diketahui pemilik produk):** komponen `LinkModel` di repo ini **belum punya mode multi value**. Kata "multi" pada `LinkModel` (spek `linkmodel-multi-model`, `AdvanceSearchDialog.multi.rtl.test.jsx`) berarti multi-**model** (satu dropdown dengan beberapa sumber `subModels`), nilainya tetap SATU objek. Maka mode multi value harus dibangun lebih dulu sebagai bagian spek ini (Requirement 9). Lihat Q-MT-1.

**Batas lingkup (usulan, menunggu Q-MT-2):** hanya Sales Invoice dan Purchase Invoice. Sales Order, Purchase Order, Quotation, dan Delivery Note tidak diubah dan tetap satu pajak per item.

## Glossary

- **Pajak Majemuk per Item**: lebih dari satu baris pajak pada satu item invoice, semuanya dihitung atas basis item yang sama.
- **Baris Pajak Item** (`invoice_item_taxes`): satu pasangan (item, pajak) di tabel pivot, memuat versi aturan, tarif, DPP, jumlah pajak, dan urutan.
- **Pajak Utama**: pajak dengan urutan pertama pada item; dicerminkan ke kolom lama `tax_id`/`tax_rule_version_id`/`tax_rate` pada item untuk kompatibilitas.
- **Basis Bersih**: `basic_amount - discount_amount` item, sama untuk semua pajak item (tidak ada pajak atas pajak, kecuali diputuskan Q-MT-6).
- **Pajak Penambah (`additive`)** dan **Pajak Potong (`withholding`)**: perilaku pajak pada `taxes.behavior` (spek Fase 3).
- **Multi value (LinkModel)**: mode `LinkModel` dengan nilai berupa array objek terpilih, bukan satu objek.

## Requirements

### Requirement 1: Relasi banyak-pajak per item invoice

**User Story:** Sebagai akuntan, saya ingin satu baris invoice membawa beberapa pajak, so that faktur jasa PPN + PPh cukup satu baris tanpa menggandakan basis dan pendapatan.

#### Acceptance Criteria

1. THE sistem SHALL menyimpan pajak item Sales Invoice dan Purchase Invoice pada tabel pivot baru `sales_invoice_item_taxes` dan `purchase_invoice_item_taxes` (satu baris per pasangan item–pajak), bukan pada kolom tunggal.
2. THE pivot SHALL memuat minimal: `tax_id`, `tax_rule_version_id`, `position` (urutan, mulai 0), `tax_rate`, `dpp_factor`, `base_amount`, `dpp_amount`, `tax_amount`, `withholding_amount` (salah satu dari `tax_amount`/`withholding_amount` selalu 0, mengikuti `behavior`).
3. THE satu item SHALL dapat membawa 1 sampai N pajak (N usulan 5, Q-MT-4); item tanpa pajak (aturan "tanpa pajak" eksplisit, `ValidatesRowTaxRequired`) membawa 0 pajak.
4. THE kolom lama `tax_id`, `tax_rule_version_id`, `tax_rate` pada item SHALL tetap ada dan SHALL selalu mencerminkan Pajak Utama (urutan pertama); bernilai null/0 bila item tanpa pajak (Q-MT-5).
5. WHEN draft disimpan ulang, THE sistem SHALL menyinkronkan baris pajak item (tambah, ubah, hapus) dalam transaksi yang sama dengan penyimpanan item, tanpa meninggalkan baris pajak yatim.
6. THE tabel baru SHALL mendeklarasikan kolom eksplisit di migration, aditif, dengan `down()` terdokumentasi.

### Requirement 2: Aturan kombinasi pajak pada satu item

**User Story:** Sebagai pemilik produk, saya ingin kombinasi pajak yang tidak masuk akal ditolak, so that dokumen tidak membawa pajak ganda yang salah.

#### Acceptance Criteria

1. IF dua baris pajak pada satu item memakai `tax_id` yang sama, THEN THE validasi SHALL menolak dengan pesan id/en pada `items.{i}.taxes`.
2. IF satu item memuat lebih dari satu pajak berkategori `ppn_standard`, THEN THE validasi SHALL menolak (Q-MT-3). Kombinasi pajak penambah dengan pajak potong (mis. PPN + PPh 23) SHALL diizinkan.
3. IF jumlah pajak melebihi batas N, THEN THE validasi SHALL menolak.
4. THE pajak berkategori `unclassified` SHALL tetap boleh dipakai bersama pajak lain; perilakunya mengikuti Fase 3 (tertanam di jurnal, tidak dipisah, P-6).
5. THE aturan kombinasi SHALL ditegakkan di FormRequest (pesan ke pengguna) DAN di service (jaring pengaman), sehingga jalur non-HTTP (seeder, job) tidak melewatinya.
6. THE spek Fase 3 (Q-P3-12) hanya memutuskan penyimpanan pajak potong dan tidak melarang kombinasi apa pun; larangan di atas adalah keputusan baru spek ini.

### Requirement 3: Urutan dan basis perhitungan per pajak

**User Story:** Sebagai akuntan, saya ingin tiap pajak dihitung dari basis yang jelas, so that angka dapat dijelaskan.

#### Acceptance Criteria

1. THE tiap pajak item SHALL dihitung `TaxEngine` dari Basis Bersih item yang sama, dengan faktor DPP dan tarif dari versi aturan pajak itu pada tanggal dokumen (Requirement 3.4 Fase 3), satu `TaxInput` per pasangan item–pajak.
2. THE tidak ada pajak atas pajak: hasil satu pajak tidak masuk basis pajak lain (Q-MT-6, usulan ditetapkan).
3. THE urutan (`position`) SHALL hanya menentukan Pajak Utama dan urutan tampil, bukan hasil hitung.
4. THE pembulatan SHALL mengikuti `rounding_mode` tiap versi (Requirement 4.3 dan 8.3 Fase 3): `per_line` membulatkan tiap pasangan; `per_document` mengelompokkan per versi dan sisa dibebankan pada pasangan dengan basis terbesar; hasil Σ komponen = jumlah dokumen.
5. THE `lineRef` komponen SHALL gabungan item dan pajak (mis. `{item_id}#{tax_id}`) sehingga pasangan yang sama tidak bertabrakan di snapshot dan pembulatan.
6. THE kolom hitung item SHALL menjadi agregat: `tax_amount` = Σ pajak penambah item, `withholding_amount` = Σ pajak potong item, `dpp_amount` = DPP Pajak Utama penambah (atau Pajak Utama bila tidak ada pajak penambah; Q-MT-7), `amount` (Purchase Invoice) = basis bersih + `tax_amount`.
7. THE `amount` header, outstanding, dan jadwal pembayaran SHALL tetap NET: Σ basis bersih + Σ pajak penambah − Σ pajak potong (Q-P3-12 b), tanpa perubahan rumus.

### Requirement 4: Alokasi diskon dokumen dengan banyak pajak

**User Story:** Sebagai akuntan, saya ingin diskon dokumen tetap teralokasi benar saat item punya beberapa pajak.

#### Acceptance Criteria

1. THE `DocumentDiscountCalculator::invoiceItemDiscounts()` dan `allocate()` SHALL menerima daftar pajak per baris (tarif, faktor DPP, `additive`) dan menghitung pajak awal baris sebagai Σ pajak penambah; pajak potong tidak ikut basis `grand_total` (Req 12.4 Fase 3).
2. THE basis `net_total` SHALL tidak terpengaruh jumlah pajak.
3. THE rumus reduksi `grand_total` SHALL memakai Σ tarif pajak penambah sebagai pengganti satu tarif; keterbatasan ketidak-eksakan untuk faktor DPP selain 1 (Q8 Fase 3) tetap berlaku dan dicatat.
4. THE perilaku untuk item dengan satu pajak SHALL identik byte-demi-byte dengan sebelum spek ini (karakterisasi).

### Requirement 5: Jurnal Sales/Purchase Invoice

**User Story:** Sebagai akuntan, saya ingin jurnal memisahkan tiap pajak item pada akunnya masing-masing.

#### Acceptance Criteria

1. THE `InvoiceTaxComponentsBuilder` SHALL membentuk komponen dari baris pajak item (pivot), dikelompokkan per `(tax_id, tax_rule_version_id)`, dengan `lineShares` berisi `tax_amount` per item untuk komponen itu; `withholdingComponents()` memakai `withholding_amount` pivot dengan cara yang sama.
2. THE Posting Rule (`SalesInvoiceRule`, rule Purchase Invoice) SHALL tidak berubah: pendapatan/beban per baris dikurangi Σ bagian pajak terpisah pada baris itu; Σ debit = Σ kredit tanpa baris pembulatan (Requirement 7.4 Fase 3).
3. THE `InvoiceLineAttributesBuilder` SHALL tetap memakai `tax_amount` item (kini Σ pajak penambah) sehingga jumlah baris = `basic − discount + tax_amount`.
4. THE cutover pemisahan pajak (`finance_tax_split_from.{type}`) dan aturan retur mengikuti bentuk invoice asal (Q-P3-8) SHALL tidak berubah; retur SHALL membawa pajak yang sama dengan item asal, mengikuti mekanisme yang berlaku untuk pajak tunggal.
5. THE peran `withholding_receivable`/`withholding_payable` SHALL tetap dituntut pada approve bila Σ potongan > 0 (Req 12.4 Fase 3).
6. THE approve SHALL menolak (sebelum commit) bila versi aturan salah satu pajak item pada tanggal dokumen berbeda dari versi tersimpan pada baris pajak itu (memperluas `assertStoredVersionsCurrent`).

### Requirement 6: Snapshot `tax_breakdown`, penjelasan, dan Faktur Pajak

**User Story:** Sebagai akuntan, saya ingin penjelasan pajak dan Faktur Pajak tetap benar untuk item berpajak majemuk.

#### Acceptance Criteria

1. THE `DocumentTaxSnapshot` SHALL membangun satu komponen per baris pajak item (bukan per item); `describePersisted()` SHALL membaca nilai tersimpan dari pivot dengan kunci `lineRef` gabungan.
2. THE snapshot yang gagal dibangun SHALL tetap tidak memblokir approve (Q-P3-6).
3. THE `TaxInvoiceAmounts::fromBreakdown()` SHALL menjumlah DPP dan PPN hanya dari komponen berkategori PPN; PPh pada item yang sama tidak masuk kolom PPN (perilaku sudah per komponen, dikunci dengan test). Aturan `unclassified` Q-P3-9 tidak berubah.
4. THE jalur fallback `assignTaxInvoice`/`recordTaxInvoice` (`sum(items.dpp_amount)`/`sum(items.tax_amount)`) SHALL memakai kolom agregat item; untuk item PPN + PPh, hasil fallback SHALL tidak memasukkan PPh ke `tax_invoice_ppn_amount` (dipastikan lewat Requirement 3.6 dan test).
5. THE `TaxBreakdownPanel` dan `UnclassifiedTaxUsage` SHALL membaca pajak dari pivot sehingga pajak non-utama ikut terhitung.

### Requirement 7: Migrasi data lama

**User Story:** Sebagai pemilik produk, saya ingin invoice lama tetap benar setelah skema berubah.

#### Acceptance Criteria

1. THE migrasi SHALL membuat satu baris pivot untuk setiap item invoice yang `tax_id`-nya terisi, dengan nilai disalin dari item (`tax_rule_version_id`, `tax_rate`, `dpp_amount`, `tax_amount` atau `withholding_amount` menurut `taxes.behavior`, `position` 0, `base_amount` = `basic_amount − discount_amount`).
2. THE migrasi SHALL memuat pra-pemeriksaan paritas: Σ pivot `tax_amount` = Σ item `tax_amount` dan Σ pivot `withholding_amount` = Σ item `withholding_amount` per dokumen; selisih lebih dari 1 minor unit menghentikan migrasi dengan pesan jelas.
3. THE item lama tanpa `tax_rule_version_id` (data legacy Bagian A) SHALL tetap dibackfill dengan `tax_rule_version_id` null; komponen legacy diperlakukan sesuai Requirement 5.5 Fase 3.
4. THE migrasi SHALL idempoten (aman dijalankan ulang) dan `down()` SHALL menghapus pivot tanpa mengubah kolom item.
5. THE dokumen yang sudah disetujui SHALL tidak dihitung ulang dan jurnalnya tidak diubah.
6. THE kode SHALL kompatibel dengan data tanpa pivot selama jendela deploy: item tanpa baris pivot tetapi ber-`tax_id` diperlakukan sebagai satu pajak dari kolom item (jaring pengaman baca), sampai migrasi selesai.

### Requirement 8: Validasi dan kontrak request

**User Story:** Sebagai pengembang, saya ingin kontrak request yang jelas untuk banyak pajak.

#### Acceptance Criteria

1. THE FormRequest Sales/Purchase Invoice SHALL menerima `items.*.taxes` (array objek `{id, ...}`), tiap `taxes.*.id` ber-ULID dan `ExistsExcludingTrashed('taxes')`, sesuai pola `items.*.tax.id` yang ada.
2. THE `items.*.tax` (satu objek) SHALL tetap diterima selama masa transisi dan dinormalisasi menjadi `taxes: [tax]` (Q-MT-8); bila keduanya dikirim, `taxes` menang.
3. THE `ValidatesRowTaxRequired` SHALL mewajibkan minimal satu pajak per baris kecuali aturan "tanpa pajak" eksplisit cocok (perilaku sama, kunci `items.{i}.taxes`).
4. THE kolom hitung (`dpp_amount`, `tax_amount`, `withholding_amount`, `tax_rate`, `tax_rule_version_id`, nilai pivot) SHALL tidak dapat diisi dari request (mass assignment dibuang, seperti Req 12.3 Fase 3).
5. THE pajak tanpa versi aturan berlaku pada tanggal dokumen SHALL tetap gagal tertutup (Q-P3-5) dengan pesan pada `items.{i}.taxes.{j}`.
6. THE `InvoiceBilledValueResolver` (toleransi penagihan) SHALL menghitung tarif baris dari Σ pajak penambah item.

### Requirement 9: Komponen LinkModel mode multi value

**User Story:** Sebagai pengguna, saya ingin memilih beberapa pajak pada satu field item, so that tidak perlu menambah baris.

#### Acceptance Criteria

1. THE `LinkModel` SHALL mendukung mode multi value lewat prop baru (usulan `multiple`), dengan `value` berupa array objek berbentuk sama seperti nilai tunggal (`id`, field yang diminta) dan `onValueChange(array)`.
2. WHEN mode multi value aktif, THE dropdown SHALL tetap terbuka setelah memilih opsi, menandai opsi terpilih, dan memungkinkan hapus per pilihan (chip); urutan pilihan SHALL dipertahankan (menentukan Pajak Utama).
3. THE `AdvanceSearchDialog` dan `useAdvanceSearchModel` SHALL mendukung seleksi banyak baris pada mode ini; `trimToLinkModelPayload` SHALL memangkas tiap elemen seperti nilai tunggal.
4. THE mode tunggal dan mode multi-model (`subModels`) yang ada SHALL tidak berubah perilakunya; kombinasi `multiple` dengan `subModels` TIDAK didukung pada rilis ini dan SHALL ditolak jelas (dev warning).
5. THE `TaxLinkModel` SHALL meneruskan `multiple` ke `LinkModel`, dan filter opsi (`filters`) SHALL tetap berfungsi.
6. THE komponen SHALL diuji RTL (`LinkModel.multiple.rtl.test.jsx`): pilih, hapus, urutan, filter, dialog advance search, mode tunggal tidak regresi.

### Requirement 10: Form Sales/Purchase Invoice

**User Story:** Sebagai pengguna, saya ingin form menampilkan dan menghitung banyak pajak per baris dengan benar.

#### Acceptance Criteria

1. THE field pajak item pada `SalesInvoice/Form.jsx` dan `PurchaseInvoice/Form.jsx` SHALL memakai `TaxLinkModel` mode multi value dengan state `taxes` (array); baris baru mendapat default pajak tunggal dari `useDocumentDefaults`/`applyToNewLine` sebagai array berisi satu elemen.
2. THE `resolveTaxRule` SHALL dipanggil per pajak (`rulesOf(row)`); `mapItem` dan `allocateDiscount` SHALL menerima daftar pajak per baris dan menulis balik `dpp_amount`, `tax_amount`, `withholding_amount` sebagai agregat, konsisten dengan backend.
3. THE kolom DPP (Req 12.8 Fase 3) SHALL tampil bila SALAH SATU pajak penambah baris berfaktor selain 1/1; nilainya = `dpp_amount` item (Requirement 3.6); baris tanpa pajak berfaktor DPP tidak menampilkan angka DPP.
4. THE tabel/panel ringkasan pajak SHALL merinci per pajak (nama, tarif, jumlah); `TaxBreakdownPanel` membaca komponen per pasangan.
5. THE item dari Sales Order/Purchase Order/Delivery Note (`tax: val?.tax`) SHALL dipetakan menjadi `taxes: [tax]`.
6. THE pesan galat validasi SHALL muncul pada field pajak baris (`items.{i}.taxes`).
7. THE test form (`Form.rtl.test.jsx`), `taxRules.test.js`, dan `discountAllocation.test.js` SHALL diperbarui dan menambah kasus banyak pajak.

### Requirement 11: Laporan, tampilan, dan cetak

**User Story:** Sebagai pengguna, saya ingin laporan dan cetak memuat semua pajak item.

#### Acceptance Criteria

1. THE `SalesInvoiceItem`/`PurchaseInvoiceItem` SHALL mendapat relasi `taxLines()` (hasMany pivot) dan `taxes()` (belongsToMany `Tax` melalui pivot, berurut `position`); relasi `tax()` yang ada tetap menunjuk Pajak Utama.
2. THE view laporan (`report_sales_view`, `report_purchase_view`, `report_sales_invoice_view`, `report_purchase_invoice_view`) SHALL diaudit; kolom `tax_id`/`tax_amount` yang ada tetap valid (Pajak Utama dan agregat), dan keterbatasan "filter per pajak hanya melihat Pajak Utama" didokumentasikan atau diperbaiki (Q-MT-9).
3. THE atribut cetak item SHALL menambah `tax_names` (nama pajak dipisah koma) dan `tax_rates` selain kolom `tax`/`tax_rate` yang ada; template standar Sales/Purchase Invoice SHALL memakai atribut baru; template buatan pengguna tetap bekerja (menampilkan Pajak Utama).
4. THE "Pajak Dipotong" dan DPP pada cetak (`InvoicePrintTotals`) SHALL dihitung dari pivot: DPP hanya dari pajak penambah berfaktor selain 1/1; potongan = Σ `withholding_amount`.
5. THE `configColumns` item SHALL mendaftarkan kolom baru dengan benar sehingga datatable/print tidak menampilkan kunci mentah.

### Requirement 12: Non-fungsional dan kompatibilitas

#### Acceptance Criteria

1. THE perilaku item dengan satu pajak SHALL identik dengan sebelum spek ini (angka, jurnal, snapshot, cetak); test karakterisasi Fase 0, test Fase 1–2, dan test pajak existing (`InvoiceCalcConversionTest`, `InvoiceTaxSnapshotTest`, `TaxJournalSplitTest`, `TaxInvoiceAssignmentTest`, `*DiscountPersistenceTest`) SHALL tetap hijau.
2. THE penambahan pivot SHALL tidak menambah lebih dari 15% waktu pembuatan/approve invoice (selaras Req 13.1 Fase 3); pembacaan pivot SHALL eager-loaded (tanpa N+1).
3. THE model pivot baru SHALL diuji terhadap `initPermissions()` (F-12) dan mendeklarasikan `$guarded`/kolom eksplisit.
4. THE `ComputesLegacyInvoiceItemAmounts` (jaring pengaman penulis non-service) SHALL tetap menghitung satu pajak dari kolom item; penulis yang tidak memakai service tidak membentuk pivot (didokumentasikan).
5. THE skenario S2 simulasi Task 6.6 (PPN 12% + PPh 23 2% jasa, satu baris) SHALL menjadi test end-to-end: header NET, jurnal (piutang/utang, pendapatan/beban, PPN, `withholding_*`), Faktur Pajak, snapshot, dan cetak.

## Pertanyaan yang Menunggu Konfirmasi

| ID | Pertanyaan | Rekomendasi | Dampak |
|---|---|---|---|
| Q-MT-1 | `LinkModel` belum punya mode multi value ("multi" saat ini = multi-model). Apakah membangun mode multi value baru di `LinkModel` (Requirement 9) memang yang dimaksud, atau cukup memperluas `MultiSelect` dengan opsi dinamis dari model Tax? | Bangun mode `multiple` di `LinkModel` (sesuai keputusan 2026-11-28; Advance Search dan filter ikut). Biaya: komponen inti dipakai banyak halaman, wajib uji regresi. | Req 9, Task 1 |
| Q-MT-2 | Batas lingkup: apakah Sales Order, Purchase Order, Quotation, dan Delivery Note ikut pajak majemuk? | Tidak (hanya Invoice). Mereka berbagi `taxRules.js`, `AdditionalDiscount.jsx`, dan `TaxLinkModel`; invoice dari SO/PO membawa satu pajak lalu pengguna menambah. Konsekuensi: total SO ≠ total invoice bila pengguna menambah PPh di invoice. | Seluruh spek |
| Q-MT-3 | Kombinasi terlarang: duplikat `tax_id` (pasti ditolak), lebih dari satu `ppn_standard` (usulan ditolak). Perlu larangan lain (mis. dua pajak potong sekategori, `ppn_standard` + `ppn_luxury`)? | Tolak duplikat dan >1 `ppn_standard`; sisanya diizinkan (akuntan bertanggung jawab). | Req 2 |
| Q-MT-4 | Batas jumlah pajak per item? | 5 | Req 1.3, 2.3 |
| Q-MT-5 | Nasib kolom lama `tax_id`, `tax_rule_version_id`, `tax_rate` pada item: dicerminkan ke Pajak Utama (usulan) atau dihapus setelah semua pembaca berpindah ke pivot? | Cermin sekarang (aman untuk view laporan, cetak lama, `InvoiceBilledValueResolver`, trait legacy); hapus di spek lanjutan. | Req 1.4, 11.2 |
| Q-MT-6 | Pajak atas pajak (opsi Odoo "include in base of subsequent taxes")? | Tidak diperlukan; semua pajak dari basis bersih yang sama. | Req 3.2 |
| Q-MT-7 | Definisi `dpp_amount` item bila ada banyak pajak (DPP berbeda per pajak: PPN 11/12 vs PPh 23 penuh)? | DPP Pajak Utama penambah (atau Pajak Utama bila tak ada penambah); DPP per pajak ada di pivot. Menjaga cetak dan fallback Faktur Pajak. | Req 3.6, 6.4, 10.3 |
| Q-MT-8 | Apakah kontrak lama `items.*.tax` (satu objek) tetap diterima sementara (dinormalisasi)? | Ya, selama transisi; hapus di spek lanjutan bersama kolom lama. | Req 8.2 |
| Q-MT-9 | Laporan/filter per pajak: cukup Pajak Utama, atau view laporan diperluas ke pivot? | Perluas view hanya bila ada kebutuhan laporan pajak nyata; awalnya dokumentasikan keterbatasan. | Req 11.2 |
| Q-MT-10 | Aturan default (`default_tax_rules`, pajak default modul) tetap satu pajak per aturan? | Ya, default tetap satu pajak (prefill); pengguna menambah di form. Default multi pajak = spek lanjutan. | Req 10.1 |
