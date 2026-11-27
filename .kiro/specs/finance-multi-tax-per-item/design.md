# Design Document: Finance Multi Tax per Item

## Overview

Satu item dokumen berpajak (Quotation, Sales Order, Sales Invoice, Purchase Order, Purchase Invoice) dapat membawa beberapa pajak, dan item master punya pajak default (multi) untuk penjualan dan pembelian (keputusan pemilik produk 2026-11-28: Q-MT-2 dan Q-MT-10). Prinsip desain: **tabel pivot menyimpan kebenaran per pajak; kolom item lama menjadi agregat/cermin**. Dengan begitu header dokumen, `InvoiceLineAttributesBuilder`, Posting Rule, view laporan, dan cetak lama tetap membaca kolom item yang sama, sedangkan jurnal, snapshot, dan form membaca pivot.

`TaxEngine` tidak berubah perilakunya (kait D-28: `TaxInput` per pasangan, `lineRef` boleh berulang). Yang berubah ada di lapisan pemanggil: `InvoiceItemTaxCalculator`, `DocumentTaxRules`, `DocumentDiscountCalculator`, `InvoiceTaxComponentsBuilder`, `DocumentTaxSnapshot`, service dokumen, FormRequest, dan form React.

### Temuan telaah kode (dasar desain)

- Item punya satu `tax_id`, `tax_rule_version_id`, `tax_rate`, serta `dpp_amount`, `tax_amount`, `withholding_amount` (+ `amount` pada PI). Dibaca oleh: `InvoiceItemTaxCalculator`, `DocumentTaxSnapshot`, `InvoiceTaxComponentsBuilder`, `InvoiceLineAttributesBuilder` (`tax_amount`), `InvoicePrintTotals`, `TaxInvoiceAmounts` (fallback `sum(items.dpp_amount/tax_amount)`), `InvoiceBilledValueResolver` (`tax_rate`), `ComputesLegacyInvoiceItemAmounts`, `UnclassifiedTaxUsage`, view laporan, dan template cetak.
- `TaxEngine::applyDocumentRounding()` mengelompokkan per **versi**, bukan per baris, sehingga banyak pajak per baris aman; `describePersisted()` dan `persistedRoundingAdjustments()` mengindeks nilai tersimpan per `lineRef` sehingga `lineRef` harus unik per pasangan.
- `InvoiceTaxComponentsBuilder` sudah mengelompokkan per `(tax_id, versi)` dengan `lineShares` per item: cukup mengganti sumber dari kolom item ke pivot.
- `update()` service: item lama di-`fill()`+`save()`, item hilang di-`delete()` (soft delete), item baru `create()`. Sinkron pivot harus mengikuti pola ini.
- `LinkModel` tidak punya mode multi value (hanya multi-model). Pola multi value yang ada: `MultiSelect` (array nilai mentah, opsi statis) dan checkbox peran di `ManageUsers/Form.jsx` dengan `->sync()` di `UserController`. Tidak ada contoh multi value di dalam baris item yang memakai pivot (item repeater = baris anak `hasMany`).
- Q-P3-12 hanya menetapkan penyimpanan pajak potong (`withholding_amount`), NET header, dan pembulatan; tidak ada larangan kombinasi pajak.

## Architecture

```mermaid
flowchart TD
  F[Form.jsx: TaxLinkModel multiple] -->|items.*.taxes[]| R[FormRequest: validasi + aturan kombinasi]
  R --> S[Sales/PurchaseInvoiceService]
  S --> D[DocumentTaxRules: resolve versi per pajak]
  D --> A[DocumentDiscountCalculator: alokasi diskon, pajak per baris = Σ penambah]
  A --> C[InvoiceItemTaxCalculator: TaxInput per pasangan]
  C --> E[TaxEngine, tanpa perubahan]
  C --> P[(invoice_item_taxes pivot)]
  C --> I[(kolom item: agregat + cermin Pajak Utama)]
  P --> B[InvoiceTaxComponentsBuilder -> PostingContext -> Rule]
  P --> N[DocumentTaxSnapshot -> tax_breakdown]
  P --> T[TaxInvoiceAmounts / InvoicePrintTotals / cetak]
```

## Components and Interfaces

### 1. Skema (jawaban: tabel pivot, bukan JSON dan bukan kolom-kolom)

Lima tabel pivot dokumen, mengikuti pola repo (tabel terpisah per jenis dokumen, ULID): `sales_invoice_item_taxes`, `purchase_invoice_item_taxes`, `sales_order_item_taxes`, `purchase_order_item_taxes`, `quotation_item_taxes`. Satu pivot tambahan untuk default item: `item_default_taxes` (bagian 12). Semua pivot dokumen berstruktur sama:

| Kolom | Tipe | Catatan |
|---|---|---|
| `id` | ulid PK | `HasUlids` |
| `sales_invoice_item_id` / `purchase_invoice_item_id` | ulid FK | `cascadeOnDelete`; indeks gabungan dengan `tax_id` UNIQUE (mencegah duplikat di level DB) |
| `tax_id` | ulid FK `taxes` | tanpa cascade; `taxes` soft delete |
| `tax_rule_version_id` | ulid FK null | null = legacy |
| `position` | unsignedTinyInteger | 0 = Pajak Utama |
| `tax_rate` | decimal(9,4)/double | tarif versi saat simpan |
| `dpp_factor` | decimal | pembilang/penyebut dibagi (info, mengikuti `TaxComponent::dppFactor`) |
| `base_amount` | double | basis bersih item |
| `dpp_amount`, `tax_amount`, `withholding_amount` | double | salah satu pajak/potongan 0 menurut `behavior` |
| timestamps | | |

Alternatif yang ditolak:
- **Kolom JSON pada item**: tidak bisa di-join untuk laporan, tidak ada FK ke `taxes`/versi, sulit diaudit (Fase 3 menuntut penjelasan per komponen).
- **Satu pivot polimorfik** untuk SI+PI: tidak mengikuti pola repo (tabel item sudah terpisah, FK tegas) dan mempersulit view laporan.
- **Master pajak majemuk (grup pajak)**: sudah ditolak pemilik produk 2026-11-28.

Kolom item lama: `tax_id`, `tax_rule_version_id`, `tax_rate` = cermin Pajak Utama (Q-MT-5); `tax_amount`, `withholding_amount`, `dpp_amount`, `amount` = agregat (Requirement 3.6).

Model: `SalesInvoiceItemTax`, `PurchaseInvoiceItemTax` (`$guarded = ['id']`, `HasUlids`, relasi `item()`, `tax()` withTrashed, `ruleVersion()`); pada item: `taxLines()` hasMany berurut `position`, `taxes()` belongsToMany (withPivot `tax_rate, tax_amount, ...`), `tax()` tetap Pajak Utama.

### 2. Aturan kombinasi (`InvoiceItemTaxSet` baru, pure)

Kelas `App\Services\Finances\Tax\ItemTaxSelection` (final, tanpa model dokumen): menerima daftar `Tax` terurut dan mengembalikan hasil validasi. Dipanggil FormRequest (pesan UI) dan service (jaring pengaman).

| Aturan | Hasil |
|---|---|
| `tax_id` duplikat | tolak |
| lebih dari satu `ppn_standard` | tolak (Q-MT-3) |
| jumlah > N (5) | tolak |
| penambah + potong | boleh |
| ada `unclassified` | boleh (tertanam, P-6) |
| daftar kosong | tolak kecuali aturan "tanpa pajak" (`ValidatesRowTaxRequired`) |

Pesan id/en di `lang/{id,en}` (`finances/tax`), kunci galat `items.{i}.taxes`.

### 3. Perhitungan

Pada `fillItemRelations()`: `data['taxes']` dinormalisasi (`tax` tunggal → `[tax]`, Q-MT-8); `tax_id`/`tax_rate`/`tax_rule_version_id` item diisi dari elemen pertama. `resolveTaxRules()` meresolve versi untuk SEMUA pajak semua baris sebelum penulisan apa pun (fail-closed Q-P3-5; `DocumentTaxRules::resolveForRows` membaca `taxes.*.id`, kunci galat `items.{i}.taxes.{j}`).

`InvoiceItemTaxCalculator::apply()`:
1. Untuk tiap item, tiap pajak terpilih: `new TaxInput($taxId, $net, $date, $minorUnit, lineRef: "{$itemId}#{$taxId}")`.
2. `TaxEngine::calculateDocument($inputs)` sekali untuk seluruh dokumen (pembulatan `per_document` lintas item dan lintas pajak berversi sama).
3. Tiap komponen ditulis ke pivot (`updateOrCreate` pada kunci item+pajak; baris pivot yang tidak lagi dipilih dihapus).
4. Item di-`forceFill`: `tax_amount` = Σ komponen penambah, `withholding_amount` = Σ komponen potong, `dpp_amount` = DPP komponen berkategori PPN pertama; bila tak ada PPN, komponen penambah pertama; bila tak ada penambah, komponen pertama (usulan Q-MT-7, menunggu keputusan), `amount` PI = net + `tax_amount`.
5. Mengembalikan total dokumen (`net`, `dpp`, `tax`, `withholding`), `dpp` = Σ item `dpp_amount` seperti sekarang.

Basis sama untuk semua pajak; tidak ada pajak atas pajak (Q-MT-6). Item satu pajak menghasilkan angka identik (dijaga test karakterisasi).

### 4. Alokasi diskon dokumen

`invoiceItemDiscounts()` menerima `$lineRules` per `tax_id` (tidak berubah) tetapi tiap baris kini memuat `taxes: list<{rate, dpp_factor, additive}>`. `allocate()`:
- `preTax[i]` = Σ_j penambah `basic × factor_j × rate_j / 100`.
- Reduksi `grand_total`: `allocated / (1 + Σ rate_penambah/100)`.
- Baris dengan satu pajak: jalur lama dipertahankan persis (kompatibel balik: bentuk `tax_rate/dpp_factor/additive` lama tetap diterima dan dibungkus menjadi satu elemen). Catatan Q8 Fase 3 (tidak eksak untuk faktor ≠ 1) berlaku dan sama.
Klien (`lib/discountAllocation.js`) menyalin rumus yang sama.

### 5. Jurnal

`InvoiceTaxComponentsBuilder::build()`/`withholdingComponents()` membaca `taxLines` (eager load `items.taxLines`) alih-alih kolom item: grup `(tax_id, tax_rule_version_id)`, `amount` = Σ pivot `tax_amount` (atau `withholding_amount`), `lineShares[itemId]` = pivot `tax_amount` item itu. Fallback baca (Requirement 7.6): item ber-`tax_id` tanpa pivot dibentuk dari kolom item.

Tidak berubah: `SalesInvoiceRule`, rule Purchase Invoice, `TaxComponentLine`, `TaxSplitResolver` (retur mengikuti jurnal asal), `InvoiceLineAttributesBuilder` (jumlah baris memakai `tax_amount` agregat), `WithholdingRoleGuard` (Σ `withholding_amount` item). Invarian: Σ pajak jurnal = Σ pivot = Σ agregat item; diuji.

Dampak ke akun: contoh jasa Rp1.000.000, PPN 12% (DPP 11/12) + PPh 23 2% (DPP 1/1), SI: piutang = 1.000.000 + 110.000 − 20.000 = 1.090.000 (NET), `withholding_receivable` 20.000 debit, kredit pendapatan 1.000.000 (dikurangi bagian PPN bila cutover pemisahan pajak aktif, lalu kredit `tax_output` 110.000; aturan Fase 3, tidak dibahas ulang di sini). PPN = 12% × (11/12 × 1.000.000) = 110.000.

### 6. Snapshot, Faktur Pajak, cetak

- `DocumentTaxSnapshot::build()` membuat satu `TaxInput` dan satu entri `persisted` per baris pivot, kunci `lineRef` gabungan. `TaxEngine::describePersisted()` tidak berubah (kunci string bebas); hanya `TaxBreakdownPanel` yang memecah `line_ref` untuk menampilkan item.
- `TaxInvoiceAmounts::fromBreakdown()` sudah per komponen berkategori PPN: PPh pada item yang sama otomatis keluar. Dikunci test.
- Fallback `sum(items.dpp_amount)`/`sum(items.tax_amount)`: aman karena `tax_amount` agregat hanya memuat pajak penambah dan `dpp_amount` mengikuti Pajak Utama penambah; item PPN + PPh yang PPN-nya bukan urutan pertama tetap benar karena DPP diambil dari penambah pertama.
- `InvoicePrintTotals::dpp()` iterasi pivot (penambah, faktor ≠ 1); `withholding()` tetap Σ `withholding_amount`.
- Atribut cetak baru pada item: `tax_names`, `tax_rates` (string); template standar di `FinancesTemplates` diperbarui; template pengguna lama tetap jalan.

### 7. Migrasi data

Migrasi `create_*_item_taxes_tables` (aditif) + migrasi data terpisah:
1. Untuk tiap item ber-`tax_id` tanpa pivot: insert satu baris (`position` 0, nilai salin; `tax_amount`/`withholding_amount` menurut `taxes.behavior` ber-`withTrashed`).
2. Pra-pemeriksaan paritas per tabel: Σ pivot = Σ item (tolok 1 minor unit); gagal = berhenti dengan pesan.
3. Idempoten (`insertOrIgnore` pada unik item+pajak). `down()` hanya drop tabel pivot.
Tidak butuh jendela pemeliharaan (aditif, tidak menyentuh kolom item). Produksi tanpa data pajak historis (Q-P3-1) sehingga yang terdampak hanya staging. Urutan deploy: migrasi dulu lalu kode, atau bersamaan; jaring pengaman baca (Requirement 7.6) menutup jeda.

### 8. Validasi dan request

`SalesInvoiceRequest`/`PurchaseInvoiceRequest`: `items.*.taxes` `nullable|array|max:5`; `items.*.taxes.*.id` `required|ulid|ExistsExcludingTrashed('taxes')`; `items.*.taxes.*` array bebas field lain (seperti `items.*.tax.*`). `prepareForValidation` menormalisasi `tax` → `taxes`. `ValidatesRowTaxRequired` memeriksa `taxes` kosong. Aturan kombinasi dipanggil di `withValidator`.

### 9. Frontend

- **`LinkModel` mode `multiple`** (opt-in di komponen yang ada, bukan komponen baru; keputusan Q-MT-1, 2026-11-28): `value` array objek; `setOption` menjadi toggle (opsi terpilih ditandai, memilih lagi mencabut); popover tetap terbuka; urutan pilihan terjaga. Nilai tampil sebagai **chip** lewat komponen bersama `Components/ChipList.jsx` (dipakai juga `MultiSelect`, lihat butir 11).
  - **Chip**: label dan tombol X terpisah. Klik label memakai logika navigasi yang SUDAH ada di `LinkModel` (`LinkModel.jsx` sekitar baris 1074-1106): `window.open(route(`${pluralize.plural(name)}.show`, get(option, keyRoute ?? 'id')), '_blank')` dengan `customNavigation(value)` bila ada. Logika itu diekstrak menjadi fungsi bersama per-opsi (`resolveNavigation(option)` mengembalikan `{allowed, href|null}`), memakai `disabledNavigation`, `canNavigation`, `can/canGlobal('read', {user_id: option.created_by_id})` per opsi (bukan hanya `option` tunggal seperti `navAllowed` sekarang, yang dihitung untuk satu nilai). Mode tunggal memanggil fungsi yang sama sehingga perilakunya tidak berubah.
  - Tidak diizinkan: label teks biasa (tanpa kursor/gaya tautan). `disabled`/`readOnly`: X hilang, label tetap berfungsi. Chip terpotong + tooltip; susunan membungkus baris.
  - `valueBefore` (diff) per chip: ditambah/dihapus ditandai memakai `DIFF_ADDED`/`DIFF_REMOVED` seperti `MultiSelect`.
  - `AdvanceSearchDialog`/`useAdvanceSearchModel`: set seleksi (centang) + tombol "Pilih"; `trimToLinkModelPayload` per elemen. `multiple` + `subModels` ditolak (dev warning).
- **`TaxLinkModel`** meneruskan `multiple` dan `filters`.
- **Form invoice**: state `taxes` (array); `rulesOf(row)` memetakan `resolveTaxRule` per pajak; `mapItem` memakai `lines[].taxes`; `allocateDiscount` versi array; header memakai agregat; panel ringkasan merinci per pajak. Kolom DPP: `showDpp` = ada pajak penambah dengan `showsDpp`; nilai = `dpp_amount` item. `isTaxRequired`/`taxRowError` membaca `items.{i}.taxes`. Pemetaan dari SO/PO/DN: `taxes: val?.tax ? [val.tax] : []`.
- **`MultiSelect` mengikuti pola chip** (Requirement 13): ringkasan teks gabungan di input saat tertutup diganti `ChipList` (chip per nilai, X per chip; "Semua" tetap satu chip). Navigasi label opt-in lewat prop `navigation(option) => href|null`; tanpa prop, chip teks biasa (opsi `MultiSelect` statis, bukan data berhalaman detail). Input ketik/pencarian, `valueBefore` (tooltip diff), `changeOnBlur`, `delimiters`, paste banyak entri, `showAllOption`, `defaultValue`, dan tombol clear dipertahankan. Tujuh konsumen (`Table/Filter/ValueField`, `Todos/AssignedToFields`, `Inventory/Items/Form`, `Purchase/ItemRequests/Index`, dst.) diaudit visual; default chip vs opt-in menunggu Q-MT-11.
- PO/SO/Quotation tidak berubah (Q-MT-2); `taxRules.js` dan `AdditionalDiscount.jsx` dipakai bersama sehingga perubahan bersifat tambahan (parameter baru opsional), bukan mengubah kontrak lama.

### 10. Batas lingkup dan kompatibilitas

Termasuk (Q-MT-2, diputuskan): Quotation, SO, SI, PO, PI, retur, off-source item, cetak, snapshot, Faktur Pajak, form, dan pajak default item master. Tidak berubah: Delivery Note dan Purchase Receipt (tidak punya kolom pajak per item), aturan bersyarat `default_tax_rules` (tetap satu pajak per aturan), pajak atas pajak (Q-MT-6, menunggu), penghapusan kolom item lama (Q-MT-5, spek lanjutan), perubahan view laporan (Q-MT-9, didokumentasikan). Retur membawa `taxes` dari request seperti sekarang; form retur memprefill dari item asal.

### 11. Quotation, Sales Order, Purchase Order (Requirement 14)

Temuan telaah kode: ketiga dokumen ini TIDAK memakai `TaxEngine` maupun versi aturan. `SalesOrderService`/`PurchaseOrderService` mengisi `tax_id` dan `tax_rate = taxes.rate`, lalu `DocumentDiscountCalculator::applyToItems()` menghitung `tax_amount = basic × tax_rate / 100` (tanpa faktor DPP, tanpa pajak potong); `QuotationService::fillItemRelations()` melakukan hal yang sama dan mempertahankan `keepTaxRate` saat update. Akibatnya total order PPN 12% sudah berbeda dari invoice (12% penuh vs 12% × 11/12). Pemecahan baris SO/PO ke invoice mengelompokkan per `rate|tax_id|tax_rate|gudang`.

Rancangan (bergantung Q-MT-12):
- **Opsi A (usulan): order dan quotation memakai `InvoiceItemTaxCalculator`** yang sama (diparameterisasi: nama kolom harga `rate`/`price`, ada/tidaknya `amount`), sehingga pivot, agregat item, dan total order = invoice. `DocumentTaxRules` meresolve versi pada tanggal dokumen order. `applyToItems()` untuk order digantikan; jalur `allocate()` yang dibagi dengan klien tetap satu sumber rumus. Dokumen order lama tidak dihitung ulang sampai diedit. Pajak order tanpa versi berlaku gagal tertutup (Q-P3-5), sehingga `finance:init-tax-rules` sudah menjadi prasyarat (sudah dijalankan untuk invoice).
- **Opsi B: hitung sederhana per pajak**: `tax_amount` item = Σ `basic_net × rate_j / 100` untuk pajak penambah; pajak potong dicatat terpisah (kolom baru `withholding_amount` pada tabel order) atau diabaikan; wajib dinyatakan eksplisit. Tidak menyelesaikan selisih order vs invoice.
- Pivot order/quotation memuat kolom yang sama dengan pivot invoice; pada Opsi B kolom `dpp_amount`/`dpp_factor`/`tax_rule_version_id` bernilai default (basic, 1, null).
- **Dari order ke invoice** (`SalesOrderService` baris sekitar 407, `PurchaseOrderService` baris sekitar 459-560): kunci pengelompokan memakai himpunan terurut `tax_id` (mis. `implode(',', sorted ids)`) dan payload invoice membawa `taxes` seluruh pajak; `InvoiceBilledValueResolver` mengganti `tax_rate` tunggal dengan Σ pajak penambah yang dihitung dari pajak invoice, dan bila pajak invoice berbeda dari order, perbandingan dilakukan pada nilai sebelum pajak (usulan) agar penambahan PPh di invoice tidak memicu pelanggaran toleransi.
- **Quotation → SO**: salin `taxes`. `QuotationService::keepTaxRate` dipertahankan per pajak (tarif lama dipertahankan bila pajak sama).
- Form: `SalesOrders/Form.jsx`, `PurchaseOrders/Form.jsx` (+ `purchaseOrderAmounts.js`, `FromRequests/draftData.js`, `reviewData.js`), `CRM/Quotations/QuotationItems.jsx` memakai `TaxLinkModel multiple`; `lib/taxRules.js`, `lib/discountAllocation.js`, dan `AdditionalDiscount.jsx` dipakai bersama sehingga perubahan bersifat tambahan (parameter `taxes[]` opsional; bentuk satu pajak lama tetap berjalan).
- Spek `finance-p3-tax-engine` Requirement 12.7 ("konversi tidak mengubah dokumen order") tetap benar untuk Bagian B Fase 3; spek ini yang mengubah order, dicatat di decision log.

### 12. Pajak default per item master (Requirement 15)

- **Skema:** `item_default_taxes` (`id` ulid, `item_id` FK `items` cascade, `tax_id` FK `taxes`, `module` string `sales`|`purchase`, `position`, timestamps; UNIQUE `item_id, module, tax_id`). Pada `Item`: relasi `salesDefaultTaxes()` dan `purchaseDefaultTaxes()` (belongsToMany `Tax`, `wherePivot('module', ...)`, berurut `position`). Default di level `Item` induk, bukan varian (sama dengan `DocumentDefaultsResolver` yang membaca `type`, `is_stock_item`, `category_id` dari `Item`).
- **Resolver:** `DocumentDefaultsResolver::resolveForItems()` sudah mengembalikan `tax_ids`/`taxes` sebagai array (sekarang berisi 0 atau 1 elemen). Prioritas (usulan Q-MT-13): (1) `item_default_taxes` untuk modul dokumen (`$type->module()`), diambil massal untuk semua `itemIds` (satu query, tanpa N+1) dan difilter pajak yang tidak terhapus lunak; (2) aturan bersyarat `default_tax_rules`; (3) default modul. `tax_optional` hanya dari aturan bersyarat (Req 15.8). Default item kosong atau seluruhnya rusak jatuh ke tingkat (2).
- **Request/service Item:** `ItemRequest` menerima `default_sales_taxes` dan `default_purchase_taxes` (array objek `{id}`, `ExistsExcludingTrashed('taxes')`, `ItemTaxSelection`); `ItemService` menyinkronkan dengan `sync()` berurutan (pola `UserController::roles()->sync`, dengan `position` lewat `syncWithPivotValues`/attach berurut).
- **Form Item:** dua `TaxLinkModel multiple` di seksi penjualan dan pembelian `Inventory/Items/Form.jsx`; value berupa array objek pajak; chip dengan navigasi ke halaman Pajak.
- **Form dokumen:** `applyToNewLine`/`useDocumentDefaults` (`lib/documentDefaults.js`) mengisi `taxes` dari `taxes` hasil resolver (array), bukan satu objek.
- **Cakupan modul:** `DefaultsDocumentType::module()` memetakan Quotation/SO/SI ke `sales` dan PO/PI ke `purchase`.

## Data Models

Lihat tabel di bagian Skema. Invarian per item (diuji): `tax_amount` = Σ pivot penambah; `withholding_amount` = Σ pivot potong; `tax_id` = pivot `position` 0; per dokumen Σ pivot = Σ item = Σ komponen jurnal.

## Error Handling

- Pajak tanpa versi berlaku: `ValidationException` pada `items.{i}.taxes.{j}` sebelum penulisan (Q-P3-5).
- Kombinasi terlarang: 422 pada `items.{i}.taxes`; service melempar `ValidationException` yang sama.
- Approve dengan versi usang pada pajak mana pun: `StaleTaxRuleVersionException` (diperluas membaca pivot).
- Snapshot gagal: tidak memblokir (Q-P3-6).
- Paritas migrasi gagal: berhenti dengan jumlah baris bermasalah.

## Testing Strategy

PHPUnit: unit `ItemTaxSelection`; `InvoiceItemTaxCalculator` (satu pajak identik; PPN+PPh; dua penambah; per_document lintas pajak); `DocumentDiscountCalculator` (net_total dan grand_total, satu vs banyak pajak); builder jurnal + `TaxJournalSplitTest` diperluas (invarian seimbang, lineShares); snapshot, Faktur Pajak (PPh tidak masuk PPN), cetak; migrasi data (backfill, paritas, idempoten, down); request (normalisasi `tax`→`taxes`, mass assignment); skenario S2 end-to-end. Vitest/RTL: `LinkModel.multiple`, `AdvanceSearchDialog` multi value, `taxRules`, `discountAllocation`, `Form.rtl` SI dan PI. Karakterisasi: seluruh test pajak existing harus hijau tanpa perubahan angka.

## Risiko

1. `LinkModel` dan `MultiSelect` komponen inti: regresi halaman lain (MultiSelect dipakai 7 file, termasuk filter tabel yang sempit). Mitigasi: prop opt-in, tes regresi mode tunggal dan multi-model.
2. Dua sumber kebenaran (pivot vs agregat item) bisa selisih bila penulis lain menyentuh item. Mitigasi: hanya `InvoiceItemTaxCalculator` menulis keduanya; tes invarian; `ComputesLegacyInvoiceItemAmounts` tetap hanya untuk satu pajak.
3. Order dan invoice dapat berbeda pajak bila pengguna mengubah pajak di invoice. Mitigasi: toleransi penagihan dibandingkan pada nilai sebelum pajak (Q-MT-12) dan invoice dari order membawa seluruh pajak order.
4. Faktor DPP campuran pada satu item mempersulit satu kolom DPP di UI (Q-MT-7).
5. Cakupan membesar (5 dokumen + item master + 5 form). Mitigasi: urutan task: invoice dulu (Task 2-8), order/quotation (Task 9-10), default item (Task 11), karena tiap tahap dapat dirilis terpisah.
6. Perhitungan order berpindah ke `TaxEngine` (Opsi A) mengubah total order saat diedit dan membuat pajak order tanpa versi gagal tertutup; ditandai Q-MT-12.
