# Implementation Plan: Notification Center

## Overview

Membangun infrastruktur notifikasi terpusat: setiap event (approve/reject, approval pending, dokumen dibatalkan, dokumen baru role-based, invite user) direpresentasikan satu `Notification` class, dikirim lewat service `NotifyUser` yang memisahkan kecepatan delivery — `database`+`broadcast` sinkron via `Notification::sendNow()`, `mail` async lewat `SendNotificationMailJob` baru. Infrastruktur lama (`app/Channels/DatabaseChannel.php`, `MyMailChannel.php`, `BaseNotification.php`, binding di `AppServiceProvider`) dibuang total. Backend (infra + service + notification classes + trigger) dikerjakan dan diverifikasi test dulu sebelum frontend (`Notifications.jsx`), karena frontend bergantung pada kontrak endpoint `GET/POST /notifications*`.

## Tasks

- [ ] 1. Bersihkan infrastruktur lama dan siapkan fondasi
  - [x] 1.1 Hapus `app/Channels/DatabaseChannel.php`, `app/Channels/MyMailChannel.php`, `app/Notifications/BaseNotification.php`
    - Verifikasi dulu via grep: `MyMailChannel`/`DatabaseChannel`/`BaseNotification` tidak di-reference file manapun selain dirinya sendiri dan `AppServiceProvider` — aman dihapus
    - **Catatan penting**: `App\Jobs\SendEmailNotificationJob` (beda dari `MyMailChannel`) TIDAK dihapus — masih dipakai `EmailTemplateController::testSend()` (spec 1, fitur Test Send). Task ini hanya scope 3 file yang eksplisit disebut requirement
    - Hapus import dan 2 baris binding `$this->app->instance(...)` di `app/Providers/AppServiceProvider.php`
    - `php -l app/Providers/AppServiceProvider.php` → no syntax errors
    - _Requirements: 1.2_

  - [x] 1.2 Buat migration tabel `notifications` standar
    - `php artisan notifications:table` → `database/migrations/2026_07_17_021651_create_notifications_table.php`, skema standar Laravel (uuid, type, morphs notifiable, data, read_at, timestamps) tanpa modifikasi
    - _Requirements: 1.1_

  - [x] 1.3 Pasang broadcasting — **awalnya Laravel Reverb, diganti Pusher pasca-task-18** (lihat catatan design.md)
    - Riwayat awal: `composer require laravel/reverb` → terinstall (`laravel/reverb v1.10.2`, `pusher/pusher-php-server` sebagai protocol dependency, TAPI gagal ter-download 3x berturut-turut karena permission error di lingkungan lokal). `php artisan install:broadcasting --reverb --no-interaction` (flag `--reverb` WAJIB — tanpa itu command coba `Laravel\Prompts\select()` yang gagal di mode non-interaktif meski `--no-interaction` dipasang) → publish `config/broadcasting.php`, `routes/channels.php`; **echo config otomatis TIDAK jalan** karena command mencari `resources/js/app.tsx` (project ini pakai `.jsx`, bukan TypeScript) — setup manual dilakukan
    - `laravel-echo`+`pusher-js` terinstall via npm (bagian dari command yang sama, TETAP DIPAKAI — package ini generik protokol Pusher, dipakai baik untuk Reverb maupun Pusher asli)
    - **Migrasi ke Pusher**: setelah ditemukan target deploy shared hosting tidak mendukung proses daemon Reverb, `composer update laravel/reverb pusher/pusher-php-server` (hapus Reverb, install `pusher/pusher-php-server` LANGSUNG sebagai dependency, bukan transitive) — kali ini BERHASIL tanpa error permission sama sekali (kemungkinan file lock sementara di attempt2 sebelumnya sudah reda). `config/broadcasting.php` block `reverb` dihapus. `resources/js/echo.js` ditulis ulang: `broadcaster: "pusher"`, `key`+`cluster` (bukan `wsHost`/`wsPort`)
    - `.env`/`.env.example`: `REVERB_APP_ID/KEY/SECRET/HOST/PORT/SCHEME` diganti `PUSHER_APP_ID/KEY/SECRET/CLUSTER`, `VITE_REVERB_*` diganti `VITE_PUSHER_APP_KEY`/`VITE_PUSHER_APP_CLUSTER`. `.env` (lokal) diisi kredensial Pusher asli dari user; `.env.example` tetap placeholder
    - Authorization callback `routes/channels.php`: template default pakai `(int) $user->id === (int) $id` — **diperbaiki ke `(string)`** karena `User` model pakai `HasUlids` (primary key ULID string, bukan integer auto-increment). TIDAK terpengaruh migrasi Pusher — channel logic sama sekali tidak bergantung driver broadcasting
    - `npx eslint resources/js/echo.js resources/js/bootstrap.js` → 0 error, 0 warning (diverifikasi ulang pasca-migrasi Pusher juga)
    - `php artisan config:clear` pasca-migrasi → sukses, konfirmasi driver `pusher` resolve tanpa error
    - _Requirements: 1.4, 1.5_

  - [x] 1.4 Jalankan migration, verifikasi tabel `notifications` dan config broadcasting siap
    - **Root cause ditemukan**: `vendor/pusher/pusher-php-server` gagal ter-download 3x berturut-turut (`composer install`/`require` selalu `Failed to open stream: Permission denied` saat menulis `vendor/composer/tmp-*.zip` — pola konsisten Windows Defender/antivirus real-time scan mengunci file sesaat setelah ditulis). Setiap `php artisan` APAPUN (bahkan `config:clear`) ikut gagal — bukan spesifik migrate/test — karena `routes/channels.php` berisi `Broadcast::channel(...)`, dan `Broadcast` facade (extends `Manager` Laravel) **selalu eager-resolve driver default** begitu method apa pun dipanggil di atasnya; `bootstrap/app.php:33` (`withRouting(channels: ...)`) meng-require file itu di callback `booted()` untuk SEMUA command, bukan cuma request HTTP. Diverifikasi via isolasi: rename sementara `channels.php` → `config:clear` langsung sukses, mengonfirmasi bukan bug Clockwork/kode lain
    - **Solusi sementara**: `BROADCAST_CONNECTION` di `.env` diubah dari `reverb` ke `log` — driver `log` tidak butuh `Pusher\Pusher` sama sekali, jadi `Broadcast::channel()` resolve tanpa error. Ini TIDAK mengubah kode manapun (routes/channels.php, config/broadcasting.php tetap seperti final design), murni env var. **Wajib diganti balik ke `reverb` setelah `pusher/pusher-php-server` berhasil terinstall** (composer install manual oleh user, atau nonaktifkan sementara antivirus real-time protection untuk folder project)
    - `php artisan migrate --no-interaction` → `2026_07_17_021651_create_notifications_table` migrated sukses (165ms)
    - _Requirements: 1.1, 1.4_

- [x] 2. Checkpoint - Ensure fondasi siap (tidak ada test otomatis di sini, verifikasi manual: migration jalan, tidak ada reference ke class yang dihapus)
  - Migration `notifications` jalan sukses. `grep` konfirmasi tidak ada reference ke `DatabaseChannel`/`MyMailChannel`/`BaseNotification` di `app/` selain dirinya sendiri (sudah dihapus). Catatan: instalasi Reverb belum 100% tuntas (`pusher/pusher-php-server` masih hilang di vendor, `BROADCAST_CONNECTION` sementara `log` bukan `reverb`) — lihat detail di task 1.3/1.4

- [ ] 3. Service dan Job pengiriman notifikasi
  - [x] 3.1 Buat `App\Services\Core\Notification\NotifyUser`
    - Method `send($notifiable, Notification $notification)`: hitung irisan `via($notifiable)` dengan `['database', 'broadcast']`, panggil `Notification::sendNow()` HANYA kalau irisan tidak kosong; kalau `'mail'` ada di `via()`, dispatch `SendNotificationMailJob`
    - `php -l` bersih
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.2 Buat `App\Jobs\Core\Notification\SendNotificationMailJob`
    - Constructor terima `$notifiable`, `Notification $notification` (bukan primitif — keduanya serializable lewat `SerializesModels`, beda dari `SendEmailWithPdfJob` yang serialize primitif karena notifiable-nya dulu objek anonim)
    - `handle()`: `Notification::sendNow($this->notifiable, $this->notification, ['mail'])`
    - `failed(Throwable $e)`: `Log::error()` dengan konteks (class notification, notifiable type+id, pesan error) — TIDAK menyentuh tabel `notifications` sama sekali (Correctness Property 2)
    - `php -l` bersih
    - _Requirements: 2.2, 2.4, 2.5_

  - [x] 3.3 Write unit test `NotifyUserTest`
    - Test: notification dengan `via()` `['database','broadcast','mail']` → `sendNow` terpanggil dengan `['database','broadcast']`, job ter-dispatch ke queue (`Queue::fake()`)
    - Test: notification `via()` mail-only (`['mail']`) → `sendNow(['database','broadcast'])` TIDAK terpanggil (assert tidak ada record `notifications` tersimpan), job tetap ter-dispatch
    - Test: notification `via()` `['database','broadcast']` tanpa mail → job TIDAK ter-dispatch
    - **Pakai `RefreshDatabase`** (beda dari pola stub-model manual di spec sebelumnya) — notifiable-nya `User` model asli via factory, butuh tabel `users`+`notifications` lengkap dari migration; base `TestCase` project ini tidak punya `RefreshDatabase` default, jadi trait ditambah eksplisit di file test ini
    - **Sempat ke-blok masalah environment yang sama dengan task 1.4** (`Broadcast::channel()` eager-resolve `Pusher\Pusher` yang belum terinstall) — teratasi otomatis begitu `BROADCAST_CONNECTION=log` diset di task 1.4
    - `tests/Unit/Core/Notification/NotifyUserTest.php` → 3 passed (6 assertions)
    - **Validates: Requirements 2.1, 2.2, 2.3**

  - [x] 3.4 Write feature test `SendNotificationMailJobTest`
    - Test: job `handle()` dipanggil langsung → email terkirim (`Notification::fake()` + `assertSentTo`)
    - Test: `toMail()` melempar exception → ditangkap manual (simulasi queue worker) lalu `failed()` dipanggil eksplisit, `Log::spy()` verifikasi pesan+konteks tercatat, `assertDatabaseMissing` konfirmasi tabel `notifications` tidak tersentuh
    - `tests/Feature/Core/Notification/SendNotificationMailJobTest.php` → 2 passed (3 assertions)
    - **Validates: Requirements 2.4, 2.5**

- [x] 4. Checkpoint - Ensure Service dan Job tests pass
  - `php artisan test --compact` (path eksplisit kedua file, filter regex `|` bermasalah di PowerShell) → 5 passed (9 assertions)

- [x] 5. Notification classes
  - [x] 5.1 Buat `App\Notifications\ApprovalDecidedNotification`
    - Constructor: `ApprovalInstance $approval`, `string $decision` ('approved'|'rejected'), `?string $notes = null`
    - `via()`: `['database', 'broadcast', 'mail']`
    - `toArray()`/`toDatabase()`: `title`, `message`, `documentType`, `documentId`, `notes`
    - `toMail()`: `MailMessage` sederhana, subjek sesuai decision
    - `toBroadcast()`: `BroadcastMessage` dengan payload sama seperti `toArray()`
    - **`broadcastOn()` TIDAK di-override** (beda dari rencana awal design.md) — lihat catatan design pada task 6
    - _Requirements: 3.1, 3.2, 3.5_

  - [x] 5.2 Buat `App\Notifications\ApprovalPendingNotification`
    - Constructor: `ApprovalInstanceStep $step`
    - Pola channel/broadcast sama seperti 5.1
    - _Requirements: 3.3, 3.4, 3.5_

  - [x] 5.3 Buat `App\Notifications\ApprovalCanceledNotification`
    - Constructor: `ApprovalInstance $approval`, `array $canceledStepSequences`
    - _Requirements: 3.7_

  - [x] 5.4 Buat `App\Notifications\DocumentSubmittedNotification`
    - Constructor: `Model $document`, `string $role`
    - Payload menyertakan kode/nomor, nama, pembuat dokumen
    - _Requirements: 4.2, 4.3_

  - [x] 5.5 Buat `App\Notifications\UserInvitedNotification`
    - `via()`: HANYA `['mail']` (Requirement 5.3 — tanpa database/broadcast)
    - `toMail()`: tautan ke `/setup` (route existing `SetupUserController`)
    - _Requirements: 5.1, 5.3_

  - [x] 5.6 Tambah translation keys terkait
    - **Temuan arsitektur penting**: `__()` backend PHP di project ini HANYA resolve file lang di ROOT (`lang/{locale}/*.php`), sesuai parsing `group`/`item` standar Laravel (`NamespacedItemResolver::parseBasicSegments()` — segmen pertama key selalu jadi nama FILE, bukan folder). Pola `lang/{locale}/core/*.php` yang dipakai luas di project (`core.emailTemplate.xxx`, `core.approvalInstance.xxx`, dst) TERNYATA tidak pernah resolve lewat translator backend Laravel — diverifikasi langsung: `app('translator')->has('core.errors.fetch_failed')` return `false` meski filenya ada dan valid. Raw key itu "aman" di controller karena SELALU dikirim ke Inertia→React, dan translasi sesungguhnya terjadi di frontend (Vite plugin `laravel-react-i18n/vite` baca file PHP lang langsung saat build, terlepas dari mekanisme translator backend). Notification (email + payload database) TIDAK PERNAH lewat React — kalau tetap pakai `core.notification.xxx`, user terima email berisi raw key mentah
    - **Fix**: file dipindah dari `lang/{id,en}/core/notification.php` ke `lang/{id,en}/notification.php` (ROOT, bukan subfolder) — key jadi `notification.xxx` (bukan `core.notification.xxx`), yang cocok dengan parsing `group='notification'` standar Laravel dan benar-benar resolve via `__()` backend
    - Semua 5 Notification class disesuaikan pakai key `notification.xxx`
    - _Requirements: 3.1, 3.2, 4.3, 5.1_

  - [x] 5.7 Write unit test `NotificationClassesTest` (satu file gabungan)
    - Test: `toArray()` mengandung field yang diharapkan (termasuk translasi ter-resolve, bukan raw key); `via()` return channel yang benar; `toBroadcast()` menghasilkan `BroadcastMessage` valid; broadcast channel privat diverifikasi di level event `BroadcastNotificationCreated::broadcastOn()` (channel `'private-App.Models.User.User.{id}'` — nama auto-derive dari FQCN `App\Models\User\User`, BUKAN `App.Models.User.{id}` yang diasumsikan design.md awal, lihat task 6)
    - `tests/Unit/Notifications/NotificationClassesTest.php` → 6 passed (19 assertions)
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.7, 4.2, 4.3, 5.1, 5.3**

- [x] 6. Checkpoint - Ensure Notification classes tests pass
  - `php artisan test --compact` (3 file grup 3+5 sekaligus, path eksplisit) → 11 passed (28 assertions)

- [ ] 7. Trigger: Approval (approve/reject/pending/cancel)
  - [x] 7.3 Buat helper resolusi approver kandidat → Collection User
    - `ApprovalInstanceStep::resolveCandidateUsers(): Collection` (method baru di model yang sama dengan `approverCandidates()`, konsisten pola existing)
    - Resolve `approver_type === 'user'` via `User::whereIn('id', $userIds)->get()` (batch, bukan `find()` per-item), `approver_type === 'role'` via `User::whereHas('roles', fn($q) => $q->whereIn('roles.id', $roleIds))->get()` (batch juga), gabung `merge()->unique('id')->values()`
    - `php -l` bersih
    - _Requirements: 3.3, 3.4_

  - [x] 7.1 Sisipkan notifikasi di `ApprovalInstanceController::approve()`
    - Tangkap `$nextPending` step di dalam loop (variable baru, sebelumnya cuma dipakai lokal dalam `foreach`) supaya bisa dipakai setelah loop selesai
    - Setelah `AttachGeneratedPdfJob::dispatch($approval)`: `$creator = $approval->document?->createdBy` (null-safe, dokumen morphTo bisa null kalau soft-deleted), kirim `ApprovalDecidedNotification($approval, 'approved')` — HANYA saat `$isApproved` true
    - Kalau belum step terakhir: `$nextPending->resolveCandidateUsers()`, kirim `ApprovalPendingNotification($nextPending)` ke SELURUH candidates sekaligus (`NotifyUser::send()` terima Collection, bukan loop manual per-user)
    - TIDAK mengubah urutan/perilaku existing (`onApproved()` callback, `AttachGeneratedPdfJob`) — notifikasi disisipkan SETELAH `DB::commit()`/dispatch job PDF, sebelum `return`
    - _Requirements: 3.1, 3.4, 3.6_

  - [x] 7.2 Sisipkan notifikasi di `ApprovalInstanceController::reject()`
    - Setelah `DB::commit()`, sebelum `callWithRouteModels(..., 'onRejected', ...)`: `$creator = $approval->document?->createdBy`, kirim `ApprovalDecidedNotification($approval, 'rejected', $notes)`
    - _Requirements: 3.2, 3.6_

  - [x] 7.4 Sisipkan notifikasi di `ApprovalInstance::makeInstance()` — step pertama PENDING
    - Setelah `DB::commit()` (di luar transaksi, konsisten pola 7.1/7.2): kalau `$instance->wasRecentlyCreated`, query ulang step `sequence=0` — kalau statusnya masih `PENDING` (BUKAN sudah di-auto-approve oleh `runAutoApprovePass` yang jalan sebelum commit), kirim `ApprovalPendingNotification` ke `resolveCandidateUsers()`-nya
    - _Requirements: 3.3_

  - [x] 7.5 Sisip notifikasi cancel — **keputusan desain berubah dari rencana awal (Observer terpisah)**: `app/Traits/Submitable.php::bootSubmitable()` SUDAH punya listener `saving()` yang menghandle transisi `FormStatus::CANCELED` (baris 77-85, existing) — ini Eloquent boot hook global yang otomatis aktif di SEMUA 11 model submitable (`SalesOrder`, `PurchaseOrder`, dst) TANPA registrasi manual per-model. Membuat Observer class terpisah + registrasi manual akan menduplikasi mekanisme yang sudah ada
    - Listener `saved()` BARU ditambahkan (sejajar `creating`/`saving`, didaftarkan SEKALI di `bootSubmitable()` — bukan nested di dalam listener lain, itu bug yang sempat ditulis lalu diperbaiki: nested registration bikin listener menumpuk tiap kali model manapun di-save)
    - Kondisi cek `$model->wasChanged('status')` DAN `in_array(FormStatus::CANCELED, $model->status)` di dalam closure `saved()` — notifikasi hanya terkirim setelah save() SUKSES (bukan di `saving()`, supaya save yang gagal tidak mengirim notifikasi)
    - `$model->approvalable` (relasi `morphOne` existing) → `$approval->steps->whereIn('status', [PENDING, WAITING])` → `flatMap(resolveCandidateUsers())->unique('id')` → kirim `ApprovalCanceledNotification`
    - TIDAK melakukan cascade update status step (di luar scope, lihat Requirement 3.9) — murni baca status apa adanya
    - _Requirements: 3.7, 3.9, 3.10_

  - [x] 7.6 ~~Daftarkan observer~~ — **tidak diperlukan**, lihat 7.5. `bootSubmitable()` otomatis dipanggil Laravel untuk semua model yang `use Submitable` (konvensi `boot{TraitName}()`), sudah aktif tanpa langkah registrasi tambahan
    - _Requirements: 3.7_

  - [x] 7.7 Write feature test `ApprovalNotificationTest`
    - Model stub `ApprovalNotificationTestDocument` (baru, `use HasUlids, Submitable` — beda dari `PdfAttachTestDocument` di test lama yang BUKAN `Submitable`, sengaja dibuat baru supaya listener `saved()` cancel di task 7.5 bisa dites) + controller stub, pola persis `ApprovalPdfAutoAttachTest` (helper `makeUser`/`makeRole`/`assignRole`/`makeScheme`/`makeDocument`)
    - Test: approve step terakhir → `createdBy` dapat `ApprovalDecidedNotification` (database record via `Notification::fake()` + job mail ter-dispatch)
    - Test: approve step menengah (skema 2 step) → KEDUA user role step berikutnya dapat `ApprovalPendingNotification` (bukan cuma satu), `createdBy` BELUM dapat `ApprovalDecidedNotification`
    - Test: reject → `createdBy` dapat notifikasi dengan `notes` tersimpan di payload
    - Test: auto-approved (requester sendiri approver step 0) → TIDAK ada `ApprovalPendingNotification`/apa pun terkirim ke creator
    - Test: cancel dokumen dengan approval `PENDING` → approver kandidat step itu dapat `ApprovalCanceledNotification`
    - Test: cancel dokumen SETELAH full-approved → `Notification::fake()` di-reset lalu assert `assertNothingSent()` (tidak ada notifikasi baru)
    - **Bug ditemukan & diperbaiki (di test sendiri, bukan kode aplikasi)**: alias import salah `use Illuminate\Notifications\Notification as NotificationFacade` (class dasar, tanpa method `fake()` statis) — seharusnya `Illuminate\Support\Facades\Notification`. Root cause kegagalan awal "Call to undefined method Notification::fake()"
    - **Skema tabel tambahan dari SQLite in-memory shared** (pola familiar dari sesi sebelumnya): tabel test butuh kolom `is_example` di `approval_notification_test_documents` (dibaca `HasExampleData` scope), DAN di `general_ledgers`/`stock_ledger_entries` (dibaca `bootSubmitable()`'s existing cancel-handling code saat soft-delete GL/SLE terkait)
    - `tests/Feature/Core/Notification/ApprovalNotificationTest.php` → 6 passed (14 assertions)
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.6, 3.7**

- [x] 8. Checkpoint - Ensure Approval trigger tests pass
  - `php artisan test --compact tests/Feature/Core/Notification/ApprovalNotificationTest.php` → 6 passed (14 assertions)

- [x] 9. Trigger: Role-based document notification
  - [x] 9.1 Tambah `notifyRolesOnStatus()` di `Submitable` trait
    - **Berubah dari rencana awal (static property) ke static METHOD**: `protected static function notifyRolesOnStatus(): array` — PHP fatal error kalau static property trait di-override langsung dengan value beda di class pemakai ("definition differs"), method tidak kena batasan ini. Key return array = status VALUE (string, mis. `'submitted'`), value = array nama role. Default kosong (opt-in per model)
    - Contoh konfigurasi nyata ditunda ke task 9.4 (dalam test, bukan production model) — model produksi mana yang butuh role-based notification dan role apa persisnya adalah keputusan bisnis di luar scope spec ini untuk ditentukan; infrastrukturnya siap dipakai
    - _Requirements: 4.1_

  - [x] 9.2 Sisip listener `saved()` role-based — **konsisten keputusan desain 7.5**: di `bootSubmitable()` yang sama (bukan Observer terpisah)
    - Iterasi `$model->status` (array `FormStatus[]` dari `FormStatusesCast`), kumpulkan role dari `static::$notifyRolesOnStatus[$statusValue->value]` untuk tiap status aktif, dedupe dengan `array_unique`
    - Kalau ada role terkonfigurasi: `User::whereHas('roles', fn($q) => $q->whereIn('name', $roles))->get()`, kirim `DocumentSubmittedNotification` ke SEMUA hasilnya sekaligus (bukan loop manual)
    - _Requirements: 4.2_

  - [x] 9.3 ~~Daftarkan observer~~ — **tidak diperlukan**, sama alasan dengan 7.6 (`bootSubmitable()` otomatis aktif)
    - _Requirements: 4.2_

  - [x] 9.4 Write feature test `RoleBasedNotificationTest`
    - Model stub `RoleBasedTestDocument` (override `notifyRolesOnStatus()`) dan `RoleBasedTestDocumentUnconfigured` (tidak override — pakai default kosong dari trait), sama tabel `role_based_test_documents`
    - **Bug PHP ditemukan & diperbaiki**: static property trait TIDAK BISA di-override langsung di class pemakai dengan value berbeda (fatal error "definition differs in composition") — root cause task 9.1 diubah dari property jadi method
    - Test: dokumen model yang dikonfigurasi transisi ke status yang relevan → KEDUA user role terkait dapat notifikasi, user role lain TIDAK dapat
    - Test: model TIDAK dikonfigurasi (`notifyRolesOnStatus()` default kosong) → `Notification::assertNothingSent()`
    - Test: role dikonfigurasi tapi tidak ada user dengan role tsb → `Notification::assertNothingSent()`, tidak ada exception (Requirement 4.4)
    - `tests/Feature/Core/Notification/RoleBasedNotificationTest.php` → 3 passed (5 assertions)
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

- [x] 10. Checkpoint - Ensure Role-based trigger tests pass
  - `php artisan test --compact tests/Feature/Core/Notification/RoleBasedNotificationTest.php` → 3 passed (5 assertions)

- [ ] 11. Trigger: Invite user
  - [x] 11.1 Sisip listener di `App\Models\User\User` langsung — **bukan Observer/trait terpisah**: `User` bukan `Submitable` dan cuma SATU model yang butuh ini, abstraksi trait tidak perlu
    - `protected static function booted(): void` (bukan override `boot()` — tidak butuh `parent::boot()` manual, menghindari risiko lupa panggil parent yang bisa mematikan trait lain seperti `HasUlids`)
    - **Berubah dari rencana awal (satu listener `saved()` + `wasChanged()`) ke DUA listener terpisah**: `static::created()` (cek `$user->status === FormStatus::INVITED` langsung, TANPA `wasChanged()`) dan `static::updated()` (`wasChanged('status') && status === INVITED`). **Bug ditemukan**: `wasChanged('status')` TIDAK reliable `true` untuk model yang baru dibuat via factory di project ini — root cause pasti belum ditelusuri sampai tuntas (kemungkinan terkait `FormStatusCast` custom comparison instance enum), tapi perilaku `created()`/`updated()` Eloquent standar (bukan bergantung `wasChanged` untuk create) terbukti reliable dan lebih eksplisit secara intent
    - `php -l` bersih
    - _Requirements: 5.1, 5.2_

  - [x] 11.2 ~~Daftarkan observer~~ — **tidak diperlukan**, `booted()` Eloquent otomatis terpanggil
    - _Requirements: 5.1_

  - [x] 11.3 Write feature test `UserInvitedNotificationTest`
    - Test: user baru dibuat dengan status `INVITED` → `UserInvitedNotification` terkirim, `via()` HANYA `['mail']` (tanpa `database`/`broadcast`, Requirement 5.3)
    - Test: user existing (`PRE_REGISTERED`) diupdate jadi `INVITED` → `assertNothingSent()` sebelum update, `assertSentToTimes(..., 1)` setelah
    - Test: user yang SUDAH `INVITED` diupdate lagi (field `name` berubah, status tetap `INVITED`) → tetap `assertSentToTimes(..., 1)` (bukan 2) — inilah yang mengonfirmasi bug `wasRecentlyCreated` di percobaan pertama (instance PHP yang sama tetap `wasRecentlyCreated=true` setelah `update()` berikutnya pada objek yang sama, bukan cuma di re-fetch — pendekatan itu dibuang, diganti `created()`/`updated()` terpisah)
    - `tests/Feature/Core/Notification/UserInvitedNotificationTest.php` → 3 passed (5 assertions)
    - **Validates: Requirements 5.1, 5.2, 5.3**

- [x] 12. Checkpoint - Ensure Invite user trigger tests pass
  - `php artisan test --compact tests/Feature/Core/Notification/UserInvitedNotificationTest.php` → 3 passed (5 assertions)

- [x] 13. Reset password — konsistensi visual (opsional secara fungsional)
  - [x] 13.1 ~~Override tampilan email `ResetPassword`~~ — **tidak diperlukan, sudah konsisten by default**: diverifikasi tidak ada `resources/views/vendor/mail/` custom theme di project ini, dan `ResetPassword` bawaan Laravel sudah pakai `MailMessage` (theme default framework) — SAMA PERSIS dengan yang dipakai semua Notification class baru di spec ini (`ApprovalDecidedNotification`, dst, semua `toMail()` return `MailMessage` polos tanpa view custom). Tidak ada perbedaan visual untuk diselaraskan; `Password::sendResetLink()` tetap tidak disentuh
    - _Requirements: 6.1, 6.2_

  - [x] 13.2 ~~Write test link reset password tetap valid~~ — **tidak diperlukan**, tidak ada perubahan kode di alur reset password (task 13.1 murni verifikasi, bukan implementasi)
    - **Validates: Requirements 6.1, 6.2**

- [ ] 14. Backend endpoint untuk panel notifikasi
  - [x] 14.1 Buat `App\Http\Controllers\Core\NotificationController` dengan method `index()`, `markAsRead()`, `markAllAsRead()`
    - `__construct()`: `$this->ignorePermission = true`, `parent::__construct($request)` TANPA model class (pola sama `ApprovalInstanceController`) — endpoint berlaku universal untuk user login mana pun, tidak terikat permission per-model
    - `index()`: `$user->notifications()->latest()->limit(20)->get()` + `unread_count` dari `$user->unreadNotifications()->count()`
    - `markAsRead($id)`: `$user->notifications()->where('id', $id)->firstOrFail()->markAsRead()`, return `documentType`/`documentId` MENTAH dari payload (BUKAN resolve ke URL Ziggy di backend — resolusi URL final tetap di frontend, sesuai design.md; `markAsRead()` Laravel idempotent, aman dipanggil berulang)
    - `markAllAsRead()`: `$user->unreadNotifications->markAsRead()`
    - `php -l` bersih
    - _Requirements: 7.4, 7.5, 7.6_

  - [x] 14.2 Daftarkan routes: `GET /notifications`, `POST /notifications/{id}/read`, `POST /notifications/read-all`
    - `notifications.index`, `notifications.read`, `notifications.readAll` di `routes/web.php`, sejajar grup `approvalInstances`
    - **Perbaikan desain di checkpoint 18**: 3 route ini dibungkus `Route::withoutMiddleware([HandleInertiaRequests::class])->group(...)` — konsisten pola existing untuk endpoint JSON murni lain di file yang sama (`saved-filters`, `api/html/sanitize`, `commands/search`). Endpoint ini dipanggil dari dalam Popover (axios), bukan navigasi Inertia, jadi tidak butuh Inertia sharing sama sekali — menghindari `resolveSharedUserRoleIds()` dkk yang tidak relevan
    - _Requirements: 7.4, 7.5, 7.6_

  - [x] 14.3 Share `unread_notifications_count` lewat middleware Inertia (pola sama `unread_changelogs_count`)
    - `app/Http/Middleware/HandleInertiaRequests.php`: `fn () => $user ? $user->unreadNotifications()->count() : 0`
    - _Requirements: 7.2_

  - [x] 14.4 Write feature test `NotificationControllerTest`
    - Test: `index()` return notifikasi milik user login saja (bukan user lain)
    - Test: `markAsRead()` mengisi `read_at`, tidak mempengaruhi notifikasi user lain
    - Test: `markAsRead()` TIDAK bisa target notifikasi user lain (404, IDOR check)
    - Test: `markAllAsRead()` menandai SEMUA notifikasi user tersebut
    - **Workaround awal (kolom `roles.is_example`) DICABUT** setelah task 14.2 diperbaiki — begitu route tidak lagi lewat `HandleInertiaRequests`, `resolveSharedUserRoleIds()` tidak pernah terpanggil di test ini, workaround jadi tidak perlu
    - `tests/Feature/Core/Notification/NotificationControllerTest.php` → 4 passed (11 assertions)
    - **Validates: Requirements 7.2, 7.4, 7.5, 7.6**

- [x] 15. Checkpoint - Ensure backend endpoint tests pass (checkpoint besar — seluruh backend spec ini)
  - `php artisan test --compact` pada 7 file test spec ini sekaligus (path eksplisit) → **27 passed (63 assertions)**

- [x] 16. Frontend: isi ulang `Notifications.jsx`
  - [x] 16.1 Hapus `return null` dan JSX placeholder statis di `resources/js/Components/Navbar/Notifications.jsx`
    - Fetch via `GET notifications.index` di `useEffect` yang dependency-nya `[open]` — cuma jalan saat Popover dibuka, bukan saat mount
    - Badge count: `useState` di-seed dari `unread_notifications_count` shared prop (sync via `useEffect` kalau prop berubah — misal navigasi Inertia lain memperbarui count), lalu di-update lokal oleh mark-as-read/mark-all/event realtime
    - `npx eslint`: 0 error, 0 warning (setelah fix 1 JSDoc mismatch — `@param` menyebut prop yang tidak pernah diterima komponen, dihapus)
    - _Requirements: 7.1, 7.2, 7.4, 7.7_

  - [x] 16.2 Subscribe channel privat Echo untuk update realtime
    - `window.Echo.private('App.Models.User.User.${user.id}')` — **channel name disesuaikan** dari asumsi awal `App.Models.User.{id}` ke `App.Models.User.User.{id}` (konsisten dengan keputusan task 5, FQCN `User` model adalah `App\Models\User\User`)
    - `channel.notification((n) => {...})`, prepend ke state + increment unread count, `.slice(0, 20)` jaga batas list
    - Unsubscribe via `window.Echo.leave(...)` di cleanup `useEffect`
    - _Requirements: 7.3_

  - [x] 16.3 Wire klik notifikasi → `POST notifications.read`, lalu `router.visit(url)` kalau ada tautan
    - Resolusi URL via `DOCUMENT_TYPE_ROUTE_MAP` (mapping FQCN backend → nama route plural Ziggy) — sengaja kosong secara default, model yang butuh notifikasi dengan tautan dokumen ditambahkan satu baris di sini tanpa ubah backend. Kalau mapping tidak ada, notifikasi tetap tertandai dibaca tapi tidak navigasi (fallback aman)
    - _Requirements: 7.5_

  - [x] 16.4 Wire tombol "Mark all as read" → `POST notifications.readAll`
    - Tombol disabled saat `unreadCount === 0`
    - _Requirements: 7.6_

  - [x] 16.5 Empty state saat belum ada notifikasi (ganti pesan "Under Development")
    - _Requirements: 7.7_

  - [x] 16.6 ~~Write component test~~ — **dikonfirmasi ulang, masih sama seperti spec sebelumnya**: `@testing-library/react` tidak tersedia di project ini. Diverifikasi manual di checkpoint browser (task 17)
    - **Validates: Requirements 7.1-7.7**

  - **Bug pre-existing ditemukan (di luar scope, TIDAK diperbaiki)**: `tests/Feature/LocaleKeysTest.php::flattenArrayKeys()`'s `str_replace()` membandingkan path pakai forward slash (`/`) terhadap `File::getRealPath()` yang di Windows return backslash (`\`) — replace gagal match, `$relativePath` jadi full absolute path bukan relative key, bikin SEMUA key (bukan cuma `notification.*` yang baru) dianggap "missing" saat test dijalankan di Windows. Murni platform-dependent, sudah ada jauh sebelum spec ini (commit `9b7678b`), tidak disentuh

- [ ] 17. Checkpoint - Manual browser verification
  - **Prasyarat berubah pasca-migrasi Pusher** (lihat design.md): cukup `npm run dev`/`composer run dev` + queue worker (`php artisan queue:listen`) — TIDAK PERLU proses ketiga `reverb:start` lagi, Pusher adalah layanan eksternal
  - Skenario: approve dokumen multi-step → cek approver step berikutnya dapat notifikasi realtime (buka 2 browser/sesi user berbeda); reject → cek creator dapat notifikasi; cancel dokumen dengan approval berjalan → cek approver dapat notifikasi "dibatalkan"; buat user baru berstatus INVITED → cek email masuk (tanpa notifikasi in-app); role-based submit → cek semua user role terkait dapat notifikasi; klik notifikasi → tertandai dibaca dan navigasi ke dokumen; mark all as read → badge jadi nol
  - Laporkan hasil ke user — jangan klaim selesai tanpa observasi ini

- [x] 18. Final checkpoint - Ensure all tests pass
  - `vendor/bin/pint --dirty --format agent` → 12 file diformat ulang (semua minor: `class_definition`, `braces_position`, `ordered_imports`, `binary_operator_spaces`, dst — tidak ada perubahan logic, diverifikasi via diff tiap file)
  - Pint run menemukan celah desain di `routes/web.php`: route `notifications.*` sebelumnya lewat `HandleInertiaRequests` middleware standar (butuh workaround kolom `roles.is_example` di test) — **diperbaiki** jadi `Route::withoutMiddleware([HandleInertiaRequests::class])->group(...)`, konsisten pola existing untuk endpoint JSON murni (`saved-filters`, `api/html/sanitize`). Workaround test dicabut, 4 test `NotificationControllerTest` tetap pass tanpa itu
  - `php artisan test --compact` pada 7 file test spec ini (path eksplisit) → **27 passed (63 assertions)**, tidak ada regresi dari perbaikan routes
  - `npx eslint` pada `resources/js/Components/Navbar/Notifications.jsx`, `resources/js/echo.js`, `resources/js/bootstrap.js` → 0 error, 0 warning
  - Tidak ada test frontend baru (task 16.6 di-skip, `@testing-library/react` tidak tersedia) — tidak perlu `npx vitest run` tambahan untuk spec ini
  - **Bug pre-existing ditemukan, TIDAK diperbaiki (di luar scope)**: `tests/Feature/LocaleKeysTest.php` gagal di Windows karena `str_replace()` path separator mismatch (`/` vs `\`) — sudah ada sejak commit `9b7678b`, memengaruhi SEMUA file lang bukan cuma yang baru ditambah spec ini

## Notes

- Setiap task mereferensikan requirement dari `requirements.md` untuk traceability.
- Backend (group 1, 3, 5, 7, 9, 11, 13, 14) diverifikasi penuh sebelum frontend (group 16) mulai — endpoint `/notifications*` harus stabil dulu karena frontend bergantung pada kontrak response-nya.
- Task 7.5/7.6 dan 9.2/9.3 sengaja disebut "evaluasi saat implementasi" untuk kemungkinan digabung jadi satu observer generik — keputusan teknis final diambil saat coding berdasarkan seberapa mirip logic-nya, dicatat di task tersebut saat selesai.
- Task 13 (reset password visual) ditandai **optional** — murni konsistensi tampilan, bukan syarat fungsional (Requirement 6.2 pakai `MAY` bukan `SHALL`). Tanyakan ke user saat mulai implementasi apakah mau dikerjakan.
- Task 16.6 (component test frontend) kondisional pada ketersediaan infra render-testing — kemungkinan besar tetap tidak tersedia (sama seperti temuan spec `email-template-trigger`), cek ulang saat implementasi jangan asumsikan.
- Task 17 butuh TIGA proses berjalan bersamaan (dev server, queue worker, Reverb server) — lebih kompleks dari checkpoint manual spec sebelumnya, pastikan didokumentasikan jelas ke user caranya.
- Gap cascade-cancel (`{Model}Service::cancel()` tidak mengubah status `ApprovalInstanceStep`) TIDAK diperbaiki di spec ini (lihat Requirement 3.9) — task 7.5 sengaja membaca status step apa adanya, tidak mengasumsikan step ikut berubah status.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["1.4"] },
    { "id": 2, "tasks": ["2"] },
    { "id": 3, "tasks": ["3.1", "3.2"] },
    { "id": 4, "tasks": ["3.3", "3.4"] },
    { "id": 5, "tasks": ["4"] },
    { "id": 6, "tasks": ["5.1", "5.2", "5.3", "5.4", "5.5", "5.6"] },
    { "id": 7, "tasks": ["5.7"] },
    { "id": 8, "tasks": ["6"] },
    { "id": 9, "tasks": ["7.3"] },
    { "id": 10, "tasks": ["7.1", "7.2", "7.4", "7.5"] },
    { "id": 11, "tasks": ["7.6"] },
    { "id": 12, "tasks": ["7.7"] },
    { "id": 13, "tasks": ["8"] },
    { "id": 14, "tasks": ["9.1"] },
    { "id": 15, "tasks": ["9.2"] },
    { "id": 16, "tasks": ["9.3"] },
    { "id": 17, "tasks": ["9.4"] },
    { "id": 18, "tasks": ["10"] },
    { "id": 19, "tasks": ["11.1"] },
    { "id": 20, "tasks": ["11.2"] },
    { "id": 21, "tasks": ["11.3"] },
    { "id": 22, "tasks": ["12"] },
    { "id": 23, "tasks": ["13.1"] },
    { "id": 24, "tasks": ["13.2"] },
    { "id": 25, "tasks": ["14.1"] },
    { "id": 26, "tasks": ["14.2", "14.3"] },
    { "id": 27, "tasks": ["14.4"] },
    { "id": 28, "tasks": ["15"] },
    { "id": 29, "tasks": ["16.1"] },
    { "id": 30, "tasks": ["16.2", "16.3", "16.4", "16.5"] },
    { "id": 31, "tasks": ["16.6"] },
    { "id": 32, "tasks": ["17"] },
    { "id": 33, "tasks": ["18"] }
  ]
}
```
