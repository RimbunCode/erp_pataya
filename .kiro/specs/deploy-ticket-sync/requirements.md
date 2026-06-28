# Requirements Document

## Introduction

Project ERP ini menggunakan sistem tiket helpdesk untuk mencatat dan melacak
bug serta task yang perlu diselesaikan. Selama ini, pembaruan status tiket
dilakukan secara manual — developer harus masuk ke aplikasi dan menandai tiket
sebagai selesai setelah kode di-deploy.

Fitur ini mengotomasi dua hal sekaligus setiap kali deploy production berhasil:

1. **Deploy Ticket Sync** — tiket yang direferensikan di commit/changelog
   otomatis berubah status menjadi `resolved` (progress 90%), sehingga creator
   tiket dapat melakukan verifikasi akhir tanpa menunggu notifikasi manual dari
   developer.

2. **In-App Changelog** — setiap versi yang di-deploy disimpan ke database dan
   dapat dilihat oleh semua user di halaman `/changelogs`. Kode tiket di
   changelog menjadi link langsung ke halaman tiket terkait.

Sistem ini menggunakan GitHub Actions sebagai trigger (bukan GitHub Webhook)
karena deploy berjalan di GitHub Actions dan konteks CHANGELOG.md tersedia
langsung di sana tanpa perlu konfigurasi tambahan di server.

## Glossary

- **Tiket** — entitas helpdesk dengan kode unik (misal `26/0001`), status, progress, dan audit trail berupa TicketResponse
- **TicketResponse** — snapshot status tiket pada setiap perubahan; berfungsi sebagai audit trail
- **Changelog** — catatan perubahan per versi yang dihasilkan Release-Please dari commit messages
- **Deploy Webhook** — endpoint `POST /api/webhooks/deploy` yang dipanggil GitHub Actions setelah deploy selesai
- **System** — aktor non-human; ditampilkan di UI saat `user_id` pada TicketResponse bernilai null
- **Kode tiket** — identifier unik tiket dalam format yang dikustomisasi via FormatingSeries (misal `26/0001`), ditulis di commit sebagai `[#26/0001]`
- **content_raw** — teks changelog asli dari CHANGELOG.md tanpa modifikasi
- **content_html** — teks changelog yang sudah diproses; kode tiket `[#kode]` dikonversi menjadi tag `<a>`

## Requirements

### Requirement 1: Konvensi Penulisan Kode Tiket di Commit

**User Story:** As a developer, I want a consistent format to reference ticket codes in commit messages, so that the system can automatically extract them during deploy.

#### Acceptance Criteria

1. THE developer SHALL write ticket references using the format `[#<kode>]` in commit messages or PR body (e.g. `fix: login bug [#26/0001]`).
2. THE system SHALL support multiple ticket references in a single commit message (e.g. `feat: export [#26/0002] [#26/0003]`).
3. THE format `[#<kode>]` SHALL be format-agnostic — valid selama kode cocok dengan regex `[\w\/\-]+`, sehingga perubahan FormatingSeries tidak memerlukan update kode program.

---

### Requirement 2: GitHub Actions Mengekstrak Kode Tiket dan Memanggil Webhook

**User Story:** As a system, I want GitHub Actions to automatically extract ticket codes from CHANGELOG.md after a successful production deploy, so that ticket statuses are updated without manual intervention.

#### Acceptance Criteria

1. THE deploy workflow SHALL add a final step that only runs when `github.event_name == 'push'` (production deploy via tag push).
2. WHEN deploy production berhasil, THE workflow SHALL extract ticket codes dari entry versi terbaru di `CHANGELOG.md` menggunakan regex `\[#([\w\/\-]+)\]`.
3. THE workflow SHALL read the current version from `.release-please-manifest.json`.
4. THE workflow SHALL extract the latest version's changelog entry (from `## [vX.Y.Z]` until the next `## [` heading).
5. THE workflow SHALL send a `POST` request to `{APP_URL}/api/webhooks/deploy` with Bearer token `DEPLOY_WEBHOOK_TOKEN` and payload:
   ```json
   {
     "tickets": ["26/0001"],
     "environment": "production",
     "version": "v1.2.0",
     "changelog": "<entry changelog versi terbaru>"
   }
   ```
6. IF `tickets` array kosong, THE workflow SHALL still send the request (changelog tetap disimpan).
7. THE `DEPLOY_WEBHOOK_TOKEN` dan `APP_URL` SHALL disimpan sebagai GitHub Secrets.

---

### Requirement 3: Endpoint Webhook Menerima dan Memproses Deploy Notification

**User Story:** As a system, I want a secure API endpoint to receive deploy notifications, so that the application can process ticket updates and changelog storage atomically.

#### Acceptance Criteria

1. THE system SHALL expose `POST /api/webhooks/deploy` tanpa session auth middleware.
2. THE endpoint SHALL verify Bearer token dari header `Authorization` terhadap `env('DEPLOY_WEBHOOK_TOKEN')`.
3. IF token tidak valid atau tidak ada, THE endpoint SHALL return HTTP 401 tanpa detail error.
4. THE endpoint SHALL validate payload: `tickets` (array of strings), `environment` (string), `version` (string), `changelog` (string).
5. THE endpoint SHALL be rate-limited to 10 requests per minute.
6. WHEN request valid, THE endpoint SHALL:
   a. Simpan changelog ke DB via `ChangelogService::store()`
   b. Proses setiap kode tiket via `TicketService::resolveFromDeploy()`
7. THE endpoint SHALL return JSON response:
   ```json
   {
     "resolved": ["26/0001"],
     "not_found": ["26/0002"],
     "already_resolved": ["26/0003"],
     "changelog_id": "<ulid>"
   }
   ```

---

### Requirement 4: Update Status Tiket Setelah Deploy

**User Story:** As a ticket creator, I want my ticket to be automatically marked as resolved after the related fix is deployed to production, so that I know it's ready for verification without waiting for manual updates from developers.

#### Acceptance Criteria

1. WHEN kode tiket ditemukan di DB dan statusnya bukan `resolved` atau `done`, THE system SHALL update tiket:
   - `status` → `resolved`
   - `progress` → `90`
   - `end_date` → timestamp saat proses
   - `assign_to_id` → `created_by_id` tiket (dikembalikan ke creator untuk verifikasi)
2. THE system SHALL always create a new `TicketResponse` regardless of current ticket status, dengan:
   - `user_id` → `null` (ditampilkan sebagai "System" di UI)
   - `assign_to_id` → `created_by_id` tiket
   - `status` → `resolved`
   - `progress` → `90`
   - `content` → `"Diselesaikan pada deploy {version}."`
3. IF tiket sudah berstatus `resolved` atau `done`, THE system SHALL skip update field tiket tapi TETAP buat TicketResponse baru. Tiket masuk ke `already_resolved[]` dalam response.
4. IF kode tiket tidak ditemukan, THE system SHALL add kode ke `not_found[]` dan lanjut proses tiket berikutnya tanpa error.
5. THE `user_id` column pada tabel `ticket_responses` SHALL be nullable untuk mendukung TicketResponse dari System.

---

### Requirement 5: Direct Link ke Tiket via Query Param

**User Story:** As a user, I want to open a ticket directly by its code from a URL, so that I can navigate to a ticket without searching manually.

#### Acceptance Criteria

1. WHEN `GET /tickets?code=26/0001` dipanggil, THE system SHALL find the ticket by exact `code` match.
2. IF tiket ditemukan, THE system SHALL redirect ke `GET /tickets/{ulid}` (halaman show tiket).
3. IF tiket tidak ditemukan, THE system SHALL return HTTP 404.
4. IF query param `code` tidak ada, THE `index()` method SHALL behave normally (tampilkan list tiket).

---

### Requirement 6: Penyimpanan Changelog ke Database

**User Story:** As a system, I want each deployment's changelog to be stored in the database, so that it can be displayed to users and processed for ticket hyperlinks.

#### Acceptance Criteria

1. THE system SHALL store changelog dengan fields: `version`, `environment`, `content_raw`, `content_html`, `deployed_at`.
2. THE `content_raw` SHALL contain the plain text changelog entry as received from the webhook payload.
3. THE `content_html` SHALL be generated by replacing `[#<kode>]` dengan `<a href="/tickets?code=<kode>">[#<kode>]</a>`.
4. IF versi yang sama di-deploy ulang, THE system SHALL update record yang ada (`updateOrCreate` by `version`).
5. THE `changelog_reads` table SHALL track per-user read status dengan unique constraint `(changelog_id, user_id)`.

---

### Requirement 7: Halaman In-App Changelog

**User Story:** As a user, I want to see a history of all application version updates in one place, so that I know what has changed and which tickets have been resolved in each release.

#### Acceptance Criteria

1. THE system SHALL provide a page at `GET /changelogs` accessible by all authenticated users.
2. THE page SHALL display all changelog entries ordered by `deployed_at` descending (terbaru di atas).
3. THE page SHALL render `content_html` sehingga kode tiket tampil sebagai link klikable.
4. WHEN user mengklik link kode tiket, THE system SHALL redirect ke halaman show tiket terkait.
5. THE page SHALL show a badge "Baru" pada versi yang belum dibaca oleh user yang sedang login.
6. WHEN user membuka halaman `/changelogs`, THE system SHALL automatically mark all visible changelog entries as read untuk user tersebut (triggered on page load, not on explicit button click).
7. THE layout/navbar SHALL display an unread changelogs count badge untuk semua authenticated user, diupdate via shared Inertia props.
8. WHEN semua changelog sudah dibaca, THE unread badge SHALL not be displayed.
