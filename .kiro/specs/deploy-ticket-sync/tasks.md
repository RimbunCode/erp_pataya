# Implementation Plan: Deploy Ticket Sync & In-App Changelog

## Overview

Implementasi dibagi dua fase independen. Fase 1 membangun pipeline backend:
migration, model, service, endpoint webhook, dan GitHub Actions step. Fase 2
membangun UI changelog termasuk halaman, per-user read tracking, dan badge
navbar. Fase 1 bisa di-deploy dan diuji mandiri sebelum Fase 2 dimulai.

---

## Tasks

### FASE 1 — Backend & Webhook

- [x] 1. Migration — Buat perubahan skema database
  - [x] 1.1 Buat migration `make_user_id_nullable_on_ticket_responses_table`
    - `Schema::table('ticket_responses')` → `$table->foreignUlid('user_id')->nullable()->references('id')->on('users')->nullOnDelete()->change()`
    - _Requirements: 4.5_

  - [x] 1.2 Buat migration `create_changelogs_table`
    - Fields: `id` (ulid PK), `version` (string unique), `environment` (string), `content_raw` (text), `content_html` (text), `deployed_at` (timestamp), timestamps
    - _Requirements: 6.1_

  - [x] 1.3 Buat migration `create_changelog_reads_table`
    - Fields: `id` (ulid PK), `changelog_id` (FK changelogs cascadeOnDelete), `user_id` (FK users cascadeOnDelete), `read_at` (timestamp)
    - Tambah unique constraint: `['changelog_id', 'user_id']`
    - _Requirements: 6.5_

- [x] 2. Model — Buat Eloquent models untuk changelog
  - [x] 2.1 Buat `app/Models/Core/Changelog.php`
    - `use HasUlids`
    - Cast: `deployed_at` → datetime
    - Relations: `reads()` HasMany ChangelogRead, `readers()` BelongsToMany User via changelog_reads
    - Accessor: `isReadBy(User $user): bool` → cek via `reads()->where('user_id', $user->id)->exists()`
    - _Requirements: 6.1, 6.5_

  - [x] 2.2 Buat `app/Models/Core/ChangelogRead.php`
    - `use HasUlids`
    - Cast: `read_at` → datetime
    - Relations: `changelog()` BelongsTo, `user()` BelongsTo
    - _Requirements: 6.5_

- [x] 3. Service — Buat ChangelogService dan update TicketService
  - [x] 3.1 Buat `app/Services/Core/ChangelogService.php`
    - Method `store(string $version, string $environment, string $raw): Changelog`
      - Proses `content_html`: `preg_replace('/\[#([\w\/\-]+)\]/', '<a href="/tickets?code=$1">[#$1]</a>', $raw)`
      - `Changelog::updateOrCreate(['version' => $version], [...])`  ← handle re-deploy
    - Method `markRead(Changelog $changelog, User $user): void`
      - `ChangelogRead::firstOrCreate(['changelog_id' => $changelog->id, 'user_id' => $user->id], ['read_at' => now()])`
    - Method `markAllRead(User $user): void`
      - Bulk insert untuk semua changelog yang belum dibaca user
    - Method `getUnreadCount(User $user): int`
      - `Changelog::whereDoesntHave('reads', fn($q) => $q->where('user_id', $user->id))->count()`
    - _Requirements: 6.1, 6.3, 6.4, 6.5, 7.6_

  - [x] 3.2 Update `app/Services/Helpdesk/TicketService.php` — tambah `resolveFromDeploy()`
    - Signature: `public function resolveFromDeploy(Ticket $ticket, string $version): bool`
    - Cek `$alreadySettled = in_array($ticket->status->value, ['resolved', 'done'])`
    - Jika belum settled: update tiket `status=resolved, progress=90, end_date=now(), assign_to_id=$ticket->created_by_id`
    - Selalu buat `TicketResponse`: `user_id=null, assign_to_id=$ticket->created_by_id, status=resolved, progress=90, content="Diselesaikan pada deploy {$version}."`
    - Panggil `$ticket->logForUpdated()`
    - Return `$alreadySettled` (true = already_resolved, false = resolved)
    - _Requirements: 4.1, 4.2, 4.3_

- [x] 4. Tests Fase 1 — Tulis feature tests
  - [x] 4.1 Tulis `tests/Feature/Core/ChangelogServiceTest.php`
    - **test_store_creates_changelog_with_html_links**: simpan changelog, verifikasi `content_html` berisi `<a href="/tickets?code=26/0001">`
    - **test_store_updates_existing_on_redeploy**: panggil `store()` dua kali dengan versi sama, verifikasi hanya 1 record
    - **test_mark_all_read_marks_unread_changelogs**: buat 3 changelog, panggil `markAllRead()`, verifikasi `getUnreadCount()` = 0
    - **Validates: Requirements 6.1, 6.3, 6.4, 6.5**

  - [x] 4.2 Tulis `tests/Feature/Helpdesk/TicketResolveFromDeployTest.php`
    - **test_resolves_ticket_and_creates_response**: tiket `in_progress` → `resolveFromDeploy()` → status=resolved, progress=90, assign_to=creator, TicketResponse dibuat dengan user_id=null
    - **test_already_resolved_ticket_skips_update_but_creates_response**: tiket `resolved` → `resolveFromDeploy()` → status tidak berubah, tapi TicketResponse baru tetap dibuat
    - **test_returns_false_for_new_ticket_and_true_for_already_resolved**: verifikasi return value
    - **Validates: Requirements 4.1, 4.2, 4.3**

- [x] 5. Webhook Endpoint — Buat route, controller, dan registrasi API
  - [x] 5.1 Buat `routes/api.php`
    - `Route::post('/webhooks/deploy', DeployWebhookController::class)->name('webhooks.deploy')->middleware('throttle:10,1')`
    - _Requirements: 3.1, 3.5_

  - [x] 5.2 Update `bootstrap/app.php` — daftarkan `routes/api.php`
    - Tambah `api: __DIR__.'/../routes/api.php'` ke `withRouting()`
    - _Requirements: 3.1_

  - [x] 5.3 Buat `app/Http/Controllers/Api/DeployWebhookController.php`
    - Invokable controller
    - Verify Bearer token: `$request->bearerToken() !== config('services.deploy.webhook_token')` → return 401
    - Validate: `tickets` (array, max 50), `environment` (string), `version` (string), `changelog` (string)
    - Panggil `ChangelogService::store()` → dapat `$changelog`
    - Loop `tickets[]` → `Ticket::where('code', $code)->first()` → jika null masuk `not_found[]`, jika ada panggil `TicketService::resolveFromDeploy()`
    - Return JSON: `{ resolved, not_found, already_resolved, changelog_id }`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6, 3.7_

  - [x] 5.4 Tambah config ke `config/services.php`
    - `'deploy' => ['webhook_token' => env('DEPLOY_WEBHOOK_TOKEN')]`
    - Tambah `DEPLOY_WEBHOOK_TOKEN=` ke `.env.example`
    - _Requirements: 3.2_

- [x] 6. Tests Webhook Endpoint
  - [x] 6.1 Tulis `tests/Feature/Api/DeployWebhookTest.php`
    - **test_rejects_request_without_token**: POST tanpa Authorization → 401
    - **test_rejects_request_with_wrong_token**: POST dengan token salah → 401
    - **test_valid_request_resolves_tickets**: POST valid dengan 2 kode tiket → 200, tiket terupdate, response berisi `resolved[]`
    - **test_not_found_ticket_code_added_to_not_found**: POST dengan kode tidak ada → 200, masuk `not_found[]`
    - **test_already_resolved_ticket_added_to_already_resolved**: POST dengan tiket `resolved` → 200, masuk `already_resolved[]`, TicketResponse tetap dibuat
    - **test_empty_tickets_still_saves_changelog**: POST dengan `tickets: []` → 200, changelog tersimpan
    - **test_redeploy_same_version_updates_changelog**: POST dua kali versi sama → 1 record changelog
    - **Validates: Requirements 3.1–3.7, 4.1–4.4, 6.1–6.4**

- [x] 7. Checkpoint Fase 1 — Pastikan semua test Fase 1 pass
  - Jalankan: `php artisan test --compact tests/Feature/Core/ChangelogServiceTest.php tests/Feature/Helpdesk/TicketResolveFromDeployTest.php tests/Feature/Api/DeployWebhookTest.php`
  - Pastikan semua pass sebelum lanjut ke task 8.

- [x] 8. TicketController — Tambah redirect by code
  - [x] 8.1 Update `app/Http/Controllers/Helpdesk/TicketController.php` method `index()`
    - Cek `if ($request->code)` → `Ticket::where('code', $request->code)->firstOrFail()` → redirect ke `tickets.show`
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 8.2 Tulis test untuk redirect by code
    - Tambahkan ke `tests/Feature/Helpdesk/TicketTest.php`
    - **test_index_redirects_to_show_when_code_param_given**: GET `/tickets?code=26/0001` → redirect ke `/tickets/{ulid}`
    - **test_index_returns_404_when_code_not_found**: GET `/tickets?code=INVALID` → 404
    - **Validates: Requirements 5.1–5.4**

- [x] 9. GitHub Actions — Tambah step webhook di deploy workflow
  - [x] 9.1 Update `.github/workflows/deploy-cpanel.yml`
    - Tambah step terakhir dengan `if: github.event_name == 'push'`
    - Extract `VERSION` dari `.release-please-manifest.json` via `jq`
    - Extract `TICKETS` dari CHANGELOG.md via `grep -oP '\[#\K[^\]]+' CHANGELOG.md | head -50 | jq -Rsc 'split("\n")[:-1]'`
    - Extract `CHANGELOG` entry versi terbaru via `awk`
    - `curl -sf POST` ke `$APP_URL/api/webhooks/deploy` dengan Bearer token
    - _Requirements: 2.1–2.7_

---

### FASE 2 — Frontend & In-App Changelog

- [x] 10. Shared Props — Tambah unread count ke Inertia shared data
  - [x] 10.1 Tambah `unread_changelogs_count` ke HandleInertiaRequests middleware
    - Inject `ChangelogService` dan panggil `getUnreadCount(Auth::user())`
    - Hanya jika user authenticated
    - _Requirements: 7.7, 7.8_

- [x] 11. ChangelogController dan Routes
  - [x] 11.1 Buat `app/Http/Controllers/Core/ChangelogController.php`
    - Method `index()`: ambil semua changelog ordered `deployed_at` desc, pass ke Inertia dengan data `isRead` per user, panggil `ChangelogService::markAllRead(Auth::user())`
    - _Requirements: 7.1, 7.2, 7.6_

  - [x] 11.2 Update `routes/web.php` — tambah route changelog
    - `Route::get('/changelogs', [ChangelogController::class, 'index'])->name('changelogs.index')`
    - _Requirements: 7.1_

- [x] 12. Frontend — Halaman Changelogs
  - [x] 12.1 Buat `resources/js/Pages/Core/Changelogs/Index.jsx`
    - List semua versi ordered terbaru di atas
    - Render `content_html` menggunakan `dangerouslySetInnerHTML` (aman karena dihasilkan internal, bukan user input)
    - Badge "Baru" pada entry yang `!isRead`
    - Tampilkan `version`, `environment`, `deployed_at` per card
    - _Requirements: 7.2, 7.3, 7.5_

  - [x] 12.2 Update layout/navbar — tambah unread badge
    - Baca `unread_changelogs_count` dari shared Inertia props
    - Tampilkan badge hanya jika count > 0
    - Link ke `/changelogs`
    - _Requirements: 7.7, 7.8_

- [x] 13. Tests Fase 2
  - [x] 13.1 Tulis `tests/Feature/Core/ChangelogControllerTest.php`
    - **test_index_accessible_by_authenticated_user**: GET `/changelogs` → 200
    - **test_index_marks_all_changelogs_as_read**: buat 3 changelog unread, GET `/changelogs`, verifikasi semua jadi read
    - **test_unread_count_decreases_after_visit**: verifikasi shared prop `unread_changelogs_count` = 0 setelah visit
    - **Validates: Requirements 7.1, 7.6, 7.7**

- [x] 14. Checkpoint Fase 2 — Pastikan semua test pass
  - Jalankan: `php artisan test --compact tests/Feature/Core/ChangelogControllerTest.php`
  - Pastikan semua pass.

- [x] 15. Final Checkpoint — Jalankan seluruh test suite
  - `php artisan test --compact`
  - Jika pass, jalankan `vendor/bin/pint --dirty --format agent`
  - Konfirmasi ke user bahwa semua selesai.

---

## Notes

- **Fase 1 deployable tanpa Fase 2** — webhook berjalan, tiket terupdate, changelog tersimpan di DB meski belum ada UI.
- **`dangerouslySetInnerHTML` aman** untuk `content_html` karena dihasilkan oleh `ChangelogService::processHtml()` internal, bukan dari user input.
- **GitHub Secrets yang diperlukan**: `DEPLOY_WEBHOOK_TOKEN` (baru), `APP_URL` (mungkin sudah ada).
- **`user_id` nullable di TicketResponse** — frontend yang menampilkan tiket response harus handle `null` dengan menampilkan "System".

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1", "2.2"] },
    { "id": 2, "tasks": ["3.1", "3.2"] },
    { "id": 3, "tasks": ["4.1", "4.2"] },
    { "id": 4, "tasks": ["5.1", "5.2", "5.3", "5.4"] },
    { "id": 5, "tasks": ["6.1"] },
    { "id": 6, "tasks": ["7"] },
    { "id": 7, "tasks": ["8.1", "8.2", "9.1"] },
    { "id": 8, "tasks": ["10.1"] },
    { "id": 9, "tasks": ["11.1", "11.2"] },
    { "id": 10, "tasks": ["12.1", "12.2"] },
    { "id": 11, "tasks": ["13.1"] },
    { "id": 12, "tasks": ["14", "15"] }
  ]
}
```
