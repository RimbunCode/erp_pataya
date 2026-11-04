# Decision Log — Finance Engine Fase 0

| | |
|---|---|
| **Status dokumen** | Disetujui pemilik produk (2026-11-03); Fase 0 belum selesai (skema staging Req 6.2, APP_ENV, Task 8) |
| **Tanggal entri** | 2026-11-03 |
| **Spec** | [`finance-p0-foundation-audit`](../../.kiro/specs/finance-p0-foundation-audit/requirements.md) (Requirement 7.2 dan 7.5; Task 7.3) |
| **Dokumen terkait** | [`finance-engine-prd.md`](finance-engine-prd.md) (sumber keputusan: Bagian 7 dan 16); [`finance-audit-report.md`](finance-audit-report.md) (laporan audit, sedang disusun) |

> Dokumen ini **disetujui** oleh pemilik produk pada 2026-11-03 (AP-3), termasuk keputusan proses BR-1 s.d. BR-5, penyimpangan DV-A s.d. DV-D (AP-3, 2026-11-03); DV-E disetujui terpisah 2026-11-04, dan keputusan penanganan per bug (PB-1 s.d. PB-15 (AP-3, 2026-11-03)). PB-16 s.d. PB-18 diputuskan pemilik produk 2026-11-04. Hotfix Payment Entry diimplementasi 2026-11-04 (PB-2, PB-4, PB-5, PB-16 s.d. PB-18). Laporan audit ([`finance-audit-report.md`](finance-audit-report.md)) disetujui beserta tambahan PR #274 (AP-1, AP-2). Q1 versi PRD dan Q-P0-1 dijawab; D-1 dan D-11 ditunda. Fase 0 **belum selesai**. Yang masih menunggu: (1) hasil skema staging Req 6.2 dan konfirmasi `APP_ENV` (Task 7.1, belum diserahkan); (2) Task 8 (checkpoint akhir Fase 0). Implementasi DV-D (Task 2.6) selesai 2026-11-04 dan sudah di-merge ke `feat/finance-engine` lewat PR #275. Keputusan berstatus PENDING atau PROPOSED belum berlaku sebelum disahkan. Fase 1 mensyaratkan Fase 0 selesai dan disetujui. Sumber lengkap ada di [`finance-engine-prd.md`](finance-engine-prd.md) Bagian 7 (ADR), Bagian 10 (indeks spec dan aturan branch), dan Bagian 16 (pertanyaan terbuka).

## Ringkasan

| ID | Topik | Fase | Status | Tanggal |
|---|---|---|---|---|
| D-1 | Mode posting: antrian vs sinkron | 2 | DITUNDA (2026-11-03); rekomendasi tetap B | 2026-11-03 |
| D-4 | Satu perusahaan | 1 | DECIDED | 2026-10-18 |
| D-11 | Standar akuntansi acuan | 0 | DITUNDA (2026-11-03), menunggu Q2 | 2026-11-03 |
| D-12 | Pajak dalam jurnal | 3 | PROPOSED (validasi akuntan) | 2026-11-03 |
| D-25 | Penyimpanan setting keuangan | S, 1–6 | DECIDED | 2026-10-18 |
| D-26 | Akun transaksi hanya dari konfigurasi | 2 | DECIDED | 2026-10-18 |
| BR-1 | Branch baru dari `origin/dev-1` terbaru untuk setiap tahapan (basis diubah 2026-11-04 menjadi `origin/feat/finance-engine`, lihat BR-6) | Proses | DECIDED | 2026-11-03 |
| BR-2 s.d. BR-5 | Konvensi turunan: cara membuat, pola nama, PR dan penggabungan branch basis, definisi tahapan | Proses | DECIDED (disahkan 2026-11-03) | 2026-11-03 |
| BR-6 | Basis tahapan dan base PR: `feat/finance-engine` (bukan `dev-1`) | Proses | DECIDED (2026-11-04) | 2026-11-04 |
| DV-A | Rumus snapshot saldo (penyimpangan dari Requirement 3.2 dan 3.5) | 0 | DECIDED (disahkan 2026-11-03) | 2026-11-03 |
| DV-B | Cakupan characterization test Task 5.3, 5.4, 5.6 (penyimpangan dari Requirement 4) | 0 | DECIDED (disahkan 2026-11-03) | 2026-11-03 |
| DV-C | Penanganan bug di luar opsi Requirement 7.3 (hotfix, Fase 1, Fase 2, atau fase terkait) | 0 | DECIDED (diterima 2026-11-03); penanganan per bug disetujui 2026-11-03 (PB) | 2026-11-03 |
| DV-D | Auditor cakupan dokumen tidak mengenali status pasca-approve (Req 2.2; N-9) | 0 | DECIDED (opsi a, disetujui 2026-11-03); implementasi Task 2.6 selesai 2026-11-04 (PR #275) | 2026-11-03 |
| DV-E | `posting_missing` adalah kolom informasi saja; Req 2.2 tetap hanya `posting_not_posted` | 0 | DECIDED (disetujui 2026-11-04) | 2026-11-04 |
| AP-2 | Tambahan laporan audit PR #274 (angka staging, N-4…N-9) | 0 | DECIDED (disetujui 2026-11-03) | 2026-11-03 |
| AP-3 | Decision log disetujui | 0 | DECIDED (disetujui 2026-11-03) | 2026-11-03 |
| PB-1 s.d. PB-15 | Keputusan penanganan per bug (F-04, F-10, F-11, F-16, N-1 s.d. N-9), AP-3 | 0–4 | DECIDED (disetujui 2026-11-03) | 2026-11-03 |
| PB-16 s.d. PB-18 | Keputusan penanganan per bug (N-10, N-11, N-12 (Q12)) | 0–2 | DECIDED (diputuskan 2026-11-04) | 2026-11-04 |
| HF | Hotfix Payment Entry (`finance-payment-entry-hotfix`): N-4, F-10, bagian `paid_amount` F-04, N-10 (Q3), N-11 (Q10, Q11), N-12 (Q12), Q2, Q9b | 0–1 | DECIDED (diimplementasi 2026-11-04) | 2026-11-04 |
| Q1–Q7, Q-P0-1 | Pertanyaan terbuka | 0–6 | Terbuka (Q1 versi PRD, Q4, dan Q-P0-1 dijawab; Q2, Q3, Q5–Q7 terbuka) | Lihat tabel |
| Q-P1-1 s.d. Q-P6-3 | 21 pertanyaan per fase dari spec Fase 1–6 | 1–6 | PENDING | 2026-11-03 |
| AP-1 | Laporan audit Fase 0 (`finance-audit-report.md`) disetujui; Task 6.5 selesai di staging | 0 | DECIDED (disetujui 2026-11-03) | 2026-11-03 |

## Persetujuan Laporan Audit

### AP-1 — Laporan audit Fase 0 disetujui

**Keputusan 2026-11-03: disetujui** oleh pemilik produk: [`finance-audit-report.md`](finance-audit-report.md), versi hasil PR #272 dan #273. Angka staging ditambahkan sesudah persetujuan. Tambahan staging (angka dan N-4…N-9) disetujui 2026-11-03 (AP-2). Keputusan penanganan per bug (F-04, F-10, F-11, F-16, N-1 s.d. N-9) juga disetujui 2026-11-03 (lihat Keputusan Penanganan per Bug).

**Dasar.** Task 6.5 selesai 2026-11-03 oleh pemilik produk di staging (lingkungan diasumsikan staging, sesuai Q-P0-1; penyerahan tidak menyebut lingkungan secara eksplisit). Berkas yang diserahkan: `audit-20261103-155516.json` dan `baseline-20261103-155540.csv`, disimpan di `storage/app/finance-audit/` (ter-ignore git). Ringkasan JSON yang diserahkan: 60 baris GL, 28 kelompok, Σdebit = Σkredit; semua kategori anomali 0, kecuali 4 baris soft-delete yang diharapkan.

**Alasan.** Tidak dinyatakan pemilik produk; yang tercatat hanya persetujuan laporan.

**Belum diserahkan.** Konfirmasi `APP_ENV` staging dan hasil query skema Req 6.2. Keduanya masih diperlukan untuk Task 7.1.

| Opsi | Rekomendasi | Pemilik keputusan | Status | Tanggal |
|---|---|---|---|---|
| Disetujui (dipilih). | — | Pemilik produk | DECIDED (disetujui 2026-11-03) | 2026-11-03 |

**Sumber:** `finance-audit-report.md`; `tasks.md` (Task 6.5, 7.1, 7.2); catatan pemilik produk 2026-11-03.

### AP-2 — Tambahan laporan audit (PR #274) disetujui

**Keputusan 2026-11-03: disetujui** oleh pemilik produk: tambahan laporan audit dari PR #274, yaitu angka staging (Bagian 2 sampai 4) dan temuan N-4 sampai N-9. Dasar: Task 6.5 dan berkas staging pada AP-1. Alasan: tidak dinyatakan pemilik produk. Batas: skema staging Req 6.2 dan `APP_ENV` belum diserahkan.

### AP-3 — Decision log disetujui

**Keputusan 2026-11-03: disetujui** oleh pemilik produk: dokumen `finance-decision-log.md` ini, termasuk keputusan proses BR-1 s.d. BR-5, penyimpangan DV-A s.d. DV-D (AP-3, 2026-11-03); DV-E disetujui terpisah 2026-11-04, dan keputusan penanganan per bug (PB-1 s.d. PB-15). Alasan: tidak dinyatakan pemilik produk. Persetujuan ini tidak mencakup implementasi DV-D (Task 2.6); implementasi itu selesai 2026-11-04 (PR #275).

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

**Keputusan pemilik produk (2026-11-03).** Setiap tahapan dikerjakan di branch baru dari `origin/dev-1` terbaru (basis diubah 2026-11-04, lihat BR-6). Konvensi turunannya dicatat terpisah di BR-2 s.d. BR-5 dan juga disahkan pada 2026-11-03.

| Opsi | Rekomendasi | Pemilik keputusan | Status | Tanggal |
|---|---|---|---|---|
| Branch baru dari `origin/dev-1` terbaru untuk setiap tahapan (dipilih 2026-11-03; basis diubah 2026-11-04, lihat BR-6). Melanjutkan branch tahapan sebelumnya, termasuk yang sudah di-merge (tidak diizinkan). | Tidak ada (sudah diputuskan) | Pemilik produk | DECIDED | 2026-11-03 |

**Sumber:** PRD Bagian 10 ("Aturan branch per tahapan").

### BR-2 — Cara membuat branch tahapan

**Konvensi turunan, disahkan pemilik produk (2026-11-03).** `git fetch origin`, pastikan working tree bersih, lalu `git switch --no-track -c <branch> origin/dev-1` (**diubah 2026-11-04, BR-6:** `origin/feat/finance-engine`). Alasan: rincian pelaksanaan BR-1.

| Opsi | Rekomendasi | Pemilik keputusan | Status | Tanggal |
|---|---|---|---|---|
| Konvensi di atas (dipilih; basis diubah 2026-11-04, BR-6). PRD tidak mencantumkan alternatif tertulis. | Disahkan (usulan PRD Bagian 10) | Pemilik produk | DECIDED (disahkan 2026-11-03) | 2026-11-03 |

**Sumber:** PRD Bagian 10 (butir 1 "Aturan branch per tahapan").

### BR-3 — Pola nama branch

**Konvensi turunan, disahkan pemilik produk (2026-11-03).** Pola `<tipe>/finance-p<N>-<nama>`, dengan tipe `feat`, `docs`, atau `fix` sesuai isi pekerjaan. Contoh sisa Fase 0: `docs/finance-p0-audit-report`.

**Keputusan 2026-11-03: opsi A.** Alasan: pola mengikuti isi tahapan (usulan PRD Bagian 10). PRD Bagian 10 mengusulkan opsi A; rumusan sebelumnya (putaran review 2026-11-03) hanya `feat/…`. Opsi B akan mewajibkan rename branch.

| Opsi | Rekomendasi | Pemilik keputusan | Status | Tanggal |
|---|---|---|---|---|
| A (dipilih): pola dengan tipe `feat`, `docs`, atau `fix` sesuai isi (contoh `docs/finance-p0-audit-report`). B (tidak dipilih): hanya `feat/finance-p<N>-<nama>`; branch saat ini harus di-rename. | A (usulan PRD Bagian 10, disahkan) | Pemilik produk | DECIDED (disahkan 2026-11-03) | 2026-11-03 |

**Sumber:** PRD Bagian 10 (butir 2 "Aturan branch per tahapan"); branch aktual per git.

### BR-4 — PR dan penggabungan branch basis

**Konvensi turunan, disahkan pemilik produk (2026-11-03).** PR selalu ber-base `dev-1` (**diubah 2026-11-04, BR-6:** `feat/finance-engine`). Bila `dev-1` bergerak sebelum PR dibuka atau diperbarui, `origin/dev-1` digabung ke branch (**diubah 2026-11-04, BR-6:** `origin/feat/finance-engine`). Alasan: rincian pelaksanaan BR-1.

| Opsi | Rekomendasi | Pemilik keputusan | Status | Tanggal |
|---|---|---|---|---|
| Konvensi di atas (dipilih; basis diubah 2026-11-04, BR-6). PRD tidak mencantumkan alternatif tertulis. | Disahkan (usulan PRD Bagian 10) | Pemilik produk | DECIDED (disahkan 2026-11-03) | 2026-11-03 |
| Base PR = `feat/finance-engine` (diubah 2026-11-04, BR-6; sebelumnya `dev-1`). | — | Pemilik produk | DECIDED (diubah 2026-11-04) | 2026-11-04 |

**Sumber:** PRD Bagian 10 (butir 3 "Aturan branch per tahapan").

### BR-5 — Definisi tahapan

**Konvensi turunan, disahkan pemilik produk (2026-11-03).** Satu tahapan = satu fase, atau satu bagian fase yang dikirim sebagai PR tersendiri (contoh: sisa Fase 0 setelah PR #271). Alasan: rincian pelaksanaan BR-1.

| Opsi | Rekomendasi | Pemilik keputusan | Status | Tanggal |
|---|---|---|---|---|
| Definisi di atas (dipilih). PRD tidak mencantumkan alternatif tertulis. | Disahkan (usulan PRD Bagian 10) | Pemilik produk | DECIDED (disahkan 2026-11-03) | 2026-11-03 |

**Sumber:** PRD Bagian 10 (paragraf pembuka "Aturan branch per tahapan").

### BR-6 — Branch integrasi `feat/finance-engine` sebagai basis tahapan dan base PR (diputuskan 2026-11-04)

**Keputusan pemilik produk (2026-11-04).** Semua PR program Finance Engine ber-base `feat/finance-engine`, bukan `dev-1`, agar `dev-1` tidak terganggu. Branch `feat/finance-engine` dibuat dari `origin/dev-1` pada 2026-11-04. Konsekuensi: tahapan baru dibuat dari `origin/feat/finance-engine` terbaru (mengubah BR-1, BR-2, dan BR-4). CI tetap berjalan untuk PR ke branch ini; merge ke sana tidak memicu deploy staging. Alasan (pemilik produk): agar tidak merusak `dev-1`.

| Opsi | Rekomendasi | Pemilik keputusan | Status | Tanggal |
|---|---|---|---|---|
| Base PR dan basis tahapan = `feat/finance-engine` (dipilih). Base `dev-1` (tidak dipilih untuk program ini). | — (keputusan pemilik produk) | Pemilik produk | DECIDED (2026-11-04) | 2026-11-04 |

**Sumber:** keputusan pemilik produk 2026-11-04; PRD Bagian 10 ("Aturan branch per tahapan").

## Penyimpangan dan Usulan Perubahan Spec

Lima butir berikut: DV-A dan DV-B disahkan, DV-C diterima, DV-D disetujui opsi (a) pada 2026-11-03, DV-E disetujui 2026-11-04. DV-C diterima sebagai bentuk usulan; keputusan penanganan per bug disetujui 2026-11-03 (lihat Keputusan Penanganan per Bug). Teks spec yang terdampak (Requirement 3.2, 3.5, 4, dan 7.3) sudah disesuaikan pada tanggal perubahan masing-masing.

### DV-A — Rumus snapshot saldo (Requirement 3.2 dan 3.5)

**Konteks.** Rumus awal menyesuaikan arah `net` menurut `balance_type`. Verifikasi kode pada Task 3.1 (2026-11-01) menunjukkan bahwa satu-satunya penulis `accounts.balance_amount` adalah `StockEntryService`, yang menulis sisi debit dengan `+` dan sisi kredit dengan `−` tanpa melihat `balance_type`. Dengan demikian `balance_amount` bertanda debit − kredit untuk semua akun. Rumus baru: `net` = Σdebit − Σkredit (baris GL aktif), `difference` = `net` − `balance_amount`. Rumus awal akan membuat akun berjenis kredit tampak selisih 2 × (debit − kredit) padahal datanya konsisten. Status verifikasi staging: **terkonfirmasi sebagian (2026-11-03)**; lihat keputusan di bawah.

**Teks spec.** Requirement 3.2 dan 3.5 di `requirements.md` sudah memakai rumus baru, dan `design.md` (bagian 4) mengunci rumus yang sama.

**Keputusan 2026-11-03: disahkan** oleh pemilik produk. Alasan: mengikuti konvensi tanda `balance_amount` yang ditulis `StockEntryService`. Verifikasi terhadap data staging: **terkonfirmasi sebagian (2026-11-03):** sesuai untuk akun ber-`balance_type` debit yang ditulis `StockEntryService` (5110, 1241); akun ber-`balance_type` kredit tidak punya cache di staging, sehingga belum teruji data. Fakta dari CSV baseline: 5110 `balance_amount` −11.341.940.000 = net (`difference` 0); 1241 cache 11.341.940.000.

| Opsi | Rekomendasi | Pemilik keputusan | Status | Tanggal |
|---|---|---|---|---|
| A (dipilih, disahkan 2026-11-03): rumus baru, mengikuti tanda `balance_amount` yang ditulis kode saat ini. B (tidak dipilih): rumus awal, arah `net` menurut `balance_type`. | A (rumus yang dikunci `design.md` dari kode saat ini); verifikasi staging: terkonfirmasi sebagian (2026-11-03) | Pemilik produk | DECIDED (disahkan 2026-11-03) | 2026-11-03 (perubahan spec 2026-11-01) |

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

**Keputusan 2026-11-03: diterima** oleh pemilik produk, sebagai bentuk usulan saja. Requirement 7.3 sudah diubah. Keputusan penanganan per bug (F-04, F-10, F-11, F-16, N-1 s.d. N-9) disetujui pemilik produk 2026-11-03 (lihat Keputusan Penanganan per Bug).

### DV-D — Auditor cakupan dokumen tidak mengenali status pasca-approve (disetujui opsi a, 2026-11-03)

**Konteks.** Laporan audit (Bagian 3.13, N-9) menemukan bahwa `DocumentCoverageMatrix` menghitung dokumen `approved` dengan `whereJsonContains('status', 'approved')`. Padahal `onApproved` setiap service menimpa status menjadi `unpaid`, `returned`, `received`, `delivered`, `completed`, atau `paid`. Akibatnya Requirement 2.2 (menandai dokumen `approved` yang `GlPostingStatus`-nya bukan `posted`) tidak terpenuhi pada data nyata: `posting_not_posted` dan `posting_missing` bernilai 0 atas himpunan kosong, sehingga nol tidak menjadi bukti bahwa tidak ada posting `pending`, `failed`, atau hilang. Pengecualiannya `asset_depreciation_schedule`, yang tidak memiliki kolom status. Test auditor lulus karena fixture menyetel status `approved` secara manual. Dampaknya terbatas pada alat audit, bukan perilaku produksi; kolom `canceled*` tidak terdampak.

**Catatan fixture.** Fixture test Payment Entry (`makePaymentEntry`) memakai kas sebagai `paid_from`, yang tidak sesuai filter form. Akibatnya arah terbalik N-4 tidak terlihat di test (laporan audit Bagian 5.2 butir 7). **Diselesaikan hotfix 2026-11-04 (Req 8.1, 8.2):** fixture dan test kini mengikuti filter form.

**Dibutuhkan sebelum:** Task 8 (checkpoint akhir Fase 0). **Implementasi:** Task 2.6 selesai 2026-11-04 (PR #275, sudah di-merge ke `feat/finance-engine`).

| Opsi | Rekomendasi | Pemilik keputusan | Status | Tanggal |
|---|---|---|---|---|
| (a) **Dipilih** (disetujui 2026-11-03): perbaiki auditor di Fase 0 sebelum Task 8, dengan menghitung dokumen berstatus pasca-`onApproved` menurut daftar **per jenis** di tabel *Definisi `approved` pada matriks* di `.kiro/specs/finance-p0-foundation-audit/design.md` (bukan satu himpunan bersama), lalu memperbarui test auditor. `submitted` berarti pasca-persetujuan hanya untuk Asset dan Asset Value Adjustment; pada jenis lain `submitted` tidak pernah diset. Status pra-persetujuan (`draft`, `need_approval`, `rejected`) dan `canceled` tidak termasuk; `need_approval` adalah status pra-persetujuan di alur approval (`ApprovalService.php:37`). (b) Tidak dipilih: ubah teks Req 2.2 dan terima keterbatasan ini. | (a), karena auditor dipakai sebagai alat verifikasi Fase 1–2 | Pemilik produk | DECIDED (opsi a, 2026-11-03) | 2026-11-03 |

**Sumber:** `finance-audit-report.md` Bagian 3.13 (N-9), Bagian 5.2 butir 7; `requirements.md` Req 2.2; `tasks.md` Task 2.3 dan 2.5.

### DV-E — `posting_missing` adalah kolom informasi (disetujui 2026-11-04)

**Konteks.** Matriks cakupan menghitung `posting_missing` untuk dokumen pasca-persetujuan tanpa baris `gl_posting_statuses`. Baris itu dibuat tanpa syarat saat `onApproved` hanya pada Sales Invoice dan Purchase Invoice, sehingga `posting_missing` > 0 pada kedua jenis itu adalah sinyal nyata. Pada Purchase Receipt, Delivery Note, Asset Value Adjustment, dan Asset pembuatannya bersyarat, sehingga dokumen pasca-persetujuan tanpa baris tersebut belum tentu gagal posting. Batas makna ini didokumentasikan di `design.md` (*`posting_missing` adalah kolom informasi, bukan kewajiban spec (keputusan pemilik produk 2026-11-04)*).

**Keputusan 2026-11-04: disetujui** oleh pemilik produk. `posting_missing` adalah kolom informasi saja. Req 2.2 tetap hanya mewajibkan `posting_not_posted`. Bentuk JSON tidak berubah.

| Opsi | Rekomendasi | Pemilik keputusan | Status | Tanggal |
|---|---|---|---|---|
| Kolom informasi saja; Req 2.2 tetap hanya `posting_not_posted` (dipilih). PRD dan spec tidak merinci opsi alternatif tertulis. | — (keputusan pemilik produk) | Pemilik produk | DECIDED (2026-11-04) | 2026-11-04 |

**Sumber:** `design.md` (*Definisi `approved` pada matriks*, *`posting_missing` adalah kolom informasi, bukan kewajiban spec (keputusan pemilik produk 2026-11-04)*); `requirements.md` Req 2.2; `finance-audit-report.md` Bagian 2.4 dan 3.13.

## Keputusan Penanganan per Bug (PB)

PB-1 s.d. PB-15 disetujui pemilik produk pada 2026-11-03 (AP-3), sesuai laporan audit (Bagian 3). PB-16 s.d. PB-18 diputuskan pemilik produk pada 2026-11-04 (lihat tiap entri).

| ID | Temuan | Keputusan | Fase / hotfix | Tanggal | Disetujui |
|---|---|---|---|---|---|
| PB-1 | F-04: bagian GL (soft-delete → reversal) | Fase 2, per D-13 | Fase 2 | 2026-11-03 | Pemilik produk |
| PB-2 | F-04: bagian `paid_amount` saat Payment Entry dibatalkan | Hotfix, digabung ke paket hotfix pembayaran (PB-4, PB-5). **Diperbaiki 2026-11-04** (hotfix `finance-payment-entry-hotfix`) | Hotfix `finance-payment-entry-hotfix` | 2026-11-03 | Pemilik produk |
| PB-3 | F-04: bagian `balance_amount` | Fase 2/Fase 5 | Fase 2/Fase 5 | 2026-11-03 | Pemilik produk |
| PB-4 | F-10: pembayaran parsial memposting total kumulatif | Hotfix satu paket dengan N-4 dan PB-2. **Diperbaiki 2026-11-04** (hotfix `finance-payment-entry-hotfix`) | Hotfix `finance-payment-entry-hotfix`; sebelum Fase 1 | 2026-11-03 | Pemilik produk |
| PB-5 | N-4: arah jurnal Payment Entry tampak terbalik (akun dipilih sesuai filter form) | Hotfix satu paket dengan F-10 dan PB-2, termasuk perbaikan fixture test. Syarat (1): semantik diputuskan pemilik produk 2026-11-04 (Q1 hotfix; debit `account_paid_to`, kredit `account_paid_from`; receive: Dr kas/bank, Cr piutang; pay: Dr utang, Cr kas/bank; filter form tidak diubah); syarat konfirmasi akuntan dikesampingkan oleh pemilik produk 2026-11-04. Syarat (2) dipenuhi: test yang mengunci arah lama dibalik bersamaan. Syarat (3) tetap berlaku: koreksi data historis (staging bernilai kecil; produksi kosong) diputuskan terpisah. **Diperbaiki 2026-11-04** (hotfix `finance-payment-entry-hotfix`) | Hotfix `finance-payment-entry-hotfix`; sebelum Fase 1 | 2026-11-03 | Pemilik produk |
| PB-6 | F-11: GL pembayaran mengabaikan kurs | Fase 4 (D-16, D-17), bukan hotfix. Pengecualian: hotfix hanya bila data staging menunjukkan pembayaran FX nyata (laporan Bagian 3.3) | Fase 4 | 2026-11-03 | Pemilik produk |
| PB-7 | F-16: cancel sebelum job posting dieksekusi | Fase 2 (FR-P3); hotfix guard bila ada kasus nyata (staging: 0 kasus) | Fase 2 | 2026-11-03 | Pemilik produk |
| PB-8 | N-1: tanda laba/rugi disposal aset tampak terbalik | Ditinjau akuntan sebelum Fase 2; koreksi dalam Fase 2 | Sebelum Fase 2 | 2026-11-03 | Pemilik produk |
| PB-9 | N-2: Purchase Invoice tanpa PO gagal `TypeError` | Hotfix kecil bila ada PI tanpa PO nyata; selain itu Fase 2 | Hotfix kecil atau Fase 2 | 2026-11-03 | Pemilik produk |
| PB-10 | N-3: baris satu dokumen terpecah lintas detik | Fase 1; granularitas D-8 ditentukan sebelum spec Fase 1 final | Fase 1 | 2026-11-03 | Pemilik produk |
| PB-11 | N-5: akun SRNB 2214 bersaldo debit | Fase 2 | Fase 2 | 2026-11-03 | Pemilik produk |
| PB-12 | N-6: HPP 4210 berklasifikasi income | Fase 2 | Fase 2 | 2026-11-03 | Pemilik produk |
| PB-13 | N-7: akun selisih Stock Entry default ke 5110 | Fase 2; koreksi data staging oleh pemilik (memilih 3110), tindakan pemilik data, bukan perubahan kode | Fase 2 | 2026-11-03 | Pemilik produk |
| PB-14 | N-8: baris GL bernilai nol untuk invoice bernilai nol | Fase 1 | Fase 1 | 2026-11-03 | Pemilik produk |
| PB-15 | N-9: kolom `approved` dan `posting_*` matriks cakupan | DV-D opsi (a), Task 2.6 (selesai 2026-11-04), sebelum Task 8 | Fase 0 (alat audit) | 2026-11-03 | Pemilik produk |
| PB-16 | N-10: jadwal pembayaran (`PaymentSchedule.paid_amount`) ditimpa, bukan ditambah, pada pembayaran bertahap; jadwal lunas dapat di-reset | Hotfix, ikut paket (Q3); dibuktikan lebih dulu dengan test yang gagal. **Diperbaiki 2026-11-04** | Hotfix `finance-payment-entry-hotfix` | 2026-11-04 | Pemilik produk |
| PB-17 | N-11: server tidak menjaga status Payment Entry (`update` non-draft, submit ulang, dan approve di sela commit) | Hotfix, ikut paket (Q10 opsi a dan c, Q11). **Diperbaiki 2026-11-04** | Hotfix `finance-payment-entry-hotfix` | 2026-11-04 | Pemilik produk |
| PB-18 | N-12 (Q12): default `paid_amount` tombol bayar invoice menjumlahkan `payment_amount` jadwal, bukan sisanya, sehingga setelah pembayaran parsial melebihi sisa tagihan (Q12) | Hotfix, ikut paket: default = `min(total sisa jadwal, sisa faktur)`. **Diperbaiki 2026-11-04** | Hotfix `finance-payment-entry-hotfix` | 2026-11-04 | Pemilik produk |

**Catatan PB-4 dan PB-5.** Hotfix tidak mengoreksi data GL staging yang salah secara otomatis. Koreksi data historis tetap keputusan terpisah.

**Temuan lanjutan dari pengerjaan hotfix (2026-11-04; TL-a s.d. TL-d belum diputuskan):**

| ID | Temuan | Status | Catatan |
|---|---|---|---|
| TL-a | Default `paid_amount` = 0 bila jadwal pertama lunas dan cicilan berikutnya belum jatuh tempo | Terbuka | Kandidat perbaikan UX |
| TL-b | `DB::commit()` eksplisit di `Submitable::checkApproval` (DV-4 di design hotfix) | Terbuka | Perubahan generik; memengaruhi semua dokumen submitable |
| TL-c | Dua berkas test menyebut `print_templates` tanpa `RefreshDatabase`/`DatabaseTransactions`/`DatabaseMigrations` di berkasnya sendiri: `tests/Feature/Core/PrintTemplate/PrintPdfControllerTest.php` dan `tests/Feature/Core/PrintTemplateRequestTest.php` (PR #276 hanya mengubah `tests/TestCase.php`) | Terbuka | Berkas test |
| TL-d | Jalur retur dan `internal_transfer` di Payment Entry (Q4 hotfix) | Terbuka; belum diuji | Hotfix tidak menambah kegagalan pada jalur ini |

**TL-e:** N-2 tetap terbuka (sudah diputuskan PB-9; belum dikerjakan).

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
| Q-P0-1 | Siapa yang menjalankan perintah audit (`finance:audit-gl`, `finance:snapshot-balances`) di staging dan produksi, lalu mengirim hasilnya? **Dijawab: pemilik produk menjalankan di staging; produksi tidak untuk sekarang. Task 6.5 selesai 2026-11-03 (lihat AP-1).** | — | — | Pemilik produk | Dijawab | 2026-11-03 | Task 6.5 (Fase 0) |
| Q-BR-1 | Kapan `feat/finance-engine` digabung ke `dev-1`? | — | — | Pemilik produk | Terbuka (belum diputuskan) | 2026-11-04 | Sebelum merge ke `dev-1` (belum dijadwalkan) |

Keterangan: "—" berarti PRD atau spec tidak mencantumkan opsi atau rekomendasi tertulis.

**Sumber:** PRD Bagian 16 (Q1–Q7). Q-P0-1 dari `requirements.md` dan `design.md` (bukan PRD).

**Catatan Q1.** Q1 versi PRD (apakah GL sudah berisi data produksi nyata?) dijawab pemilik produk pada 2026-11-03: belum ada data sama sekali (GL produksi kosong). Konsekuensi (bukan keputusan baru): beban backfill produksi per 2026-11-03 nol (GL produksi kosong); estimasi backfill di laporan audit Bagian 4 berlaku untuk staging sebagai uji coba migrasi. Q1 versi spec (apakah audit boleh dijalankan pada DB produksi) dijawab 2026-11-03: untuk sekarang hanya staging. Persetujuan laporan versi PR #272/#273 tercatat (AP-1); tambahan staging (angka dan N-4…N-9) disetujui 2026-11-03 (AP-2).

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
