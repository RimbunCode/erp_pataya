# Context Handoff — Event/Listener Migration Fase 3

Dokumen ini untuk agent/developer yang MELANJUTKAN implementasi spec ini tanpa histori brainstorming sebelumnya. Baca `requirements.md` → `design.md` → `tasks.md` secara berurutan dulu (ini bukan pengganti ketiganya, cuma orientasi cepat + jebakan yang perlu diwaspadai).

## Status saat ini

Spec **selesai didesain**, `requirements.md`/`design.md`/`tasks.md` sudah final dan disetujui user. **Belum ada satupun task diimplementasikan** — semua checkbox di `tasks.md` masih `[ ]`. Prasyarat (`event-listener-migration-phase-2`) sudah diverifikasi LULUS (audit kode 8/8 Requirement SESUAI PENUH, full test suite 974 test/0 Error/2 Failure pre-existing) sebelum spec ini mulai ditulis — lihat memory `project_event_listener_migration_phase2_verified.md`.

## Kenapa spec ini bentuknya begini (histori singkat)

Beda dari Fase 1/2, Fase 3 sejak awal dinilai user sendiri sebagai "effort besar, defer" (lihat memory `project_event_listener_migration_phases.md`) — area GL-entangled (GeneralLedger posting bercampur Stock/StockLedgerEntry dalam satu `onApproved()`). Sebelum requirements ditulis, dilakukan **audit menyeluruh 2026-08-08** (4 subagent paralel, baca method dari nol, BUKAN cuma percaya baris di memory lama 3 hari sebelumnya) terhadap `DeliveryNoteService`, `PurchaseReceiptService`, `PurchaseInvoiceService`, plus cross-check `billed_quantity` (Fase 2) dan `LeadService::convertToCustomer()`.

Temuan kunci yang membentuk scope:
1. **`LeadService::convertToCustomer()` DIKELUARKAN dari scope** — audit membuktikan ini BUKAN kategori GL-entangled, tapi "return-value-dependent" (controller butuh `Customer::id` sebagai return value langsung, bukan soal transaction-entanglement). Kategori masalah beda, solusi pola beda — didiskusikan terpisah nanti (bukan bagian Fase 3).
2. **`billed_quantity` race condition dari catatan lama SUDAH TERATASI** oleh keputusan desain Fase 2 (event sync, bukan queued) — dikonfirmasi lewat audit, bukan diasumsikan.
3. **Rental di `DeliveryNoteService` TIDAK PERNAH menghasilkan GL entry** (koreksi terhadap memory lama yang bilang "2 entry stock vs COGS untuk rent/pick" — ternyata rental `continue` sebelum akumulasi apapun, GL cuma untuk forward-pick dan retur).
4. **Race condition BARU ditemukan** (belum pernah tercatat sebelumnya) di titik-titik yang belum `lockForUpdate()`: `PurchaseOrderItem.billed_quantity`/`received_quantity`, `PurchaseInvoiceItem.allocated_qty`, `StockLedgerEntry` pending rows, `$debitAccount`/`$creditAccount`, `returnAgainstItem` di 2 service. Ini jadi Requirement 1, dikerjakan duluan (independen dari desain queue), pola sama seperti Fase 2 menaruh koreksi Fase 1 sebagai Task pertama.

**Pergeseran scope besar terjadi saat user memilih pendekatan "desain ulang batas transaksi"** (bukan sekadar pindah kode jadi event sync) — dipilih dari 3 opsi (event-per-langkah-tetap-sync / fix-race-saja / desain-ulang-transaksi), karena selaras motivasi awal migrasi ini ("kesiapan microservice"). Begitu opsi ini dipilih, muncul rangkaian pertanyaan susulan yang MEMPERBESAR scope lagi:
- User tanya soal `lockForUpdate()` di dalam Job terpisah — jawabannya membuka diskusi soal window race antara commit transaksi 1 (Stock/SLE) dan Job GL mulai dieksekusi (saat masih di antrian).
- User eksplisit menyebut SEMUA 4 resiko window itu relevan (urutan GL antar dokumen, saldo akun berubah, visibilitas "approved tapi GL belum ada", Job gagal berkali-kali menumpuk) — ini yang MELAHIRKAN Requirement 3 (tabel `gl_posting_statuses`) dan Requirement 4 (halaman monitoring + retry manual), yang di draft PALING AWAL tidak ada sama sekali.
- User eksplisit minta pola tracking ini **generik/polymorphic**, bukan spesifik 3 service Fase 3 — karena "ini juga berlaku pada module/fitur lainnya yang membutuhkan transaksi GL" ke depan.

**Pelajaran untuk siapapun yang lanjutin kerjaan ini**: jangan kaget kalau scope Fase 3 ini terasa jauh lebih besar dari sekadar "pindahkan GL ke event" — itu memang keputusan sadar user, bukan scope creep tak disengaja. Kalau nanti nemuin area GL lain (module selain 3 service ini) yang butuh pola serupa, `gl_posting_statuses`/halaman monitoring SUDAH didesain generik untuk itu — JANGAN bikin tabel/halaman tracking baru per-module, pakai yang sudah ada.

## Keputusan desain kunci (jangan diubah tanpa alasan kuat)

1. **GL posting via `ShouldQueue` Job — SATU-SATUNYA titik async di seluruh codebase.** Semua listener Fase 1/2 (dan Requirement 1-4 di Fase 3 ini kalau ada listener baru) tetap SYNC. Hanya listener GL Requirement 5-7 yang `ShouldQueue`. Jangan generalisasi "queue" ke listener lain di luar scope ini.
2. **`QUEUE_CONNECTION=database`** (dari `.env`, dikonfirmasi saat brainstorming) — queue jalan lewat tabel `jobs`, bukan Redis/SQS. Kalau ini berubah sebelum implementasi, verifikasi ulang asumsi timing/retry di design.md masih berlaku.
3. **`transaction_date` WAJIB diisi manual `now()` di titik dispatch event** (bukan `created_at` default Eloquent) — supaya GL/SLE yang di-post lewat Job tetap merefleksikan kapan DOKUMEN di-approve, bukan kapan worker kebetulan memproses. Data lama di-backfill dari `created_at` (satu-satunya sumber yang ada untuk data lama).
4. **`gl_posting_statuses` (baris `pending`) dibuat DI DALAM transaksi 1 (bersama Stock/SLE), SEBELUM event GL di-dispatch — BUKAN di dalam Job.** Ini krusial: kalau baris status dibuat di dalam Job, ada window di mana dokumen sudah approved tapi belum kelihatan "pending" di halaman monitoring sama sekali. Lihat design.md Property 2.
5. **1 titik posting GL = 1 event/listener/Job**, walau GL selalu terdiri 2 entry (debit+credit) atau lebih (`PurchaseInvoiceService` bisa 2-4 entry). JANGAN dipecah event per-entry — 2 entry itu satu kesatuan logis yang harus konsisten dalam satu transaksi Job.
6. **Window race antara commit transaksi 1 dan Job mulai dieksekusi DITERIMA sebagai konsekuensi desain queue** — `lockForUpdate()` pada `Account` di dalam Job cuma mencegah race ANTAR-JOB (saat sama-sama jalan), bukan mencegah perubahan yang terjadi SAAT Job masih di antrian. Mitigasinya BUKAN lock tambahan, tapi `transaction_date` (urutan tetap benar di laporan) + halaman monitoring (visibilitas kalau ada yang telat/gagal). Jangan coba "fix" window ini dengan menambah lock lagi — itu di luar apa yang bisa lock capai secara struktural.
7. **Retry manual (Requirement 4.4) SEBAIKNYA re-query data terbaru dari dokumen sumber**, bukan replay payload event lama yang mungkin stale sejak kegagalan pertama — lihat design.md Error Handling.
8. **`LeadService::convertToCustomer()` di luar scope total** — jangan tergoda memasukkannya karena "sama-sama kandidat lama di memory", kategorinya sudah dikonfirmasi beda.

## Titik rawan yang WAJIB diverifikasi ulang saat implementasi

Spec ini dibuat dengan audit manual terhadap kode di titik waktu penulisan (2026-08-08, SETELAH Fase 2 selesai diimplementasikan). Sama seperti Fase 2, **baris kode yang disebut di `requirements.md`/`design.md`/`tasks.md` BISA SUDAH BERGESER** — jangan asumsikan nomor baris masih akurat.

Titik yang PALING rawan geser dalam spec ini sendiri (bukan cuma dari waktu ke implementasi, tapi ANTAR-TASK di spec yang sama):
- **Task 1 (lockForUpdate) mengubah baris di `PurchaseReceiptService.php`, `PurchaseInvoiceService.php`, `DeliveryNoteService.php` LEBIH DULU** dari Task 9/11/13 (migrasi GL) yang menyentuh file YANG SAMA. Baseline baris "L377-407" dkk di requirements.md/design.md ditulis SEBELUM Task 1 jalan — begitu Task 1 selesai, baris itu bergeser. Task 9/11/13 di tasks.md sudah eksplisit bilang "verifikasi ulang baris persis" — jangan skip instruksi itu.
- `PurchaseReceiptService::onApproved()` — method terbesar, batas loop item (L177-371 baseline) vs GL block (L377-407 baseline) harus tetap presisi setelah Task 1 menambah lock di dalamnya.
- `PurchaseInvoiceService::updatePendingSLEs()` — dependency baca-balik `$totalStockGL` (hasil method ini dipakai GL Stock/SRNB) HARUS tetap terjaga urutannya walau lock ditambahkan.

## Referensi terkait

- Rencana 3-fase migrasi lengkap (termasuk daftar kandidat Fase 3 versi awal sebelum audit ulang): memory `project_event_listener_migration_phases.md`
- Verifikasi Fase 2 (prasyarat spec ini): memory `project_event_listener_migration_phase2_verified.md`, `.kiro/specs/event-listener-migration-phase-2/`
- Pola Job existing yang jadi referensi (`ShouldQueue`, method `failed()`): `app/Jobs/Core/Notification/SendNotificationMailJob.php`
- Pola halaman monitoring polymorphic existing yang jadi referensi: `app/Http/Controllers/Core/LogController.php`, model `App\Models\Core\Log`
- Pola enum native PHP existing yang jadi referensi: `app/Enums/FormStatus.php`
- Environment note: `php`/`artisan`/`phpunit` HARUS dijalankan via PowerShell di lingkungan dev ini, BUKAN Git Bash (`php` tidak ada di PATH Bash) — lihat memory `feedback_use_powershell.md`.
