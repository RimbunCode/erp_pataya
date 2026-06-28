# Design Document: Deploy Ticket Sync & In-App Changelog

## Overview

Dua fitur terintegrasi dalam satu siklus deploy:

1. **Deploy Ticket Sync** — setelah deploy production selesai, GitHub Actions
   mengekstrak kode tiket dari CHANGELOG.md, lalu memanggil webhook Laravel
   untuk mengubah status tiket menjadi `resolved` (progress 90%).

2. **In-App Changelog** — setiap deploy menyimpan changelog ke DB. User dapat
   melihat full history di halaman `/changelogs`. Kode tiket di changelog
   menjadi link klikable ke `/tickets?code=`. Per-user read tracking
   memastikan "versi baru" hanya muncul sekali.

## Architecture

```
Commit: "fix: login bug [#26/0001]"
         │
         ▼
Release-Please → CHANGELOG.md (plain text, tanpa hyperlink)
         │
         ▼
Tag v1.x.x push → deploy-cpanel.yml
  step 1: Deploy (existing)
  step 2: Baca CHANGELOG.md → extract ticket codes + ambil entry terbaru
  step 3: POST /api/webhooks/deploy
         │
         ▼
DeployWebhookController
  ├─ Verify Bearer token
  ├─ ChangelogService::store()     ← simpan ke DB, proses hyperlink
  └─ TicketService::resolveFromDeploy() foreach ticket
         │
         ├─── Changelog: version, content_raw, content_html (link tiket)
         │
         └─── Ticket: status=resolved, progress=90, end_date=now()
              TicketResponse: audit trail entry
         │
         ▼
Frontend
  ├─ /changelogs → halaman history semua versi
  └─ Badge "versi baru" → per-user read tracking
```

## Format Kode Tiket di Commit/PR Body

Konvensi penulisan:

```
fix: perbaiki login bug [#26/0001]
feat: tambah export [#26/0002] [#26/0003]
```

Regex ekstrak: `\[#([\w\/\-]+)\]`

- Format-agnostic: jika `FormatingSeries` berubah, kode tiket tetap terbaca
  selama dibungkus `[# ]`
- Satu commit bisa referensikan banyak tiket

## Hyperlink Tiket di In-App Changelog

Hyperlink **tidak** dimasukkan ke `CHANGELOG.md` (file git). Sebaliknya,
diproses saat simpan ke DB:

```php
// ChangelogService::processHtml()
$html = preg_replace(
    '/\[#([\w\/\-]+)\]/',
    '<a href="/tickets?code=$1">[#$1]</a>',
    $rawContent
);
```

- `content_raw` → plain text dari CHANGELOG.md (untuk re-process jika format berubah)
- `content_html` → sudah ada hyperlink (untuk render di frontend)

## Fase Implementasi

### Fase 1 — Backend & Webhook
Bisa di-deploy mandiri. User belum bisa lihat changelog di UI, tapi:
- Tiket otomatis terupdate setelah deploy
- Changelog tersimpan di DB, siap untuk Fase 2

### Fase 2 — Frontend & UX
Bergantung pada Fase 1 (tabel `changelogs` dan `changelog_reads` harus ada).

## Components dan Interfaces

### FASE 1

#### 1. `routes/api.php` (NEW FILE)

```php
Route::post('/webhooks/deploy', DeployWebhookController::class)
    ->name('webhooks.deploy')
    ->middleware('throttle:10,1');
```

Tidak pakai `auth` middleware — autentikasi via Bearer token statis.

#### 2. `app/Http/Controllers/Api/DeployWebhookController.php` (NEW)

```php
// Invokable controller
public function __invoke(Request $request): JsonResponse
{
    // 1. Verify Bearer token vs env('DEPLOY_WEBHOOK_TOKEN')
    // 2. Validate payload: tickets[], environment, version, changelog
    // 3. ChangelogService::store($payload)
    // 4. foreach ticket code → TicketService::resolveFromDeploy()
    // 5. Return { resolved: [...], not_found: [...], skipped: [...] }
}
```

#### 3. `database/migrations/..._make_user_id_nullable_on_ticket_responses_table.php` (NEW)

Ubah `user_id` jadi nullable untuk mendukung TicketResponse dari System (webhook):

```php
Schema::table('ticket_responses', function (Blueprint $table) {
    $table->foreignUlid('user_id')->nullable()->references('id')->on('users')->nullOnDelete()->change();
});
```

#### 4. `database/migrations/..._create_changelogs_table.php` (NEW)

```
changelogs
  id          ulid PK
  version     string unique     (e.g. "v1.2.0")
  environment string            ("production" | "staging")
  content_raw text              (plain text dari CHANGELOG.md)
  content_html text             (processed: [#code] → <a href>)
  deployed_at timestamp
  created_at / updated_at
```

#### 4. `database/migrations/..._create_changelog_reads_table.php` (NEW)

```
changelog_reads
  id            ulid PK
  changelog_id  FK → changelogs.id
  user_id       FK → users.id
  read_at       timestamp
  UNIQUE(changelog_id, user_id)
```

#### 5. `app/Models/Core/Changelog.php` (NEW)

```php
// Relations: reads() HasMany, readBy() BelongsToMany User
// Accessor: isReadBy(User $user): bool
```

#### 6. `app/Models/Core/ChangelogRead.php` (NEW)

```php
// BelongsTo: changelog(), user()
```

#### 7. `app/Services/Core/ChangelogService.php` (NEW)

```php
public function store(string $version, string $environment, string $raw): Changelog
{
    // processHtml($raw) → content_html
    // Changelog::create(...)
}

public function markRead(Changelog $changelog, User $user): void
{
    // ChangelogRead::firstOrCreate([changelog_id, user_id])
}

public function getUnreadCount(User $user): int
{
    // Changelog::whereDoesntHave('reads', fn($q) => $q->where('user_id', $user->id))->count()
}
```

#### 8. `app/Services/Helpdesk/TicketService.php` (MODIFY)

Tambah method:

```php
public function resolveFromDeploy(Ticket $ticket, string $version): bool
{
    $alreadySettled = in_array($ticket->status->value, ['resolved', 'done']);

    if (! $alreadySettled) {
        $ticket->update([
            'status'       => 'resolved',
            'progress'     => 90,
            'end_date'     => now(),
            'assign_to_id' => $ticket->created_by_id,
        ]);
    }
    // Tetap buat TicketResponse meski tiket sudah resolved/done

    TicketResponse::create([
        'ticket_id'    => $ticket->id,
        'user_id'      => null,  // null = "System" di view
        'assign_to_id' => $ticket->created_by_id,
        'type'         => $ticket->type,
        'priority'     => $ticket->priority,
        'subject'      => $ticket->subject,
        'status'       => 'resolved',
        'progress'     => 90,
        'start_date'   => $ticket->start_date,
        'due_date'     => $ticket->due_date,
        'end_date'     => now(),
        'content'      => "Diselesaikan pada deploy $version.",
        'content_json' => null,
    ]);

    $ticket->logForUpdated();

    return $alreadySettled;  // true = masuk already_resolved[], false = masuk resolved[]
}
```

`user_id` null — frontend menampilkan "System" jika `user` relation null.

#### 9. `app/Http/Controllers/Helpdesk/TicketController.php` (MODIFY)

Jika query param `?code=` ada di `index()`, redirect langsung ke halaman show:

```php
public function index(Request $request)
{
    if ($request->code) {
        $ticket = Ticket::where('code', $request->code)->firstOrFail();
        return redirect()->route('tickets.show', $ticket);
    }
    // ... logic index normal
}
```

#### 10. `bootstrap/app.php` (MODIFY)

Register `routes/api.php`:

```php
->withRouting(
    web: __DIR__.'/../routes/web.php',
    api: __DIR__.'/../routes/api.php',
    ...
)
```

#### 11. `.github/workflows/deploy-cpanel.yml` (MODIFY)

Tambah step terakhir setelah deploy berhasil (production only):

```yaml
- name: Notify deploy webhook
  if: github.event_name == 'push'  # production only
  env:
    DEPLOY_WEBHOOK_TOKEN: ${{ secrets.DEPLOY_WEBHOOK_TOKEN }}
    APP_URL: ${{ secrets.APP_URL }}
  run: |
    VERSION=$(cat .release-please-manifest.json | jq -r '."."')

    # Extract ticket codes dari CHANGELOG.md entry versi ini
    TICKETS=$(grep -oP '\[#\K[^\]]+' CHANGELOG.md | head -50 | jq -Rsc 'split("\n")[:-1]')

    # Ambil entry changelog versi terbaru (dari ## v... sampai ## v... berikutnya)
    CHANGELOG=$(awk "/^## \[$VERSION\]/,/^## \[/{if(/^## \[/ && !/^## \[$VERSION\]/) exit; print}" CHANGELOG.md | jq -Rs .)

    curl -sf -X POST "$APP_URL/api/webhooks/deploy" \
      -H "Authorization: Bearer $DEPLOY_WEBHOOK_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"tickets\": $TICKETS, \"environment\": \"production\", \"version\": \"$VERSION\", \"changelog\": $CHANGELOG}"
```

---

### FASE 2

#### 12. `app/Http/Controllers/Core/ChangelogController.php` (NEW)

```php
public function index(): Response         // halaman /changelogs
public function markRead(Changelog $changelog): RedirectResponse
```

#### 13. `resources/js/Pages/Core/Changelogs/Index.tsx` (NEW)

Halaman `/changelogs`:
- List semua versi (card per versi, ordered by deployed_at desc)
- Badge "Baru" pada versi yang belum dibaca user
- Render `content_html` (kode tiket sudah jadi link)
- Tombol "Tandai sudah dibaca" per versi

#### 14. `routes/web.php` (MODIFY)

```php
Route::get('/changelogs', [ChangelogController::class, 'index'])->name('changelogs.index');
Route::post('/changelogs/{changelog}/read', [ChangelogController::class, 'markRead'])->name('changelogs.markRead');
```

#### 15. Shared prop / layout — unread count badge (MODIFY)

Tambah `unread_changelogs_count` ke shared Inertia props supaya badge
"versi baru" bisa tampil di navbar/sidebar tanpa load ulang.

---

## Security

- Token statis di `.env`: `DEPLOY_WEBHOOK_TOKEN=<random-32-chars>`
- Token yang sama disimpan di GitHub Secrets sebagai `DEPLOY_WEBHOOK_TOKEN`
- Endpoint throttle: 10 req/menit
- Controller return 401 jika token salah — tidak reveal detail error
- `content_html` di-escape kecuali tag `<a>` yang dihasilkan internal

## Payload Contract

### Request

```json
{
  "tickets": ["26/0001", "26/0002"],
  "environment": "production",
  "version": "v1.2.0",
  "changelog": "## Bug Fixes\n- perbaiki login bug [#26/0001]\n"
}
```

### Response (200 OK)

```json
{
  "resolved": ["26/0001"],
  "not_found": ["26/0002"],
  "already_resolved": [],
  "changelog_id": "01JXXXXXXX"
}
```

`already_resolved` — tiket sudah `resolved`/`done`, status tidak diubah tapi TicketResponse tetap dibuat.
`changelog_id` — ULID changelog yang tersimpan, untuk keperluan debug.

## Edge Cases

| Kasus | Perilaku |
|---|---|
| Tiket sudah `resolved`/`done` | Tidak update status/progress, tapi tetap buat TicketResponse baru. Masuk `already_resolved[]` di response payload. |
| Kode tiket tidak ditemukan | Masuk `not_found[]`, tidak error |
| Payload `tickets: []` | Changelog tetap disimpan, tiket skip |
| Versi sama di-deploy ulang | `Changelog::updateOrCreate` by version |
| Token salah | Return 401 |
| Deploy staging | Step GitHub Actions tidak jalan |
| User belum baca changelog lama | Semua versi belum dibaca tampil dengan badge |
