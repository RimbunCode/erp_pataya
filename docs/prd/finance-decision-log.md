# Decision Log — Finance Engine Fase 0

| | |
|---|---|
| **Status dokumen** | Sebagian disahkan pemilik produk (2026-11-03); Fase 0 belum selesai |
| **Tanggal entri** | 2026-11-03 |
| **Spec** | [`finance-p0-foundation-audit`](../../.kiro/specs/finance-p0-foundation-audit/requirements.md) (Requirement 7.2 dan 7.5; Task 7.3) |
| **Dokumen terkait** | [`finance-engine-prd.md`](finance-engine-prd.md) (sumber keputusan: Bagian 7 dan 16); [`finance-audit-report.md`](finance-audit-report.md) (laporan audit, sedang disusun) |

> Dokumen ini **disahkan sebagian** oleh pemilik produk pada 2026-11-03: BR-2 s.d. BR-5, DV-A, dan DV-B disahkan; DV-C diterima; Q1 versi PRD dan Q-P0-1 dijawab; D-1 dan D-11 ditunda. Fase 0 **belum selesai**. Fase 1 tidak dimulai sebelum laporan audit ([`finance-audit-report.md`](finance-audit-report.md)) disetujui (Requirement 7.5) dan Task 6.5 selesai. Yang masih menunggu: (1) Task 6.5, ditugaskan kepada pemilik produk di staging dan hasilnya belum diserahkan; (2) persetujuan laporan audit; (3) keputusan penanganan per bug (F-04, F-10, F-11, F-16, N-1 s.d. N-3). Keputusan berstatus PENDING atau PROPOSED belum berlaku sebelum disahkan. Sumber lengkap ada di [`finance-engine-prd.md`](finance-engine-prd.md) Bagian 7 (ADR), Bagian 10 (indeks spec dan aturan branch), dan Bagian 16 (pertanyaan terbuka).

## Ringkasan

| ID | Topik | Fase | Status | Tanggal |
|---|---|---|---|---|
| D-1 | Mode posting: antrian vs sinkron | 2 | DITUNDA (2026-11-03); rekomendasi tetap B | 2026-11-03 |
| D-4 | Satu perusahaan | 1 | DECIDED | 2026-10-18 |
| D-11 | Standar akuntansi acuan | 0 | DITUNDA (2026-11-03), menunggu Q2 | 2026-11-03 |
| D-12 | Pajak dalam jurnal | 3 | PROPOSED (validasi akuntan) | 2026-11-03 |
| D-25 | Penyimpanan setting keuangan | S, 1–6 | DECIDED | 2026-10-18 |
| D-26 | Akun transaksi hanya dari konfigurasi | 2 | DECIDED | 2026-10-18 |
| BR-1 | Branch baru dari `origin/dev-1` terbaru untuk setiap tahapan | Proses | DECIDED | 2026-11-03 |
| BR-2 s.d. BR-5 | Konvensi turunan: cara membuat, pola nama, PR dan penggabungan dev-1, definisi tahapan | Proses | DECIDED (disahkan 2026-11-03) | 2026-11-03 |
| DV-A | Rumus snapshot saldo (penyimpangan dari Requirement 3.2 dan 3.5) | 0 | DECIDED (disahkan 2026-11-03) | 2026-11-03 |
| DV-B | Cakupan characterization test Task 5.3, 5.4, 5.6 (penyimpangan dari Requirement 4) | 0 | DECIDED (disahkan 2026-11-03) | 2026-11-03 |
| DV-C | Penanganan bug di luar opsi Requirement 7.3 (hotfix, Fase 1, Fase 2, atau fase terkait) | 0 | DECIDED (diterima 2026-11-03); penanganan per bug menunggu | 2026-11-03 |
| Q1–Q7, Q-P0-1 | Pertanyaan terbuka | 0–6 | Terbuka (Q1 versi PRD, Q4, dan Q-P0-1 dijawab; Q2, Q3, Q5–Q7 terbuka) | Lihat tabel |
| Q-P1-1 s.d. Q-P6-3 | 21 pertanyaan per fase dari spec Fase 1–6 | 1–6 | PENDING | 2026-11-03 |

## Keputusan Arsitektur (ADR)

### D-1 — Mode posting

**Konteks.** Spec `event-listener-migration-phase-3` memindahkan posting GL ke queue dan menetapkannya sebagai keputusan kunci. Dokumen dapat berstatus `UNPAID`/`APPROVED` sementara GL-nya masih `pending` atau `failed`; Payment Entry masih sinkron (F-05). Invarian jurnal seimbang ditegakkan di `JournalService` dan tidak bergantung pada keputusan ini, sehingga Fase 1 tidak terblokir. Keputusan ini mengikat Fase 2.

| Opsi | Rekomendasi | Pemilik keputusan | Status | Tanggal |
|---|---|---|---|---|
| A: pertahankan queue untuk semua; jadikan `JournalService::post()` atomik di dalam job. B: A ditambah pengamanan (penutupan periode diblokir selama ada posting `pending`/`failed`; laporan menampilkan indikator posting lag; Payment dan Asset boleh sinkron). C: semua sinkron dalam satu transaksi dengan dokumen. | B (rekomendasi PRD) | Pemilik produk | DITUNDA (2026-11-03) | 2026-11-03 |

**Sumber:** PRD Bagian 7 (D-1, R-8) dan Bagian 16 (Q5).

**Keputusan 2026-11-03: ditunda** oleh pemilik produk. Alasan: keputusan ini baru mengikat pada Fase 2; invarian jurnal seimbang tidak bergantung padanya, sehingga Fase 1 tidak terblokir. Rekomendasi tetap opsi B. Keputusan wajib sebelum Fase 2. Q5 tetap Terbuka.

### D-4 — Satu perusahaan

**Konteks.** Satu entitas hukum; cabang (`branches`) adalah dimensi, bukan perusahaan terpisah. Akibatnya Posting Profile, aturan akun, dan setting keuangan bersifat global. Cabang tetap menjadi dimensi pada `journals.branch_id` dan laporan. Multi-company berada di luar cakupan (Non-Tujuan 3.2). Q4 dijawab pada tanggal yang sama.

| Opsi | Rekomendasi | Pemilik keputusan | Status | Tanggal |
|---|---|---|---|---|
| Satu perusahaan dengan cabang sebagai dimensi (dipilih). Multi-company tidak dicakup. PRD tidak merinci opsi alternatif tertulis. | Tidak ada (sudah diputuskan) | Pemilik produk | DECIDED | 2026-10-18 |

**Sumber:** PRD Bagian 7 (D-4) dan Bagian 16 (Q4).

### D-11 — Standar akuntansi acuan

**Konteks.** Dokumen rancangan merujuk IAS/IFRS, sedangkan perusahaan di Indonesia umumnya mengikuti SAK/PSAK. Pilihan ini memengaruhi struktur laporan (Fase 5), kebijakan FX (Fase 4 dan 6), dan penyajian pajak. Masukan akuntan dibutuhkan sebelum desain Fase 5 difinalkan.

| Opsi | Rekomendasi | Pemilik keputusan | Status | Tanggal |
|---|---|---|---|---|
| A: SAK/PSAK. B: IFRS penuh. | Tidak ada di PRD; menunggu masukan akuntan (R-4, Q2) | Pemilik produk, dengan masukan akuntan | DITUNDA (2026-11-03) | 2026-11-03 |

**Sumber:** PRD Bagian 7 (D-11, ADR tabel), Bagian 13 (R-4), Bagian 16 (Q2).

**Keputusan 2026-11-03: ditunda** oleh pemilik produk. Alasan: menunggu akuntan (Q2); paling lambat sebelum desain Fase 5 difinalkan (PRD); berdampak juga ke Fase 4/6. Q2 tetap Terbuka.

### D-12 — Pajak dalam jurnal

**Konteks.** PPN Masukan dan PPN Keluaran dipisahkan sebagai akun sendiri; PPh dicatat sebagai utang atau piutang pajak (FR-T3). Usulan ini belum divalidasi akuntan dan berkaitan dengan risiko kesalahan kebijakan pajak (R-2).

| Opsi | Rekomendasi | Pemilik keputusan | Status | Tanggal |
|---|---|---|---|---|
| Usulan tunggal PRD: PPN Masukan dan Keluaran sebagai akun terpisah; PPh sebagai utang atau piutang pajak. PRD tidak mencantumkan alternatif tertulis. | Usulan PRD; perlu persetujuan akuntan (R-4) | Pemilik produk, setelah validasi akuntan | PROPOSED, validasi akuntan | 2026-11-03 |

**Sumber:** PRD Bagian 7 (D-12, ADR tabel), Bagian 8.3 (FR-T3), Bagian 13 (R-2, R-4).

### D-25 — Penyimpanan setting keuangan

**Konteks.** Tabel `preferences` (key/value JSON) tidak dipakai untuk setting baru karena tidak mendukung foreign key (akun, pajak, gudang) dan validasi bertipe. Setting keuangan dibaca lewat service setting Finances dari spec `module-settings-foundation`, yang menjadi prasyarat Fase 1.

| Opsi | Rekomendasi | Pemilik keputusan | Status | Tanggal |
|---|---|---|---|---|
| Tabel `preferences` (ditolak untuk setting baru). Tabel setting modul bertipe dari spec `module-settings-foundation` (dipilih). | Tidak ada (sudah diputuskan) | Pemilik produk | DECIDED | 2026-10-18 |

**Sumber:** PRD Bagian 7 (D-25); Revisi v1.1 pada header PRD.

### D-26 — Akun transaksi hanya dari konfigurasi

**Konteks.** Pemilih akun pada form dokumen dihapus setelah jenis dokumen tersebut berada pada mode `on` (Fase 2 Requirement 13). Engine mencatat akun pada kolom dokumen yang sudah ada dan pada kolom baru per baris item. Kolom `accounts.is_contra` dihapus setelah pemakaiannya dibersihkan (Fase 2 Task 14.2).

| Opsi | Rekomendasi | Pemilik keputusan | Status | Tanggal |
|---|---|---|---|---|
| PRD tidak merinci opsi alternatif tertulis. Akun hanya dari konfigurasi (dipilih). | Tidak ada (sudah diputuskan) | Pemilik produk | DECIDED | 2026-10-18 |

**Sumber:** PRD Bagian 3.1 (G7), Bagian 7 (D-26), Bagian 8.2 (FR-P5).

## Keputusan dan Konvensi Proses

### BR-1 — Branch baru dari `origin/dev-1` untuk setiap tahapan

**Konteks.** Branch tahapan yang lama tertinggal dari `dev-1` setelah PR-nya di-merge. Contoh nyata: setelah PR #271 di-merge, branch `feat/finance-p0-foundation-audit` tertinggal 3 commit dari `dev-1` (perbaikan template cetak PR #270 beserta merge #270 dan #271). Tahapan berikutnya yang berangkat dari basis basi memicu konflik atau push yang ditolak.

**Keputusan pemilik produk (2026-11-03).** Setiap tahapan dikerjakan di branch baru dari `origin/dev-1` terbaru. Konvensi turunannya dicatat terpisah di BR-2 s.d. BR-5 dan juga disahkan pada 2026-11-03.

| Opsi | Rekomendasi | Pemilik keputusan | Status | Tanggal |
|---|---|---|---|---|
| Branch baru dari `origin/dev-1` terbaru untuk setiap tahapan (dipilih). Melanjutkan branch tahapan sebelumnya, termasuk yang sudah di-merge (tidak diizinkan). | Tidak ada (sudah diputuskan) | Pemilik produk | DECIDED | 2026-11-03 |

**Sumber:** PRD Bagian 10 ("Aturan branch per tahapan").

### BR-2 — Cara membuat branch tahapan

**Konvensi turunan, disahkan pemilik produk (2026-11-03).** `git fetch origin`, pastikan working tree bersih, lalu `git switch --no-track -c <branch> origin/dev-1`. Alasan: rincian pelaksanaan BR-1.

| Opsi | Rekomendasi | Pemilik keputusan | Status | Tanggal |
|---|---|---|---|---|
| Konvensi di atas (dipilih). PRD tidak mencantumkan alternatif tertulis. | Disahkan (usulan PRD Bagian 10) | Pemilik produk | DECIDED (disahkan 2026-11-03) | 2026-11-03 |

**Sumber:** PRD Bagian 10 (butir 1 "Aturan branch per tahapan").

### BR-3 — Pola nama branch

**Konvensi turunan, disahkan pemilik produk (2026-11-03).** Pola `<tipe>/finance-p<N>-<nama>`, dengan tipe `feat`, `docs`, atau `fix` sesuai isi pekerjaan. Contoh sisa Fase 0: `docs/finance-p0-audit-report`.

**Keputusan 2026-11-03: opsi A.** Alasan: pola mengikuti isi tahapan (usulan PRD Bagian 10). PRD Bagian 10 mengusulkan opsi A; rumusan sebelumnya (putaran review 2026-11-03) hanya `feat/…`. Opsi B akan mewajibkan rename branch.

| Opsi | Rekomendasi | Pemilik keputusan | Status | Tanggal |
|---|---|---|---|---|
| A (dipilih): pola dengan tipe `feat`, `docs`, atau `fix` sesuai isi (contoh `docs/finance-p0-audit-report`). B (tidak dipilih): hanya `feat/finance-p<N>-<nama>`; branch saat ini harus di-rename. | A (usulan PRD Bagian 10, disahkan) | Pemilik produk | DECIDED (disahkan 2026-11-03) | 2026-11-03 |

**Sumber:** PRD Bagian 10 (butir 2 "Aturan branch per tahapan"); branch aktual per git.

### BR-4 — PR dan penggabungan `dev-1`

**Konvensi turunan, disahkan pemilik produk (2026-11-03).** PR selalu ber-base `dev-1`. Bila `dev-1` bergerak sebelum PR dibuka atau diperbarui, `origin/dev-1` digabung ke branch. Alasan: rincian pelaksanaan BR-1.

| Opsi | Rekomendasi | Pemilik keputusan | Status | Tanggal |
|---|---|---|---|---|
| Konvensi di atas (dipilih). PRD tidak mencantumkan alternatif tertulis. | Disahkan (usulan PRD Bagian 10) | Pemilik produk | DECIDED (disahkan 2026-11-03) | 2026-11-03 |

**Sumber:** PRD Bagian 10 (butir 3 "Aturan branch per tahapan").

### BR-5 — Definisi tahapan

**Konvensi turunan, disahkan pemilik produk (2026-11-03).** Satu tahapan = satu fase, atau satu bagian fase yang dikirim sebagai PR tersendiri (contoh: sisa Fase 0 setelah PR #271). Alasan: rincian pelaksanaan BR-1.

| Opsi | Rekomendasi | Pemilik keputusan | Status | Tanggal |
|---|---|---|---|---|
| Definisi di atas (dipilih). PRD tidak mencantumkan alternatif tertulis. | Disahkan (usulan PRD Bagian 10) | Pemilik produk | DECIDED (disahkan 2026-11-03) | 2026-11-03 |

**Sumber:** PRD Bagian 10 (paragraf pembuka "Aturan branch per tahapan").

## Penyimpangan dan Usulan Perubahan Spec

Tiga butir berikut diputuskan pemilik produk pada 2026-11-03. DV-A dan DV-B disahkan. DV-C diterima sebagai bentuk usulan; keputusan penanganan per bug tetap menunggu. Teks spec yang terdampak (Requirement 3.2, 3.5, 4, dan 7.3) sudah disesuaikan pada tanggal perubahan masing-masing.

### DV-A — Rumus snapshot saldo (Requirement 3.2 dan 3.5)

**Konteks.** Rumus awal menyesuaikan arah `net` menurut `balance_type`. Verifikasi kode pada Task 3.1 (2026-11-01) menunjukkan bahwa satu-satunya penulis `accounts.balance_amount` adalah `StockEntryService`, yang menulis sisi debit dengan `+` dan sisi kredit dengan `−` tanpa melihat `balance_type`. Dengan demikian `balance_amount` bertanda debit − kredit untuk semua akun. Rumus baru: `net` = Σdebit − Σkredit (baris GL aktif), `difference` = `net` − `balance_amount`. Rumus awal akan membuat akun berjenis kredit tampak selisih 2 × (debit − kredit) padahal datanya konsisten. Rumus belum diverifikasi terhadap data staging (Task 6.5).

**Teks spec.** Requirement 3.2 dan 3.5 di `requirements.md` sudah memakai rumus baru, dan `design.md` (bagian 4) mengunci rumus yang sama.

**Keputusan 2026-11-03: disahkan** oleh pemilik produk. Alasan: mengikuti konvensi tanda `balance_amount` yang ditulis `StockEntryService`. Verifikasi terhadap data staging tetap dilakukan pada Task 6.5.

| Opsi | Rekomendasi | Pemilik keputusan | Status | Tanggal |
|---|---|---|---|---|
| A (dipilih, disahkan 2026-11-03): rumus baru, mengikuti tanda `balance_amount` yang ditulis kode saat ini. B (tidak dipilih): rumus awal, arah `net` menurut `balance_type`. | A (rumus yang dikunci `design.md` dari kode saat ini); verifikasi staging tetap pada Task 6.5 | Pemilik produk | DECIDED (disahkan 2026-11-03) | 2026-11-03 (perubahan spec 2026-11-01) |

**Sumber:** `.kiro/specs/finance-p0-foundation-audit/requirements.md` (Requirement 3.2, 3.5), `design.md` (bagian 4), `tasks.md` (Task 3.1).

### DV-B — Cakupan characterization test Task 5.3, 5.4, 5.6 (Requirement 4.1–4.2)

**Konteks.** Requirement 4 meminta characterization test untuk setiap titik posting, termasuk jalur stok/SRNB, retur, dan aset. Tiga task dipersempit ke batas event dan listener asli, bukan jalur service penuh, karena nilai yang diuji berasal dari valuasi stok (SLE) untuk Task 5.3 dan 5.4, serta dari dokumen penyesuaian dan nilai buku aset untuk Task 5.6. Valuasi stok berada di luar refactor posting:

- **Task 5.3** (Purchase Invoice cabang stok/SRNB): nilai `totalStockGL` berasal dari valuasi SLE. Cakupan valuasinya sudah ada di `PurchaseInvoicePendingSlesFifoOrderTest`.
- **Task 5.4** (Purchase Receipt dan Delivery Note): `totalRatesForGL` dan `totalPicked` adalah keluaran valuasi stok. Jalur rental Delivery Note tidak dibuat di task ini; posting rental ada di `PostAssetDisposalGainLoss` (Task 5.6).
- **Task 5.6** (Asset): penyesuaian nilai dan disposal diuji di batas event dan listener asli. Depresiasi dan scrap tetap lewat jalur penuh.

**Temuan terkait (belum dikonfirmasi sebagai F-xx, tidak diperbaiki, Requirement 5.7):**

- Task 5.3: `onApproved` tanpa PO gagal dengan `TypeError`, karena event rekalkulasi PO membutuhkan PO non-null.
- Task 5.6: tanda laba/rugi disposal tampak terbalik terhadap konvensi umum (lihat docblock test).

| Opsi | Rekomendasi | Pemilik keputusan | Status | Tanggal |
|---|---|---|---|---|
| A (dipilih, disahkan 2026-11-03): cakupan dipersempit seperti sekarang, dengan batas yang dicatat di test. B (tidak dipilih): kembali ke cakupan Requirement 4.1–4.2 penuh (jalur service), dengan test tambahan pada task terkait. | Tidak ada rekomendasi tertulis di sumber; keputusan pemilik produk | Pemilik produk | DECIDED (disahkan 2026-11-03) | 2026-11-03 (perubahan task 2026-11-01) |

**Sumber:** `tasks.md` (catatan Task 5.3, 5.4, 5.6), `requirements.md` (Requirement 4.1–4.2, 5.7).

**Keputusan 2026-11-03: disahkan** oleh pemilik produk. Alasan: (a) Purchase Receipt, Delivery Note, dan cabang stok/SRNB Purchase Invoice: nilai debit/kredit berasal dari valuasi stok (SLE), yang berada di luar cakupan refactor posting. (b) Penyesuaian nilai aset: nilai berasal dari selisih dokumen penyesuaian (`difference_amount`, `PostValueAdjustmentEntry`). Disposal aset: nilai berasal dari harga jual proporsional dikurangi nilai buku proporsional (`bookValue()` di `app/Models/Asset/Asset.php`, dipakai oleh `app/Listeners/Asset/Rental/PostAssetDisposalGainLoss.php` baris 33–39). Jalur service Sales Invoice dan dokumen penyesuaian dikunci terpisah oleh characterization test Sales Invoice (`SalesInvoicePostingTest`) dan oleh test listener (`PostValueAdjustmentEntryTest`). Batas ini dicatat sebagai Requirement 4.6 di `requirements.md`.

### DV-C — Penanganan bug di luar opsi Requirement 7.3 (usulan)

**Konteks.** Requirement 7.3 meminta setiap bug terkonfirmasi dilengkapi usulan penanganan berupa "hotfix terpisah, Fase 1, atau Fase 2". Laporan audit (`finance-audit-report.md`) mengusulkan F-11 ditangani di Fase 4 (D-16 dan D-17, tipe kurs dan selisih kurs) dan bagian `balance_amount` dari F-04 di Fase 2 atau Fase 5 (FR-R2, `accounts.balance_amount` dipensiunkan sebagai sumber). Fase 5 berada di luar opsi Req 7.3.

| Opsi | Rekomendasi | Pemilik keputusan | Status | Tanggal |
|---|---|---|---|---|
| A (dipilih, diterima 2026-11-03): terima, lalu Requirement 7.3 diubah menjadi "…atau fase terkait". B (tidak dipilih): tolak, dan pilih salah satu dari hotfix, Fase 1, atau Fase 2. | A, karena sejalan dengan PRD (D-16 dan D-17 di Fase 4; FR-R2 di Fase 5) | Pemilik produk | DECIDED (diterima 2026-11-03) | 2026-11-03 |

**Sumber:** `requirements.md` (Requirement 7.3); PRD Bagian 7 (D-16, D-17), Bagian 8.5 (FR-R2); `finance-audit-report.md` Bagian 3.1 (F-04), Bagian 3.3 (F-11).

**Keputusan 2026-11-03: diterima** oleh pemilik produk, sebagai bentuk usulan saja. Requirement 7.3 sudah diubah. Keputusan penanganan per bug (F-04, F-10, F-11, F-16, N-1 s.d. N-3) tetap MENUNGGU pemilik produk.

## Pertanyaan Terbuka

| ID | Pertanyaan | Opsi | Rekomendasi | Pemilik keputusan | Status | Tanggal | Dibutuhkan sebelum |
|---|---|---|---|---|---|---|---|
| Q1 | Apakah GL sudah berisi data **produksi** nyata (hanya staging yang terlihat)? | — | — | Pemilik produk | Dijawab 2026-11-03: belum ada data sama sekali (GL produksi kosong) (versi spec: untuk sekarang staging saja) | 2026-11-03 | Fase 1 |
| Q2 | Siapa penanggung jawab akuntansi yang menyetujui kebijakan (D-11, D-12)? | — | — | Pemilik produk (PRD tidak merinci) | Terbuka | 2026-11-03 | Fase 0 |
| Q3 | Berapa developer yang tersedia, dan apakah ada tenggat bisnis (mis. audit atau pajak tertentu)? | — | — | Pemilik produk | Terbuka | 2026-11-03 | Fase 0 |
| Q4 | ~~Apakah multi-company direncanakan dalam 12 bulan (D-4)?~~ Dijawab: satu perusahaan (lihat D-4). | — | — | Pemilik produk | Dijawab | 2026-10-18 | — |
| Q5 | D-1: opsi A, B, atau C? | A, B, atau C (lihat D-1) | B (rekomendasi D-1) | Pemilik produk | Terbuka | 2026-11-03 | Fase 2 |
| Q6 | Format laporan resmi yang dibutuhkan (SAK/PSAK, format e-Faktur/SPT)? | — | — | Pemilik produk | Terbuka | 2026-11-03 | Fase 5 |
| Q7 | Apakah ada laporan keuangan eksternal yang saat ini dibuat manual di luar ERP dan harus direplikasi? | — | — | Pemilik produk | Terbuka | 2026-11-03 | Fase 5 |
| Q-P0-1 | Siapa yang menjalankan perintah audit (`finance:audit-gl`, `finance:snapshot-balances`) di staging dan produksi, lalu mengirim hasilnya? **Dijawab: pemilik produk menjalankan di staging; produksi tidak untuk sekarang.** | — | — | Pemilik produk | Dijawab | 2026-11-03 | Task 6.5 (Fase 0) |

Keterangan: "—" berarti PRD atau spec tidak mencantumkan opsi atau rekomendasi tertulis.

**Sumber:** PRD Bagian 16 (Q1–Q7). Q-P0-1 dari `requirements.md` dan `design.md` (bukan PRD).

**Catatan Q1.** Q1 versi PRD (apakah GL sudah berisi data produksi nyata?) dijawab pemilik produk pada 2026-11-03: belum ada data sama sekali (GL produksi kosong). Konsekuensi (bukan keputusan baru): beban backfill produksi per 2026-11-03 nol (GL produksi kosong); estimasi backfill di laporan audit Bagian 4 berlaku untuk staging sebagai uji coba migrasi. Q1 versi spec (apakah audit boleh dijalankan pada DB produksi) dijawab 2026-11-03: untuk sekarang hanya staging. Prasyarat Fase 1 yang belum selesai (persetujuan laporan audit, Task 6.5) tetap berlaku.

## Pertanyaan per Fase (Q-P1 s.d. Q-P6)

Dirangkum dari bagian "Pertanyaan yang Menunggu Konfirmasi" di akhir `requirements.md` tiap fase. Tidak ada sumber yang menyebut pertanyaan ini sudah terjawab, sehingga semuanya PENDING. Kolom "Dibutuhkan sebelum" diambil dari sumber: prasyarat `tasks.md` bila ada, atau Requirement yang disebut tabel pertanyaan. Bila sumber tidak merinci task, hal itu ditulis.

| ID | Pertanyaan | Fase | Dibutuhkan sebelum | Status | Tanggal |
|---|---|---|---|---|---|
| Q-P1-1 | Boleh membuat jendela pemeliharaan untuk `ALTER TABLE general_ledgers` di MySQL produksi? | 1 | Requirement 13 (task tidak dirinci) | PENDING | 2026-11-03 |
| Q-P1-2 | Penegakan periode diaktifkan kapan (setelah berapa periode terisi)? | 1 | Requirement 6.4 (task tidak dirinci) | PENDING | 2026-11-03 |
| Q-P2-1 | Siapa yang menyetujui perpindahan mode `on` per jenis dokumen? | 2 | Requirement 6.8, 7.2 (task tidak dirinci) | PENDING | 2026-11-03 |
| Q-P2-2 | Apakah COA saat ini sudah memisah akun PPN Masukan/Keluaran (seeder hanya memiliki `account_type = tax`)? Menentukan peta peran `tax_*` di profil default | 2 | Requirement 1; sebelum Fase 3 | PENDING | 2026-11-03 |
| Q-P2-3 | Apakah F-10 (Payment kumulatif) diperbaiki saat migrasi Payment atau sebagai hotfix terpisah? | 2 | Task 7.2 (`tasks.md`); Requirement 7 | PENDING | 2026-11-03 |
| Q-P2-4 | Daftar awal aturan akun bersyarat (barang non-stok, retur, kategori) disusun bersama akuntan saat `init-posting-profile` | 2 | Requirement 12.7 (task tidak dirinci) | PENDING | 2026-11-03 |
| Q-P2-5 | Perlakuan diskon pembelian untuk baris stok (net ke persediaan) dan non-stok (potongan pembelian) | 2 | Task 13 (GATED Q-P2-5); Requirement 14.3 | PENDING | 2026-11-03 |
| Q-P3-1 | Semantik `taxes.rate` di data produksi: apakah 11 dengan DPP 11/12 (≈10,08%), atau seharusnya 12? Apakah invoice historis bernilai benar? | 3 | Task 1.1 (`tasks.md`); Requirement 6.3; prasyarat fase (`tasks.md`) | PENDING | 2026-11-03 |
| Q-P3-2 | Apakah perusahaan PKP? Apakah PPN Masukan seluruhnya dapat dikreditkan? | 3 | Task 6 (`tasks.md`); Requirement 7.2, 7.9; prasyarat fase (`tasks.md`) | PENDING | 2026-11-03 |
| Q-P3-3 | Tanggal cutover pemisahan pajak per jenis dokumen (awal bulan/periode terbuka) | 3 | Requirement 7.5; prasyarat fase (`tasks.md`) | PENDING | 2026-11-03 |
| Q-P3-4 | Akun COA PPN Keluaran/Masukan/PPh yang akan dipakai (akuntan melengkapi COA) | 3 | Task 1.4 dan Task 6 (`tasks.md`); Requirement 7.7–7.8; prasyarat fase (`tasks.md`) | PENDING | 2026-11-03 |
| Q-P4-1 | Apakah transaksi tiga mata uang berbeda perlu didukung nanti? | 4 | Prasyarat fase (`tasks.md`); Requirement 7.7 | PENDING | 2026-11-03 |
| Q-P4-2 | Bagaimana pembayaran dalam mata uang asing diterima di bank (rekening valas atau dikonversi bank ke IDR)? Menentukan mata uang `payment_entries` | 4 | Prasyarat fase (`tasks.md`); Requirement 7.2, 11.2 | PENDING | 2026-11-03 |
| Q-P4-3 | Apakah uang muka dipakai sekarang (proses bisnis nyata)? Menentukan prioritas Requirement 5.8 | 4 | Requirement 5; prasyarat fase (`tasks.md`) | PENDING | 2026-11-03 |
| Q-P4-4 | F-10: apakah dikonfirmasi sebagai bug oleh Fase 0? Tentukan apakah hotfix terpisah lebih dulu | 4 | Prasyarat fase (`tasks.md`); Requirement 7.1 | PENDING | 2026-11-03 |
| Q-P5-1 | Aturan default jatuh tempo untuk invoice tanpa termin (tunai? 30 hari?) | 5 | Requirement 7.2; fallback `AgingBuilder` (`design.md`) | PENDING | 2026-11-03 |
| Q-P5-2 | Siapa pemakai laporan (hak akses cabang vs gabungan) dan apakah ada laporan eksternal yang saat ini dibuat manual dan harus direplikasi (Q7) | 5 | Requirement 11 (task tidak dirinci) | PENDING | 2026-11-03 |
| Q-P5-3 | Apakah akun HPP (`cost_of_goods_sold`, yang di seeder berada di bawah root `income`) harus ditampilkan sebagai beban pada Laba Rugi? | 5 | Task 1.2 (`tasks.md`); Requirement 4.1 | PENDING | 2026-11-03 |
| Q-P6-1 | Frekuensi revaluasi (bulanan/triwulan/tahunan) dan kurs closing mana yang dipakai (BI JISDOR, kurs pajak) | 6 | Task 6 (`tasks.md`); Requirement 4.3 | PENDING | 2026-11-03 |
| Q-P6-2 | Pos moneter lain yang perlu direvaluasi (mis. pinjaman valas, uang muka valas) | 6 | Requirement 4.2 (task tidak dirinci) | PENDING | 2026-11-03 |
| Q-P6-3 | Perlukah periode penyesuaian ke-13 untuk jurnal audit pasca-tutup? | 6 | Requirement 6 (task tidak dirinci) | PENDING | 2026-11-03 |

**Catatan jumlah.** Jumlah per fase: Fase 1 (2), Fase 2 (5), Fase 3 (4), Fase 4 (4), Fase 5 (3), Fase 6 (3), total 21. Fase 3 perlu perhatian: prasyarat `requirements.md` menyebut "Q-P3-1…3", sedangkan `tasks.md` menyebut "Q-P3-1…4" dan tabel memuat empat pertanyaan. Tabel diikuti, sehingga Q-P3-4 tetap dicantumkan.

**Catatan D-xx belum tercatat.** Tabel "Pertanyaan yang Menunggu Konfirmasi" di spec Fase 1–6 juga memuat keputusan D-xx berikut yang belum punya entri di log ini, dan tidak dimasukkan di sini karena di luar cakupan: D-3, D-13, D-14, D-15, D-16, D-17, D-18, D-19, D-20, D-21, D-22, D-23, D-24.

## Catatan Sumber

Butir berikut tidak ditemukan secara tertulis di sumber dan ditandai "—" atau "tidak ada" di atas:

- Opsi alternatif untuk D-4, D-25, dan D-26 (PRD hanya mencatat keputusan yang dipilih).
- Opsi alternatif untuk D-12, BR-2, BR-4, dan BR-5 (PRD hanya memuat satu usulan).
- Rekomendasi untuk D-11 (PRD meminta masukan akuntan).
- Pemilik keputusan untuk Q1–Q3, Q6, dan Q7 (PRD dan spec tidak merinci; ditulis sebagai pemilik produk).
- Task yang membutuhkan Q-P1-1, Q-P1-2, Q-P2-1, Q-P2-4, Q-P5-2, Q-P6-2, dan Q-P6-3 tidak dirinci di `tasks.md`.
