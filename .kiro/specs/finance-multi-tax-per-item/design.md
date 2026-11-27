# Design Document: Finance Multi Tax per Item

## Overview

Satu item Sales/Purchase Invoice dapat membawa beberapa pajak. Prinsip desain: **tabel pivot menyimpan kebenaran per pajak; kolom item lama menjadi agregat/cermin**. Dengan begitu header dokumen, `InvoiceLineAttributesBuilder`, Posting Rule, view laporan, dan cetak lama tetap membaca kolom item yang sama, sedangkan jurnal, snapshot, dan form membaca pivot.

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

Dua tabel, mengikuti pola repo (tabel terpisah per jenis dokumen, ULID):

`sales_invoice_item_taxes` dan `purchase_invoice_item_taxes`

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
4. Item di-`forceFill`: `tax_amount` = Σ komponen penambah, `withholding_amount` = Σ komponen potong, `dpp_amount` = DPP komponen penambah pertama (fallback komponen pertama; Q-MT-7), `amount` PI = net + `tax_amount`.
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

- **`LinkModel` mode `multiple`** (komponen baru di dalam komponen yang ada, bukan komponen baru): `value` array objek; `setOption` menjadi toggle; popover tetap terbuka; chip dengan tombol hapus; `AdvanceSearchDialog` mendapat seleksi centang banyak baris + tombol "Pilih"; `useAdvanceSearchModel` menyimpan set terpilih; `trimToLinkModelPayload` dipetakan per elemen. Tidak kompatibel dengan `subModels` (ditolak, warning dev). Tes RTL baru mengikuti `AdvanceSearchDialog.multi.rtl.test.jsx` sebagai acuan struktur tes.
- **`TaxLinkModel`** meneruskan `multiple` dan `filters`.
- **Form invoice**: state `taxes` (array); `rulesOf(row)` memetakan `resolveTaxRule` per pajak; `mapItem` memakai `lines[].taxes`; `allocateDiscount` versi array; header memakai agregat; panel ringkasan merinci per pajak. Kolom DPP: `showDpp` = ada pajak penambah dengan `showsDpp`; nilai = `dpp_amount` item. `isTaxRequired`/`taxRowError` membaca `items.{i}.taxes`. Pemetaan dari SO/PO/DN: `taxes: val?.tax ? [val.tax] : []`.
- PO/SO/Quotation tidak berubah (Q-MT-2); `taxRules.js` dan `AdditionalDiscount.jsx` dipakai bersama sehingga perubahan bersifat tambahan (parameter baru opsional), bukan mengubah kontrak lama.

### 10. Batas lingkup dan kompatibilitas

Termasuk: SI, PI, retur, off-source item (SI/PI), cetak, snapshot, Faktur Pajak, form. Tidak termasuk (Q-MT-2): SO, PO, Quotation, Delivery Note, aturan default multi pajak (Q-MT-10), pajak atas pajak (Q-MT-6), penghapusan kolom item lama (Q-MT-5), perubahan view laporan (Q-MT-9). Retur membawa `taxes` dari request seperti sekarang; form retur memprefill dari item asal.

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

1. `LinkModel` komponen inti: regresi halaman lain. Mitigasi: prop opt-in, tes regresi mode tunggal dan multi-model.
2. Dua sumber kebenaran (pivot vs agregat item) bisa selisih bila penulis lain menyentuh item. Mitigasi: hanya `InvoiceItemTaxCalculator` menulis keduanya; tes invarian; `ComputesLegacyInvoiceItemAmounts` tetap hanya untuk satu pajak.
3. SO total ≠ invoice total bila PPh ditambah di invoice (Q-MT-2). Mitigasi: dokumentasi dan peringatan toleransi penagihan bila perlu.
4. Faktor DPP campuran pada satu item mempersulit satu kolom DPP di UI (Q-MT-7).
