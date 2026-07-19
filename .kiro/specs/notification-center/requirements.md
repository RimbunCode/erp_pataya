# Requirements Document

## Introduction

Sistem ini belum punya kanal notifikasi terpusat. Tanda-tandanya sudah ada di berbagai tempat — `Notifications.jsx` di navbar cuma placeholder mati (`return null` sebelum kode Popover-nya), `app/Channels/DatabaseChannel.php`, `app/Channels/MyMailChannel.php`, dan `app/Notifications/BaseNotification.php` adalah hasil copy-paste tidak lengkap dari proyek lain (`journal-library`) yang mengasumsikan property (`subGate`, `link`) yang tidak relevan di ERP ini, dan `SendEmailNotificationJob` memakai pola `app(MailChannel::class)->send()` yang sudah terbukti tidak bisa di-`Notification::fake()` (ditemukan saat spec `email-template-trigger`).

Sementara itu titik-titik trigger yang butuh notifikasi sudah jelas ada di codebase: approval flow (`ApprovalInstanceController::approve()`/`reject()`) sudah punya pola queued side-effect (`AttachGeneratedPdfJob::dispatch($approval)`) yang bisa dicontoh, model dokumen submitable (`Submitable` trait) selalu tahu `created_by_id`, dan struktur role (`User::roles()`, `Role::users()`) sudah dipakai untuk resolve approver berdasarkan role.

Spec ini membangun **satu infrastruktur notifikasi terpusat** untuk dua channel: **in-app** (realtime, tersimpan di database, ditampilkan lewat bell icon yang sudah di-scaffold) dan **email** (async lewat queue, reuse pola `Notification::send()` yang sudah divalidasi di spec `email-template`/`email-template-trigger`). Kedua channel dipicu dari satu `Notification` class per event — bukan dua implementasi terpisah — supaya kondisi "kapan notifikasi ini terjadi" hanya didefinisikan sekali.

Cakupan trigger iterasi pertama: approve/reject dokumen, notifikasi role-based (dokumen baru masuk ke role tertentu, mis. Warehouse), auth (reset password — sudah aktif via Breeze, tinggal disatukan; invite user — belum ada sama sekali), dan pola umum lain yang lumrah di ERP (ERPNext/Odoo) yang applicable ke struktur data proyek ini.

Di luar scope: verifikasi email (`MustVerifyEmail` sengaja nonaktif, diabaikan per keputusan eksplisit), serta reuse `app/Channels/DatabaseChannel.php`/`MyMailChannel.php`/`BaseNotification.php` lama — ketiganya dibuang dan ditulis ulang generik tanpa asumsi domain journal-library.

## Glossary

- **Notification Center**: infrastruktur terpusat yang menangani pengiriman notifikasi lintas channel (in-app, email) dari satu definisi event.
- **In-app notification**: notifikasi yang tersimpan di tabel `notifications` (channel `database` bawaan Laravel) dan ditampilkan realtime lewat bell icon di navbar via broadcast (Laravel Reverb).
- **Trigger**: event dalam sistem yang menyebabkan notifikasi dikirim (mis. approval disetujui, dokumen baru masuk untuk role tertentu, user diundang).
- **Notifiable**: entitas penerima notifikasi — pada iterasi ini selalu `User` (model `Notifiable` bawaan Laravel), tidak ada penerima non-user seperti `AnonymousEmailNotifiable` di spec sebelumnya.
- **Channel**: cara pengiriman satu notifikasi — `database` (in-app, sinkron), `broadcast` (in-app realtime via Reverb, sinkron), `mail` (email, async lewat queue job).
- **Role-based notification**: notifikasi yang dikirim ke *semua* user yang memiliki role tertentu, bukan ke satu user spesifik.

## Requirements

### Requirement 1: Infrastruktur Notification Center dasar

**User Story:** Sebagai pengembang, saya ingin infrastruktur notifikasi dasar (tabel, channel, broadcasting) tersedia dan bersih dari sisa kode tidak relevan, sehingga setiap notification class baru bisa langsung dipakai tanpa menabrak asumsi yang salah.

#### Acceptance Criteria

1. THE system SHALL menyediakan tabel `notifications` standar Laravel (`id` UUID, `type`, `notifiable_type`, `notifiable_id`, `data` JSON, `read_at`, timestamps) melalui migration bawaan (`php artisan notifications:table`), tanpa kolom tambahan spesifik domain lain.
2. THE system SHALL menghapus `app/Channels/DatabaseChannel.php`, `app/Channels/MyMailChannel.php`, `app/Notifications/BaseNotification.php`, dan binding container terkait di `AppServiceProvider.php` (baris yang meng-override `Illuminate\Notifications\Channels\DatabaseChannel` dan `Illuminate\Notifications\Notification` secara global).
3. THE system SHALL menggunakan channel `database` bawaan Laravel (`Illuminate\Notifications\Channels\DatabaseChannel`) tanpa override, untuk in-app notification.
4. THE system SHALL memasang Laravel Reverb (`composer require laravel/reverb`, `php artisan install:broadcasting`) beserta `laravel-echo` dan `pusher-js` di frontend untuk mendukung channel `broadcast`.
5. WHEN sebuah Notification class mengimplementasikan channel `broadcast`, THE system SHALL mem-broadcast ke private channel milik user penerima (`App.Models.User.{id}` atau setara), bukan channel publik.
6. THE system SHALL memvalidasi bahwa setiap notification baru TIDAK menggunakan pola `app(MailChannel::class)->send()` manual (pola lama `SendEmailNotificationJob` yang terbukti tidak ter-capture `Notification::fake()`/`Mail::fake()`) — email SHALL selalu dikirim lewat `Notification::send()`/`$notifiable->notify()` standar.

### Requirement 2: Notifikasi multi-channel dengan delivery mode berbeda per channel

**User Story:** Sebagai pengguna, saya ingin notifikasi in-app muncul seketika tanpa menunggu antrian, sementara email boleh diproses di background, sehingga saya tidak merasa sistem lambat saat suatu aksi memicu banyak notifikasi sekaligus.

#### Acceptance Criteria

1. WHEN sebuah event memicu notifikasi ke satu atau lebih user, THE system SHALL menyimpan record `database` dan mem-broadcast `broadcast` secara sinkron (tidak lewat queue) pada request yang sama.
2. WHEN event yang sama juga mengharuskan pengiriman email, THE system SHALL memproses channel `mail` secara asynchronous lewat queue job — TIDAK memblokir response request yang memicu notifikasi.
3. THE system SHALL mencapai pemisahan ini TANPA membuat notification class implement `ShouldQueue` pada level class (karena itu meng-queue SEMUA channel termasuk `database`/`broadcast`), melainkan lewat mekanisme yang mengizinkan channel `mail` saja yang tertunda (mis. `Notification` non-`ShouldQueue` yang channel mail-nya sendiri dispatch job internal, mengikuti pola `MyMailChannel` lama tapi ditulis ulang generik tanpa dependency `subGate`/`link`).
4. IF pengiriman email pada channel `mail` gagal (mis. SMTP down), THEN THE system SHALL tetap mempertahankan notifikasi `database`/`broadcast` yang sudah terkirim — kegagalan email TIDAK membatalkan atau menghapus notifikasi in-app yang sudah tersimpan.
5. THE system SHALL mencatat kegagalan pengiriman email (job `failed()`) ke log, mengikuti pola `SendEmailWithPdfJob::failed()` di spec `email-template-trigger`.

### Requirement 3: Notifikasi approve/reject dokumen

**User Story:** Sebagai pembuat dokumen (mis. Sales Order), saya ingin diberi tahu saat dokumen saya disetujui atau ditolak, sehingga saya tidak perlu mengecek status secara manual berkala.

#### Acceptance Criteria

1. WHEN sebuah `ApprovalInstanceStep` di-approve melalui `ApprovalInstanceController::approve()` DAN seluruh step approval selesai (`ApprovalInstance.status` menjadi `APPROVED`), THE system SHALL mengirim notifikasi ke `createdBy` dokumen terkait (relasi `Submitable::createdBy()`).
2. WHEN sebuah `ApprovalInstanceStep` di-reject melalui `ApprovalInstanceController::reject()`, THE system SHALL mengirim notifikasi ke `createdBy` dokumen terkait, menyertakan `notes` penolakan jika diisi approver.
3. WHEN sebuah `ApprovalInstance` baru dibuat dengan step pertama berstatus `PENDING` (`ApprovalInstance::makeInstance()`), THE system SHALL mengirim notifikasi ke seluruh approver kandidat step tersebut (user langsung atau seluruh user dari role yang ditunjuk) bahwa ada dokumen menunggu keputusan mereka.
4. WHEN sebuah step approval menengah selesai (bukan step terakhir) dan approval berlanjut ke step berikutnya, THE system SHALL mengirim notifikasi ke approver kandidat step berikutnya (pola sama dengan 3.3, dipicu ulang tiap kali `current_sequence` maju).
5. THE notification SHALL menyertakan tautan (link) ke dokumen terkait agar penerima bisa langsung membuka dari notifikasi.
6. THE system SHALL menyisipkan pemicu notifikasi ini di titik yang sama dengan `AttachGeneratedPdfJob::dispatch($approval)` di `approve()`/`reject()` (setelah `DB::commit()`), TANPA mengubah urutan atau perilaku existing dari `onApproved()`/`onRejected()` callback maupun attach PDF job.
7. WHEN dokumen dengan `ApprovalInstance` yang masih berjalan (status bukan `APPROVED`/`REJECTED`, ada step `PENDING`/`WAITING`) di-cancel oleh pembuatnya (`Submitable` transisi ke `FormStatus::CANCELED`), THE system SHALL mengirim notifikasi ke approver kandidat dari step yang sedang `PENDING` saat itu, memberi tahu bahwa dokumen dibatalkan dan tidak perlu ditinjau lagi.
8. IF dokumen di-amend (`Submitable::amend()`, menghasilkan dokumen baru dengan `amended_from_id` terisi) SETELAH sebelumnya `APPROVED`, THEN THE system TIDAK WAJIB mengirim notifikasi otomatis pada iterasi ini — `amend()` membuat entitas dokumen baru yang perlu melalui alur submit/approval-nya sendiri dari awal (lihat Requirement 3.3), sehingga cukup ditangani oleh trigger submit biasa, bukan trigger khusus "amend".
9. **Gap ditemukan, DI LUAR SCOPE spec ini**: saat ini `{Model}Service::cancel()` (mis. `SalesOrderService::cancel()` baris 579-592) hanya mengubah status dokumen dan rollback item — TIDAK mengubah status `ApprovalInstanceStep` yang masih `PENDING`/`WAITING` menjadi `CANCELED`. Step tersebut nyangkut di status lama selamanya, sehingga approver tetap melihat dokumen di daftar "perlu ditinjau" meski sudah dibatalkan. Ini bug perilaku approval system yang butuh perbaikan di `{Model}Service::cancel()` (atau titik terpusat setara) untuk seluruh model submitable — ditangani sebagai **spec/bugfix terpisah**, bukan bagian notification-center.
10. THE notifikasi pada 3.7 SHALL dibangun agar TIDAK bergantung pada urutan penyelesaian gap di atas — cukup dipicu oleh transisi status dokumen ke `CANCELED` (via observer/event pada `Submitable`), dan me-resolve approver kandidat dari step yang berstatus `PENDING`/`WAITING` pada saat itu (apa pun bug di atas sudah diperbaiki atau belum, resolusi kandidat tetap benar karena membaca status step apa adanya).

### Requirement 4: Notifikasi role-based untuk dokumen baru

**User Story:** Sebagai staf gudang (role Warehouse), saya ingin mendapat notifikasi saat ada Sales Order baru yang perlu saya proses, sehingga saya tidak perlu membuka halaman listing berulang kali untuk mengecek dokumen baru.

#### Acceptance Criteria

1. THE system SHALL menyediakan mekanisme konfigurasi per model submitable untuk menentukan role mana yang dinotifikasi saat dokumen baru dibuat/disubmit — TIDAK di-hardcode per model di kode notification, agar bisa dipakai ulang untuk model submitable lain.
2. WHEN sebuah dokumen yang dikonfigurasi memicu role-based notification berpindah ke status yang relevan (mis. `SUBMITTED`), THE system SHALL mengirim notifikasi ke seluruh `User` yang memiliki role terkait (`User::whereHas('roles', ...)`).
3. THE notification role-based SHALL menyertakan informasi ringkas dokumen (kode/nomor, judul/nama, pembuat) dan tautan ke dokumen.
4. IF tidak ada user dengan role yang dikonfigurasi, THEN THE system SHALL tidak melempar error — notifikasi untuk trigger tersebut cukup tidak terkirim ke siapa pun.

### Requirement 5: Notifikasi sistem — invite user

**User Story:** Sebagai admin yang mengundang user baru ke sistem, saya ingin user tersebut menerima email undangan, sehingga mereka tahu harus melakukan setup akun (set password, pilih branch).

#### Acceptance Criteria

1. WHEN sebuah `User` baru dibuat dengan status `FormStatus::INVITED`, THE system SHALL mengirim email undangan berisi tautan ke halaman setup akun (`/setup`, existing route yang ditangani `SetupUserController`).
2. THE invite notification SHALL hanya dikirim satu kali saat status pertama kali menjadi `INVITED` (bukan berulang setiap update user), memakai observer/event pada transisi status, bukan polling.
3. THE invite email SHALL memakai channel `mail` saja (tanpa `database`/`broadcast`) karena penerima belum tentu bisa login untuk melihat in-app notification.

### Requirement 6: Notifikasi sistem — reset password

**User Story:** Sebagai pengguna yang lupa password, saya ingin tetap menerima email reset password yang konsisten secara visual dengan notifikasi lain di sistem, sehingga pengalamannya tidak terasa terputus dari branding aplikasi.

#### Acceptance Criteria

1. THE system SHALL mempertahankan alur reset password bawaan Breeze (`Password::sendResetLink()`) yang sudah berfungsi — TIDAK mengubah logic pengiriman token/link.
2. THE system MAY menyesuaikan tampilan email `ResetPassword` (override `toMail()` lewat `ResetPassword::toMailUsing()` di `AppServiceProvider`, atau custom Notification class) agar konsisten secara visual dengan notification lain dari spec ini — tapi ini bukan syarat wajib fungsional, murni konsistensi tampilan.

### Requirement 7: Bell icon dan panel notifikasi in-app

**User Story:** Sebagai pengguna, saya ingin melihat notifikasi saya lewat ikon lonceng di navbar dengan badge jumlah belum dibaca, sehingga saya tahu ada pembaruan tanpa harus membuka halaman lain.

#### Acceptance Criteria

1. THE system SHALL mengisi ulang `resources/js/Components/Navbar/Notifications.jsx` (menghapus `return null` dan JSX placeholder statis) memakai struktur Popover yang sudah ada sebagai kerangka.
2. THE bell icon SHALL menampilkan badge jumlah notifikasi belum dibaca (`read_at IS NULL`) milik user yang sedang login.
3. WHEN notifikasi baru masuk untuk user yang sedang online, THE badge count SHALL bertambah secara realtime (via Reverb broadcast) tanpa reload halaman.
4. WHEN pengguna membuka panel notifikasi, THE system SHALL menampilkan daftar notifikasi terbaru (dibatasi jumlah, mis. 20 terakhir) diurutkan dari terbaru, masing-masing menunjukkan pesan ringkas, waktu relatif, dan status baca.
5. WHEN pengguna mengklik sebuah notifikasi, THE system SHALL menandainya sebagai sudah dibaca (`read_at` terisi) DAN mengarahkan ke tautan terkait (jika ada).
6. WHEN pengguna mengklik tombol "Mark all as read" (sudah ada di kerangka UI), THE system SHALL menandai seluruh notifikasi milik user tersebut sebagai sudah dibaca.
7. THE panel notifikasi SHALL menampilkan pesan kondisi kosong yang sesuai ketika belum ada notifikasi (bukan pesan "Under Development" placeholder lama).

### Requirement 8: Struktur Notification class yang dapat digunakan ulang

**User Story:** Sebagai pengembang, saya ingin menambah trigger notifikasi baru di masa depan tanpa menulis ulang boilerplate channel, sehingga menambah event notifikasi baru menjadi konsisten dan cepat.

#### Acceptance Criteria

1. THE system SHALL menyediakan satu queued mail-dispatch mechanism generik (pengganti `MyMailChannel`/`SendEmailNotificationJob` lama) yang bisa dipakai oleh notification class manapun tanpa bergantung pada property domain-spesifik.
2. EACH notification class SHALL mengimplementasikan `toArray()`/`toDatabase()` untuk representasi in-app (minimal: `title`, `message`, `url`) DAN `toMail()` untuk representasi email, dari satu constructor/data yang sama — tidak ada duplikasi data antara representasi database dan mail.
3. THE system SHALL menyediakan minimal satu contoh test (feature test) yang membuktikan: notifikasi tersimpan ke `database` segera (assertable lewat `Notification::fake()` atau query langsung), DAN email ter-dispatch ke queue (assertable lewat `Queue::fake()`), dalam satu pemicu event yang sama.

## Out of Scope (iterasi ini)

- Verifikasi email (`MustVerifyEmail`) — tetap nonaktif sesuai kondisi saat ini, diabaikan per keputusan eksplisit.
- Reuse `app/Channels/DatabaseChannel.php`, `app/Channels/MyMailChannel.php`, `app/Notifications/BaseNotification.php` versi lama — dibuang, bukan direfactor.
- Preferensi notifikasi per user (mis. toggle "matikan notifikasi role-based untuk model X") — bisa jadi iterasi lanjutan.
- Notifikasi push browser (Web Push API) di luar Reverb — di luar scope, fokus in-app + email dulu.
