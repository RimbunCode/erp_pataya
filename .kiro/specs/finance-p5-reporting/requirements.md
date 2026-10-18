# Requirements Document

## Introduction

Fase 5 dari 7 fase program **Finance Engine** (lihat `docs/prd/finance-engine-prd.md`). Fase ini menjadikan ledger (journal lines) sumber **semua** laporan keuangan: Trial Balance, Buku Besar (GL detail), Laba Rugi, Neraca, Arus Kas, AR/AP Aging, dan Rekap Pajak. Saldo akun yang saat ini disimpan sebagai angka mutable (`accounts.balance_amount`, dimutasi langsung oleh `StockEntryService` — F-09) digantikan oleh **proyeksi turunan** `account_balances` yang dapat dibangun ulang dan direkonsiliasi.

Kondisi nyata yang membentuk fase ini (diverifikasi di kode):

- Infrastruktur laporan sudah ada dan matang (spec `modul-laporan`): setiap laporan = **Row model baca-saja di atas view DB** (`report_*_view`) + `ReportFilter` (`applyTo`, `toSummary`, `KEYS`) + `KpiBuilder` + controller (`ReportAccess::canRead`) + halaman Inertia + entri `ReportCatalog`/`ReportDefinition`, dengan `ReportExporter` (`csv`, `pdf`), `ReportFilterStore`, dan `ReportConsistencyChecker` (hitung ulang KPI dari baris). Rute di bawah `/reports/*`. Fase ini **mengikuti pola itu**, bukan membuat pola baru.
- Laporan yang ada bersifat operasional (stok, penjualan, pembelian, invoice, work order, dll.); belum ada laporan keuangan dari GL. Halaman `Finances/GeneralLedger` hanya daftar baris.
- COA memiliki `root_type` (`asset`, `liability`, `equity`, `income`, `expense`), `report_type` (`balance_sheet`/`profit_and_loss`), `balance_type` (`debit`/`credit`), `is_contra`, dan hierarki pohon (`parent_id`, `lft`, `rgt`, `depth`) — cukup untuk menyusun laporan. Seeder memuat akun ekuitas "Laba".
- Pembatalan dokumen (perilaku sekarang) men-soft-delete baris GL lewat update massal yang tidak memicu event model (F-04); proyeksi saldo harus tahu soal ini (Requirement 3.5).
- Posting GL bersifat asinkron (D-1): laporan dapat tertinggal dari dokumen; keputusan D-1 opsi B mensyaratkan **indikator posting lag** pada laporan.

**Prasyarat:** Fase 1 (journals, periode, kolom `foreign_*`), Fase 2 (semua titik posting via Posting Engine; peran akun), Fase 3 (baris pajak terpisah — bergantung pada cutover), dan Fase 4 (`PartyLedgerService`, alokasi) selesai atau tersedia untuk bagian laporan yang memerlukannya. Laporan dapat dirilis bertahap: TB dan GL detail hanya butuh Fase 1.

**Di luar scope:**
- Konsolidasi multi-entitas, laporan segmen/dimensi analitik di luar cabang.
- Format laporan resmi regulator dan pelaporan SPT/e-Faktur (hanya rekap pajak internal; D-11/Q6).
- Penutupan periode dan jurnal penutup (Fase 6); fase ini menghitung laba berjalan secara virtual.
- Dasbor/visualisasi lanjutan (number card/chart existing dapat memakai proyeksi kemudian).
- Penyaringan analitik multi-dimensi dan perbandingan multi-periode berbentuk pivot (hanya perbandingan dua rentang dasar).

## Glossary

- **Ledger line view**: view `report_ledger_line_view` — satu baris per baris jurnal aktif dari jurnal `posted`/`reversed`, lengkap dengan atribut akun, periode, cabang, pihak, sumber.
- **Proyeksi saldo / `account_balances`**: tabel agregat turunan (akun × periode fiskal × cabang) berisi total debit dan kredit; bukan sumber kebenaran.
- **Posting lag**: selisih antara dokumen yang disetujui dan jurnalnya yang belum terposting (`GlPostingStatus` `pending`/`failed`).
- **Laba berjalan (current year earnings)**: Σ saldo akun `profit_and_loss` pada tahun fiskal berjalan yang belum ditutup; ditampilkan sebagai bagian ekuitas pada Neraca.
- **Akun kontrol**: akun piutang/utang yang saldonya harus sama dengan sub-ledger.

## Requirements

### Requirement 1: View dasar baris jurnal dan landasan laporan

**User Story:** Sebagai developer, saya ingin satu sumber data baris jurnal yang konsisten, so that semua laporan menghitung populasi baris yang sama.

#### Acceptance Criteria

1. THE sistem SHALL membuat view `report_ledger_line_view` yang memuat baris `general_ledgers` dengan `deleted_at IS NULL` dari `journals` berstatus `posted` atau `reversed` (tidak termasuk `voided`), dengan kolom: id baris, `journal_id`, kode jurnal, `transaction_date`, `fiscal_period_id`, `branch_id`, `account_id`, nomor/nama/`root_type`/`report_type`/`balance_type`/`is_contra` akun, `debit`, `credit`, `partyable_*`, `source_type`/`source_id`, `tax_rule_version_id`, kolom asing, dan `description`.
2. THE baris jurnal legacy yang `legacy_unbalanced = true` SHALL tetap muncul di view (tanda khusus), karena angkanya adalah apa yang tercatat.
3. THE baris GL yang belum memiliki `journal_id` (pra-backfill) SHALL tetap muncul (jurnal null) selama backfill belum selesai, agar laporan tidak kehilangan data; fase ini tidak memerlukan backfill selesai untuk mulai dirilis tetapi melaporkan jumlah baris tanpa jurnal sebagai peringatan.
4. THE setiap laporan keuangan SHALL didaftarkan di `ReportCatalog` (atau definisi setara bila bentuknya statement), memakai `ReportFilter`, `ReportAccess`, dan mengikuti rute `/reports/*`.
5. THE filter bersama SHALL mencakup: rentang tanggal atau periode fiskal, cabang (mengikuti pembatasan cabang pengguna), mata uang (tampilan), dan opsi sertakan/abaikan jurnal legacy tak seimbang.
6. THE view dan seluruh query laporan SHALL dapat dijalankan di SQLite untuk test (view dibuat mengikuti pola migration `report_*_view` yang ada).

### Requirement 2: Trial Balance dan Buku Besar (GL detail)

**User Story:** Sebagai akuntan, saya ingin neraca saldo dan buku besar yang dapat ditelusuri ke jurnal, so that saya dapat memeriksa angka sampai ke sumbernya.

#### Acceptance Criteria

1. THE Trial Balance SHALL menampilkan per akun (daun dan agregat induk mengikuti pohon COA): saldo awal, mutasi debit, mutasi kredit, saldo akhir untuk rentang yang dipilih, dengan total debit = total kredit.
2. THE saldo awal SHALL = Σ seluruh baris dengan `transaction_date` sebelum awal rentang (bukan hanya dalam tahun fiskal) sehingga laporan konsisten tanpa jurnal penutup.
3. THE baris akun induk SHALL menjumlahkan turunannya (rollup `lft/rgt`); opsi tampilan "hanya akun bertransaksi".
4. THE Buku Besar SHALL menampilkan baris jurnal per akun (atau semua akun) dengan saldo berjalan per akun, filter pihak/sumber/cabang, tautan ke jurnal dan dokumen sumber, serta total per akun; urutan `transaction_date` lalu `journal.code` lalu `line_no`.
5. THE saldo akhir terakhir pada Buku Besar sebuah akun SHALL sama dengan saldo akhir akun itu pada Trial Balance untuk rentang yang sama.
6. THE laporan SHALL menggunakan `account_balances` bila tersedia dan konsisten (Requirement 8), selain itu agregasi langsung dari view; hasil keduanya identik.
7. THE kedua laporan SHALL dapat diekspor CSV dan PDF memakai `ReportExporter`.

### Requirement 3: Proyeksi saldo `account_balances`

**User Story:** Sebagai operator, saya ingin saldo akun cepat dibaca tetapi selalu dapat dibuktikan dari jurnal, so that kinerja laporan baik tanpa mengorbankan kebenaran.

#### Acceptance Criteria

1. THE sistem SHALL membuat tabel `account_balances` dengan `account_id`, `fiscal_period_id`, `branch_id` (nullable), `debit_total`, `credit_total` (`decimal(20,4)`), `last_journal_at`, timestamps; unik `(account_id, fiscal_period_id, branch_id)`.
2. THE `AccountBalanceProjector` SHALL memperbarui proyeksi **dalam transaksi yang sama** dengan `JournalService::post()` (peningkatan debit/kredit per akun/periode/cabang dengan `lockForUpdate` pada baris proyeksi), sehingga proyeksi selalu konsisten dengan jurnal terposting.
3. WHEN jurnal dibalik (Fase 1), THE pembalik sebagai jurnal baru SHALL menambah proyeksi sebagaimana jurnal lain; tidak ada pengurangan khusus.
4. THE sistem SHALL menyediakan `finance:rebuild-balances {--from=} {--to=} {--dry-run}` yang menghitung ulang proyeksi dari baris jurnal aktif secara idempoten dan dalam potongan (chunk).
5. WHEN hook `Submitable` men-soft-delete baris GL dokumen yang dibatalkan (perilaku legacy, F-04) dan menandai jurnal `voided`, THE sistem SHALL mengurangi proyeksi dengan nilai jurnal itu pada saat yang sama; pada mode `reversal` (D-13) tidak diperlukan.
6. THE sistem SHALL menyediakan `finance:reconcile-balances` yang membandingkan proyeksi dengan agregasi langsung ledger per akun/periode dan melaporkan selisih (target nol); dijadwalkan harian dan keluar non-nol bila ada selisih.
7. THE proyeksi SHALL diperlakukan sebagai cache: bila rekonsiliasi gagal, laporan secara otomatis jatuh ke agregasi langsung dan menampilkan peringatan.
8. THE baris GL tanpa `fiscal_period_id` (periode tak terdefinisi) SHALL dikelompokkan pada periode sintetis `null` dan dilaporkan; tidak boleh hilang.

### Requirement 4: Laporan Laba Rugi

**User Story:** Sebagai manajer keuangan, saya ingin laporan laba rugi per periode, so that kinerja dapat dinilai dari ledger.

#### Acceptance Criteria

1. THE Laba Rugi SHALL menyusun akun `report_type = profit_and_loss` menurut pohon COA: pendapatan, harga pokok, beban, lain-lain, dengan subtotal, laba kotor (bila akun HPP dapat diidentifikasi lewat `account_type = cost_of_goods_sold`), dan laba bersih.
2. THE tanda dan penyajian SHALL mengikuti `balance_type` dan `is_contra` (akun kontra, mis. retur/potongan penjualan, mengurangi induknya).
3. THE laporan SHALL mendukung rentang tanggal dan perbandingan dengan satu rentang pembanding (selisih dan persen), per cabang atau gabungan.
4. THE laba bersih Laba Rugi untuk rentang tahun fiskal berjalan SHALL sama dengan laba berjalan yang dipakai Neraca (Requirement 5).
5. THE laporan SHALL dapat diekspor CSV/PDF.

### Requirement 5: Laporan Neraca

**User Story:** Sebagai manajer keuangan, saya ingin neraca per tanggal, so that posisi keuangan jelas dan seimbang.

#### Acceptance Criteria

1. THE Neraca SHALL menyusun akun `report_type = balance_sheet` per tanggal (as-of) menjadi Aset, Liabilitas, Ekuitas menurut pohon COA.
2. THE Ekuitas SHALL menyertakan baris virtual **Laba Berjalan** = Σ akun `profit_and_loss` dari awal tahun fiskal sampai tanggal as-of bagi tahun yang belum ditutup (Fase 6), dan saldo laba ditahan = Σ akun `profit_and_loss` tahun-tahun sebelumnya yang belum ditutup bila tidak ada jurnal penutup.
3. THE Neraca SHALL menunjukkan indikator keseimbangan: Aset − (Liabilitas + Ekuitas) = 0 dalam satu minor unit; bila tidak, laporan menampilkan peringatan dengan selisih dan tautan ke audit (`finance:audit-gl`), tanpa menyembunyikan angka.
4. THE penyajian akun kontra dan tanda saldo SHALL mengikuti `balance_type`/`is_contra`.
5. THE laporan SHALL dapat dibandingkan dengan satu tanggal pembanding, per cabang atau gabungan, dan diekspor CSV/PDF.

### Requirement 6: Laporan Arus Kas (metode tidak langsung)

**User Story:** Sebagai manajer keuangan, saya ingin arus kas turunan dari ledger, so that perubahan kas dapat dijelaskan.

#### Acceptance Criteria

1. THE sistem SHALL menambah kolom `accounts.cash_flow_category` (nullable; nilai `operating`, `investing`, `financing`, `cash`, `non_cash_adjustment`, `none`) dan memuat UI untuk mengaturnya; akun `account_type` `cash`/`bank` default `cash` secara saran, tidak otomatis.
2. THE Arus Kas SHALL menghitung: laba bersih periode + penyesuaian non-kas (akun `non_cash_adjustment`) + perubahan modal kerja (selisih saldo awal/akhir akun neraca berkategori `operating`) → kas dari operasi; perubahan akun `investing` → kas dari investasi; perubahan akun `financing` → kas dari pendanaan.
3. THE hasil SHALL direkonsiliasi: total perubahan kas (operasi + investasi + pendanaan) = selisih saldo akun `cash` antara awal dan akhir periode; bila berbeda, laporan menampilkan "belum terklasifikasi" dengan daftar akun yang menyebabkannya.
4. THE akun neraca yang tidak berkategori SHALL dilaporkan pada daftar peringatan, bukan diabaikan diam-diam.
5. THE fase ini SHALL menandai laporan sebagai versi dasar yang bergantung pada klasifikasi akuntan dan standar acuan (D-11, Q6); penyesuaian format dilakukan setelahnya.

### Requirement 7: AR/AP Aging dan buku besar pihak

**User Story:** Sebagai staf keuangan, saya ingin umur piutang/utang per pihak, so that penagihan dan pembayaran dapat diprioritaskan.

#### Acceptance Criteria

1. THE laporan Aging SHALL dibangun di atas `PartyLedgerService` (Fase 4) dengan tanggal as-of, mengelompokkan sisa tiap open item ke bucket berdasarkan jatuh tempo: `belum jatuh tempo`, `1–30`, `31–60`, `61–90`, `>90` (batas dapat dikonfigurasi lewat preferensi).
2. THE jatuh tempo SHALL berasal dari `payment_schedules.due_date` (sisa `outstanding_amount` per termin); invoice tanpa termin memakai tanggal invoice plus kondisi default [TODO: konfirmasi aturan default jatuh tempo].
3. THE laporan SHALL menampilkan per pihak dan total, mata uang asing dengan jumlah asli dan nilai dasar, uang muka/kredit terbuka sebagai kolom terpisah, dan tautan ke buku besar pihak.
4. THE total Aging SHALL sama dengan saldo akun kontrol GL pada as-of yang sama; ketidaksamaan ditampilkan sebagai peringatan (rekonsiliasi Fase 4).
5. THE buku besar pihak (statement) SHALL menampilkan baris jurnal pihak dengan saldo berjalan dan dapat diekspor.
6. THE kedua laporan SHALL mengikuti pembatasan cabang pengguna.

### Requirement 8: Rekap Pajak

**User Story:** Sebagai staf pajak, saya ingin rekap PPN masukan/keluaran per masa dari ledger, so that SPT dapat disiapkan dan dicocokkan.

#### Acceptance Criteria

1. THE Rekap Pajak SHALL, per masa pajak (bulan), mengelompokkan baris jurnal yang memiliki `tax_rule_version_id` per pajak/versi: Σ PPN Keluaran, Σ PPN Masukan, serta DPP terkait bersumber dari `tax_breakdown` dokumen.
2. THE laporan SHALL menampilkan rekonsiliasi terhadap Faktur Pajak: Σ `tax_invoice_ppn_amount` dokumen penjualan pada masa itu vs Σ PPN Keluaran di ledger; selisih dilaporkan dan dijelaskan (invoice pra-cutover Fase 3 tidak memiliki baris pajak terpisah).
3. THE invoice yang dipisah pajaknya SHALL dihitung dari ledger; invoice pra-cutover (pajak tertanam) SHALL ditampilkan terpisah sebagai "tidak terpisah di ledger" dengan jumlah dokumen dan nilai pajak dari `tax_amount` tersimpan.
4. THE laporan SHALL dapat diekspor CSV/PDF dan tidak menggantikan e-Faktur/SPT (di luar scope).

### Requirement 9: Indikator posting lag dan konsistensi

**User Story:** Sebagai pengguna laporan, saya ingin tahu apakah laporan sudah memuat semua transaksi, so that saya tidak salah menafsirkan angka.

#### Acceptance Criteria

1. THE setiap laporan keuangan SHALL menampilkan banner bila terdapat `GlPostingStatus` `pending` atau `failed` yang `created_at`-nya ≤ batas akhir laporan, dengan jumlah dan tautan ke halaman monitoring (selaras D-1 opsi B).
2. THE setiap laporan SHALL menjalankan pemeriksaan konsistensi sesuai bentuknya (TB: debit = kredit; Neraca: seimbang; Buku Besar: saldo akhir = TB; Aging: = akun kontrol; Arus Kas: = perubahan kas) memakai pola `ReportConsistencyChecker` dan menampilkan hasilnya.
3. THE jumlah baris GL tanpa `journal_id` (pra-backfill) dan jurnal `legacy_unbalanced` dalam rentang SHALL ditampilkan sebagai catatan kualitas data.
4. THE banner dan hasil konsistensi SHALL ikut dalam ekspor PDF.

### Requirement 10: Pensiun `accounts.balance_amount` sebagai sumber

#### Acceptance Criteria

1. THE `StockEntryService` SHALL berhenti memutasi `accounts.balance_amount` secara langsung; kolom itu dipertahankan sebagai cermin yang diperbarui oleh `AccountBalanceProjector` (Σ semua waktu bertanda menurut `balance_type`) agar tampilan existing tetap berfungsi.
2. WHEN rekonsiliasi `finance:reconcile-balances` hijau selama dua siklus tutup bulan dan atas persetujuan, THE kode yang membaca `balance_amount` untuk keputusan SHALL diganti dengan layanan saldo, dan kolom dapat ditandai deprecated.
3. THE `finance:snapshot-balances` (Fase 0) SHALL tetap dapat dijalankan untuk membandingkan baseline lama dengan proyeksi baru.
4. THE perubahan ini SHALL diuji bahwa total saldo per akun sebelum/sesudah migrasi sama (selain koreksi yang disengaja untuk drift lama, dilaporkan).

### Requirement 11: Antarmuka, izin, dan ekspor

#### Acceptance Criteria

1. THE halaman laporan baru: `Report/TrialBalance`, `Report/GeneralLedgerDetail`, `Report/IncomeStatement`, `Report/BalanceSheet`, `Report/CashFlow`, `Report/Aging` (piutang/utang), `Report/PartyStatement`, `Report/TaxSummary`, mengikuti pola halaman laporan yang ada (filter, ringkasan/KPI, tabel, ekspor, tombol laporkan masalah).
2. THE izin laporan SHALL dicek lewat `ReportAccess::canRead` pada modul sumber yang sesuai (`Journal`/`GeneralLedger` untuk TB/GL/LR/Neraca/Arus Kas/Pajak; `SalesInvoice`/`PurchaseInvoice` untuk Aging) dan menghormati pembatasan cabang pengguna.
3. THE statement (Laba Rugi, Neraca, Arus Kas) SHALL dirender sebagai tabel hierarkis (indentasi, subtotal, ekspansi/ciutkan) dan ekspor datar (kolom: kode, nama, level, jumlah, pembanding).
4. THE entri menu laporan keuangan SHALL didaftarkan sesuai mekanisme Desk/menu project.
5. THE kunci terjemahan di `lang/id` & `lang/en` (`report.finance.*`) dan `report_rows`; `LocaleKeysTest` hijau; komponen React baru memiliki `.rtl.test.jsx`.

### Requirement 12: Non-fungsional

#### Acceptance Criteria

1. THE Trial Balance setahun SHALL selesai ≤ 3 detik pada ≥ 1 juta baris jurnal dan ≤ 1.000 akun (pembacaan dari `account_balances`); tanpa proyeksi, ≤ 15 detik dan ditampilkan peringatan kinerja.
2. THE Buku Besar SHALL mendukung paginasi dan tidak memuat seluruh baris ke memori; ekspor memakai streaming/chunk.
3. THE rilis laporan SHALL tidak mengubah perilaku posting selain penambahan proyeksi dalam transaksi posting; overhead proyeksi ≤ 10% waktu posting rata-rata.
4. THE seluruh migration aditif dengan `down()`; view dibuat ulang idempoten.
5. THE characterization Fase 0, test Fase 1–4, dan test laporan existing (`tests/Feature/Report/*`) SHALL tetap hijau.

## Pertanyaan yang Menunggu Konfirmasi

| ID | Pertanyaan | Dampak |
|---|---|---|
| D-11 | Standar acuan (SAK/PSAK vs IFRS) dan format laporan keuangan yang dibutuhkan | Requirement 4–6 (struktur dan penamaan) |
| D-19 | Proyeksi saldo diperbarui dalam transaksi posting (usulan) vs dibangun ulang berkala | Requirement 3.2 |
| D-20 | Klasifikasi arus kas (`cash_flow_category`) per akun — siapa mengisi, dan apakah metode langsung juga diperlukan? | Requirement 6 |
| Q-P5-1 | Aturan default jatuh tempo untuk invoice tanpa termin (tunai? 30 hari?) | Requirement 7.2 |
| Q-P5-2 | Siapa pemakai laporan (hak akses cabang vs gabungan) dan apakah ada laporan eksternal yang saat ini dibuat manual dan harus direplikasi (Q7) | Requirement 11 |
| Q-P5-3 | Apakah akun HPP (`cost_of_goods_sold`, yang di seeder berada di bawah root `income`) harus ditampilkan sebagai beban pada Laba Rugi? | Requirement 4.1 |
