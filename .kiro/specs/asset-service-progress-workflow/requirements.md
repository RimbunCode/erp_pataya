# Requirements Document

## Introduction

`AssetService` (`app/Models/Asset/AssetService.php`) saat ini hanya punya status approval murni via `App\Traits\Submitable` + `App\Enums\FormStatus`: `draft` → `need_approval` (opsional, tergantung `ApprovalScheme` aktif) → `approved` / `canceled`. Begitu `AssetServiceService::onApproved()` (`app/Services/Asset/AssetServiceService.php:178`) jalan, tidak ada tracking progress perbaikan sama sekali — status berhenti di `approved` sampai `complete()` dipanggil (yang hanya mengisi `completion_date`, bukan status baru).

Spec ini menambah status progress granular pasca-approval: `NEED_CONFIRMATION` (status baru) dengan dialog konfirmasi berisi beberapa pilihan alur kerja (lihat stok, Hold, Create PR, Create PO, Mulai pekerjaan), redesain `AssetServiceActivity` jadi pola mirip sistem tiket (status per-entry, bukan cuma `is_done` boolean), tombol "Complete" yang prefill activity baru, DAN status `AssetService` sendiri disinkronkan otomatis dari status activity terakhir (lihat Requirement 9).

**Dropped**: requirement "perluasan `App\Models\Core\Log` agar bisa menyimpan data custom" (rencana awal) DIJATUHKAN — motivasi awalnya (alasan Hold) sudah tidak berlaku sejak Hold direvisi tersimpan sebagai `AssetServiceActivity`, bukan `Log`. User mengonfirmasi drop total, bukan dipertahankan sebagai kapabilitas mandiri.

**Riwayat keputusan penting**: draf awal spec ini termasuk requirement "status dokumen terkait (PR/PO/SO/IO) diteruskan/disinkronkan balik ke AssetService via relasi baru". Requirement itu **dijatuhkan** setelah investigasi menemukan itu bertabrakan langsung dengan domain-boundary rule yang sudah dipatenkan di dua spec lain:
- `asset-service-internal-order/requirements.md` Requirement 5: *"AssetService/AssetServiceConsumedItem model SHALL TIDAK mendapat field/relasi baru yang menunjuk ke InternalOrder/InternalOrderItem/DeliveryNote apapun. Semua relasi/referensi SHALL berasal dari sisi Sales/Inventory... menunjuk KE Asset domain, bukan sebaliknya."*
- `AssetService.php:127-133` (spec `asset-service-billing` Req 10.2): *"AssetService TETAP TIDAK boleh punya relasi ke SalesOrder/SalesOrderItem/SalesInvoice/DeliveryNote manapun."*
- `asset-service-procurement` Req 4 juga sengaja memutuskan PR/PO dari AssetService tanpa link balik/guard duplikat.

User memilih menjatuhkan requirement itu dari spec ini (lihat Non-Goals) alih-alih meng-override boundary rule yang sudah diulang 3x tersebut.

## Glossary

- **NEED_CONFIRMATION**: status baru (`App\Enums\FormStatus`) yang menandai AssetService sudah disetujui approval tapi user belum memilih alur kerja lanjutan (nunggu part / langsung kerja / hold).
- **WAITING_PARTS**: status baru (`App\Enums\FormStatus`) — AssetService sudah memicu pembuatan PR/PO dari dialog Confirm, menunggu procurement.
- **Status lifecycle AssetService** (single-value, REPLACE TOTAL tiap transisi — bukan multi-flag): `draft` → `need_approval` (opsional) → `need_confirmation` → (`on_hold` | `waiting_parts` | `in_progress` | ...ikut status activity terakhir, lihat Requirement 9) → `canceled` (terminal, kapan saja). Tidak ada status literal `approved` yang persisten setelah `onApproved()` — lihat Requirement 8 untuk dampaknya ke consumer existing.
- **Dialog Confirm**: dialog yang dibuka lewat tombol primary "Confirm", muncul selama status AssetService mengandung `NEED_CONFIRMATION`, berisi 4 opsi alur (Hold, Create PR, Create PO, Mulai pekerjaan) + tombol lihat info stok.
- **Ticket-like activity**: `AssetServiceActivity` dengan field `status` sendiri per-entry (nilai: `IN_PROGRESS`, `RESOLVED`, `WAITING`, `ON_HOLD`, `COMPLETED` — lihat Requirement 6.2, revisi terbaru menghapus `NEW`, dan `DONE`→`COMPLETED` biar konsisten penamaan dengan tombol "Complete"/method `complete()`/field `completion_date`), menggantikan `is_done` boolean, merepresentasikan siklus kerja mirip sistem tiket/case log.

## Requirements

### Requirement 1: Status NEED_CONFIRMATION pasca-approval

**User Story:** As a staff service, I want AssetService yang baru disetujui berhenti dulu di status "perlu konfirmasi" alih-alih langsung `approved` polos, so that saya bisa memilih alur kerja lanjutan (hold / procurement / mulai kerja) sebelum progress tercatat.

#### Acceptance Criteria

1. THE `App\Enums\FormStatus` SHALL mendapat case baru `NEED_CONFIRMATION = 'need_confirmation'` (belum ada di enum saat ini — sudah diverifikasi ke `app/Enums/FormStatus.php`).
2. WHEN `AssetServiceService::onApproved()` dipanggil (baik cabang `repair` maupun `maintenance_task`), THE sistem SHALL men-set `status` menjadi `[FormStatus::NEED_CONFIRMATION]` — REPLACE TOTAL, bukan `[FormStatus::APPROVED]` dan bukan co-exist `[FormStatus::APPROVED, FormStatus::NEED_CONFIRMATION]`. **Keputusan user**: full-replace, `APPROVED` tidak lagi muncul literal di `status` AssetService setelah titik ini.
3. **Konsekuensi WAJIB dari keputusan AC2** — lihat Requirement 8 untuk daftar lengkap consumer `FormStatus::APPROVED` (kode existing, sudah diverifikasi lewat grep) yang HARUS diaudit/diupdate supaya tidak regresi. Requirement 8 BUKAN opsional — tanpa itu, fitur Hold (Req 3) dan Complete (Req 7) di spec ini sendiri akan diblokir oleh guard existing. User sudah konfirmasi daftar 5 titik ini ("tidak masalah").

### Requirement 2: Tombol "Confirm" & dialog pilihan alur

**User Story:** As a staff service, I want tombol aksi jelas saat AssetService masih menunggu konfirmasi alur kerja, so that saya tahu langkah berikutnya tanpa harus menebak dari status mentah.

#### Acceptance Criteria

1. WHEN `assetService.status` mengandung `NEED_CONFIRMATION`, THE halaman Show AssetService SHALL menampilkan tombol primary "Confirm".
2. WHEN tombol "Confirm" diklik, THE sistem SHALL membuka dialog berisi: tombol lihat info stok tersedia per gudang, Option 1 (Hold), Option 2 (Create PR), Option 3 (Create PO), Option 4 (Mulai pekerjaan).
3. **Keputusan user**: komponen BARU (bukan reuse `resources/js/Pages/Inventory/StockLedgers/` mentah) — prioritas simple & nyaman dipakai user, bukan daftar transaksi ledger mentah.
4. **[BARU — keputusan user, resolusi lanjutan AC3]**: THE komponen kartu stok SHALL menampilkan tiap `consumedItem` yang `is_stock_item = true` (item non-stock TIDAK ditampilkan), DAN untuk tiap item tersebut SHALL menampilkan breakdown PER GUDANG — jumlah stok yang **ready** (bukan sekadar total/quantity mentah; lihat `design.md` field `Stock.ready_quantity` spesifik, BUKAN `Stock.quantity`/`actual_quantity`).

### Requirement 3: Option Hold

**User Story:** As a staff service, I want menahan AssetService dengan alasan tercatat, so that ada jejak kenapa pekerjaan ini belum dimulai.

#### Acceptance Criteria

1. WHEN user memilih Option "Hold", THE sistem SHALL membuka dialog Activity yang SAMA dengan dialog Tambah Aktivitas biasa (`ActivityFormDialog`, reuse — **koreksi user**: BUKAN dialog/textbox baru), dengan field `status` ter-prefill ke nilai "hold" dari daftar ticket-like (Requirement 6.2) dan `action_date` ter-prefill `now()` (Requirement 6.5). Alasan Hold diisi user lewat field `description` yang sudah ada di dialog tersebut — TIDAK ada field baru khusus "alasan".
2. WHEN dialog disubmit, THE sistem SHALL menyimpan sebagai baris `AssetServiceActivity` BARU — **koreksi user**: BUKAN lewat `Log` (rencana awal), reuse pola ticket-like Requirement 6/7 sepenuhnya (activity biasa, tidak ada jalur penyimpanan khusus Hold).
3. WHEN activity berhasil disimpan, THE sistem SHALL men-set `status` AssetService menjadi `[FormStatus::ON_HOLD]` (REPLACE TOTAL, bukan co-exist dengan `APPROVED` — konsisten Requirement 1 AC2; `FormStatus::ON_HOLD` sudah ada di enum, tidak perlu case baru).

### Requirement 4: Option Create PR / Create PO

**User Story:** As a staff service, I want opsi langsung ke pembuatan PR/PO dari dialog konfirmasi, so that saya tidak perlu navigasi manual ke tombol terpisah kalau memang butuh beli part dulu.

#### Acceptance Criteria

1. WHEN user memilih Option "Create PR"/"Create PO", THE sistem SHALL mengarahkan ke route yang SAMA dengan tombol existing dari spec `asset-service-procurement` (`purchaseRequests.create`/`purchaseOrders.create` dengan `ref=assetService/{id}`) — TIDAK membuat mekanisme prefill baru, reuse yang sudah ada.
2. THE aksi ini SHALL TIDAK membuat relasi/link balik apapun dari AssetService ke PR/PO yang dihasilkan (konsisten Non-Goals spec ini DAN `asset-service-procurement` Requirement 4).
3. **Keputusan user**: WHEN PR/PO berhasil dibuat dari opsi ini, THE sistem SHALL men-set `status` AssetService menjadi `[FormStatus::WAITING_PARTS]` (REPLACE TOTAL, konsisten Requirement 1 AC2).
4. THE `App\Enums\FormStatus` SHALL mendapat case baru `WAITING_PARTS = 'waiting_parts'` (belum ada di enum — sudah diverifikasi; berbeda dari `FormStatus::WAITING` generik yang sudah ada, sengaja dipisah karena maknanya spesifik "menunggu part AssetService", bukan waiting generik dipakai model lain).

### Requirement 5: Option "Mulai pekerjaan" + gating stok

**User Story:** As a teknisi, I want memulai pengerjaan langsung dari dialog konfirmasi kalau part sudah tersedia, so that saya tidak perlu proses procurement kalau memang tidak diperlukan.

#### Acceptance Criteria

1. THE Option "Mulai pekerjaan" SHALL ditampilkan WHEN minimal SATU `consumedItem` (`is_stock_item = true`) punya stok tersedia (balance `StockLedgerEntry` per `item_id`+`warehouse_id` > 0) di SATU gudang manapun DALAM branch AssetService saat ini (`warehouse.branch_id = assetService.branch_id`, BUKAN lintas branch) — **keputusan user**: bukan syarat SEMUA item harus tersedia stok.
2. THE Option "Mulai pekerjaan" SHALL disembunyikan total (tidak dirender) WHEN TIDAK ADA satupun `consumedItem` yang memenuhi syarat AC1 (nihil stok sama sekali untuk semua item, di semua gudang dalam branch ini).
3. WHEN Option "Mulai pekerjaan" diklik, THE sistem SHALL men-set `status` menjadi `[FormStatus::IN_PROGRESS]` (REPLACE TOTAL, konsisten Requirement 1 AC2; `FormStatus::IN_PROGRESS` sudah ada di enum).
4. THE tabel `asset_services` SHALL mendapat kolom baru `start_date` (datetime, nullable, migration baru) — diisi `now()` saat transisi ini terjadi.
5. **Keputusan user**: THE field `start_date` SHALL ditampilkan di halaman Show AssetService HANYA JIKA terisi (`start_date IS NOT NULL`) — disembunyikan total (bukan ditampilkan kosong/dash) selama belum diisi. Ini field BARU (AC4), bukan field existing.

### Requirement 6: AssetServiceActivity jadi pola ticket-like

**User Story:** As a teknisi, I want tiap activity yang saya catat punya status sendiri (bukan cuma checkbox selesai/belum), so that riwayat pengerjaan lebih presisi merepresentasikan tahapan kerja seperti tiket.

#### Acceptance Criteria

1. THE tabel `asset_service_activities` SHALL mendapat kolom baru `status` (migration baru) — **keputusan user**: MENGGANTIKAN `is_done` (boolean), BUKAN mendampingi. Kolom `is_done` SHALL di-drop (migration).
2. **Keputusan user (revisi)**: daftar status valid untuk satu activity entry (ticket-like) SHALL berupa: `IN_PROGRESS`, `RESOLVED`, `WAITING`, `ON_HOLD`, `COMPLETED` — 5 nilai. `CLOSED` dikecualikan (keputusan sebelumnya), `NEW` DIHAPUS dari daftar (keputusan user, revisi terbaru — sebelumnya sempat diusulkan sebagai default activity kosong), DAN `DONE` diganti `COMPLETED` (keputusan user — konsisten penamaan dengan tombol "Complete"/`AssetServiceService::complete()`/`completion_date`; ada precedent `SalesOrder` pakai `FormStatus::COMPLETED` untuk semantik terminal "sepenuhnya selesai" yang sama, `SalesOrderService.php:550`). Semua 5 nilai ini sudah ada di `App\Enums\FormStatus`, tidak perlu case baru.
3. **Keputusan user**: `is_done` di-drop saja, TANPA strategi migrasi/backfill data existing ke `status` baru — baris `AssetServiceActivity` lama kehilangan representasi checklist-nya (diterima sebagai konsekuensi, bukan di luar scope).
4. THE `AssetService::isFullyChecked()` (`app/Models/Asset/AssetService.php:118`, dipakai gate `complete()`) SHALL disesuaikan mengikuti representasi status baru — definisi "checklist lengkap" perlu didefinisikan ulang dalam istilah `status` activity, bukan lagi `is_done`.
5. **Keputusan user (berlaku UNIVERSAL, semua dialog activity — bukan cuma Hold/Complete)**: WHEN dialog Activity dibuka untuk MENAMBAH activity baru (mode create, bukan edit) DAN field `action_date` ditampilkan, THE dialog SHALL selalu prefill `action_date` ke `now()`. Berlaku untuk dialog Tambah Aktivitas biasa, dialog dari Option Hold (Requirement 3), dan dialog dari tombol Complete (Requirement 7) — SATU aturan yang sama, bukan 3 implementasi terpisah.
6. **Keputusan user [REVISI — konsisten Requirement 9 AC1]**: THE field `status` pada dialog Tambah Aktivitas BIASA (bukan dari Option Hold/tombol Complete, yang keduanya sudah punya target prefill tetap masing-masing — `ON_HOLD` di Requirement 3 AC1, `COMPLETED` di Requirement 7 AC2) SHALL ter-prefill ke nilai `status` activity dengan `action_date` TERBESAR milik AssetService ini (BUKAN "activity yang terakhir disimpan" — samakan definisi "terakhir" dengan Requirement 9 AC1 pasca-revisi). Karena Requirement 9 AC3 menjamin selalu ada minimal 1 activity begitu status lewat `NEED_CONFIRMATION` (dibuat otomatis saat "Mulai pekerjaan", ATAU lebih awal lewat Option Hold — keduanya bisa jadi activity pertama tergantung opsi mana yang dipilih user duluan di dialog Confirm), SELALU ada activity utk basis prefill — tidak ada skenario "activity pertama tanpa status sebelumnya" yang perlu ditangani.
7. **Keputusan user**: THE field `description` SHALL wajib diisi (validasi, tidak boleh kosong) saat activity dibuat/diubah lewat dialog — berlaku dialog Tambah Aktivitas biasa, Hold, DAN Complete. **Pengecualian**: activity yang dibuat OTOMATIS oleh sistem (Requirement 9 AC3, saat "Mulai pekerjaan" diklik) SHALL TIDAK tunduk validasi ini — activity tersebut dibuat tanpa dialog sama sekali, `description` boleh kosong (keputusan user eksplisit: "detailnya lainnya kosong").
8. **[BARU — keputusan user]**: THE daftar activity yang ditampilkan di halaman Show AssetService (`ServiceActivityLog`) SHALL diurutkan berdasarkan `action_date` (bukan urutan simpan/`id`) — konsisten dengan Requirement 9 AC1 (status AssetService juga mengikuti `action_date` terbesar, bukan urutan simpan). "Activity terakhir" yang ditampilkan paling bawah/atas (lihat `design.md` utk arah urutan) SHALL activity dengan `action_date` terbesar — SAMA dengan yang menentukan `status` AssetService (Requirement 9 AC1) dan prefill (AC6 di atas), satu definisi "terakhir" dipakai konsisten di semua tempat.

### Requirement 7: Tombol "Complete" + dialog prefill

**User Story:** As a teknisi, I want menandai AssetService selesai lewat activity terakhir yang jelas, so that penyelesaian pekerjaan tercatat sebagai bagian dari riwayat activity, bukan aksi tersembunyi.

#### Acceptance Criteria

1. **Keputusan user (revisi)**: THE tombol aksi "Complete" SHALL ditampilkan WHEN activity TERAKHIR milik AssetService ini berstatus salah satu dari `IN_PROGRESS`, `RESOLVED`, `WAITING`, `ON_HOLD` — DAN SHALL disembunyikan WHEN activity terakhir berstatus `COMPLETED` (sudah selesai, tombol tidak relevan lagi) ATAU belum ada activity sama sekali (tidak ada skenario ini secara praktis — lihat Requirement 9 AC3).
2. WHEN tombol "Complete" diklik, THE sistem SHALL membuka dialog Activity yang SAMA dengan dialog Tambah Aktivitas biasa (`ActivityFormDialog`, reuse — bukan dialog baru, konsisten pola Requirement 3), dengan field `status` ter-prefill ke `COMPLETED` dan `action_date` ter-prefill `now()` (Requirement 6.5).
3. WHEN dialog ini disubmit, THE sistem SHALL memanggil `AssetServiceService::complete()` (`app/Services/Asset/AssetServiceService.php:212`) SETELAH activity baru berhasil disimpan — gate `isFullyChecked()` yang sudah ada (disesuaikan Requirement 6.4) TETAP berlaku, submit SHALL ditolak jika gate gagal.

### Requirement 8: Audit consumer `FormStatus::APPROVED` milik AssetService

**User Story:** As a developer, I want semua tempat yang mengecek AssetService "sudah approved" tetap berfungsi benar setelah Requirement 1 membuat `APPROVED` tidak lagi muncul literal di `status`, so that fitur existing (billing, internal order, activity log) tidak regresi diam-diam.

**Latar belakang**: Requirement 1 AC2 memutuskan `onApproved()` REPLACE TOTAL status jadi `[FormStatus::NEED_CONFIRMATION]` — `FormStatus::APPROVED` tidak lagi ada di array `status` AssetService setelah titik itu, SELAMANYA (termasuk saat sudah `IN_PROGRESS`/`ON_HOLD`/`WAITING_PARTS`/dst). Grep `FormStatus::APPROVED` di seluruh `app/` (sudah dijalankan, bukan tebakan) menemukan 5 titik yang secara spesifik cek status AssetService dengan pola ini — SEMUA WAJIB diperbarui:

#### Acceptance Criteria

1. `App\Http\Controllers\Asset\AssetServiceController::assertApproved()` (`app/Http/Controllers/Asset/AssetServiceController.php:153-156`, `in_array(FormStatus::APPROVED, $assetService->status ?? [], true)`, melempar `activity_requires_approval` kalau gagal) — guard ini menjaga create/edit `AssetServiceActivity`. **PALING KRITIS**: tanpa perbaikan ini, Requirement 3 (Hold, bikin activity) dan Requirement 7 (Complete, bikin activity) di spec ini sendiri akan SELALU gagal begitu status AssetService pindah dari `APPROVED` literal. THE method ini SHALL diperbarui mengenali "AssetService sudah lewat tahap approval" (bukan literal `APPROVED` lagi) — definisi himpunan status yang dianggap "sudah lewat approval" didetailkan di `design.md`.
2. `App\Http\Requests\Sales\SalesOrderRequest.php:124,136` — validasi referenceable `AssetService`/`AssetServiceConsumedItem` ke `SalesOrder` (implementasi gate spec `asset-service-billing`). THE validasi ini SHALL diperbarui dengan definisi yang sama seperti AC1.
3. `App\Http\Requests\Sales\InternalOrderRequest.php:136,148` — validasi setara untuk `InternalOrder` (implementasi gate spec `asset-service-internal-order` Requirement 2). THE validasi ini SHALL diperbarui dengan definisi yang sama seperti AC1.
4. `resources/js/Pages/Asset/Services/Show.jsx:21` (`isApproved = (assetService?.status ?? []).includes("approved")`, gate visibilitas `ServiceActivityLog`) — THE kondisi ini SHALL diperbarui dengan definisi yang sama seperti AC1 (bukan cek literal `"approved"` lagi).
5. `resources/js/Pages/Asset/Services/Form.jsx:34,39` (`isApproved`, gate `canBillToRenter`) — THE kondisi ini SHALL diperbarui dengan definisi yang sama seperti AC1.
6. THE definisi himpunan "status AssetService dianggap sudah lewat tahap approval" (dipakai seragam di AC1-5) SHALL didefinisikan SATU KALI di satu tempat (mis. method baru `AssetService::hasPassedApproval(): bool` atau konstanta array) — bukan diduplikasi 5x secara terpisah. Detail implementasi di `design.md`.

### Requirement 9: Status AssetService disinkronkan dari activity terakhir

**User Story:** As a teknisi, I want status AssetService otomatis mengikuti status activity terakhir yang saya catat, so that dokumen selalu merefleksikan progres kerja terkini tanpa saya harus mengubah status dokumen secara terpisah dari activity-nya.

**Keputusan user**: status activity TERAKHIR mengubah `status` AssetService.

**Revisi (diskusi lanjutan)**: "terakhir" awalnya diartikan "activity yang barusan disimpan" (urutan simpan/insertion order) — user mengoreksi: `action_date` bisa diisi mundur (fleksibilitas, mis. teknisi lupa catat lalu backfill tanggal asli), jadi "activity yang barusan disimpan" BELUM TENTU "activity paling akhir secara kronologis kejadian". User memilih: sync berdasar `action_date` TERBESAR (bukan urutan simpan) — lihat AC1 revisi, AC8 (batas `action_date`), AC9 (lock activity pasca-`COMPLETED`) di bawah, ditambahkan untuk menutup celah yang muncul dari keputusan ini.

#### Acceptance Criteria

1. **[REVISI]** WHEN sebuah `AssetServiceActivity` disimpan (CREATE **atau** UPDATE — bukan cuma create, karena edit `action_date` activity existing juga bisa mengubah siapa yang "terkini"), THE sistem SHALL me-**recompute** `status` AssetService menjadi `[<status activity dengan action_date TERBESAR di antara SEMUA activity milik AssetService ini>]` (REPLACE TOTAL, konsisten pola Requirement 1 AC2) — BUKAN otomatis status activity yang baru disimpan itu sendiri (beda dari desain awal). Tie-break kalau 2+ activity punya `action_date` PERSIS sama: pakai `id` terbesar (ULID, `AssetServiceActivity` pakai `HasUlids` — id sudah chronological-insertion-order) sebagai penentu kedua.
2. Requirement ini SHALL menjelaskan/menggantikan penetapan status manual di Requirement 3 AC3 (Hold → `ON_HOLD`) dan menjadi mekanisme yang membuat `AssetServiceService::complete()` (Requirement 7 AC3) efektif menghasilkan `status` AssetService `[FormStatus::COMPLETED]` — TANPA kode tambahan terpisah di `complete()` itu sendiri, cukup lewat AC1.
3. **Keputusan user**: Requirement 5 ("Mulai pekerjaan") SHALL diperbarui — opsi (a) dipilih. WHEN "Mulai pekerjaan" diklik, THE sistem SHALL (selain men-set `status` AssetService, Requirement 5 AC3) JUGA membuat 1 `AssetServiceActivity` BARU secara otomatis (TANPA dialog): `status = FormStatus::IN_PROGRESS`, `pic` = user yang mengklik tombol (user login saat ini), `action_date = now()`, `description` = kosong (dikecualikan dari validasi wajib-isi, lihat Requirement 6 AC7). Dengan ini, AC1 di Requirement ini menjadi SATU-SATUNYA mekanisme yang mengubah `status` AssetService setelah `NEED_CONFIRMATION` (tidak ada exception "Mulai pekerjaan" set status langsung tanpa activity) — Requirement 5 AC3 tetap berlaku secara efek (status akhirnya `IN_PROGRESS`), tapi jalurnya SEKARANG lewat activity ini, bukan `update()` terpisah.
4. **Keputusan user**: AC1 berlaku UNIVERSAL, di SEMUA status activity, tanpa terkecuali — TERMASUK activity "biasa" yang dicatat teknisi di tengah kerja (bukan cuma dari Hold/Complete/Mulai-pekerjaan). Konsekuensi eksplisit: teknisi mencatat activity baru berstatus `WAITING` di tengah kerja → `status` AssetService otomatis ikut menjadi `[FormStatus::WAITING]` — TIDAK ada activity yang "cuma catatan riwayat tanpa efek ke status dokumen".
5. **Keputusan user [REVISI]**: WHEN `status` AssetService menjadi `COMPLETED` (lewat mekanisme AC1), THE sistem SHALL men-set kolom `completion_date` (**field EXISTING** — `asset_services.completion_date`, `database/migrations/2026_08_15_000007_create_asset_services_table.php:17`, sudah dipakai `AssetServiceService::complete()` — BUKAN kolom baru `completed_at` seperti istilah yang dipakai user, sudah diverifikasi ke migration) ke **`action_date` milik activity `COMPLETED` tersebut** — BUKAN `now()` (waktu klik tombol/submit) seperti draf awal. Konsisten filosofi "action_date sebagai sumber kebenaran kronologi", bukan waktu submit form.
6. **[DIABAIKAN SEMENTARA — keputusan user]**: AC5 di atas berpotensi bikin `completion_date` ke-set TANPA lewat gate `isFullyChecked()` — karena AC4 bilang AC1 (sync status) berlaku UNIVERSAL termasuk dialog Tambah Aktivitas biasa (Requirement 6 AC6, yang user manapun bisa pilih status `COMPLETED` secara manual), sementara gate `isFullyChecked()` SAAT INI cuma dicek di jalur tombol "Complete" (Requirement 7 AC3, via `complete()`). Akibatnya: teknisi BISA set status activity manapun langsung ke `COMPLETED` lewat dialog biasa → `status` AssetService & `completion_date` ikut ter-set, TANPA melewati validasi checklist `isFullyChecked()`, MEMOTONG tombol "Complete" & gate-nya. **User eksplisit minta diabaikan dulu untuk sekarang** — BUKAN diputuskan "gate memang longgar", ini genuinely belum diputuskan, harus diangkat lagi sebelum/saat implementasi Requirement 7/9 di `tasks.md` nanti, jangan dianggap selesai.
7. **Keputusan user**: THE field `completion_date` SHALL ditampilkan di halaman Show AssetService HANYA JIKA terisi (`completion_date IS NOT NULL`) — pola sama seperti `start_date` (Requirement 5 AC5). Field ini SUDAH ADA di model/DB, TAPI belum pernah ditampilkan di FE (`Form.jsx`/`Show.jsx`) sampai sekarang — sudah diverifikasi (grep), tidak ada render existing.
8. **[BARU — keputusan user]**: `action_date` pada `AssetServiceActivity` baru (create) MAUPUN saat activity diedit (update) SHALL TIDAK BOLEH lebih awal dari `action_date` milik activity PERTAMA (activity dengan `id` terkecil, `oldest('id')`) milik `AssetService` yang sama — validasi ditolak (`ValidationException`) kalau dilanggar. Ini batas BAWAH backdate, mencegah `action_date` mendahului kapan pekerjaan ini pertama kali tercatat — TIDAK membatasi backdate DI ANTARA activity yang sudah ada (fleksibilitas "lupa isi detail" tetap ada, cuma dibatasi gak boleh sebelum titik mula).
9. **[BARU — keputusan user]**: WHEN `status` AssetService (hasil AC1, yaitu status activity dengan `action_date` terbesar) sudah `COMPLETED`, THE sistem SHALL menolak (validasi) penambahan `AssetServiceActivity` BARU — activity TIDAK BISA ditambahkan lagi setelah `AssetService` mencapai `COMPLETED`. **Catatan cakupan**: keputusan user eksplisit soal "ditambahkan" (CREATE) — belum ada keputusan soal apakah EDIT activity EXISTING juga ikut dikunci pasca-`COMPLETED` (kalau tidak dikunci, edit `action_date`/`status` activity lama pasca-`COMPLETED` masih bisa memicu AC1 recompute dan "membuka lagi" status yang harusnya terminal — celah serupa, TIDAK dibahas eksplisit, jangan diasumsikan tertutup juga).
10. **[BARU — keputusan user]**: WHEN activity BARU dibuat dengan `status = COMPLETED`, THE `action_date`-nya SHALL LEBIH BESAR (setelah) `action_date` activity TERAKHIR (`action_date` terbesar) yang SUDAH ADA sebelum activity ini disimpan — validasi ditolak kalau dilanggar. Beda dari AC8 (batas BAWAH umum, berlaku semua status) — AC10 ini batas ATAS, KHUSUS status `COMPLETED`, memastikan begitu suatu activity men-declare "selesai", dia benar-benar jadi titik PALING AKHIR secara kronologi (menjamin AC5 — `completion_date` diambil dari `action_date` activity ini — benar-benar merepresentasikan momen paling akhir, bukan "selesai" yang di-backdate ke tengah-tengah riwayat).

## Non-Goals

1. **Sync status balik PR/PO/SO/IO ke AssetService** — dijatuhkan dari scope. AssetService TIDAK mendapat relasi/field baru yang menunjuk ke `PurchaseRequest`/`PurchaseOrder`/`SalesOrder`/`InternalOrder` apapun, konsisten domain-boundary rule di `asset-service-internal-order` Req 5 dan `asset-service-billing` Req 10.2. Kalau kebutuhan ini muncul lagi ke depan, harus lewat pendekatan query-search dari sisi Sales/Purchase (bukan relasi tersimpan di AssetService), dan didiskusikan sebagai spec terpisah.
2. **Perubahan requirement spec lain** — `asset-service-procurement`, `asset-service-internal-order`, `asset-service-billing`, `asset-service-activity-attachment` tetap berlaku apa adanya, tidak diubah oleh spec ini.
3. **Komponen kartu stok generic lintas modul** — kalau Requirement 2.3 ujungnya butuh komponen baru, scope-nya cukup dipakai di dialog Confirm AssetService, bukan refactor besar modul Inventory.
4. ~~WAITING_PARTS sebagai status eksplisit~~ — **SUDAH TIDAK BERLAKU**, dipindah jadi Requirement 4 AC3/AC4 (keputusan user: Create PR/PO men-set status `WAITING_PARTS`, case baru di `FormStatus`).
5. **Log API custom data** — DIJATUHKAN total dari spec ini (keputusan user). `App\Models\Core\Log` TIDAK mendapat perubahan apapun. Kalau kebutuhan generic log-custom-data muncul lagi ke depan (di luar konteks AssetService), dibahas sebagai spec terpisah.
