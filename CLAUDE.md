# Project Instructions

## Terminal Shell

Semua terminal command harus Bash-compatible (`C:/Program Files/Git/usr/bin/bash.exe`). Jangan gunakan PowerShell/cmd.
Gunakan: `ls`, `cp`, `mv`, `rm`, `export VAR=value`, forward slashes di path.

## Verifikasi Sebelum Klaim Teknis

Jangan berasumsi atau menjawab pertanyaan arsitektur/desain ("kenapa X begini", "apakah Y akan konflik dengan Z") dari ingatan umum. Telusuri dulu implementasi konkret — baca kode terkait, cari precedent pola serupa di module lain di codebase ini — sebelum menyampaikan sesuatu sebagai fakta. Kalau setelah ditelusuri masih ambigu atau belum ketemu jawaban pasti, konfirmasi ke user secara eksplisit alih-alih menyimpulkan sendiri.

# Spec-Driven Development Workflow

## Evaluasi Request

**Langsung kerjakan** (tidak perlu spec): bug fix sederhana (1–3 file), perubahan kecil, refactor minor, pertanyaan kode.

**Perlu spec** (wajib tanya dulu): fitur baru, perubahan arsitektur, integrasi API baru, perubahan 4+ file, bug kompleks.

**Grey area** — selalu tawarkan pilihan: _"Langsung dikerjakan sekarang"_ vs _"Buat spec dulu"_.

## Struktur Spec

Semua spec di `.kiro/specs/<nama-spec>/`: `.config.kiro` (metadata JSON) · `requirements.md` · `design.md` · `tasks.md`.

```json
{
  "specId": "<uuid>",
  "workflowType": "requirements-first | design-first",
  "specType": "feature | bugfix",
  "description": "..."
}
```

## Workflow Spec

Tanyakan tipe (`feature`/`bugfix`), nama kebab-case, dan alur sebelum menulis apapun.

- **Requirement-first**: requirements → design → tasks
- **Design-first**: design → requirements → tasks

Gunakan slash commands: `/spec` · `/spec-read` · `/spec-req` · `/spec-design` · `/spec-task` · `/spec-list` · `/spec-status`

## Aturan Implementasi

Saat mengerjakan spec (termasuk spec dari Kiro di `.kiro/specs/`):

- **Baca dulu** `requirements.md` (behavior & acceptance criteria), `design.md` (arsitektur), `tasks.md` (checklist) sebelum coding
- Status task: `[ ]` todo · `[~]` queued · `[-]` in progress · `[x]` done
- Satu task sekaligus — tandai `[-]` saat mulai, kerjakan, validasi
- Jangan implementasi di luar task aktif
- Tandai `[x]` hanya jika implementasi dan test/build pass
- Sebutkan file yang berubah di setiap task selesai
- **Checkpoint = stop** — jalankan full test suite, konfirmasi ke user
- **Lint/Pint hanya dijalankan setelah semua task selesai** — jangan jalankan per task
- **Optional task** ditandai dengan `- [ ]\* <id> ...` — saat user minta mulai implementasi, tanyakan dulu: _"Jalankan required task saja, atau termasuk optional task?"_
- Ide baru → tambah ke spec dulu (jangan scope creep)

## Git Worktree

Saat menggunakan git worktree (via `EnterWorktree` atau manual), **wajib** pastikan branch aktif sudah up-to-date sebelum membuat worktree:

```bash
git fetch origin
git pull origin <nama-branch>
```

Baru kemudian buat worktree. Melewati langkah ini menyebabkan worktree dibuat dari commit lama sehingga push akan ditolak (non-fast-forward) dan rebase menghasilkan banyak konflik.

## CI/CD — Skip Deploy Otomatis saat Merge PR

Workflow [`deploy-cpanel.yml`](.github/workflows/deploy-cpanel.yml) auto-deploy ke staging setiap PR yang di-merge ke branch `dev-1`. Untuk menunda deploy PR tertentu (mis. mau digabung deploy dengan PR lain), tambahkan label **`skip-deploy`** (persis, case-sensitive) ke PR tersebut sebelum di-merge — job `deploy` otomatis di-skip untuk merge itu (lihat kondisi `if` di job `deploy`).

Label sudah dibuat di repo GitHub. Saat user minta buat/edit PR dengan skip deploy, pasang label ini: `gh pr create ... --label skip-deploy` atau `gh pr edit <PR> --add-label skip-deploy`.

## Struktur Folder `{Domain}/{Feature}` (lintas layer)

Berlaku untuk SEMUA layer app — bukan cuma Event/Listener: `Services`, `Models`, `Jobs`, `Events`, `Listeners`, `Controllers`, dan layer baru lainnya ke depan. Prinsip ini sudah eksis organik di codebase (lihat `app/Jobs/Core/Notification/SendNotificationMailJob.php` vs job Core lain yang flat) — di sini dituliskan eksplisit sebagai aturan.

**Domain** mengikuti konvensi yang sudah ada: `Core`, `Sales`, `Purchase`, `Inventory`, `Finances`, `Service`, `Helpdesk`, `User`, `Migration`.

**Kapan folder `{Feature}` di-nested — pemicunya JUMLAH FILE terkait, bukan sekadar "spesifik vs generik":**
- Fitur hanya butuh **1 file** (mis. satu Controller atau satu Service per model) → `{Domain}/NamaFile.php`, **tanpa** nested Feature. Ini kenapa `Controllers`/`Services`/`Models` per-model saat ini semuanya flat — satu model = satu file per layer, tidak ada alasan untuk nested.
- Fitur butuh **>1 file saling terkait** untuk berfungsi (mis. parser + sanitizer + renderer terpisah) → `{Domain}/{Feature}/`, **dengan** nested Feature. Contoh nyata: `app/Services/Core/PrintTemplate/` (9 file: `PdfExportService`, `TemplateParserService`, `HTMLSanitizerService`, dst).
- **Boleh preemptif**: nested tidak wajib menunggu sampai file ke-2 baru dibuat lalu dipindah — kalau developer bisa menilai fitur itu KEMUNGKINAN BESAR akan tumbuh butuh file pendamping ke depan, nested boleh dibuat sejak file pertama. Contoh: `app/Jobs/Core/Notification/SendNotificationMailJob.php` — saat ini cuma 1 file, tapi domain notifikasi jelas akan tumbuh (job notifikasi lain), jadi nested dari awal masuk akal. Ini penilaian kontekstual, bukan hitungan mekanis "sudah 2 file baru nested".

File-file yang berhubungan (mis. Event dan Listener pasangannya, atau Job dan Service yang men-trigger-nya) **tidak harus** berada di path `{Feature}` yang sama — evaluasi tiap file terpisah berdasar prediksi pertumbuhannya SENDIRI, karena bisa beda satu sama lain. Contoh dari spec `cancel-workflow-improvements`: `App\Events\Core\DocumentCanceled` (event generik untuk semua dokumen submitable yang dibatalkan, hanya 1 file dan tidak diprediksi butuh pendamping — berpotensi dikonsumsi banyak listener BEDA fitur, tapi event-nya sendiri tetap satu) TIDAK di-nest Feature, sedangkan listener-nya `App\Listeners\Core\Approval\CancelPendingApprovalSteps` (domain approval punya banyak aksi terkait — approve/reject/pending/cancel — diprediksi akan didampingi listener approval lain ke depan) DI-nest folder `Approval/`.

`Services`, `Models`, dan `Controllers` per-model saat ini semuanya flat — BUKAN berarti prinsipnya tidak berlaku di situ, tapi karena satu model secara alami hanya butuh satu Controller/Service/Model, tidak ada dorongan untuk pecah jadi banyak file. Kalau ada model/fitur yang Controller atau Service-nya diprediksi perlu dipecah (mis. logic terlalu besar, butuh helper class terpisah), nested Feature berlaku sama.

## Testing Frontend (Vitest)

Detail lengkap: [`docs/frontend.md#testing`](docs/frontend.md#testing). Ringkasan aturan wajib saat menulis test FE baru:

- **Co-located** dengan source, bukan folder `__tests__`. Tiga jenis test, urutan prioritas:
  1. **Unit test fungsi murni** (`.test.js`, environment `node`) — **paling diutamakan**, pakai kalau logic bisa diuji tanpa render.
  2. **Component test React Testing Library** (`.rtl.test.jsx`, environment `jsdom`) — **rekomendasi default untuk komponen UI baru** dengan interaksi user (form, input, tombol). Render sungguhan + `@testing-library/user-event` + `screen.getByRole()`.
  3. **Source-assertion test** (`readFileSync` + regex `toMatch`) — **hindari untuk komponen baru**, hanya kalau behavior genuinely sulit di-render (mis. GrapesJS canvas). Rapuh terhadap refactor (rename variabel/reorder — regex ketinggalan zaman tanpa behavior berubah).
- **Naming `.rtl.test.jsx` wajib** untuk test yang me-render komponen — `vitest.config.js` pakai `test.projects` (bukan `environmentMatchGlobs`, sudah dihapus di Vitest v4) untuk assign `jsdom` berdasar suffix ini. Lupa suffix → jalan di project `unit` (`node`) → gagal `document is not defined`.
- **Property-based test (`fast-check`)**: precondition `fc.pre(...)`/`.filter()` pada generator **harus selaras persis** dengan validasi source (bukan sekadar mirip) — contoh nyata: source pakai `Boolean(value.trim())`, precondition `fc.pre(Boolean(value))` saja meloloskan string whitespace-only yang seharusnya ditolak, dan random seed fast-check membuat bug ini nyaris tidak pernah ketahuan.
- CI (`.github/workflows/tests.yml`) menjalankan `npm run test` tanpa `continue-on-error` — test FE gagal = CI merah.

<laravel-boost-guidelines>
=== foundation rules ===

# Laravel Boost Guidelines

The Laravel Boost guidelines are specifically curated by Laravel maintainers for this application. These guidelines should be followed closely to ensure the best experience when building Laravel applications.

## Foundational Context

This application is a Laravel application and its main Laravel ecosystems package & versions are below. You are an expert with them all. Ensure you abide by these specific packages & versions.

- php - 8.4
- inertiajs/inertia-laravel (INERTIA_LARAVEL) - v2
- laravel/breeze (BREEZE) - v2
- laravel/framework (LARAVEL) - v12
- laravel/prompts (PROMPTS) - v0
- laravel/sanctum (SANCTUM) - v4
- laravel/socialite (SOCIALITE) - v5
- tightenco/ziggy (ZIGGY) - v2
- larastan/larastan (LARASTAN) - v3
- laravel/boost (BOOST) - v2
- laravel/mcp (MCP) - v0
- laravel/pail (PAIL) - v1
- laravel/pint (PINT) - v1
- laravel/sail (SAIL) - v1
- phpunit/phpunit (PHPUNIT) - v11
- @inertiajs/react (INERTIA_REACT) - v2
- @laravel/echo-react (ECHO_REACT) - v2
- eslint (ESLINT) - v9
- laravel-echo (ECHO) - v2
- prettier (PRETTIER) - v3
- react (REACT) - v19
- tailwindcss (TAILWINDCSS) - v4

## Skills Activation

This project has domain-specific skills available. You MUST activate the relevant skill whenever you work in that domain—don't wait until you're stuck.

- `laravel-best-practices` — Apply this skill whenever writing, reviewing, or refactoring Laravel PHP code. This includes creating or modifying controllers, models, migrations, form requests, policies, jobs, scheduled commands, service classes, and Eloquent queries. Triggers for N+1 and query performance issues, caching strategies, authorization and security patterns, validation, error handling, queue and job configuration, route definitions, and architectural decisions. Also use for Laravel code reviews and refactoring existing Laravel code to follow best practices. Covers any task involving Laravel backend PHP code patterns.
- `socialite-development` — Manages OAuth social authentication with Laravel Socialite. Activate when adding social login providers; configuring OAuth redirect/callback flows; retrieving authenticated user details; customizing scopes or parameters; setting up community providers; testing with Socialite fakes; or when the user mentions social login, OAuth, Socialite, or third-party authentication.
- `inertia-react-development` — Develops Inertia.js v2 React client-side applications. Activates when creating React pages, forms, or navigation; using <Link>, <Form>, useForm, or router; working with deferred props, prefetching, or polling; or when user mentions React with Inertia, React pages, React forms, or React navigation.
- `echo-react-development` — Develops real-time broadcasting in React applications with Laravel Echo. Activates when configuring Echo in React (configureEcho); using hooks (useEcho, useEchoPublic, useEchoPresence, useEchoModel, useEchoNotification, useConnectionStatus); listening for broadcast events in React components; implementing client events (whisper) in React; or when the user mentions Echo with React, real-time React hooks, or broadcasting in React components.
- `echo-development` — Develops real-time broadcasting with Laravel Echo. Activates when setting up broadcasting (Reverb, Pusher, Ably); creating ShouldBroadcast events; defining broadcast channels (public, private, presence, encrypted); authorizing channels; configuring Echo; listening for events; implementing client events (whisper); setting up model broadcasting; broadcasting notifications; or when the user mentions broadcasting, Echo, WebSockets, real-time events, Reverb, or presence channels.
- `tailwindcss-development` — Always invoke when the user's message includes 'tailwind' in any form. Also invoke for: building responsive grid layouts (multi-column card grids, product grids), flex/grid page structures (dashboards with sidebars, fixed topbars, mobile-toggle navs), styling UI components (cards, tables, navbars, pricing sections, forms, inputs, badges), adding dark mode variants, fixing spacing or typography, and Tailwind v3/v4 work. The core use case: writing or fixing Tailwind utility classes in HTML templates (Blade, JSX, Vue). Skip for backend PHP logic, database queries, API routes, JavaScript with no HTML/CSS component, CSS file audits, build tool configuration, and vanilla CSS.

## Conventions

- You must follow all existing code conventions used in this application. When creating or editing a file, check sibling files for the correct structure, approach, and naming.
- Use descriptive names for variables and methods. For example, `isRegisteredForDiscounts`, not `discount()`.
- Check for existing components to reuse before writing a new one.

## Verification Scripts

- Do not create verification scripts or tinker when tests cover that functionality and prove they work. Unit and feature tests are more important.

## Application Structure & Architecture

- Stick to existing directory structure; don't create new base folders without approval.
- Do not change the application's dependencies without approval.

## Frontend Bundling

- If the user doesn't see a frontend change reflected in the UI, it could mean they need to run `npm run build`, `npm run dev`, or `composer run dev`. Ask them.

## Documentation Files

- You must only create documentation files if explicitly requested by the user.

## Replies

- Be concise in your explanations - focus on what's important rather than explaining obvious details.

=== boost rules ===

# Laravel Boost

## Tools

- Laravel Boost is an MCP server with tools designed specifically for this application. Prefer Boost tools over manual alternatives like shell commands or file reads.
- Use `database-query` to run read-only queries against the database instead of writing raw SQL in tinker.
- Use `database-schema` to inspect table structure before writing migrations or models.
- Use `get-absolute-url` to resolve the correct scheme, domain, and port for project URLs. Always use this before sharing a URL with the user.

## Searching Documentation (IMPORTANT)

- Always use `search-docs` before making code changes. Do not skip this step. It returns version-specific docs based on installed packages automatically.
- Pass a `packages` array to scope results when you know which packages are relevant.
- Use multiple broad, topic-based queries: `['rate limiting', 'routing rate limiting', 'routing']`. Expect the most relevant results first.
- Do not add package names to queries because package info is already shared. Use `test resource table`, not `filament 4 test resource table`.

### Search Syntax

1. Use words for auto-stemmed AND logic: `rate limit` matches both "rate" AND "limit".
2. Use `"quoted phrases"` for exact position matching: `"infinite scroll"` requires adjacent words in order.
3. Combine words and phrases for mixed queries: `middleware "rate limit"`.
4. Use multiple queries for OR logic: `queries=["authentication", "middleware"]`.

## Artisan

- Run Artisan commands directly via the command line (e.g., `php artisan route:list`). Use `php artisan list` to discover available commands and `php artisan [command] --help` to check parameters.
- Inspect routes with `php artisan route:list`. Filter with: `--method=GET`, `--name=users`, `--path=api`, `--except-vendor`, `--only-vendor`.
- Read configuration values using dot notation: `php artisan config:show app.name`, `php artisan config:show database.default`. Or read config files directly from the `config/` directory.
- To check environment variables, read the `.env` file directly.

## Tinker

- Execute PHP in app context for debugging and testing code. Do not create models without user approval, prefer tests with factories instead. Prefer existing Artisan commands over custom tinker code.
- Always use single quotes to prevent shell expansion: `php artisan tinker --execute 'Your::code();'`
  - Double quotes for PHP strings inside: `php artisan tinker --execute 'User::where("active", true)->count();'`

=== php rules ===

# PHP

- Always use curly braces for control structures, even for single-line bodies.
- Use PHP 8 constructor property promotion: `public function __construct(public GitHub $github) { }`. Do not leave empty zero-parameter `__construct()` methods unless the constructor is private.
- Use explicit return type declarations and type hints for all method parameters: `function isAccessible(User $user, ?string $path = null): bool`
- Use TitleCase for Enum keys: `FavoritePerson`, `BestLake`, `Monthly`.
- Prefer PHPDoc blocks over inline comments. Only add inline comments for exceptionally complex logic.
- Use array shape type definitions in PHPDoc blocks.

=== tests rules ===

# Test Enforcement

- Every change must be programmatically tested. Write a new test or update an existing test, then run the affected tests to make sure they pass.
- Run the minimum number of tests needed to ensure code quality and speed. Use `php artisan test --compact` with a specific filename or filter.

=== inertia-laravel/core rules ===

# Inertia

- Inertia creates fully client-side rendered SPAs without modern SPA complexity, leveraging existing server-side patterns.
- Components live in `resources/js/Pages` (unless specified in `vite.config.js`). Use `Inertia::render()` for server-side routing instead of Blade views.
- ALWAYS use `search-docs` tool for version-specific Inertia documentation and updated code examples.
- IMPORTANT: Activate `inertia-react-development` when working with Inertia client-side patterns.

# Inertia v2

- Use all Inertia features from v1 and v2. Check the documentation before making changes to ensure the correct approach.
- New features: deferred props, infinite scroll, merging props, polling, prefetching, once props, flash data.
- When using deferred props, add an empty state with a pulsing or animated skeleton.

=== laravel/core rules ===

# Do Things the Laravel Way

- Use `php artisan make:` commands to create new files (i.e. migrations, controllers, models, etc.). You can list available Artisan commands using `php artisan list` and check their parameters with `php artisan [command] --help`.
- If you're creating a generic PHP class, use `php artisan make:class`.
- Pass `--no-interaction` to all Artisan commands to ensure they work without user input. You should also pass the correct `--options` to ensure correct behavior.

### Model Creation

- When creating new models, create useful factories and seeders for them too. Ask the user if they need any other things, using `php artisan make:model --help` to check the available options.

## APIs & Eloquent Resources

- For APIs, default to using Eloquent API Resources and API versioning unless existing API routes do not, then you should follow existing application convention.

## URL Generation

- When generating links to other pages, prefer named routes and the `route()` function.

## Testing

- When creating models for tests, use the factories for the models. Check if the factory has custom states that can be used before manually setting up the model.
- Faker: Use methods such as `$this->faker->word()` or `fake()->randomDigit()`. Follow existing conventions whether to use `$this->faker` or `fake()`.
- When creating tests, make use of `php artisan make:test [options] {name}` to create a feature test, and pass `--unit` to create a unit test. Most tests should be feature tests.

## Vite Error

- If you receive an "Illuminate\Foundation\ViteException: Unable to locate file in Vite manifest" error, you can run `npm run build` or ask the user to run `npm run dev` or `composer run dev`.

## Deployment

- Laravel can be deployed using [Laravel Cloud](https://cloud.laravel.com/), which is the fastest way to deploy and scale production Laravel applications.

=== laravel/v12 rules ===

# Laravel 12

- CRITICAL: ALWAYS use `search-docs` tool for version-specific Laravel documentation and updated code examples.
- Since Laravel 11, Laravel has a new streamlined file structure which this project uses.

## Laravel 12 Structure

- In Laravel 12, middleware are no longer registered in `app\Http/Kernel.php`.
- Middleware are configured declaratively in `bootstrap/app.php` using `Application::configure()->withMiddleware()`.
- `bootstrap/app.php` is the file to register middleware, exceptions, and routing files.
- `bootstrap/providers.php` contains application specific service providers.
- The `app\Console/Kernel.php` file no longer exists; use `bootstrap/app.php` or `routes/console.php` for console configuration.
- Console commands in `app\Console/Commands/` are automatically available and do not require manual registration.

## Database

- When modifying a column, the migration must include all of the attributes that were previously defined on the column. Otherwise, they will be dropped and lost.
- Laravel 12 allows limiting eagerly loaded records natively, without external packages: `$query->latest()->limit(10);`.

### Models

- Casts can and likely should be set in a `casts()` method on a model rather than the `$casts` property. Follow existing conventions from other models.

=== pint/core rules ===

# Laravel Pint Code Formatter

- If you have modified any PHP files, you must run `vendor/bin/pint --dirty --format agent` before finalizing changes to ensure your code matches the project's expected style.
- Do not run `vendor/bin/pint --test --format agent`, simply run `vendor/bin/pint --format agent` to fix any formatting issues.

=== phpunit/core rules ===

# PHPUnit

- This application uses PHPUnit for testing. All tests must be written as PHPUnit classes. Use `php artisan make:test --phpunit {name}` to create a new test.
- If you see a test using "Pest", convert it to PHPUnit.
- Every time a test has been updated, run that singular test.
- When the tests relating to your feature are passing, ask the user if they would like to also run the entire test suite to make sure everything is still passing.
- Tests should cover all happy paths, failure paths, and edge cases.
- You must not remove any tests or test files from the tests directory without approval. These are not temporary or helper files; these are core to the application.

## Running Tests

- Run the minimal number of tests, using an appropriate filter, before finalizing.
- To run all tests: `php artisan test --compact`.
- To run all tests in a file: `php artisan test --compact tests/Feature/ExampleTest.php`.
- To filter on a particular test name: `php artisan test --compact --filter=testName` (recommended after making a change to a related file).

=== inertia-react/core rules ===

# Inertia + React

- IMPORTANT: Activate `inertia-react-development` when working with Inertia React client-side patterns.

</laravel-boost-guidelines>

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
