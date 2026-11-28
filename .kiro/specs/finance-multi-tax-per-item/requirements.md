# Requirements Document

## Introduction

Saat ini satu item Sales Invoice atau Purchase Invoice hanya punya satu pajak (`tax_id`). Faktur jasa yang kena PPN 12% sekaligus dipotong PPh 23 2% atas basis yang sama harus ditulis sebagai dua baris, sehingga basis dan pendapatan tergandakan (terlihat pada simulasi Task 6.6 spek Fase 3, skenario S2).

Spek ini membuat satu item invoice dapat membawa **beberapa pajak sekaligus** (pajak majemuk per item), merujuk perilaku Odoo (`tax_ids` many2many pada baris faktur). Keputusan pemilik produk 2026-11-28: dikerjakan **per item** (bukan master pajak majemuk/grup pajak), dan field pajak pada item memakai komponen `LinkModel` dengan **mode multi value**.

Spek ini adalah kelanjutan kait D-28 dan Requirement 13.6 spek `finance-p3-tax-engine`: `TaxInput` sudah per pasangan (baris, pajak) dan `lineRef` boleh berulang, sehingga `TaxEngine` tidak perlu berubah perilakunya. Yang dibangun di sini: relasi banyak-pajak per item invoice, perhitungan dan penyimpanan per pasangan, jurnal, snapshot, cetak, laporan, dan form.

**Keputusan pemilik produk 2026-11-28 (Q-MT-1, menjawab temuan telaah kode):** komponen `LinkModel` belum punya mode multi value; kata "multi" pada `LinkModel` (spek `linkmodel-multi-model`, `AdvanceSearchDialog.multi.rtl.test.jsx`) berarti multi-**model** (satu dropdown dengan beberapa sumber `subModels`), nilainya tetap SATU objek. Diputuskan: mode multi value dibangun di `LinkModel` (Requirement 9), nilai terpilih tampil sebagai **chip**, dan label chip yang diklik membuka halaman detail data itu seperti fitur navigasi `LinkModel` yang ada. `MultiSelect` diperiksa dan diselaraskan dengan pola chip yang sama (Requirement 13). Alasan: konsistensi UI antar field relasi dan pemakaian ulang fitur navigasi yang sudah ada.

**Batas lingkup (diputuskan pemilik produk 2026-11-28, Q-MT-2):** SEMUA dokumen yang membawa pajak per item, agar konsisten: Quotation, Sales Order, Sales Invoice, Purchase Order, dan Purchase Invoice. Delivery Note dan Purchase Receipt tidak punya kolom pajak per item sehingga tidak berubah. Item master (Inventory Item) mendapat field pajak default penjualan dan pembelian (multi) sebagai sumber default pajak (Q-MT-10, Requirement 15). Konsekuensi: spek ini mengubah dokumen order, yang di spek Fase 3 berada di luar lingkup (Requirement 12.7 Fase 3 hanya membatasi konversi kolom Bagian B, bukan spek ini).

## Glossary

- **Pajak Majemuk per Item**: lebih dari satu baris pajak pada satu item invoice, semuanya dihitung atas basis item yang sama.
- **Baris Pajak Item** (`invoice_item_taxes`): satu pasangan (item, pajak) di tabel pivot, memuat versi aturan, tarif, DPP, jumlah pajak, dan urutan.
- **Pajak Utama**: pajak dengan urutan pertama pada item; dicerminkan ke kolom lama `tax_id`/`tax_rule_version_id`/`tax_rate` pada item untuk kompatibilitas.
- **Basis Bersih**: `basic_amount - discount_amount` item, sama untuk semua pajak item (tidak ada pajak atas pajak, Q-MT-6 diputuskan 2026-11-28).
- **Pajak Penambah (`additive`)** dan **Pajak Potong (`withholding`)**: perilaku pajak pada `taxes.behavior` (spek Fase 3).
- **Dokumen Berpajak**: Quotation, Sales Order, Sales Invoice, Purchase Order, Purchase Invoice.
- **Pajak Default Item**: daftar pajak (multi) pada item master untuk penjualan dan untuk pembelian, dipakai sebagai default pajak baris dokumen.
- **Multi value (LinkModel)**: mode `LinkModel` dengan nilai berupa array objek terpilih, bukan satu objek.

## Requirements

### Requirement 1: Relasi banyak-pajak per item invoice

**User Story:** Sebagai akuntan, saya ingin satu baris invoice membawa beberapa pajak, so that faktur jasa PPN + PPh cukup satu baris tanpa menggandakan basis dan pendapatan.

#### Acceptance Criteria

1. THE sistem SHALL menyimpan pajak item Dokumen Berpajak pada tabel pivot baru, satu baris per pasangan item–pajak, bukan pada kolom tunggal: `sales_invoice_item_taxes`, `purchase_invoice_item_taxes`, `sales_order_item_taxes`, `purchase_order_item_taxes`, `quotation_item_taxes`.
2. THE pivot SHALL memuat minimal: `tax_id`, `tax_rule_version_id`, `position` (urutan, mulai 0), `tax_rate`, `dpp_factor`, `base_amount`, `dpp_amount`, `tax_amount`, `withholding_amount` (salah satu dari `tax_amount`/`withholding_amount` selalu 0, mengikuti `behavior`).
3. THE satu item SHALL dapat membawa 1 sampai N pajak (N = 5, diputuskan Q-MT-4); item tanpa pajak (aturan "tanpa pajak" eksplisit, `ValidatesRowTaxRequired`) membawa 0 pajak.
4. THE kolom lama `tax_id`, `tax_rule_version_id`, `tax_rate` pada item SHALL tetap ada dan SHALL selalu mencerminkan Pajak Utama (urutan pertama); bernilai null/0 bila item tanpa pajak (Q-MT-5).
5. WHEN draft disimpan ulang, THE sistem SHALL menyinkronkan baris pajak item (tambah, ubah, hapus) dalam transaksi yang sama dengan penyimpanan item, tanpa meninggalkan baris pajak yatim.
6. THE tabel baru SHALL mendeklarasikan kolom eksplisit di migration, aditif, dengan `down()` terdokumentasi.

### Requirement 2: Aturan kombinasi pajak pada satu item

**User Story:** Sebagai pemilik produk, saya ingin kombinasi pajak yang tidak masuk akal ditolak, so that dokumen tidak membawa pajak ganda yang salah.

#### Acceptance Criteria

1. IF dua baris pajak pada satu item memakai `tax_id` yang sama, THEN THE validasi SHALL menolak dengan pesan id/en pada `items.{i}.taxes`.
2. IF satu item memuat lebih dari satu pajak berkategori `ppn_standard`, THEN THE validasi SHALL menolak (Q-MT-3, diputuskan). Kombinasi pajak penambah dengan pajak potong (mis. PPN + PPh 23) SHALL diizinkan.
3. IF jumlah pajak melebihi batas N, THEN THE validasi SHALL menolak.
4. THE pajak berkategori `unclassified` SHALL tetap boleh dipakai bersama pajak lain; perilakunya mengikuti Fase 3 (tertanam di jurnal, tidak dipisah, P-6).
5. THE aturan kombinasi SHALL ditegakkan di FormRequest (pesan ke pengguna) DAN di service (jaring pengaman), sehingga jalur non-HTTP (seeder, job) tidak melewatinya.
6. THE spek Fase 3 (Q-P3-12) hanya memutuskan penyimpanan pajak potong dan tidak melarang kombinasi apa pun; larangan di atas adalah keputusan baru spek ini.

### Requirement 3: Urutan dan basis perhitungan per pajak

**User Story:** Sebagai akuntan, saya ingin tiap pajak dihitung dari basis yang jelas, so that angka dapat dijelaskan.

#### Acceptance Criteria

1. THE tiap pajak item SHALL dihitung `TaxEngine` dari Basis Bersih item yang sama, dengan faktor DPP dan tarif dari versi aturan pajak itu pada tanggal dokumen (Requirement 3.4 Fase 3), satu `TaxInput` per pasangan item–pajak.
2. THE tidak ada pajak atas pajak: hasil satu pajak tidak masuk basis pajak lain (Q-MT-6, diputuskan 2026-11-28 oleh pemilik produk).
3. THE urutan (`position`) SHALL hanya menentukan Pajak Utama dan urutan tampil, bukan hasil hitung.
4. THE pembulatan SHALL mengikuti `rounding_mode` tiap versi (Requirement 4.3 dan 8.3 Fase 3): `per_line` membulatkan tiap pasangan; `per_document` mengelompokkan per versi dan sisa dibebankan pada pasangan dengan basis terbesar; hasil Σ komponen = jumlah dokumen.
5. THE `lineRef` komponen SHALL gabungan item dan pajak (mis. `{item_id}#{tax_id}`) sehingga pasangan yang sama tidak bertabrakan di snapshot dan pembulatan.
6. THE kolom hitung item SHALL menjadi agregat: `tax_amount` = Σ pajak penambah item, `withholding_amount` = Σ pajak potong item, `dpp_amount` = DPP pajak berkategori PPN (`ppn_standard`/`ppn_luxury`) pertama menurut `position`; bila tak ada pajak PPN, DPP pajak penambah pertama; bila tak ada pajak penambah, DPP pajak pertama (mempertahankan perilaku satu pajak sekarang); `amount` (Purchase Invoice) = basis bersih + `tax_amount`. _Definisi `dpp_amount` default implementasi, menunggu konfirmasi Q-MT-7; dasar usulan: DPP PPN (11/12, PMK 131/2024) berbeda dari dasar PPh (jumlah bruto tanpa PPN), sedangkan Faktur Pajak dan cetak memakai DPP PPN._
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

1. THE migrasi SHALL membuat satu baris pivot untuk setiap item Dokumen Berpajak (invoice, order, dan quotation) yang `tax_id`-nya terisi, dengan nilai disalin dari item (`tax_rule_version_id`, `tax_rate`, `dpp_amount`, `tax_amount` atau `withholding_amount` menurut `taxes.behavior`, `position` 0, `base_amount` = `basic_amount − discount_amount`).
2. THE migrasi SHALL memuat pra-pemeriksaan paritas: Σ pivot `tax_amount` = Σ item `tax_amount` dan Σ pivot `withholding_amount` = Σ item `withholding_amount` per dokumen; selisih lebih dari 1 minor unit menghentikan migrasi dengan pesan jelas.
3. THE item lama tanpa `tax_rule_version_id` (data legacy Bagian A) SHALL tetap dibackfill dengan `tax_rule_version_id` null; komponen legacy diperlakukan sesuai Requirement 5.5 Fase 3.
4. THE migrasi SHALL idempoten (aman dijalankan ulang) dan `down()` SHALL menghapus pivot tanpa mengubah kolom item.
5. THE dokumen yang sudah disetujui SHALL tidak dihitung ulang dan jurnalnya tidak diubah.
6. THE kode SHALL kompatibel dengan data tanpa pivot selama jendela deploy: item tanpa baris pivot tetapi ber-`tax_id` diperlakukan sebagai satu pajak dari kolom item (jaring pengaman baca), sampai migrasi selesai.

### Requirement 8: Validasi dan kontrak request

**User Story:** Sebagai pengembang, saya ingin kontrak request yang jelas untuk banyak pajak.

#### Acceptance Criteria

1. THE FormRequest Sales/Purchase Invoice SHALL menerima `items.*.taxes` (array objek `{id, ...}`), tiap `taxes.*.id` ber-ULID dan `ExistsExcludingTrashed('taxes')`, sesuai pola `items.*.tax.id` yang ada.
2. THE `items.*.tax` (satu objek) SHALL tetap diterima selama masa transisi dan dinormalisasi menjadi `taxes: [tax]` (Q-MT-8, diputuskan); bila keduanya dikirim, `taxes` menang.
3. THE `ValidatesRowTaxRequired` SHALL mewajibkan minimal satu pajak per baris kecuali aturan "tanpa pajak" eksplisit cocok (perilaku sama, kunci `items.{i}.taxes`).
4. THE kolom hitung (`dpp_amount`, `tax_amount`, `withholding_amount`, `tax_rate`, `tax_rule_version_id`, nilai pivot) SHALL tidak dapat diisi dari request (mass assignment dibuang, seperti Req 12.3 Fase 3).
5. THE pajak tanpa versi aturan berlaku pada tanggal dokumen SHALL tetap gagal tertutup (Q-P3-5) dengan pesan pada `items.{i}.taxes.{j}`.
6. THE `InvoiceBilledValueResolver` (toleransi penagihan) SHALL menghitung tarif baris dari Σ pajak penambah item.

### Requirement 9: Komponen LinkModel mode multi value

**User Story:** Sebagai pengguna, saya ingin memilih beberapa pajak pada satu field item dan melihat tiap pilihan sebagai chip yang bisa dibuka, so that tidak perlu menambah baris dan saya tetap dapat menelusuri data pilihan itu.

#### Acceptance Criteria

1. THE `LinkModel` SHALL mendukung mode multi value lewat prop baru (usulan `multiple`), dengan `value` berupa array objek berbentuk sama seperti nilai tunggal (`id`, field yang diminta) dan `onValueChange(array)`.
2. WHEN mode multi value aktif, THE nilai terpilih SHALL tampil sebagai chip; memilih opsi di dropdown SHALL menambah chip (opsi yang sudah terpilih ditandai dan memilihnya lagi mencabut chip), dropdown SHALL tetap terbuka, dan urutan pilihan SHALL dipertahankan (menentukan Pajak Utama).
3. THE tiap chip SHALL memiliki dua area terpisah: (a) **label**, yang bila diklik membuka halaman detail data itu persis seperti tombol navigasi `LinkModel` mode tunggal (rute `{plural(name)}.show` dengan `keyRoute`, terbuka di tab baru, menghormati `disabledNavigation`, `customNavigation`, dan `canNavigation`/izin `read` per data); (b) **tombol hapus (X)** yang mencabut chip tanpa membuka halaman.
4. IF navigasi tidak diizinkan untuk sebuah chip (`disabledNavigation`, tak ada izin `read`, atau `name` tak diketahui), THEN label chip SHALL tampil sebagai teks biasa tanpa gaya tautan dan tidak dapat diklik.
5. WHEN field `disabled` atau `readOnly`, THE chip SHALL tetap tampil dan label tetap dapat membuka detail (bila diizinkan), tetapi tombol hapus SHALL disembunyikan, selaras perilaku tombol navigasi mode tunggal.
6. THE label chip SHALL memakai `templateLink` data (teks yang sama dengan tampilan nilai tunggal) dan chip yang panjang SHALL terpotong dengan tooltip penuh; susunan chip SHALL membungkus ke baris berikutnya tanpa merusak tinggi baris tabel item.
7. THE `AdvanceSearchDialog` dan `useAdvanceSearchModel` SHALL mendukung seleksi banyak baris pada mode ini; `trimToLinkModelPayload` SHALL memangkas tiap elemen seperti nilai tunggal.
8. THE mode tunggal dan mode multi-model (`subModels`) yang ada SHALL tidak berubah perilakunya; kombinasi `multiple` dengan `subModels` TIDAK didukung pada rilis ini dan SHALL ditolak jelas (dev warning).
9. THE `TaxLinkModel` SHALL meneruskan `multiple`, dan filter opsi (`filters`) serta `valueBefore` (tampilan diff, ditandai per chip ditambah/dihapus seperti `MultiSelect`) SHALL tetap berfungsi.
10. THE komponen SHALL diuji RTL (`LinkModel.multiple.rtl.test.jsx`): pilih, hapus lewat X, urutan, klik label membuka detail (tab baru, `customNavigation`), label non-tautan saat tak diizinkan, `disabled`/`readOnly`, filter, dialog advance search, dan mode tunggal/multi-model tanpa regresi.

### Requirement 10: Form Sales/Purchase Invoice

**User Story:** Sebagai pengguna, saya ingin form menampilkan dan menghitung banyak pajak per baris dengan benar.

#### Acceptance Criteria

1. THE field pajak item pada `SalesInvoice/Form.jsx` dan `PurchaseInvoice/Form.jsx` SHALL memakai `TaxLinkModel` mode multi value dengan state `taxes` (array); baris baru mendapat default pajak tunggal dari `useDocumentDefaults`/`applyToNewLine` sebagai array berisi satu elemen.
2. THE `resolveTaxRule` SHALL dipanggil per pajak (`rulesOf(row)`); `mapItem` dan `allocateDiscount` SHALL menerima daftar pajak per baris dan menulis balik `dpp_amount`, `tax_amount`, `withholding_amount` sebagai agregat, konsisten dengan backend.
3. THE kolom DPP (Req 12.8 Fase 3) SHALL tampil bila SALAH SATU pajak penambah baris berfaktor selain 1/1; nilainya = `dpp_amount` item (Requirement 3.6); baris tanpa pajak berfaktor DPP tidak menampilkan angka DPP.
4. THE tabel/panel ringkasan pajak SHALL merinci per pajak (nama, tarif, jumlah); `TaxBreakdownPanel` membaca komponen per pasangan.
5. THE item dari Sales Order/Purchase Order/Delivery Note (`tax: val?.tax`) SHALL dipetakan menjadi `taxes` salinan seluruh pajak baris sumber (invoice dari Sales/Purchase Order membawa semua pajak order).
6. THE pesan galat validasi SHALL muncul pada field pajak baris (`items.{i}.taxes`).
7. THE test form (`Form.rtl.test.jsx`), `taxRules.test.js`, dan `discountAllocation.test.js` SHALL diperbarui dan menambah kasus banyak pajak.

### Requirement 11: Laporan, tampilan, dan cetak

**User Story:** Sebagai pengguna, saya ingin laporan dan cetak memuat semua pajak item.

#### Acceptance Criteria

1. THE `SalesInvoiceItem`/`PurchaseInvoiceItem` SHALL mendapat relasi `taxLines()` (hasMany pivot) dan `taxes()` (belongsToMany `Tax` melalui pivot, berurut `position`); relasi `tax()` yang ada tetap menunjuk Pajak Utama.
2. THE view laporan (`report_sales_view`, `report_purchase_view`, `report_sales_invoice_view`, `report_purchase_invoice_view`) SHALL diaudit; kolom `tax_id`/`tax_amount` yang ada tetap valid (Pajak Utama dan agregat), dan keterbatasan "filter per pajak hanya melihat Pajak Utama" didokumentasikan atau diperbaiki (Q-MT-9, diputuskan: dokumentasikan keterbatasan, perluas hanya bila ada kebutuhan laporan pajak nyata).
3. THE atribut cetak item SHALL menambah `tax_names` (nama pajak dipisah koma) dan `tax_rates` selain kolom `tax`/`tax_rate` yang ada; template standar Sales/Purchase Invoice SHALL memakai atribut baru; template buatan pengguna tetap bekerja (menampilkan Pajak Utama).
4. THE "Pajak Dipotong" dan DPP pada cetak (`InvoicePrintTotals`) SHALL dihitung dari pivot: DPP hanya dari pajak penambah berfaktor selain 1/1; potongan = Σ `withholding_amount`.
5. THE `configColumns` item SHALL mendaftarkan kolom baru dengan benar sehingga datatable/print tidak menampilkan kunci mentah.

### Requirement 12: Non-fungsional dan kompatibilitas

#### Acceptance Criteria

1. THE perilaku item dengan satu pajak SHALL identik dengan sebelum spek ini (angka, jurnal, snapshot, cetak); test karakterisasi Fase 0, test Fase 1–2, dan test pajak existing (`InvoiceCalcConversionTest`, `InvoiceTaxSnapshotTest`, `TaxJournalSplitTest`, `TaxInvoiceAssignmentTest`, `*DiscountPersistenceTest`) SHALL tetap hijau, dengan satu pengecualian yang diputuskan pemilik produk pada 2026-11-28 (Q-MT-14): angka dokumen ORDER (Quotation, Sales Order, Purchase Order) bergeser karena kini memakai `TaxEngine` (mis. PPN 11% atas 1.000.000 menjadi 100.833 pada order); ekspektasi `SalesOrderDiscountPersistenceTest`, `PurchaseOrderDiscountPersistenceTest`, dan `SalesOrderServiceAssetItemsTest` diubah sesuai.
2. THE penambahan pivot SHALL tidak menambah lebih dari 15% waktu pembuatan/approve invoice (selaras Req 13.1 Fase 3); pembacaan pivot SHALL eager-loaded (tanpa N+1).
3. THE model pivot baru SHALL diuji terhadap `initPermissions()` (F-12) dan mendeklarasikan `$guarded`/kolom eksplisit.
4. THE `ComputesLegacyInvoiceItemAmounts` (jaring pengaman penulis non-service) SHALL tetap menghitung satu pajak dari kolom item; penulis yang tidak memakai service tidak membentuk pivot (didokumentasikan).
5. THE skenario S2 simulasi Task 6.6 (PPN 12% + PPh 23 2% jasa, satu baris) SHALL menjadi test end-to-end: header NET, jurnal (piutang/utang, pendapatan/beban, PPN, `withholding_*`), Faktur Pajak, snapshot, dan cetak.

### Requirement 13: Penyelarasan MultiSelect dengan pola chip

**User Story:** Sebagai pengguna, saya ingin field multi-pilih di seluruh aplikasi tampil dan berperilaku sama dengan field multi value `LinkModel`, so that UI konsisten.

#### Acceptance Criteria

1. THE `MultiSelect` SHALL menampilkan nilai terpilih sebagai chip (label opsi + tombol hapus X) menggantikan ringkasan teks gabungan di input saat popover tertutup; `showAllOption` yang memilih semua opsi SHALL tetap meringkas menjadi satu chip "Semua" (label `allOptionLabel`), bukan chip per opsi.
2. THE `MultiSelect` SHALL mendukung navigasi label chip secara opt-in: chip hanya menjadi tautan bila konsumen memberi cara menelusuri (usulan prop `navigation` berupa fungsi `(option) => href|null` atau `onOptionNavigate(option)`; opsi yang menghasilkan `null` tampil sebagai teks biasa). Tanpa prop itu semua chip berupa teks biasa, karena opsi `MultiSelect` statis dan tidak selalu merujuk halaman detail.
3. THE aturan interaksi chip (label dan X terpisah, X tersembunyi saat `disabled`/`readOnly`, label dapat diklik saat `readOnly`, terpotong dengan tooltip, membungkus baris) SHALL sama dengan Requirement 9.3-9.6 dan memakai komponen chip bersama (satu implementasi dipakai `LinkModel` dan `MultiSelect`; usulan `Components/ChipList.jsx`).
4. THE fitur `MultiSelect` yang ada SHALL tidak hilang: `valueBefore` (diff per entri), `changeOnBlur`, `delimiters` (ketik-lalu-delimiter, paste banyak entri), `showAllOption`, `defaultValue`, tombol clear, dan `onSearchChange`. Input pencarian/ketik tetap ada untuk memfilter dan menambah entri.
5. THE 7 konsumen yang ada (`Table/Filter/ValueField.jsx`, `Core/Todos/AssignedToFields.jsx`, `Inventory/Items/Form.jsx`, `Purchase/ItemRequests/Index.jsx`, dan lainnya hasil audit) SHALL diaudit dan test-nya (`MultiSelect.rtl.test.jsx`, `ValueField.rtl.test.jsx`, `Inventory/Items/Form.rtl.test.jsx`) diperbarui; perubahan tampilan default vs opt-in mengikuti Q-MT-11.
6. THE `MultiSelect` SHALL diuji RTL untuk chip, X, label non-tautan default, navigasi opt-in, dan seluruh perilaku di butir 4.

### Requirement 14: Quotation, Sales Order, dan Purchase Order dengan banyak pajak

**User Story:** Sebagai pengguna, saya ingin dokumen order dan penawaran membawa beberapa pajak per baris seperti invoice, so that total dan pajak konsisten sepanjang rantai dokumen.

#### Acceptance Criteria

1. THE `quotation_items`, `sales_order_items`, dan `purchase_order_items` SHALL memakai tabel pivot pajak (Requirement 1.1) dengan aturan kombinasi (Requirement 2), batas N, kolom cermin Pajak Utama, dan kolom agregat `tax_amount` (Σ pajak penambah) serta `amount` yang sama maknanya dengan sekarang.
2. THE perhitungan pajak order/quotation SHALL mengikuti keputusan Q-MT-12 (Opsi A, diputuskan 2026-11-28 oleh pemilik produk): usulan memakai `InvoiceItemTaxCalculator`/`TaxEngine` sehingga total order = total invoice yang dibuat darinya; alternatif mempertahankan hitung sederhana `basic × tax_rate / 100` per pajak (tanpa faktor DPP dan versi aturan).
3. THE pajak potong (`withholding`) pada order/quotation SHALL ditampilkan sebagai pemotongan terpisah dan tidak menambah total, selaras Requirement 3.7; bila Q-MT-12 memilih hitung sederhana, perlakuan pajak potong SHALL dinyatakan eksplisit di spek sebelum implementasi.
4. WHEN invoice dibuat dari Sales Order atau Purchase Order (termasuk pemecahan baris per grup `rate|tax_id|tax_rate|gudang` pada `SalesOrderService`/`PurchaseOrderService`), THE invoice SHALL membawa seluruh pajak baris sumber dan kunci pengelompokan SHALL memakai himpunan terurut `tax_id` (bukan `tax_id` tunggal).
5. WHEN Sales Order dibuat dari Quotation, THE pajak baris SHALL disalin utuh.
6. THE `QuotationService` (yang mempertahankan `keepTaxRate` saat update) SHALL mempertahankan perilaku itu per pajak.
7. THE toleransi penagihan (`InvoiceBilledValueResolver`) SHALL membandingkan nilai yang konsisten bila pajak invoice berbeda dari pajak order (mis. PPh ditambah di invoice) dan perilakunya didefinisikan eksplisit (Q-MT-12).
8. THE form `SalesOrders/Form.jsx`, `PurchaseOrders/Form.jsx` (+ `purchaseOrderAmounts.js`, `FromRequests/draftData.js`, `reviewData.js`), dan `CRM/Quotations/QuotationItems.jsx` SHALL memakai `TaxLinkModel` mode multi value dan hitung klien yang sama dengan Requirement 10.
9. THE `Components/AdditionalDiscount.jsx` dan `lib/taxRules.js` yang dipakai bersama SHALL tetap bekerja untuk dokumen satu pajak tanpa perubahan perilaku.
10. THE dokumen order/quotation yang sudah ada SHALL dimigrasi (Requirement 7) tanpa mengubah angkanya.
11. THE Delivery Note dan Purchase Receipt SHALL tidak berubah (tidak ada kolom pajak per item).

### Requirement 15: Pajak default per item (master) untuk penjualan dan pembelian

**User Story:** Sebagai admin, saya ingin menetapkan pajak default (boleh lebih dari satu) pada item untuk penjualan dan pembelian, so that baris dokumen terisi pajak yang tepat otomatis.

#### Acceptance Criteria

1. THE form Item (`Inventory/Items/Form.jsx`) SHALL memiliki dua field multi value `TaxLinkModel`: "Pajak default penjualan" dan "Pajak default pembelian", disimpan pada tabel pivot baru (usulan `item_default_taxes`: `item_id`, `tax_id`, `module` = `sales`|`purchase`, `position`, unik per item+modul+pajak).
2. THE aturan kombinasi (Requirement 2) dan batas N SHALL berlaku juga pada pajak default item; validasi di FormRequest Item.
3. THE `DocumentDefaultsResolver::resolveForItems()` SHALL memakai pajak default item sebagai sumber default pajak baris: urutan prioritas item default (jika terisi) > aturan bersyarat `default_tax_rules` (spek `module-conditional-defaults`) > default modul (Q-MT-13, diputuskan 2026-11-28 oleh pemilik produk). Keluaran `tax_ids`/`taxes` yang sudah berbentuk array SHALL berisi seluruh pajak default.
4. THE dokumen Quotation/Sales Order/Sales Invoice SHALL memakai pajak default penjualan; Purchase Order/Purchase Invoice memakai pajak default pembelian.
5. WHEN baris baru dibuat dari item, THE form SHALL mengisi `taxes` dengan seluruh pajak default (`applyToNewLine`/`useDocumentDefaults`), dan pengguna dapat mengubahnya.
6. THE pajak default item SHALL tidak mengubah baris dokumen yang sudah ada; perubahan default hanya berlaku untuk baris yang dibuat sesudahnya.
7. THE pajak default item yang terhapus lunak SHALL diperlakukan referensi rusak (jatuh ke tingkat berikutnya, tidak diisikan diam-diam); pajak tanpa versi aturan berlaku tetap gagal tertutup saat dokumen disimpan (Q-P3-5).
8. THE aturan "tanpa pajak" eksplisit (`tax_optional`) SHALL tetap hanya berlaku lewat aturan bersyarat; default item kosong berarti tidak mengisi default dari item. WHEN item punya pajak default, THE pajak default item SHALL menang atas `tax_optional` untuk baris itu, dan pengguna tetap dapat mengubah atau mengosongkan pajak pada form (Q-MT-15, diputuskan 2026-11-28 oleh pemilik produk).
9. THE izin dan visibilitas field SHALL mengikuti izin ubah Item yang ada; field baru didaftarkan di `configColumns` Item dan diuji `initPermissions()`.
10. THE test SHALL mencakup: simpan/ubah default item, validasi kombinasi, prioritas resolver, prefill baris SO/SI/PO/PI/Quotation, pajak default terhapus.

## Pertanyaan yang Menunggu Konfirmasi

| ID | Pertanyaan | Rekomendasi | Dampak |
|---|---|---|---|
| Q-MT-1 | `LinkModel` belum punya mode multi value ("multi" saat ini = multi-model). Bangun mode multi value di `LinkModel` atau perluas `MultiSelect`? | **DIPUTUSKAN 2026-11-28 (pemilik produk):** bangun di `LinkModel`; nilai terpilih menjadi chip, klik label chip membuka halaman detail seperti navigasi `LinkModel` yang ada; `MultiSelect` diperiksa dan mengikuti pola chip yang sama (Requirement 13). Alasan: konsistensi UI dan pemakaian ulang fitur navigasi. Alternatif yang tidak dipilih: memperluas `MultiSelect` dengan opsi dinamis dari model Tax. | Req 9, 13, Task 1 |
| Q-MT-2 | Batas lingkup: apakah SO, PO, Quotation, dan Delivery Note ikut pajak majemuk? | **DIPUTUSKAN 2026-11-28 (pemilik produk):** ya, semua dokumen berpajak agar konsisten: Quotation, SO, SI, PO, PI. Delivery Note dan Purchase Receipt tidak punya pajak per item sehingga tidak berubah. Alasan: konsistensi total sepanjang rantai dokumen. Sub-pertanyaan perhitungan order: Q-MT-12. | Seluruh spek, Req 14 |
| Q-MT-3 | Kombinasi terlarang. | **DIPUTUSKAN 2026-11-28 (pemilik produk, sesuai rekomendasi):** tolak duplikat `tax_id` dan lebih dari satu `ppn_standard`; sisanya diizinkan (akuntan bertanggung jawab). | Req 2 |
| Q-MT-4 | Batas jumlah pajak per item? | **DIPUTUSKAN 2026-11-28 (pemilik produk, sesuai rekomendasi):** 5. | Req 1.3, 2.3 |
| Q-MT-5 | Nasib kolom lama `tax_id`, `tax_rule_version_id`, `tax_rate` pada item. | **DIPUTUSKAN 2026-11-28 (pemilik produk, sesuai rekomendasi):** dicerminkan ke Pajak Utama; penghapusan di spek lanjutan. | Req 1.4, 11.2 |
| Q-MT-6 | Pajak atas pajak (opsi Odoo "include in base of subsequent taxes")? Penjelasan diberikan ke pemilik produk 2026-11-28; **DIPUTUSKAN 2026-11-28 (pemilik produk):** tidak ada pajak atas pajak; basis semua pajak item adalah nilai netto setelah diskon. Dasar: potongan harga yang tercantum di Faktur Pajak mengurangi DPP PPN (UU PPN, definisi harga jual dan penggantian), prinsip yang sama pada EU VAT Directive Pasal 79; PPh Pasal 23 atas jumlah bruto tanpa PPN. Dasar PPh atas diskon belum diverifikasi dari teks PMK 141/PMK.03/2015 dan perlu konfirmasi akuntan atau KPP. | Tidak diperlukan sekarang: PPN, PPnBM, dan PPh di spek ini semua dihitung dari basis bersih yang sama. Hanya pajak tertentu (mis. cukai yang masuk DPP PPN) membutuhkannya; bila kelak perlu, tambahkan flag "masuk basis pajak berikutnya" pada urutan pajak tanpa mengubah skema pivot. | Req 3.2 |
| Q-MT-7 | Definisi `dpp_amount` item bila ada banyak pajak. **Hasil pengecekan aturan 2026-11-28:** DPP PPN non-mewah = 11/12 dari harga jual/penggantian (PMK 131/2024; tarif 12% × 11/12 ≈ 11% efektif), sedangkan PPh Pasal 23 dihitung atas jumlah bruto TANPA PPN (PMK 131/2024 hanya mengatur PPN, bukan PPh; sumber sekunder Ortax dan Enforcea, teks primer PMK 141/PMK.03/2015 belum dibaca). Contoh jasa Rp8.000.000: PPN = 12% × 11/12 × 8.000.000 = 880.000; PPh 23 = 2% × 8.000.000 = 160.000. Jadi DPP berbeda per pajak; Faktur Pajak dan cetak hanya butuh DPP PPN. **DIPUTUSKAN 2026-11-28 (pemilik produk):** `dpp_amount` item = DPP pajak kategori PPN pertama (lalu penambah pertama, lalu pajak pertama), DPP tiap pajak tetap di pivot. | `dpp_amount` item = DPP pajak kategori PPN pertama (bukan sekadar pajak pertama); bila tak ada PPN: DPP penambah pertama, lalu pajak pertama; DPP tiap pajak tetap di pivot. PMK 11/2025 (DPP nilai lain besaran tertentu) tidak mengubah desain karena faktor DPP adalah data versi aturan. Perlu konfirmasi akuntan atas dasar PPh. | Req 3.6, 6.4, 10.3 |
| Q-MT-8 | Kontrak lama `items.*.tax` tetap diterima sementara? | **DIPUTUSKAN 2026-11-28 (pemilik produk, sesuai rekomendasi):** ya, dinormalisasi ke `taxes` selama transisi; dihapus di spek lanjutan bersama kolom lama. | Req 8.2 |
| Q-MT-9 | Laporan/filter per pajak. | **DIPUTUSKAN 2026-11-28 (pemilik produk, sesuai rekomendasi):** dokumentasikan keterbatasan (hanya Pajak Utama); perluas view bila ada kebutuhan laporan pajak nyata. | Req 11.2 |
| Q-MT-10 | Aturan default pajak tetap satu pajak per aturan? | **DIPUTUSKAN 2026-11-28 (pemilik produk):** aturan bersyarat `default_tax_rules` tetap satu pajak; pajak default spesifik per item dibuat sebagai field default pajak (multi) di form Item untuk penjualan dan pembelian (Requirement 15). Prioritas terhadap aturan bersyarat: Q-MT-13. | Req 10.1, 15 |
| Q-MT-11 | Chip `MultiSelect`: default untuk semua konsumen atau opt-in? | **DIPUTUSKAN 2026-11-28 (pemilik produk, sesuai rekomendasi):** default chip untuk semua konsumen, dengan audit visual (terutama `Table/Filter/ValueField` yang sempit) dan opt-out `chips={false}` bila ada yang rusak. | Req 13.5 |
| Q-MT-12 | Perhitungan pajak pada Quotation, SO, dan PO. Sekarang hitung sederhana `basic × taxes.rate / 100`, tanpa faktor DPP, versi aturan, atau pajak potong, sehingga PPN 12% di order dihitung 12% penuh sedangkan invoice 12% × 11/12. Pilihan: (A) pindah ke `TaxEngine` agar total order = total invoice; (B) tetap sederhana per pajak. **DIPUTUSKAN 2026-11-28 (pemilik produk): Opsi A, order/quotation memakai `TaxEngine`.** | A: sejalan dengan "semua konsisten" dan menghilangkan selisih order vs invoice yang sudah ada. Konsekuensi: total order lama bergeser bila diedit (dokumen lama tidak dihitung ulang sampai diedit) dan pajak order tanpa versi aturan menjadi gagal tertutup. B lebih kecil tetapi tidak menyelesaikan selisih. | Req 14.2, 14.3, 14.7 |
| Q-MT-13 | Prioritas pajak default: pajak default item vs aturan bersyarat `default_tax_rules` vs default modul. **DIPUTUSKAN 2026-11-28 (pemilik produk): item default > aturan bersyarat > default modul.** | Item default > aturan bersyarat > default modul (item paling spesifik). | Req 15.3 |
| Q-MT-14 | Review independen (2026-11-28): Opsi A (Q-MT-12) mengubah angka order: PPN 11% pada 1 juta menjadi 100.833 (bukan 110.000) karena DPP 11/12, dan diskon `grand_total` order menjadi tidak eksak (rumus reduksi tanpa faktor DPP, keterbatasan Q8 Fase 3 kini meluas ke order). Req 12.1 menuntut test karakterisasi order tetap hijau. Pilihan: (a) terima, Req 12.1 dikecualikan untuk dokumen order dan ekspektasi test order diubah (sudah dilakukan implementer), atau (b) kembali ke hitung sederhana (Q-MT-12 Opsi B), atau (c) tetap Opsi A tetapi perbaiki rumus reduksi diskon `grand_total` agar eksak (klien dan backend, invoice ikut berubah). **DIPUTUSKAN 2026-11-28 (pemilik produk): pilihan (a), terima perubahan angka order; Req 12.1 dikecualikan untuk dokumen order dan ekspektasi test order diubah.** Alasan: angka order konsisten dengan invoice (total order = total invoice). Keterbatasan diskon `grand_total` yang tidak eksak pada order tetap sama dengan invoice (Q8 Fase 3); perbaikan rumus reduksi (pilihan c) tidak dikerjakan di spek ini. | (a) dipakai: angka order sekarang konsisten dengan invoice. | Req 12.1, 14.2 |
| Q-MT-15 | Review independen: pajak default item membuat `tax_optional` (aturan bersyarat "tanpa pajak") dipaksa false untuk item itu. Apakah aturan "tanpa pajak" tetap boleh mengalahkan pajak default item, atau pajak default item menang (konsisten prioritas Q-MT-13)? **DIPUTUSKAN 2026-11-28 (pemilik produk): pajak default item menang atas aturan "tanpa pajak" (`tax_optional`), dan pengguna tetap dapat mengubahnya pada form (Req 15.5).** | Item default menang (sesuai Q-MT-13; efek `tax_optional` dicatat di Req 15.8). | Req 15.3, 15.8 |
