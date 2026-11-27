# Design Document: Finance P3 — Tax Engine

## Overview

Fase 3 memisahkan tiga pertanyaan yang sekarang bercampur: **berapa pajaknya** (Tax Engine), **aturan mana yang berlaku** (versi aturan berlaku-tanggal), dan **diposting ke akun mana** (Posting Engine, Fase 2). Desain dibagi dua bagian karena kenyataan skema:

> Pada item Sales/Purchase Invoice, `dpp_amount` dan `tax_amount` adalah *stored generated column* dengan `× 11/12` tetap untuk semua jenis pajak (F-17). Selama kolom itu generated, aturan data **tidak dapat** mengubah angka dokumen.

- **Bagian A (default, aman)** — dokumen tetap dihitung oleh kolom generated; Tax Engine (i) me-resolve tarif berdasarkan tanggal dan menyimpan snapshot versi, (ii) membuat `TaxResult` yang *menjelaskan* dan *memverifikasi* angka tersimpan, dan (iii) menyuplai komponen pajak ke rule posting yang kini memisahkan baris pajak di jurnal **dari nilai tersimpan** (sumber kebenaran Bagian A = kolom dokumen).
- **Bagian B (GATED D-15)** — kolom generated dikonversi menjadi kolom biasa; Tax Engine menjadi sumber perhitungan (faktor DPP, withholding, pembulatan per dokumen).

Dengan cara ini GL menjadi benar (pajak terpisah) tanpa menunggu keputusan besar tentang perhitungan, dan keputusan itu tidak terblokir oleh GL.

## Architecture

```mermaid
flowchart TD
    subgraph DOC["Dokumen (SalesInvoiceService / PurchaseInvoiceService)"]
        FIR["fillItemRelations()<br/>tax_rate ← versi berlaku<br/>tax_rule_version_id"]
        APP["onApproved()<br/>tax_breakdown ← TaxResult"]
        CF["PostingContextFactory<br/>kelompokkan komponen pajak<br/>dari nilai TERSIMPAN"]
    end
    subgraph TAX["Tax Engine (app/Services/Finances/Tax)"]
        RES["TaxRuleResolver<br/>(tax, tanggal) → versi"]
        ENG["TaxEngine<br/>calculate / calculateDocument / verify"]
        RV[("tax_rule_versions")]
        RES --> RV
        ENG --> RES
    end
    FIR --> RES
    APP --> ENG
    CF -->|"PostingContext.taxComponents"| PE
    subgraph POST["Posting Engine (Fase 2)"]
        PE["PostingRule Sales/Purchase Invoice<br/>(split bila ≥ cutover)"]
        AR["AccountRoleResolver<br/>tax_output / tax_input / peran kustom"]
        PE --> AR
    end
    PE --> JS["JournalService (Fase 1)"]
    JS --> GL[("general_ledgers<br/>+ tax_rule_version_id")]
    ENG -.Bagian B: sumber hitung.-> FIR
```

**Aturan ketergantungan:** `app/Services/Finances/Tax/**` tidak mengimpor model Sales/Purchase/Inventory; input berupa DTO (`TaxInput`). Rule posting tidak memanggil Tax Engine — ia hanya menerima `TaxComponent` yang sudah dihitung/dibaca oleh pabrik konteks milik dokumen.

**Kait multi-pajak (D-28):** `TaxInput` mewakili satu pasangan (baris, pajak) dan `lineRef` boleh berulang, sehingga pajak ganda per baris (pola Odoo) kelak cukup menambah input untuk baris yang sama tanpa mengubah `TaxEngine`. Pengelompokan jurnal sudah per `(tax_id, tax_rule_version_id)`. Yang belum didukung dan menjadi cakupan spec masa depan `multi-tax-per-line`: relasi banyak-pajak pada baris dokumen, kolom hitung item invoice, dan `tax_rule_version_id` per komponen (saat ini satu per baris).

## Components and Interfaces

### Struktur file

```text
app/Services/Finances/Tax/
├── TaxEngine.php            calculate / calculateDocument / verify
├── TaxRuleResolver.php
├── TaxInput.php             (readonly DTO)
├── TaxResult.php            (readonly DTO, JSON-serializable)
├── TaxComponent.php         (readonly DTO)
├── TaxRuleVersionService.php  (validasi tumpang-tindih, versi baru, aktivasi, guard faktor 11/12)
└── Exceptions/NoEffectiveTaxRuleException.php
app/Models/Finances/{Tax.php (diubah), TaxRuleVersion.php (baru)}
app/Console/Commands/Finances/{InitTaxRulesCommand,UnclassifiedTaxReportCommand}.php
app/Services/Finances/Posting/Rules/{SalesInvoiceRule,PurchaseInvoiceRule}.php   (diperluas dari Fase 2)
resources/js/Pages/Finances/Taxes/{Form.jsx (diubah), RuleVersions/*}, komponen panel Rincian Pajak
```

### DTO

```php
final readonly class TaxInput {
    public function __construct(
        public string $taxId,
        public float|string $baseAmount,       // basis bersih setelah diskon
        public CarbonInterface $date,
        public int $minorUnit,                 // mata uang dasar
        public ?string $lineRef = null,        // untuk penjelasan per baris
    ) {}
}

final readonly class TaxComponent {
    public function __construct(
        public string $taxId, public string $taxName,
        public string $category, public string $behavior,
        public ?string $ruleVersionId,         // null = legacy
        public string $baseAmount, public string $dppFactor, public string $dppAmount,
        public string $rate, public string $taxAmount,
        public string $roleOutput, public string $roleInput,
        public bool $isCreditable,
        public string $roundingAdjustment = '0',
        public array $warnings = [],
    ) {}
}

final readonly class TaxResult {
    /** @param list<TaxComponent> $components */
    public function __construct(
        public array $components,
        public string $totalAdditive, public string $totalWithholding,
        public array $explanation,             // langkah terstruktur
    ) {}
    public function toJson(): string;
    public static function fromJson(string $json): self;
}
```

Angka di DTO bertipe string desimal agar serialisasi stabil dan bebas drift floating point.

### `TaxRuleResolver`

`resolve(Tax|string $tax, CarbonInterface $date): TaxRuleVersion` — satu query `status='active' AND effective_from <= :d AND (effective_to IS NULL OR effective_to >= :d)` terurut `effective_from DESC`; cache per `(tax_id, date)`. Tanpa hasil → `NoEffectiveTaxRuleException`. Tanggal selalu `transaction_date` dokumen.

### `TaxEngine`

`calculate(TaxInput): TaxResult` (Requirement 4.1; versi awal design ini menulis `TaxComponent`, diselaraskan ke Requirement 4.1 saat implementasi Task 4 dan menunggu konfirmasi pemilik produk; implementasinya mendelegasikan ke `calculateDocument([$input])`): ambil versi → `dpp = base × num/den` → `tax = dpp × rate/100` → bulatkan HALF_UP ke `minorUnit` (`per_line`). `calculateDocument(list<TaxInput>): TaxResult`: hitung tiap baris; bila `rounding_mode = per_document`, jumlahkan per komponen, bulatkan sekali, sebar selisih pembulatan ke baris terbesar (selaras DPP spec Req. 1.7) dan isi `roundingAdjustment`. `verify(TaxResult|string $json): VerificationReport`: hitung ulang dari versi yang direferensikan snapshot dan bandingkan dengan nilai di snapshot; selisih ≤ 1 minor unit = lolos.

Aritmetika memakai integer minor unit (helper `MinorUnit` Fase 1) dengan pecahan faktor sebagai rasio bilangan bulat; tidak ada perkalian `float` untuk keputusan keseimbangan.

### Pengambilan snapshot saat dokumen dibuat/diubah

Di `SalesInvoiceService::fillItemRelations()` dan padanannya di `PurchaseInvoiceService` (saat ini: `$data['tax_rate'] = $tax?->rate ?? 0`):

```php
$version = $taxId ? $resolver->resolve($taxId, $invoiceDate) : null;
$data['tax_rule_version_id'] = $version?->id;
$data['tax_rate']            = $version?->rate ?? 0;   // kolom generated tetap memakai tax_rate
```

Efek di Bagian A: untuk pajak dengan versi 1 hasil backfill, `tax_rate` = `taxes.rate` (tidak berubah). Saat versi 2 (tarif baru) aktif pada tanggal tertentu, invoice bertanggal setelahnya otomatis memakai `rate` baru — **tanpa perubahan kode**. Faktor DPP tetap 11/12 dari kolom generated, sehingga guard Req. 2.7 menolak versi berfaktor lain.

### `tax_breakdown` pada approve

`onApproved()`: bangun `TaxInput` dari item tersimpan (basis = `basic_amount − discount_amount`), jalankan `calculateDocument`, bandingkan dengan `tax_amount`/`dpp_amount` tersimpan. Beda ≤ 1 minor unit → simpan `TaxResult` dengan komponen *persis nilai tersimpan* dan `warnings=[]`. Beda lebih besar → simpan nilai tersimpan, tambah `warnings` (`persisted_vs_engine_mismatch`) dan catat log; **angka dokumen tidak diubah**. `tax_breakdown` di-set sekali dan tidak diubah setelah approved.

### Pabrik konteks (milik dokumen) dan DTO posting

`PostingContext` (Fase 2) mendapat parameter opsional `taxComponents: list<TaxComponentLine>` (ekstensi kompatibel mundur). `TaxComponentLine{ruleVersionId, role, amount, isCreditable, classified}`. Pabrik invoice menyusunnya dari item tersimpan:

```text
untuk setiap kelompok item (tax_id, tax_rule_version_id):
   amount = round(Σ tax_amount, minorUnit)
   classified = tax.category != 'unclassified' && behavior == 'additive'
   role = SI ? version.output_role : version.input_role
   isCreditable = tax.is_creditable && company_is_pkp   (pembelian saja)
```

Rule posting memisahkan hanya komponen `classified && (SI || isCreditable)` bila invoice ≥ cutover.

### Rule posting (perluasan Fase 2)

**Sales Invoice** (`purpose = default`), jumlah dalam minor unit:

| Baris | Sisi | Peran | Jumlah |
|---|---|---|---|
| Piutang | Debit | `receivable` (override `debit_account_id`) | `total` |
| Pendapatan | Kredit | `revenue` (override `income_account_id`) | `total − Σ pajak terpisah` (sisa) |
| PPN Keluaran (per komponen) | Kredit | `output_role` versi | `amount` komponen |

**Purchase Invoice** (`purpose = expense`; `stock` tidak berubah):

| Baris | Sisi | Peran | Jumlah |
|---|---|---|---|
| Beban/SRNB | Debit | `expense` (per baris, peka-barang; Fase 2 Req. 12) | `total − Σ pajak terpisah` (sisa) |
| PPN Masukan (per komponen) | Debit | `input_role` versi | `amount` komponen |
| Utang | Kredit | `payable` (override `credit_account_id`) | `total` |

Retur: sisi ditukar. Bila tidak ada komponen terpisah atau invoice < cutover → bentuk 2-baris lama. Baris pajak memberi `tax_rule_version_id` pada `RoleLine` agar diteruskan ke `general_ledgers`. Karena baris pendapatan/beban = sisa, jurnal seimbang tanpa baris pembulatan.

**Cutover:** `PostingContext.flags['tax_split'] = true` bila `transaction_date >= finance_tax_split_from.{type}` (setting Finances); rule tidak membaca setting sendiri (murni).

### Hubungan dengan Faktur Pajak

`SalesInvoiceService::assignTaxInvoice` saat ini: `tax_invoice_dpp_amount = Σ dpp_amount`, `tax_invoice_ppn_amount = Σ tax_amount` (semua pajak). Setelah fase ini: jika `tax_breakdown` ada dan terklasifikasi → jumlahkan hanya komponen kategori PPN; selain itu perilaku lama. Penyesuaian satu fungsi, nomor seri tak disentuh.

### Bagian B — konversi kolom (GATED)

Langkah migrasi untuk `sales_invoice_items` dan `purchase_invoice_items` (rantai ketergantungan generated: `dpp_amount → tax_amount → amount`):

1. Tambah kolom biasa `dpp_amount_v2`, `tax_amount_v2` (+ `amount_v2` pada PI) bertipe `double`.
2. `UPDATE … SET *_v2 = *` (salin nilai generated).
3. **Pra-pemeriksaan paritas:** hitung baris dengan |v2 − asli| > toleransi → harus nol (sebenarnya tautologi, tetapi memastikan salinan tuntas).
4. Drop kolom generated sesuai urutan dependensi (`amount`, `tax_amount`, `dpp_amount` — pola yang sudah dipakai migration 2026-07-18 dan 2026-08-18 karena SQLite), lalu `renameColumn` `_v2` → nama asli.
5. Buat ulang view yang bergantung (mis. `report_sales_invoice_view`) bila perlu.
6. Aktifkan `finance_tax_engine_calc_enabled=true` (membuka guard faktor DPP).

Perhitungan berpindah ke `TaxEngine` di `fillItemRelations`/`create`/`update`; `onApproved` tidak lagi sekadar menjumlah. Withholding dikeluarkan dari total dokumen dan diposting ke `withholding_receivable`/`withholding_payable`. Perubahan ini menyentuh lebih dari 4 file dan laporan → ditangani sebagai bagian terpisah dengan jendela pemeliharaan dan audit pemakai kolom.

## Data Models

### `taxes` (tambahan)

`category` string(32) default `unclassified`; `behavior` string(16) default `additive`; `jurisdiction_code` string(8) default `ID`; `is_creditable` boolean default true. (`rate` dipertahankan.)

### `tax_rule_versions`

| Kolom | Tipe |
|---|---|
| `id` | ulid PK |
| `tax_id` | ulid FK → `taxes` `restrictOnDelete` |
| `version` | unsignedSmallInteger |
| `effective_from` / `effective_to` | date / date nullable |
| `rate` | decimal(9,4) |
| `dpp_numerator` / `dpp_denominator` | unsignedSmallInteger default 1 / 1 |
| `rounding_mode` | string(16) `per_line`/`per_document` |
| `output_role` / `input_role` | string(64) default `tax_output` / `tax_input` |
| `status` | string(16) `draft`/`active`/`retired` |
| `notes` | text nullable |
| `created_by_id` | ulid FK nullable |
| timestamps | |

Unik `(tax_id, version)`; indeks `(tax_id, status, effective_from)`.

### Kolom tambahan lain

`sales_invoice_items.tax_rule_version_id`, `purchase_invoice_items.tax_rule_version_id` (FK nullable, `nullOnDelete` dibatasi menjadi `restrictOnDelete`), `sales_invoices.tax_breakdown` & `purchase_invoices.tax_breakdown` (json nullable), `general_ledgers.tax_rule_version_id` (FK nullable). Setting: `finance_tax_split_from.sales_invoice`, `finance_tax_split_from.purchase_invoice` (tanggal, default kosong), `finance_company_is_pkp` (default `true`), `finance_tax_engine_calc_enabled` (default `false`).

## Correctness Properties

- **P-1 Pemisahan seimbang:** untuk invoice ≥ cutover, Σdebit = Σkredit dan Σ baris pajak = Σ `tax_amount` tersimpan komponen terklasifikasi (dalam 1 minor unit).
- **P-2 Tak ada perubahan angka dokumen (Bagian A):** `total`, `tax_amount`, `dpp_amount` invoice sama sebelum/sesudah fase untuk dataset golden.
- **P-3 Effective dating:** invoice bertanggal tepat sebelum `effective_from` versi 2 memakai versi 1; tepat pada tanggal itu memakai versi 2.
- **P-4 Penambahan tarif tanpa kode:** menambah versi baru lewat data saja mengubah `tax_rate` invoice berikutnya dan tidak mengubah invoice lama.
- **P-5 Verifikasi ulang:** `verify(tax_breakdown)` lolos untuk invoice backfill versi 1 (parity dengan kolom generated).
- **P-6 Tidak menebak:** pajak `unclassified` tidak pernah dipisah; muncul di laporan `unsplit_tax`.
- **P-7 Guard faktor:** sebelum Bagian B, versi `active` berfaktor ≠ 11/12 ditolak.
- **P-8 Retur dan pembatalan:** retur menukar sisi baris pajak; pembatalan (reversal Fase 2) membalik bentuk jurnal asal apa adanya.
- **P-9 Ketergantungan:** `Tax/**` tanpa `use` model Sales/Purchase/Inventory.

## Error Handling

| Kondisi | Perilaku |
|---|---|
| Tidak ada versi berlaku pada tanggal dokumen | `NoEffectiveTaxRuleException` saat membuat/mengubah item invoice; pesan menyebut pajak dan tanggal |
| Peran pajak tidak ter-resolve saat posting (cutover aktif) | `UnresolvedAccountRoleException` → `GlPostingStatus=failed`, dapat dicoba ulang setelah profil dilengkapi |
| Versi tumpang-tindih / faktor tak valid | `InvalidTaxRuleVersionException` (form dan service) |
| Ketidakcocokan engine vs nilai tersimpan | tidak menghentikan dokumen; `warnings` pada `tax_breakdown` + log |
| `tax_breakdown` legacy null | UI menampilkan penjelasan legacy dari kolom tersimpan |

## Testing Strategy

- **Unit (tanpa DB):** `TaxEngine` (DPP 11/12, 1/1, pembulatan per_line vs per_document, minor unit 0 dan 2, nilai batas), `TaxResult` serialize/deserialize/verify.
- **Feature:** resolver (P-3), versi (tumpang-tindih, versi baru, guard P-7), `fillItemRelations` mengisi snapshot, `onApproved` menyimpan `tax_breakdown`, `finance:init-tax-rules` (idempoten, laporan rate mencurigakan), pajak `unclassified` tidak dipisah (P-6).
- **Golden tests (Req. 11):** tabel skenario input → `TaxResult` → jurnal; tarif lama/baru di sekitar tanggal berlaku (P-3/P-4); retur (P-8); mata uang minor unit 0.

| Golden | Basis | Pajak | Hasil yang diharapkan (jurnal Sales, cutover aktif) |
|---|---|---|---|
| G1 | 12.000.000 | PPN 12 (v1: rate 12, 11/12) | DPP 11.000.000; PPN 1.320.000; Dr Piutang 13.320.000; Cr Pendapatan 12.000.000; Cr PPN Keluaran 1.320.000 |
| G2 | 12.000.000 | tarif berubah di tanggal T | invoice T−1 vs T menghasilkan PPN berbeda sesuai versi |
| G3 | 5.000.000 + 7.000.000 | dua baris, tarif berbeda | Σ komponen dikelompokkan per versi |
| G4 | 10.000.000 | `unclassified` | jurnal 2-baris lama; `unsplit_tax` tercatat |
| G5 | retur G1 | PPN | sisi ditukar |
| G6 | 1.000 | mata uang minor unit 0 | pembulatan bilangan bulat |

  *(Angka G1 menggunakan rate 12 sesuai skema DPP Nilai Lain; data lama berrate 11 dites terpisah sebagai kasus paritas legacy.)*

- **Paritas legacy (Req. 6.4):** `TaxEngine` (versi 1) vs `tax_amount` tersimpan pada seluruh item invoice sampel staging.
- **Regresi:** `TaxInvoiceAssignmentTest`, `PurchaseInvoiceMissingTaxItemTest`, `*DiscountPersistenceTest`, `InvoiceDppMigrationTest`, test Fase 0–2.
- **Frontend:** form Pajak (kategori/behavior, peringatan), tab Versi Aturan, panel Rincian Pajak (legacy vs ber-snapshot), `.rtl.test.jsx`.
- **Bagian B:** test migrasi pada SQLite + MySQL staging; paritas pra/pasca; laporan terkait.

## Rollout

1. Migration aditif + `finance:init-tax-rules` (versi 1) + klasifikasi pajak oleh akuntan (UI/laporan `UnclassifiedTax`).
2. Lengkapi COA dan Posting Profile (peran `tax_output`/`tax_input`, plus peran kustom bila perlu).
3. Pilih tanggal cutover (awal periode terbuka) → set `finance_tax_split_from.*` per jenis dokumen; pantau parity jurnal dan laporan `unsplit_tax`.
4. Setiap perubahan tarif: tambah versi baru berlaku-tanggal (tanpa deploy).
5. Bagian B hanya setelah D-15 disetujui, jendela pemeliharaan tersedia, dan audit pemakai kolom selesai.

## Risiko Spesifik Fase

| Risiko | Mitigasi |
|---|---|
| Semantik `rate` data produksi salah (11 vs 12) | Laporan audit Task 1; keputusan Q-P3-1 sebelum cutover; tidak mengubah data historis |
| Klasifikasi pajak salah memisahkan jurnal | Default `unclassified`; aktivasi bertahap; golden test; review akuntan |
| PPN Masukan tak dapat dikreditkan (non-PKP) | `is_creditable` + `finance_company_is_pkp`; Q-P3-2 |
| Konversi kolom (Bagian B) merusak view/laporan | Gated; audit pemakai; paritas; jendela pemeliharaan |
| Dua bentuk jurnal invoice hidup berdampingan | Cutover per tanggal; laporan menangani keduanya; reversal meniru bentuk asal |
| Penyerapan DPP spec Req. 4 membingungkan tim | Keputusan D-15 dicatat; DPP spec diberi catatan "superseded oleh finance-p3" |

## Konfirmasi yang Masih Diperlukan

D-12, D-15, Q-P3-1…4 (lihat requirements).

## Temuan Task 1 (audit read-only, 2026-11-21)

Diverifikasi terhadap `origin/feat/finance-engine` (`ab76a569`). Task 1.1 menunggu data staging/produksi dari pemilik produk (lihat query di bawah); Task 1.2–1.4 selesai dari kode.

### 1.2 Pemakai kolom `dpp_amount` / `tax_amount` / `amount` item invoice

| Lapisan | Pemakai | Dampak Bagian A | Dampak Bagian B (Task 9) |
|---|---|---|---|
| Skema | `sales_invoice_items`: `dpp_amount = (basic_amount − discount_amount) × 11/12`, `tax_amount = dpp_amount × tax_rate / 100`; `purchase_invoice_items`: sama + `amount = (basic_amount − discount_amount) + tax_amount`. Semua `double` (tanpa pembulatan), *stored generated* (migration `2026_07_18_*` dan `2026_08_18_155751/155754`) | tidak berubah | konversi ke kolom biasa |
| View laporan | `report_sales_invoice_view` / `report_purchase_invoice_view` hanya memakai kolom **header** (`tax_invoice_dpp_amount`, `tax_invoice_ppn_amount`, `amount`); **tidak** membaca kolom item. `report_sales_view` / `report_purchase_view` memakai `tax_amount` item **order** (di luar scope) | tidak ada | tidak perlu dibuat ulang untuk invoice |
| Model | `SalesInvoice::getDppAmountAttribute()` (`$appends`, `Σ items.dpp_amount`); cast `float` dan `configColumns` di `SalesInvoiceItem`/`PurchaseInvoiceItem`; `InvoiceLineAttributesBuilder` (jumlah baris = `basic_amount − discount_amount + tax_amount`) | tidak berubah | ikut nilai kolom baru |
| Service | `SalesInvoiceService`/`PurchaseInvoiceService`: `DPP_FACTOR = 11/12` (konstanta publik, dipakai `DocumentDiscountCalculator::applyDiscountColumnToItems`), `create`/`update` (header `amount`), `onApproved` (`Σ(basic − discount) + Σ tax_amount`); `assignTaxInvoice` (Sales) **dan** `recordTaxInvoice` (Purchase) menjumlah seluruh `dpp_amount`/`tax_amount` | Task 7 harus mencakup **kedua** fungsi (Requirement 9 hanya menyebut `assignTaxInvoice`) | `DPP_FACTOR` dan `DocumentDiscountCalculator` digantikan `TaxEngine` |
| Cetak | `database/seeders/PrintTemplates/Finances/FinancesTemplates.php` (`{{doc.dpp_amount}}`, `{{this.tax_amount}}`) | tidak berubah | token tetap valid selama nama kolom sama |
| Frontend | `SalesInvoice/Form.jsx` dan `PurchaseInvoice/Form.jsx` **mereplika** `DPP_FACTOR = 11/12` dan menghitung ulang `dpp_amount`/`tax_amount` di klien; `AdditionalDiscount.jsx`; `lib/discountAllocation.js`; kunci terjemahan `columns.dpp_amount` | tidak berubah | **wajib diubah**: klien tidak boleh lagi menebak faktor DPP (Requirement 12.8) |
| Test | `InvoiceDppMigrationTest`, `*InvoiceDiscountPersistenceTest`, `TaxInvoiceAssignmentTest`, `DocumentDiscountCalculatorTest`, `InvoiceDppModelConfigTest`, `Report/*InvoiceReportTest`, `Support/InsertsReportData` | harus tetap hijau (Requirement 13.5) | disesuaikan |

### 1.3 Perbedaan dengan asumsi design

1. **Tanggal dokumen** = kolom `date` (timestamp) pada header `sales_invoices`/`purchase_invoices`. Resolver memakai tanggal ini (Requirement 3.4), bukan `now()`; posting GL masih memakai `now()` (F-19, D-21 PENDING), sehingga versi pajak (tanggal dokumen) dan periode jurnal (tanggal approve) dapat berbeda pada invoice yang disetujui lintas tanggal berlaku. Dicatat sebagai risiko untuk Task 6, bukan diubah di Bagian A.
2. **Nilai tersimpan tidak dibulatkan.** Kolom generated adalah `double` mentah; hanya total header yang dibulatkan 2 desimal oleh `DocumentDiscountCalculator::roundWithResidual`. `TaxEngine` (bulat HALF_UP per baris) dan nilai tersimpan karenanya selisih ≤ 0,5 minor unit **per baris**; pada dokumen N baris, selisih total komponen dapat mencapai N × 0,5 minor unit. Maka `verify`/`tax_breakdown` membandingkan **per baris** (toleransi 1 minor unit) dan membandingkan total komponen dengan toleransi `jumlah baris` minor unit, bukan satu minor unit untuk seluruh dokumen (penjelasan lebih ketat dari Requirement 6.4/5.3 versi tertulis; selisih ini bukan ketidakcocokan).
3. **`fillItemRelations` persis satu titik** per service (`$data['tax_rate'] = $tax?->rate ?? 0`), dipanggil dari `create` dan `update` (item draft disimpan ulang tiap `update`). Purchase Invoice tidak punya jalur pajak terpisah untuk off-PO/retur: ketiga sumber baris (PO item, baris receipt, item bebas) dan retur memakai `tax_id` yang dikirim klien.
4. **Item tanpa pajak** (`tax_id = null`): `tax_rate = 0`, tidak ada versi, tidak ada komponen; engine melewati baris ini.
5. **Faktor DPP, `DocumentDiscountCalculator`, dan FE** memakai `11/12` sebagai konstanta di tiga tempat (PHP service, PHP calculator, JS dua form); guard Requirement 2.7 menutup semuanya selama Bagian B belum aktif.
6. **Pajak tak punya versi sama sekali** (data lama sebelum `finance:init-tax-rules`, atau `Tax` yang baru dibuat sebelum UI Versi Aturan Task 8 tersedia): resolver yang melempar `NoEffectiveTaxRuleException` menggagalkan pembuatan invoice. **Diputuskan 2026-11-21 (pemilik produk, Q-P3-5): selalu gagal tertutup**, tanpa fallback ke `taxes.rate`; service menerjemahkannya menjadi 422 pada `items.{i}.tax` dan me-resolve sebelum penulisan apa pun (tidak ada header yatim). Prasyarat deploy: `finance:init-tax-rules` dijalankan lebih dulu.
7. **`InvoiceBilledValueResolver::netValues()` masih memakai `taxes.rate`** (bukan versi aturan) untuk mengalokasikan diskon header pada basis total saat memeriksa toleransi penagihan. Sejak backfill, rate versi 1 sama dengan `taxes.rate`, jadi hasilnya identik; bila kelak ada versi dengan tarif berbeda dari `taxes.rate` (Task 8), pemeriksaan toleransi dapat sedikit menyimpang dari angka yang disimpan service. Belum diubah di Bagian A (di luar daftar file Task 5; dua pemanggil di `SalesInvoiceRequest`/`PurchaseInvoiceRequest`); dicatat untuk keputusan bersama Task 8.
8. **Mata uang `tax_breakdown`.** Nilai item invoice disimpan dalam mata uang dokumen, sehingga snapshot Bagian A (`DocumentTaxSnapshot`) memakai minor unit mata uang dokumen (`currencies.minor_unit`, default 2) walaupun `TaxInput` menyebut mata uang dasar; konversi ke mata uang dasar adalah urusan FX Engine (Fase 4).
9. **`TaxFactory` membuat versi 1 otomatis** (`afterCreating`), menyerupai kondisi pasca-backfill, supaya test invoice yang ada tetap hijau di bawah kebijakan gagal tertutup. Test yang butuh pajak tanpa versi memakai `Tax::query()->create()`.

### 1.4 Audit COA

- `AccountSeeder` hanya memuat **satu** akun `account_type = tax`: `2310 VAT` (grup `2300 Kewajiban dan Pajak`); `2230 Hutang Pajak` bertipe `payable`, bukan `tax`. **Tidak ada** akun PPN Masukan (aset), PPh dipotong/dibayar di muka, maupun PPh terutang.
- `AccountRole::TaxOutput`/`TaxInput`/`WithholdingReceivable`/`WithholdingPayable` sudah ada di katalog tetapi `legacyPair()` bernilai `null` (tidak ada padanan legacy): peran itu **harus dipetakan eksplisit di Posting Profile** oleh akuntan (Q-P3-4). Tanpa pemetaan, posting dengan cutover aktif gagal tertutup (Requirement 7.7).
- Spec `dpp-discount-and-tax-compliance`: seluruh Task 11 (11.1–11.6) masih `[ ]*` (opsional, dilewati); kolom `category`/`behavior`/`use_dpp_nilai_lain` belum ada di `taxes` (skema `taxes`: `name`, `rate`, timestamps, soft delete). Task 2.1 fase ini tidak berbenturan.

### 1.1 Query read-only untuk pemilik produk (staging/produksi)

```sql
SELECT t.name, t.rate,
       ROUND(t.rate * 11 / 12, 4) AS tarif_efektif_persen_bila_dpp_11_12,
       (SELECT COUNT(*) FROM sales_invoice_items i
          JOIN sales_invoices s ON s.id = i.sales_invoice_id
         WHERE i.tax_id = t.id AND s.date >= DATE_SUB(NOW(), INTERVAL 12 MONTH)) AS item_penjualan_12_bulan,
       (SELECT COUNT(*) FROM purchase_invoice_items i
          JOIN purchase_invoices p ON p.id = i.purchase_invoice_id
         WHERE i.tax_id = t.id AND p.date >= DATE_SUB(NOW(), INTERVAL 12 MONTH)) AS item_pembelian_12_bulan
FROM taxes t
WHERE t.deleted_at IS NULL
ORDER BY t.name;
```

Hasil dibawa ke akuntan untuk menjawab Q-P3-1 (apakah `rate = 11` dengan DPP 11/12 memang dimaksud). Query hanya membaca; tidak mengubah data.
