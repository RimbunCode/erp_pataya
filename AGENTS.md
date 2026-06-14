# Project Instructions

Laravel 12 + Inertia.js v2 + React 19 ERP application. See `CLAUDE.md` for full Laravel Boost guidelines.

## Terminal Shell

Semua terminal command harus Bash-compatible (`C:/Program Files/Git/usr/bin/bash.exe`). Jangan gunakan PowerShell/cmd.
Gunakan: `ls`, `cp`, `mv`, `rm`, `export VAR=value`, forward slashes di path.

## Development Commands

**Start dev environment** (recommended):

```bash
composer run dev
```

Runs: PHP server (port 8000) + queue worker + logs + Vite dev server concurrently.

**Simple dev** (server + Vite only):

```bash
composer run dev:simple
```

**Debug mode** (with Xdebug):

```bash
composer run dev:debug
```

**Frontend only**:

```bash
npm run dev
```

**Production build** (client + SSR):

```bash
npm run build
```

Runs both `vite build` and `vite build --ssr`.

## Code Quality

**Run before finalizing PHP changes**:

```bash
vendor/bin/pint --dirty --format agent
```

**Lint JavaScript/React**:

```bash
npm run lint          # Check only
npm run lint:fix      # Auto-fix
```

**Run tests** (focused):

```bash
php artisan test --compact --filter=testName
php artisan test --compact tests/Feature/ExampleTest.php
```

## Zod Schema Generation

After modifying Laravel models or API resources:

```bash
npm run zodgen
```

Generates `resources/js/schema.js` from Laravel types. The postprocess script converts `.ts` to `.js`.

## Architecture Notes

**Inertia Pages**: `resources/js/Pages/` organized by domain (Auth, Dashboard, Finances, Inventory, Purchase, Sales, Services, Settings, Users).

**SSR**: Enabled. Entry points: `resources/js/app.jsx` (client), `resources/js/ssr.jsx` (server).

**Custom ESLint Rules**:

- `local/case-sensitive-import-paths` - Enforces exact file casing in imports (critical on case-sensitive systems)
- `local/no-unused-vars-fixer` - Auto-removes unused imports, prefixes unused vars with `_`

**Laravel 12 Structure**:

- Middleware: `bootstrap/app.php` (not `app/Http/Kernel.php`)
- Console: Commands auto-discovered in `app/Console/Commands/`
- Service Providers: `bootstrap/providers.php`

## Kiro Spec Workflow

When implementing features from `.kiro/specs/<name>/`:

1. **Read first**: `requirements.md` (behavior), `design.md` (architecture), `tasks.md` (checklist)
2. **Task states**: `[ ]` todo, `[~]` queued, `[-]` in progress, `[x]` done
3. **Work one task at a time**: Mark `[-]` when starting, implement, validate, mark `[x]` only if tests pass
4. **Checkpoints**: Stop and run full test suite when indicated
5. **Lint/Pint**: Run only after all tasks complete, not per-task
6. **Optional tasks**: Marked with `- [ ]* <id> ...` - ask user whether to include before starting

## Terminal Shell

Git Bash on Windows: `C:/Program Files/Git/usr/bin/bash.exe`

Use Bash commands: `ls`, `cp`, `mv`, `rm`, `export VAR=value`
NOT PowerShell: `dir`, `Copy-Item`, `Move-Item`, `Remove-Item`, `$env:VAR="value"`

## Terminal Shell

Git Bash on Windows: `C:/Program Files/Git/usr/bin/bash.exe`

Use Bash commands: `ls`, `cp`, `mv`, `rm`, `export VAR=value`
NOT PowerShell: `dir`, `Copy-Item`, `Move-Item`, `Remove-Item`, `$env:VAR="value"`
