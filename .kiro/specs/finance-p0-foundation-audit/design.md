# Design Document: Finance P0 — Foundation Audit

## Overview

Fase 0 menambahkan dua perintah Artisan read-only, satu set characterization test, dan dua dokumen keputusan. Tidak ada migration dan tidak ada perubahan pada kode produksi yang sudah ada selain penambahan kelas baru.

Pola yang dipakai:

- **Auditor berbasis agregasi database.** Kategori anomali dihitung dengan `GROUP BY`/`HAVING`/`EXISTS` di SQL, bukan memuat baris ke PHP. Hanya *contoh* (maks. `--limit`) yang di-fetch.
- **Laporan sebagai DTO.** `GeneralLedgerAuditor::run()` mengembalikan `AuditReport` (array terstruktur) yang dirender ke tabel konsol dan/atau JSON, sehingga logika dan presentasi terpisah serta mudah diuji.
- **Characterization test memakai helper fixture bersama** (`BuildsFinanceFixtures`) yang di Fase 2 dipakai ulang sebagai fixture *parity test*.
- **Tidak menyentuh produksi.** Seluruh perintah hanya `SELECT`.

## Architecture

```mermaid
flowchart LR
    CMD1["finance:audit-gl<br/>AuditGeneralLedgerCommand"] --> AUD["GeneralLedgerAuditor"]
    AUD --> Q1["IntegrityChecks<br/>(unbalanced, zero/negative,<br/>soft-deleted, dangling account,<br/>duplicates)"]
    AUD --> Q2["ReferenceChecks<br/>(orphan referenceable,<br/>canceled without reversal)"]
    AUD --> Q3["DocumentCoverageMatrix<br/>(per jenis dokumen)"]
    AUD --> RPT["AuditReport (DTO)"]
    RPT --> OUT1["Konsol (tabel)"]
    RPT --> OUT2["JSON file"]
    CMD2["finance:snapshot-balances"] --> SNAP["BalanceSnapshotService"] --> CSV["CSV baseline"]
    TESTS["tests/Feature/Finances/Characterization/*"] --> FIX["tests/Support/BuildsFinanceFixtures"]
```

## Components and Interfaces

### 1. `App\Services\Finances\Audit\GeneralLedgerAuditor`

```php
final class GeneralLedgerAuditor {
    public function __construct(private float $tolerance = 0.005) {}

    /** @param array{limit?: int} $options */
    public function run(array $options = []): AuditReport;
}
```

Memanggil tiga kelompok pemeriksaan (kelas kecil agar mudah diuji terpisah):

| Kelas | Pemeriksaan | Teknik |
|---|---|---|
| `IntegrityChecks` | tak seimbang; nol/negatif; soft-deleted; akun hilang/terhapus; duplikasi | agregasi `GROUP BY (referenceable_type, referenceable_id, transaction_date)` + `HAVING ABS(SUM(debit)-SUM(credit)) > :tol`; `LEFT JOIN accounts` dengan `withTrashed`; `GROUP BY` kombinasi duplikat `HAVING COUNT(*) > 1` |
| `ReferenceChecks` | referenceable hilang; soft-delete diharapkan vs anomali; dokumen `canceled` dengan GL aktif | per `referenceable_type` distinct: `whereNotExists` terhadap tabel modelnya (resolusi tabel via `(new $type)->getTable()`); status `canceled` lewat `whereJsonContains('status', 'canceled')` (kolom `status` disimpan JSON, lihat pemakaian di `SalesInvoiceService`). Soft-delete dikategorikan *diharapkan* bila dokumen sumbernya `canceled` |
| `DocumentCoverageMatrix` | matriks per jenis dokumen (Req. 2) | daftar jenis dokumen sebagai konfigurasi statis di kelas (`type`, `model`, `tracked_by_gl_posting_status`), dihitung dengan satu query agregat per jenis |

**Catatan pembatalan.** Belum ada konsep reversal (Fase 1 yang membuatnya). Perilaku saat ini: hook `saving` pada trait `Submitable` (`app/Traits/Submitable.php:98-106`) me-`update` `deleted_at` massal pada baris GL dan SLE dokumen yang baru berubah ke `canceled`. Maka definisi audit: (a) dokumen `canceled` dengan **semua** baris GL soft-deleted = sehat menurut perilaku sekarang; (b) dokumen `canceled` dengan baris GL **aktif** = anomali (indikasi balapan F-16 atau cancel yang melewati hook); (c) baris soft-deleted pada dokumen yang tidak `canceled` = anomali. Pembatasan: `deleted_at` tidak menyimpan waktu terpisah dari `canceled_at`; kecocokan waktunya dilaporkan sebagai informasi, tidak sebagai kriteria.

**Toleransi.** Kolom `debit`/`credit` bertipe `double`; perbandingan memakai toleransi `0.005` agar noise floating point tidak dilaporkan sebagai anomali.

### 2. `App\Services\Finances\Audit\AuditReport`

Struktur:

```php
[
  'generated_at' => '...',
  'totals'   => ['rows' => int, 'groups' => int, 'date_min' => ..., 'date_max' => ..., 'sum_debit' => float, 'sum_credit' => float, 'diff' => float],
  'sections' => [
     'unbalanced_groups'   => ['count' => int, 'total_diff' => float, 'samples' => [...]],
     'zero_or_negative'    => [...],
     'soft_deleted_expected'   => [...],   // dokumen sumber canceled
     'soft_deleted_unexpected' => [...],   // dokumen sumber bukan canceled / tidak ada
     'dangling_account'    => [...],
     'orphan_reference'    => [...],
     'canceled_active_gl'  => [...],       // dokumen canceled dengan GL aktif (F-16)
     'duplicates'          => [...],
  ],
  'coverage' => [ ['type' => 'sales_invoice', 'approved' => n, 'canceled' => n, 'with_gl' => n, 'canceled_gl_softdeleted' => n, 'canceled_active_gl' => n, 'tracked' => bool, 'posting_not_posted' => n], ... ],
]
```

Metode: `toArray()`, `toJson()`, dan `Renderer` terpisah untuk konsol (`Symfony Table` lewat `$this->table()`).

### 3. `App\Console\Commands\Finances\AuditGeneralLedgerCommand`

`signature`: `finance:audit-gl {--limit=20} {--json=} {--connection=}`. Otomatis ditemukan (`app/Console/Commands` di-auto-discover; subfolder `Finances/` mengikuti pola `Asset/`). Mengembalikan `Command::SUCCESS`. Output konsol berupa tabel ringkasan + daftar contoh per kategori.

### 4. `App\Services\Finances\Audit\BalanceSnapshotService` dan `finance:snapshot-balances`

Satu query agregat: `general_ledgers` (tanpa soft-deleted) `GROUP BY account_id` di-join ke `accounts` (termasuk akun tanpa transaksi lewat `LEFT JOIN`). Sinyal `net` disesuaikan arah normal akun lewat `balance_type` (`debit` → `sum_debit - sum_credit`; `credit` → `sum_credit - sum_debit`). Menulis CSV streaming (`fputcsv`) agar hemat memori.

> **[TODO: konfirmasi]** nilai valid `accounts.balance_type` ("debit"/"credit"?) dan konvensi tanda `balance_amount` di `StockEntryService` (debit akun aset menambah, akun lawan mengurangi) — diverifikasi pada Task 3.1 dengan membaca `AccountSeeder` dan data staging sebelum rumus `difference` dikunci.

### 5. Characterization tests

Struktur:

```text
tests/Feature/Finances/Characterization/
├── SalesInvoicePostingTest.php
├── PurchaseInvoicePostingTest.php
├── PurchaseReceiptPostingTest.php
├── DeliveryNotePostingTest.php
├── PaymentEntryPostingTest.php
├── StockEntryPostingTest.php
├── AssetDepreciationPostingTest.php
├── AssetScrapPostingTest.php
├── AssetValueAdjustmentPostingTest.php
├── AssetDisposalGainLossPostingTest.php
└── KnownIssues/
    ├── PartialPaymentPostsCumulativeAmountTest.php   (F-10)
    ├── ForeignCurrencyPaymentPostingTest.php          (F-11)
    ├── CancelSoftDeletesLedgerTest.php                (F-04)
    └── CancelBeforeQueuedPostingTest.php              (F-16)
tests/Support/BuildsFinanceFixtures.php
```

`BuildsFinanceFixtures` (trait): membuat user, branch, akun standar (kas, piutang, pendapatan, utang, beban, stok, SRNB, akun aset/depresiasi), setting umum (`default_currency_id`, `timezone`), dan memanggil `initPermissions()` untuk model terkait — mengikuti pola `setUp()` di `tests/Feature/Finances/GeneralLedgerControllerTest.php` (termasuk penambahan kolom `is_example` yang dilakukan test existing). Faktor di `database/factories/Finances` dipakai bila tersedia; sisanya dibuat langsung lewat model.

Listener queue dieksekusi sinkron di test dengan `config(['queue.default' => 'sync'])`; assert pada `GeneralLedger::withTrashed()->where('referenceable_id', ...)`.

Known-issue test memakai atribut PHPUnit 11 `#[Group('known-issue')]` dan menegaskan nilai aktual yang diamati (hasil run pertama dicatat di komentar dengan tanggal), mis.:

```php
#[Group('known-issue')]
public function test_f10_second_partial_payment_posts_cumulative_amount(): void {
    // F-10 (PRD): GL pembayaran ke-2 memposting total kumulatif, bukan jumlah pembayaran ini.
    // Ekspektasi saat ini = perilaku AKTUAL. Dibalik saat bug diperbaiki.
}
```

## Data Models

Tidak ada tabel atau kolom baru. File keluaran:

| Berkas | Isi | Lokasi |
|---|---|---|
| `audit-<ts>.json` | `AuditReport` penuh | `storage/app/finance-audit/` |
| `baseline-<ts>.csv` | snapshot saldo per akun | `storage/app/finance-audit/` |
| `finance-audit-report.md` | ringkasan manusia | `docs/prd/` |
| `finance-decision-log.md` | keputusan & pertanyaan | `docs/prd/` |

## Correctness Properties

- **P-1 Read-only:** menjalankan kedua perintah tidak mengubah jumlah baris pada tabel mana pun (diuji dengan hitung baris sebelum/sesudah pada DB uji).
- **P-2 Determinisme:** pada data yang sama dua kali run menghasilkan laporan identik (selain `generated_at`).
- **P-3 Cakupan kategori:** untuk setiap anomali yang disuntikkan test (mis. kelompok tak seimbang), kategori terkait melaporkan tepat jumlah yang disuntikkan.
- **P-4 Tanpa false positive pada data sehat:** data posting normal (pasangan seimbang) menghasilkan semua kategori anomali = 0.

## Error Handling

- Jenis dokumen yang kelasnya/tabelnya tidak ada → bagian matriks ditandai `unavailable`, audit lain tetap jalan.
- `referenceable_type` yang tidak dapat di-resolve ke kelas → dihitung sebagai `orphan_reference` dengan catatan "tipe tidak dikenal".
- Path `--json` tidak dapat ditulis → perintah gagal dengan pesan jelas (kode non-nol), tetapi tabel konsol sudah tercetak.
- Kolom `status` bukan JSON valid pada baris tertentu → baris dilewati dan dihitung di `unparseable_status`.

## Testing Strategy

- **Unit/feature test auditor:** satu test per kategori anomali dengan fixture yang menyuntikkan satu anomali; satu test data sehat (P-4); satu test tabel kosong.
- **Test perintah:** `artisan('finance:audit-gl')` mengeluarkan tabel dan menulis JSON; `finance:snapshot-balances` menulis CSV dengan header dan jumlah baris sesuai jumlah akun.
- **Characterization & known-issue:** seperti bagian Components.
- **Test frontend:** tidak ada (fase ini tanpa UI).

## Keputusan yang Menunggu Konfirmasi

| ID | Pertanyaan | Dampak pada fase ini |
|---|---|---|
| Q1 | Apakah audit boleh dijalankan pada DB **produksi** (read-only)? | Menentukan apakah estimasi backfill berbasis data nyata |
| Q-P0-1 | Siapa yang menjalankan perintah di staging/produksi dan mengirim hasilnya? | Task manual 6.x |
| D-11 | Standar akuntansi acuan | Hanya dicatat di decision log pada fase ini |
