# DataTable2 Row Actions — Implementation Plan

> **For agentic workers:** Kerjakan HANYA task yang ditugaskan. Baca bagian **Shared Context** dulu — semua fakta codebase yang dibutuhkan sudah ada di sana; jangan menjelajah ulang codebase di luar file yang disebut task. Steps memakai checkbox (`- [ ]`).

**Goal:** Checkbox seleksi default di semua `DataTable2`, kolom aksi jadi menu `⋯` (Hapus bawaan + aksi custom), bulk action untuk baris tercentang, endpoint `destroyMany`, dan mode pilih long-press di mobile.

**Architecture:** State seleksi milik `DataTable2` (`Map<id,row>`) diteruskan ke `Table2` secara controlled (opsional, `SelectModel` tetap uncontrolled). Aksi didefinisikan deklaratif (`rowActions`) dan dirender oleh `RowActionsMenu` (per baris) + `BulkActionBar` (massal). Backend: `destroyRecord()` sebagai titik ekstensi, dipakai `destroy` dan `destroyMany` (satu transaksi).

**Tech Stack:** Laravel 12 / PHP 8.4 / PHPUnit 11, Inertia v3 + React 19, Radix UI (shadcn), Vitest + React Testing Library, Tailwind v4.

**Spec:** `.kiro/specs/datatable2-row-actions/requirements.md`, `.kiro/specs/datatable2-row-actions/design.md`

---

## Shared Context (WAJIB dibaca setiap subagent)

### Lingkungan

- Worktree: `D:/Project/erp/.claude/worktrees/datatable2-checkbox-actions-17bfcf` (semua command dijalankan dari sini, path absolut). Branch: `claude/datatable2-checkbox-actions-17bfcf`.
- Shell: **Bash** (Git Bash). Jangan pakai PowerShell. `rg` tidak ada — gunakan tool Grep/Glob.
- PHP tidak ada di PATH Bash. Selalu prefix: `export PATH="/c/Users/Rahmad Maulana/.config/herd/bin/php84:$PATH" && php ...`
- Backend test: `php artisan test --compact <file|--filter=name>` (SQLite in-memory).
- Frontend test: `npx vitest run <path>` (project dipilih dari suffix: `*.test.js` = node, `*.rtl.test.jsx` = jsdom + `resources/js/test-setup.js`).
- Lint/format dijalankan HANYA di task terakhir (Task 11).
- **Jangan** `git stash`. Commit di akhir tiap task: `git add <file spesifik>` lalu `git commit -m "<type>(<scope>): <pesan>"` dengan baris terakhir `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (pakai heredoc).
- Komentar kode dalam Bahasa Indonesia, gaya mengikuti file sekitar. PHP: kurung kurawal selalu, return type eksplisit, PHPDoc.

### Fakta backend

- `app/Http/Controllers/Controller.php`:
  - Constructor `__construct(Request $request, ?string $model = null)` men-share `model`, `translateKey` via `Inertia::share`, lalu (kecuali `ignorePermission`) memetakan nama method → permission lewat `match ($method) { 'index' => 'select', ..., 'destroy' => 'delete', ... default => $this->enforcePermission($method) }` (sekitar baris 144-171). Setelah itu `$this->onlyCreator = $this->guard($keyPermission, 0)` dan untuk route parameter berupa model dicek `created_by_id == user id` bila `onlyCreator`.
  - Sekitar baris 536-563: `protected function beforeDestroy(Model $data): void {}`, `protected function indexRouteName(): string` (`Str::before(route name, '.') . '.index'`), dan `public function destroy(mixed $id)` (findOrFail → beforeDestroy → `DB::beginTransaction` → `$data->delete()` → `event(new AuditableModelSaved($data, 'deleted'))` → commit → `redirect()->route($this->indexRouteName())`).
- Controller yang meng-override `destroy`: `Core/BackupController`, `Core/SettingController`, `Core/TagController` (body KOSONG = sengaja menonaktifkan hapus), `User/UserController` (validasi `password => required|current_password`, `$user->delete()`, `$user->logForDeleted()`, transaksi manual), `Core/SavedFilterController` (bukan `resourceDetail`, abaikan).
- `routes/web.php` baris ~84: `Route::macro('resourceDetail', function ($name, $controller, bool $isSubmmitable = false, $nestedShow = null)`; `$uri = Str::plural($name)`; route koleksi: `Route::get('/', 'index')->name("$uri.index"); Route::post('/', 'store')->name("$uri.store");` dan `Route::delete("/{{$name}}", 'destroy')->name("$uri.destroy");`. `tag` & `user` & `supplier` memakai macro ini (`suppliers.*`, `tags.*`, `users.*`).
- Guard `canDelete`: `app/Traits/LinkModel.php` ~baris 67: listener `static::deleting` melempar `ValidationException::withMessages(['delete' => 'Data tidak dapat dihapus karena ...'])` bila `($model->canDelete ?? true) !== true` (dapat dimatikan `config('have_transactions.enforce_delete_guard')`).
- `app/Models/Scopes/DataTableScope.php` ~baris 324-347: `$extraKeys = array_merge(<sort key>, <group relation columns>, ['route', 'canDelete', 'keyModel', 'appendStatus', 'thisModel', 'templateLink', 'disabledOn'])`, lalu `$selector->safeColumnsFromVisible($dataTableColumns, $visibleKeys, $extraKeys)` dan `resolveForSafe(...)`. `$modelClass = \get_class($query->getModel())` tersedia tepat sesudahnya (pindahkan ke atas bila perlu). Append tanpa `dependsOn` di `configColumns` → throw (`collectAppendStrict`).
- Kolom config `hidden => true` di `configColumns` ikut ke metadata kolom; frontend `DataTable2.getColumns` melewati `col.hidden`, jadi atribut aksi tidak tampil sebagai kolom.
- Test pola feature: lihat `tests/Feature/Core/BranchControllerTest.php` — `use RefreshDatabase`, `withoutMiddleware([AppMiddleware::class, EnsureUserIsOnboarded::class, HandleInertiaRequests::class, LanguageMiddleware::class])`, session permission:
  ```php
  ['permissions' => [Model::class => [0 => [[ 'model' => Model::class, 'level' => 0, 'only_creator' => false,
      'permissions' => ['select' => true, 'read' => true, 'write' => true, 'create' => true, 'delete' => true] ]]]]]
  ```
  dipakai `->actingAs($user)->withSession($perm)`. Tambahan setUp `if (Schema::hasTable('users') && ! Schema::hasColumn('users', 'is_example')) { Schema::table('users', fn ($t) => $t->boolean('is_example')->default(false)); }`.
- `Supplier` (`App\Models\Purchase\Supplier`): ULID string id, `SoftDeletes`, `SupplierFactory` ada, tabel TANPA `created_by_id` (tambahkan kolom nullable di setUp test bila perlu). Ini model uji untuk `destroyMany`.
- `GlPostingStatus` (`app/Models/Core/GlPostingStatus.php`): `status` di-cast `FormStatusCast` (bandingkan `=== FormStatus::FAILED`), `configColumns` punya `status`, permissions `['select','read','write']`. Route: `gl-posting-statuses.index`, `gl-posting-statuses.retry` (POST `/{glPostingStatus}/retry`). Test yang ada: `tests/Feature/Core/GlPostingStatusControllerTest.php`.
- `HandleInertiaRequests` men-share semua key flash session di bawah prop `flash` (`->with('success', ...)` → `props.flash.success`).

### Fakta frontend

- `resources/js/Pages/Core/DataTable2.jsx` (±1240 baris, `memo(forwardRef(function DataTable2({ form, defaultValueForm, classNameDialog, actions: _actions, templateItem, usePasswordConfirmationForDelete, forceCanCreate }, ref)`):
  - `const { deleteItem } = useDeleteModal();`, `const { can } = usePermission(model);`, props halaman dari `usePage().props`: `data, defaultSort, defaultFilterId, dataTableColumns, translateKey, model, name, groupMeta, defaultGroups, searchScope`.
  - `const actions = useCallback(...)` (±baris 304-334) merender tombol `Trash2Icon` (`deleteItem(\`${pluralize.plural(name ?? "")}.destroy\`, props.dataRow.id, { usePasswordConfirmation })`) bila `props.dataRow.canDelete !== false && can("delete", { user_id: props.dataRow?.created_by_id })`, lalu `_actions?.(props)`.
  - `options` state: `{ sort, fid, page, show, group, groupSort }`; `loadData` (useCallback, `router.get(buildOptionsUrl(options), {}, { reset: [...], preserveScroll, preserveState, replace })`).
  - `treeVersion` (naik setiap objek `data` berubah, ±baris 828-835), `groupTreeProps` (null bila tidak grup).
  - `mobileItem(row)` (±baris 847) = `templateItem?.({ dataRow: row, deleteItem: () => deleteItem(...) })`; dirender di cabang `isMobile` (±baris 1109-1150): mode grup via `<GroupTree ... renderRow={(row) => mobileItem(row) ?? null} />`, mode flat via `data.data.map((x) => cloneElement(item, { key: x.id, ...item.props }))`.
  - Header mobile: `<DropdownMenu>` dengan trigger `<Ellipsis />` (±baris 870-909) berisi item reload & sub-menu show.
  - Desktop: `<Table2 reload={loadData} columnFilter={columnFilter} className="flex-1 min-h-0" actions={actions} columns={mapColumns} data={data.data} options={options} ... group={...} />` (±baris 1157) di dalam container `<div className="flex flex-col flex-1 min-h-0 max-w-full mt-3 border rounded-lg ...">`.
  - Import yang sudah ada: `Button`, `DropdownMenu*`, `Tooltip*`, `Dialog*`, `cn`, `pluralize`, `useDeleteModal`, `usePermission`, `useIsMobile` (`@/Hooks/use-mobile`), `useLaravelReactI18n`, `router`/`usePage` dari `@inertiajs/react`.
- `resources/js/Components/Table/Table2.jsx`:
  - `export const TableRow = memo(function TableRow({ row, selectable, actions, showedColumns, onRowClick, onCheck }))` (±baris 343): sel checkbox `<Checkbox checked={row.isSelected ?? false} onCheckedChange={(check) => onCheck(row, check)} />`, sel aksi `<td className="w-full flex flex-row! items-center gap-x-2 border-r border-muted-foreground/15">{actions({ dataRow: row })}</td>`.
  - `const Table2 = forwardRef(function Table2({ className, selectable, actions, columns: headers, ..., group, columnFilter }, ref)`; `const [data, setData] = useState(initialData)`; `useImperativeHandle(ref, () => ({ getSelectedItem() { return data.filter((x) => x.isSelected); } }))`.
  - `checkAll` (±baris 766) & `checklist` (±baris 820) memutasi `isSelected` di state `data`. `renderGroupRow` (±baris 789) memberi `onCheck={() => {}}`.
  - Header (±baris 871): `<Checkbox checked={data.every((x) => x.isSelected ?? false)} onCheckedChange={checkAll} />` (BUG: `[].every` = true), header aksi `<span>{t("core.datatable.action")}</span>`.
  - Flat rows (±baris 955): `data.map((row, index) => <TableRow key={index} ... onCheck={checklist} />)`.
  - Pemakai lain `Table2` dengan `selectable` uncontrolled: `Components/SelectModel.jsx`, `Components/LinkModel/AdvanceSearchDialog.jsx` — **perilakunya tidak boleh berubah**.
- `resources/js/Components/ui/checkbox.jsx`: `Checkbox` (Radix) dengan `role="forminput"` (test lama memakai `getAllByRole("forminput")`), mendukung `checked="indeterminate"`.
- Dropdown: `@/Components/ui/dropdown-menu` (`DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator`). Dialog: `@/Components/ui/dialog`. AlertDialog: `@/Components/ui/alert-dialog` (dipakai `Layouts/AlertDialogs/DeleteDialog.jsx`, yang juga memakai `PasswordInput` — lihat file itu untuk import).
- `resources/js/Hooks/usePermission.js`: `can(action, { user_id })`.
- i18n: `lang/en/core/datatable.php`, `lang/id/core/datatable.php` (array PHP; key diakses `core.datatable.<key>`). Ada test `tests/Feature/LocaleKeysTest.php` yang membandingkan key en vs id — tambahkan key ke KEDUA file.
- Test `DataTable2.rtl.test.jsx`: `t` mock = `TR:${key}` (+ `:${JSON.stringify(params)}` bila ada params); `usePageMock`, `canMock`, `isMobileMock`, `deleteItemSpy`, `routerGet` (mock `router: { get }` — tambahkan `delete` bila perlu), `Table2` di-STUB: merender `props.data.map(row => <div data-testid={\`row-${row.id}\`}>{props.actions?.({ dataRow: row })}</div>)` dan merekam props lewat `table2Props`. Helper: `renderDataTable2(ui)`, `makePageProps(overrides)` (`name: "supplier"`, `model: "App\\Models\\Purchase\\Supplier"`, data id 1 & 2 `canDelete: true`). Test lama delete: "tombol delete (actions bawaan) ..." (±baris 675-725) dan mobile "templateItem menerima closure deleteItem" — harus diperbarui ke UI baru.
- `window.route` dipakai sebagai global di halaman (`const route = window.route;`); di test di-set `window.route = (name, param) => ...`.

### Kontrak lintas task (nama & tipe WAJIB sama)

```js
// resources/js/Components/Table/RowActions/rowActions.js
export const DELETE_ACTION_KEY = "__delete";
export function normalizeAction(def) // => { key, label, icon, variant:"default"|"destructive", single:true, bulk:false, enabled:(row)=>true, requires:[], confirm:null, onAction }
export function resolveRowActions(actions, row) // => actions (sudah normalized) yg single && enabled(row)
export function partitionBulk(action, rows) // => { eligible: row[], skipped: row[] }
export function buildDeleteAction({ can, label, bulkDestroy, onSingle, onBulk }) // => normalized action
// Pemanggilan aksi SELALU: action.onAction(rows, { clearSelection, reload, source: "single" | "bulk" })
export function warnMissingRequires(actions, rows) // dev-only console.warn, no-op saat import.meta.env.PROD

// resources/js/Components/Table/RowActions/useRowSelection.js
export default function useRowSelection({ resetKey }) // => { selected: Map, rows: row[], count, isSelected(row), toggle(row, checked), setMany(rows, checked), clear() }

// resources/js/Components/Table/RowActions/useLongPress.js
export default function useLongPress({ onLongPress, delay = 500, moveThreshold = 10 }) // => { handlers: {onPointerDown,onPointerMove,onPointerUp,onPointerCancel,onPointerLeave,onContextMenu}, consumeLongPress(): boolean }

// Komponen
<RowActionsMenu row actions onRun />            // onRun(action, [row]); null bila tak ada aksi
<BulkActionBar rows actions pendingKey onRun onClear variant="desktop"|"mobile" />
<ActionConfirmDialog open title description confirmLabel destructive requirePassword errors processing onConfirm(password) onOpenChange />
<MobileRowShell selectionMode checked onToggle onLongPress menu label>{children}</MobileRowShell>

// Table2 prop baru (opsional)
selection = { isSelected(row) => bool, toggle(row, checked), setMany(rows, checked) }

// DataTable2 props baru
rowActions = [], selectable = true, hideDeleteAction = false   // prop `actions` DIHAPUS
// Inertia shared prop dari backend: bulkDestroy (bool)
// Route bulk: `${pluralize.plural(name)}.destroyMany`, router.delete(route(..), { data: { ids, password? } })
```

Key i18n baru (`core.datatable.*`): `row_actions`, `select_row`, `select_all`, `selected` (`:count dipilih`), `bulk_count` (`:label (:count)`), `bulk_count_partial` (`:label (:count dari :total)`), `bulk_skipped` (`:count baris tidak memenuhi syarat dan akan dilewati`), `clear_selection`, `select_mode`, `delete`, `delete_selected`, `delete_selected_description` (`:count data akan dihapus permanen.`), `deleted_count` (`:count data dihapus`), `confirm`, `cancel`.

---

## Global Constraints

- `SelectModel` & `AdvanceSearchDialog` (Table2 uncontrolled) tidak boleh berubah perilaku.
- `ids` bulk: array, min 1, max 500, distinct; id dapat berupa ULID string.
- Satu transaksi untuk bulk; gagal satu = rollback semua.
- `enabled(row)` hanya membaca `id`, accessor bawaan (`canDelete`, `created_by_id`, ...), atau atribut di `$rowActionAttributes`.
- Teks UI baru wajib lewat i18n en + id.

## Review Focus

- ID ULID (string) vs number: `Map` key dan `ids` request harus konsisten (pakai `row.id` apa adanya) → test di Task 1 (ULID) & Task 5.
- Header checkbox saat data kosong tidak boleh tampil tercentang (`[].every` = true) → test di Task 7.
- Record sudah terhapus/soft-deleted saat bulk dikirim (data basi) → 404 tanpa menghapus apa pun → test di Task 1.
- Gerakan scroll di kartu mobile tidak boleh memicu long-press → test di Task 5.
- Seleksi harus kosong setelah bulk delete sukses dan setelah ganti halaman/filter → test di Task 8.

---

## Tasks

- [ ] 1. Backend: `destroyRecord` + `destroyMany` + route **(model: sonnet)**

  **Files:** Modify `app/Http/Controllers/Controller.php`, `routes/web.php`; Create `tests/Feature/Core/DestroyManyTest.php`.

  - [ ] 1.1 Tulis `tests/Feature/Core/DestroyManyTest.php` (pola BranchControllerTest; model `Supplier`, route `suppliers.destroyMany`, `suppliers.destroy`, `tags.destroyMany`). setUp tambahan: `if (! Schema::hasColumn('suppliers', 'created_by_id')) { Schema::table('suppliers', fn ($t) => $t->string('created_by_id')->nullable()); }`. Helper `permissions(bool $onlyCreator = false)` untuk `Supplier::class` dan `Tag::class` (`App\Models\Core\Tag`). Test:
    - `test_bulk_delete_removes_all_records_in_one_request` — 3 supplier, `deleteJson`/`delete(route('suppliers.destroyMany'), ['ids' => [...]])` → `assertRedirect(route('suppliers.index'))`, `assertSessionHas('success')`, ketiganya `assertSoftDeleted`.
    - `test_bulk_delete_accepts_ulid_string_ids` (id dari factory adalah ULID string; pastikan terhapus).
    - `test_bulk_delete_validates_ids` — `[]` → 422 `ids`; duplikat → 422 `ids.1`; 501 id → 422 `ids` (pakai `postJson`-style `deleteJson`).
    - `test_bulk_delete_returns_404_and_deletes_nothing_when_an_id_is_missing` — 2 valid + 1 `'01NOTEXIST...'` (26 char) → 404; 2 valid `assertNotSoftDeleted`. Sertakan juga kasus id yang sudah soft-deleted → 404.
    - `test_bulk_delete_rolls_back_all_when_one_record_fails_guard` — daftarkan `Supplier::deleting(function ($s) { if ($s->name === 'BLOCKED') { throw ValidationException::withMessages(['delete' => 'Tidak boleh']); } });` lalu 2 normal + 1 `name = 'BLOCKED'` → `deleteJson` 422 dengan `errors.delete.0` mengandung `'BLOCKED'` dan `'Tidak boleh'`; semua `assertNotSoftDeleted`. (Bersihkan listener: `Supplier::flushEventListeners()` di tearDown lalu `Supplier::boot` tidak perlu — cukup jalankan test ini terakhir atau gunakan `Event::forget('eloquent.deleting: '.Supplier::class)` setelah assert.)
    - `test_bulk_delete_forbidden_when_only_creator_and_a_record_belongs_to_another_user` — permission `only_creator => true`, satu record `created_by_id = $other->id` → 403; tidak ada yang terhapus. Dan kasus semua milik user → sukses.
    - `test_bulk_delete_returns_405_for_controller_with_custom_destroy` — `deleteJson(route('tags.destroyMany'), ['ids' => [$tag->id]])` → 405 (pakai `Tag::factory()`).
    - `test_single_destroy_still_works` — `delete(route('suppliers.destroy', $s->id))` → redirect index, soft deleted.
  - [ ] 1.2 Jalankan: `php artisan test --compact tests/Feature/Core/DestroyManyTest.php` → FAIL (route tidak ada).
  - [ ] 1.3 Route di macro `resourceDetail` tepat setelah `store`: `Route::delete('/', 'destroyMany')->name("$uri.destroyMany");`
  - [ ] 1.4 `Controller.php`:
    - Mapping constructor: ganti `'destroy' => 'delete',` menjadi `'destroy', 'destroyMany' => 'delete',`.
    - Di constructor setelah `Inertia::share([... 'model', 'translateKey'])` tambahkan `'bulkDestroy' => fn (): bool => $this->supportsBulkDestroy(),` ke array share yang sama.
    - Tambahkan (dengan PHPDoc Bahasa Indonesia):
    ```php
    protected function destroyRequiresPassword(): bool {
        return false;
    }

    protected function validateDestroyPassword(): void {
        if ($this->destroyRequiresPassword()) {
            request()->validate(['password' => ['required', 'current_password']]);
        }
    }

    protected function destroyRecord(Model $data): void {
        $this->beforeDestroy($data);
        $data->delete();
        event(new AuditableModelSaved($data, 'deleted'));
    }

    protected function supportsBulkDestroy(): bool {
        $routeName = Str::before(Route::currentRouteName() ?? '', '.') . '.destroyMany';
        if (! Route::has($routeName)) {
            return false;
        }
        $destroyOwner = (new \ReflectionMethod($this, 'destroy'))->getDeclaringClass()->getName();
        $recordOwner  = (new \ReflectionMethod($this, 'destroyRecord'))->getDeclaringClass()->getName();

        return $destroyOwner === self::class || $recordOwner !== self::class;
    }

    protected function recordLabel(Model $record): string {
        if (method_exists($record, 'templateLink') && $record::templateLink()) {
            $label = Utils::convertTemplateLink($record);
            if (\is_string($label) && trim($label) !== '') {
                return $label;
            }
        }

        return (string) ($record->code ?? $record->name ?? $record->getKey());
    }

    public function destroy(mixed $id) {
        $data = $this->model::findOrFail($id);
        $this->validateDestroyPassword();
        DB::transaction(fn () => $this->destroyRecord($data));

        return redirect()->route($this->indexRouteName());
    }

    public function destroyMany(Request $request) {
        abort_unless($this->supportsBulkDestroy(), 405);
        $validated = $request->validate([
            'ids'   => ['required', 'array', 'min:1', 'max:500'],
            'ids.*' => ['required', 'distinct'],
        ]);
        $this->validateDestroyPassword();

        $records = $this->model::whereKey($validated['ids'])->get();
        abort_if($records->count() !== \count($validated['ids']), 404);

        if ($this->onlyCreator) {
            $userId = $request->user()->id;
            abort_if($records->contains(fn (Model $record) => $record->created_by_id != $userId), 403);
        }

        DB::transaction(function () use ($records): void {
            foreach ($records as $record) {
                try {
                    $this->destroyRecord($record);
                } catch (ValidationException $e) {
                    throw ValidationException::withMessages([
                        'delete' => $this->recordLabel($record) . ': ' . collect($e->errors())->flatten()->first(),
                    ]);
                }
            }
        });

        return redirect()->route($this->indexRouteName())
            ->with('success', __('core.datatable.deleted_count', ['count' => $records->count()]));
    }
    ```
    Pastikan import `Utils` (cek `use App\...\Utils` yang sudah dipakai di file ini untuk `convertTemplateLink`), `ValidationException`, `Route`, `Str`, `DB` ada. Bila `beforeDestroy`/abort menghasilkan `HttpException`, biarkan lolos (rollback otomatis oleh `DB::transaction`).
  - [ ] 1.5 Tambahkan key `deleted_count` ke `lang/en/core/datatable.php` (`':count records deleted'`) dan `lang/id/core/datatable.php` (`':count data dihapus'`).
  - [ ] 1.6 Jalankan test file → PASS. Jalankan juga `php artisan test --compact tests/Feature/Core/BranchControllerTest.php tests/Feature/LocaleKeysTest.php` → PASS.
  - [ ] 1.7 Commit `feat(datatable): add bulk destroyMany endpoint with per-record guards`.

- [ ] 2. Backend: migrasi `UserController` ke `destroyRecord` **(model: haiku)**

  **Files:** Modify `app/Http/Controllers/User/UserController.php`; Create `tests/Feature/User/UserBulkDestroyTest.php`.

  - [ ] 2.1 Test (pola Task 1, permission untuk `App\Models\User\User`): (a) `delete(route('users.destroy', $u->id))` tanpa password → 422 `password`, dengan `password => 'password'` (password default factory — cek `UserFactory`) → user terhapus; (b) `deleteJson(route('users.destroyMany'), ['ids' => [$a->id, $b->id]])` tanpa password → 422 `password`, dengan password → keduanya terhapus.
  - [ ] 2.2 Jalankan → FAIL pada (b).
  - [ ] 2.3 Di `UserController`: hapus method `destroy` override; tambahkan
    ```php
    protected function destroyRequiresPassword(): bool {
        return true;
    }

    protected function destroyRecord(Model $data): void {
        $data->delete();
        $data->logForDeleted();
    }
    ```
    (import `Illuminate\Database\Eloquent\Model` bila belum; hapus import yang jadi tidak terpakai).
  - [ ] 2.4 Jalankan test → PASS; jalankan juga test user lain yang ada: `php artisan test --compact tests/Feature/User` → PASS.
  - [ ] 2.5 Commit `refactor(user): route user deletion through destroyRecord`.

- [ ] 3. Backend: `$rowActionAttributes` + `GlPostingStatus::canRetry` **(model: sonnet)**

  **Files:** Modify `app/Traits/LinkModel.php` (atau trait tempat `getColumns`), `app/Models/Scopes/DataTableScope.php`, `app/Models/Core/GlPostingStatus.php`; Create `tests/Feature/Models/RowActionAttributesTest.php`.

  - [ ] 3.1 Test: buat `GlPostingStatus` (lihat `GlPostingStatusControllerTest` untuk cara membuat record & permission) satu `FAILED`, satu `PENDING`; set cookie visible columns hanya `retry_count` (nama cookie: lihat `DataTableScope::datatableColumnsCookieKey($request->path())` — panggil lewat reflection atau tiru logikanya) lalu GET `route('gl-posting-statuses.index')` dengan header Inertia (`X-Inertia: true`, `X-Inertia-Version` dari `app(HandleInertiaRequests::class)->version(request())` — atau jangan withoutMiddleware HandleInertiaRequests di test ini dan pakai `assertInertia`). Assert `data.data.*.canRetry` ada: `true` untuk FAILED, `false` untuk PENDING. Tambah test unit: `GlPostingStatus::getRowActionAttributes()` === `['canRetry']` dan model tanpa deklarasi → `[]`.
  - [ ] 3.2 Jalankan → FAIL.
  - [ ] 3.3 Trait (tempat `getCanDeleteAttribute`, `app/Traits/LinkModel.php`): 
    ```php
    /**
     * Atribut accessor yang WAJIB selalu ikut ter-SELECT di DataTable (dipakai
     * kondisi `enabled` row action di frontend), terlepas dari kolom visible.
     *
     * @return list<string>
     */
    public static function getRowActionAttributes(): array {
        return property_exists(static::class, 'rowActionAttributes') ? static::$rowActionAttributes : [];
    }
    ```
  - [ ] 3.4 `DataTableScope`: gabungkan `\get_class($query->getModel())::getRowActionAttributes()` (guard `method_exists`) ke `$extraKeys` setelah array meta (`['route', 'canDelete', ...]`).
  - [ ] 3.5 `GlPostingStatus`: `protected static array $rowActionAttributes = ['canRetry'];`, `protected $appends = ['canRetry'];` (gabungkan bila sudah ada), `configColumns['canRetry'] = ['hidden' => true, 'dependsOn' => ['status']]`, accessor `protected function getCanRetryAttribute(): bool { return $this->status === FormStatus::FAILED; }`.
  - [ ] 3.6 Jalankan test baru + `tests/Feature/Core/GlPostingStatusControllerTest.php` + `tests/Feature/Models` → PASS.
  - [ ] 3.7 Commit `feat(datatable): always select model rowActionAttributes; add GlPostingStatus canRetry`.

- [ ] 4. Frontend: `rowActions.js` (fungsi murni) **(model: haiku)**

  **Files:** Create `resources/js/Components/Table/RowActions/rowActions.js`, `resources/js/Components/Table/RowActions/rowActions.test.js`.

  - [ ] 4.1 Test (vitest node) untuk setiap fungsi di Kontrak:
    - `normalizeAction({ key:"a", label:"A", onAction })` → `single:true, bulk:false, variant:"default", requires:[], confirm:null`, `enabled({})===true`.
    - `resolveRowActions` membuang aksi `single:false` dan yang `enabled(row)` false; urutan dipertahankan.
    - `partitionBulk` membagi eligible/skipped sesuai `enabled`.
    - `buildDeleteAction`: `enabled` false bila `row.canDelete === false`; false bila `can("delete", { user_id: row.created_by_id })` false (assert `can` dipanggil dengan argumen itu); `bulk === bulkDestroy`; `variant==="destructive"`; `key===DELETE_ACTION_KEY`; `onAction([row], { source: "single" })` memanggil `onSingle(row)`; `onAction([r1], { source: "bulk" })` dan `onAction([r1,r2], { source: "bulk" })` memanggil `onBulk(rows)` (bulk dengan 1 baris tetap lewat dialog bulk).
    - `warnMissingRequires`: dengan `vi.spyOn(console, "warn")`, aksi `requires:["canRetry"]` dan baris tanpa `canRetry` → warn sekali per key aksi; baris lengkap → tidak warn.
  - [ ] 4.2 Run `npx vitest run resources/js/Components/Table/RowActions/rowActions.test.js` → FAIL.
  - [ ] 4.3 Implementasi sesuai Kontrak. `buildDeleteAction` mengembalikan `normalizeAction({ key: DELETE_ACTION_KEY, label, icon: Trash2Icon, variant: "destructive", single: true, bulk: Boolean(bulkDestroy), enabled: (row) => row?.canDelete !== false && can("delete", { user_id: row?.created_by_id }), onAction: (rows, helpers) => (helpers?.source === "bulk" ? onBulk(rows) : onSingle(rows[0])) })`. Kontrak: `DataTable2` selalu memanggil `onAction(rows, { clearSelection, reload, source })` dengan `source` = `"single"` (menu baris) atau `"bulk"` (bulk bar).
  - [ ] 4.4 Run test → PASS. Commit `feat(datatable): add pure row action helpers`.

- [ ] 5. Frontend: `useRowSelection` + `useLongPress` **(model: sonnet)**

  **Files:** Create `resources/js/Components/Table/RowActions/useRowSelection.js`, `useRowSelection.rtl.test.jsx`, `useLongPress.js`, `useLongPress.rtl.test.jsx`.

  - [ ] 5.1 Test `useRowSelection` (pakai `renderHook` dari `@testing-library/react`): toggle add/remove; `setMany(rows,true/false)`; `isSelected` dengan id string ULID & number; `rows` mempertahankan objek terbaru; `clear()`; ganti `resetKey` (rerender) → kosong; `toggle`/`setMany`/`clear`/`isSelected` referensi stabil antar render (useCallback).
  - [ ] 5.2 Test `useLongPress` (fake timers, `fireEvent.pointerDown/Move/Up` pada elemen dengan `{...handlers}`): tahan 500ms → `onLongPress` sekali; up sebelum 500ms → tidak; move > 10px → batal; `consumeLongPress()` true sekali setelah long-press lalu false; `contextMenu` di-`preventDefault`.
  - [ ] 5.3 Run → FAIL. Implementasi: `useRowSelection` memakai `useState(() => new Map())`, efek `useEffect(() => clear(), [resetKey])` yang melewati render pertama (pakai ref), setiap update membuat `new Map(prev)`. `useLongPress` memakai `useRef` untuk timer, posisi awal, flag `fired`.
  - [ ] 5.4 Run → PASS. Commit `feat(datatable): add row selection and long-press hooks`.

- [ ] 6. Frontend: `RowActionsMenu`, `ActionConfirmDialog`, `BulkActionBar`, `MobileRowShell` **(model: sonnet)**

  **Files:** Create di `resources/js/Components/Table/RowActions/`: `RowActionsMenu.jsx`, `ActionConfirmDialog.jsx`, `BulkActionBar.jsx`, `MobileRowShell.jsx` + masing-masing `*.rtl.test.jsx`.

  - [ ] 6.1 Tests (mock `laravel-react-i18n` dengan `t = (k, p) => p ? \`TR:${k}:${JSON.stringify(p)}\` : \`TR:${k}\``; bungkus dengan `TooltipProvider` dari `@/Components/ui/tooltip` bila komponen memakai Tooltip):
    - RowActionsMenu: tombol `aria-label="TR:core.datatable.row_actions"`; klik → item tampil sesuai `resolveRowActions` (urutan); separator (`role="separator"`) sebelum item `destructive` pertama; klik item → `onRun(action, [row])`; render `null` bila tidak ada aksi lolos.
    - ActionConfirmDialog: render title/description; `requirePassword` menampilkan input password; klik konfirmasi → `onConfirm(password)`; `errors.password` / `errors.delete` tampil; tombol disabled saat `processing`.
    - BulkActionBar: teks `TR:core.datatable.selected:{"count":5}`; hanya aksi `bulk`; label `bulk_count` bila semua eligible, `bulk_count_partial` bila sebagian; disabled bila 0 eligible atau `pendingKey` tidak null; klik → `onRun(action, eligibleRows)`; tombol `clear_selection` → `onClear`; `variant="mobile"` punya kelas `fixed`.
    - MobileRowShell: `menu` dirender; checkbox hanya saat `selectionMode`; long-press (fake timers 500ms) → `onLongPress`; saat `selectionMode`, klik pada children (mis. `<a href="/x">`) → `onToggle(!checked)` dan event default dicegah (`fireEvent.click` mengembalikan `false`); klik pertama setelah long-press ditelan (tidak memanggil `onToggle` dua kali).
  - [ ] 6.2 Run → FAIL.
  - [ ] 6.3 Implementasi:
    - RowActionsMenu: `DropdownMenu` + trigger `<Button variant="ghost" size="icon" className="size-8" aria-label={t("core.datatable.row_actions")}><Ellipsis /></Button>`; item `onSelect={() => onRun(action, [row])}`, kelas destruktif `text-destructive focus:text-destructive`; `memo`.
    - ActionConfirmDialog: `AlertDialog` (pola `Layouts/AlertDialogs/DeleteDialog.jsx`, termasuk `PasswordInput`), tombol konfirmasi `variant={destructive ? "destructive" : "default"}`; jangan auto-close saat konfirmasi (parent mengatur `open`) — gunakan `Button` biasa, bukan `AlertDialogAction`.
    - BulkActionBar: memakai `partitionBulk`; tooltip `bulk_skipped` bila `skipped.length > 0`; desktop: `flex items-center gap-2 px-3 py-2 border-b bg-accent/40`; mobile: `fixed inset-x-0 bottom-0 z-40 border-t bg-background p-3 flex items-center gap-2 overflow-x-auto`.
    - MobileRowShell: wrapper `div` `flex items-stretch` dengan `onClickCapture` & `{...longPress.handlers}` pada area konten (bukan menu), checkbox `aria-label={label}`; area menu `div` terpisah di kanan.
  - [ ] 6.4 Run → PASS. Commit `feat(datatable): add row actions menu, bulk bar, confirm dialog, mobile row shell`.

- [ ] 7. Frontend: `Table2` seleksi controlled **(model: sonnet)**

  **Files:** Modify `resources/js/Components/Table/Table2.jsx`, `resources/js/Components/Table/Table2.rtl.test.jsx`.

  - [ ] 7.1 Test baru di `Table2.rtl.test.jsx`:
    - `selection` controlled: checkbox baris `checked` mengikuti `selection.isSelected(row)`; klik baris → `selection.toggle(row, true)`; header klik → `selection.setMany(data, true)`; header `data-state="indeterminate"` bila sebagian; data kosong → header TIDAK `checked` (juga untuk mode uncontrolled).
    - Mode grup tidak diuji di sini (GroupTree butuh fetch); cukup pastikan `renderGroupRow` memakai handler controlled lewat unit kecil bila memungkinkan, jika tidak skip.
    - Test uncontrolled lama (select-all, `getSelectedItem`) tetap lulus tanpa diubah.
    - Checkbox baris memiliki `aria-label` `TR:core.datatable.select_row` dan header `TR:core.datatable.select_all`.
  - [ ] 7.2 Run → FAIL.
  - [ ] 7.3 Implementasi:
    - Prop `selection` di `Table2`; `TableRow` mendapat prop `selected` (boolean) & `onCheck`; `checked={selected ?? row.isSelected ?? false}`.
    - Flat: `selected={selection ? selection.isSelected(row) : undefined}`, `onCheck={selection ? selection.toggle : checklist}`, `key={row.id ?? index}`.
    - Header: `const allChecked = data.length > 0 && data.every(isRowSelected); const someChecked = data.some(isRowSelected); checked={allChecked ? true : someChecked ? "indeterminate" : false}`; `onCheckedChange={(c) => selection ? selection.setMany(data, c === true) : checkAll(c === true)}`. Saat `group` aktif & `selection` ada: render `<th>` kosong (tanpa checkbox).
    - `renderGroupRow`: `selected={selection?.isSelected(row)}`, `onCheck={selection?.toggle ?? (() => {})}`; tambahkan `selection` ke dependency.
    - Header kolom aksi: ganti teks dengan `<span className="sr-only">{t("core.datatable.action")}</span>`; sel aksi di `TableRow` → `className="flex items-center justify-center px-1! border-r border-muted-foreground/15"`.
    - Tambahkan key i18n `select_row`, `select_all`, `row_actions` ke kedua file lang.
  - [ ] 7.4 Run `npx vitest run resources/js/Components/Table` → PASS (termasuk SelectModel/AdvanceSearchDialog bila ada test-nya: `npx vitest run resources/js/Components/SelectModel resources/js/Components/LinkModel`).
  - [ ] 7.5 Commit `feat(table2): support controlled row selection`.

- [ ] 8. Frontend: integrasi `DataTable2` desktop **(model: sonnet)**

  **Files:** Modify `resources/js/Pages/Core/DataTable2.jsx`, `resources/js/Pages/Core/DataTable2.rtl.test.jsx`, `lang/en/core/datatable.php`, `lang/id/core/datatable.php`.

  - [ ] 8.1 Update/ tambah test di `DataTable2.rtl.test.jsx` (tambahkan `router.delete` ke mock `@inertiajs/react`: `const routerDelete = vi.fn(); router: { get: ..., delete: (...a) => routerDelete(...a) }`; set `window.route = (name, p) => p != null ? \`${name}/${p}\` : name` di `beforeEach`; perbarui stub Table2 agar juga merender checkbox stub: `<input type="checkbox" aria-label={\`check-${row.id}\`} checked={props.selection?.isSelected(row) ?? false} onChange={(e) => props.selection?.toggle(row, e.target.checked)} />`):
    - Ganti test "tombol delete ..." lama: klik `⋯` (`getByRole("button", { name: "TR:core.datatable.row_actions" })` di dalam `row-1`) → klik item `TR:core.datatable.delete` → `deleteItemSpy("suppliers.destroy", 1, { usePasswordConfirmation: undefined })`. Pertahankan varian canDelete false / can false (tombol `⋯` tidak ada) dan usePasswordConfirmationForDelete.
    - `table2Props` terakhir memiliki `selectable === true` & `selection` object; `selectable={false}` → `selection` undefined & `selectable` false.
    - Centang row 1 & 2 → bulk bar tampil `TR:core.datatable.selected:{"count":2}`; dengan `bulkDestroy: true` di page props, klik tombol hapus bulk → dialog → konfirmasi → `routerDelete("suppliers.destroyMany", expect.objectContaining({ data: { ids: [1, 2] } }))`; panggil `onSuccess` dari argumen → bulk bar hilang.
    - `bulkDestroy: false` → tombol hapus tidak ada di bulk bar.
    - Aksi custom: `rowActions=[{ key:"x", label:"X", bulk:true, enabled:(r)=>r.id===1, onAction }]`, centang 1 & 2 → tombol `TR:core.datatable.bulk_count_partial:{"label":"X","count":1,"total":2}` → klik → `onAction([row1], expect.objectContaining({ clearSelection: expect.any(Function), reload: expect.any(Function), source: "bulk" }))`.
    - Ganti page (klik stub trigger-options-changed) → seleksi kosong (bulk bar hilang).
    - `hideDeleteAction` → menu baris tanpa item delete.
  - [ ] 8.2 Run → FAIL.
  - [ ] 8.3 Implementasi di `DataTable2.jsx`:
    - Props: hapus `actions: _actions`; tambah `rowActions = []`, `selectable = true`, `hideDeleteAction = false`. Update JSDoc (`RowAction` typedef dari design.md §1.2).
    - `const { bulkDestroy = false } = usePage().props;`, `const plural = pluralize.plural(name ?? "");`.
    - `const selectionResetKey = \`${treeVersion}|${JSON.stringify(options)}\`` (hitung SETELAH `treeVersion`; pindahkan deklarasi `useRowSelection` ke bawah `treeVersion`), `const selection = useRowSelection({ resetKey: selectionResetKey });`.
    - State: `pendingKey`, `confirmState` (`{ action, rows, source } | null`), `bulkDeleteState` (`{ open, processing, errors }`).
    - `deleteAction = buildDeleteAction({ can, label: t("core.datatable.delete"), bulkDestroy, onSingle: (row) => deleteItem(\`${plural}.destroy\`, row.id, { usePasswordConfirmation: usePasswordConfirmationForDelete }), onBulk: (rows) => setBulkDeleteState({ open: true, rows, processing: false, errors: {} }) })`.
    - `allActions = useMemo(() => [...rowActions.map(normalizeAction), ...(hideDeleteAction ? [] : [deleteAction])], [...])`.
    - `runAction(action, rows, source)`: bila `action.confirm` → set `confirmState`; else `execute`. `execute`: `setPendingKey(action.key)`; `try { await action.onAction(rows, { clearSelection: selection.clear, reload: loadData, source }) } catch (e) { console.error(e) } finally { setPendingKey(null) }`.
    - `Table2`: `selectable={selectable}`, `selection={selectable ? selection : undefined}`, `actions={rowActionsRenderer}` dengan `rowActionsRenderer = useCallback(({ dataRow }) => <RowActionsMenu row={dataRow} actions={allActions} onRun={(a, rows) => runAction(a, rows, "single")} />, [allActions, runAction])`.
    - Render `<BulkActionBar rows={selection.rows} actions={allActions} pendingKey={pendingKey} onRun={(a, rows) => runAction(a, rows, "bulk")} onClear={selection.clear} />` di dalam container tabel, sebelum `Table2`, hanya bila `!isMobile && selection.count > 0`.
    - Bulk delete dialog: `<ActionConfirmDialog open={bulkDeleteState.open} destructive requirePassword={Boolean(usePasswordConfirmationForDelete)} title={t("core.datatable.delete_selected")} description={t("core.datatable.delete_selected_description", { count })} errors={bulkDeleteState.errors} processing={bulkDeleteState.processing} onConfirm={(password) => router.delete(route(\`${plural}.destroyMany\`), { data: { ids: rows.map((r) => r.id), ...(usePasswordConfirmationForDelete ? { password } : {}) }, preserveScroll: true, onStart: ..., onError: (errors) => ..., onSuccess: () => { close; selection.clear(); } })} />`. Gunakan `window.route` (pola file ini — cek cara file memanggil `route`).
    - Dialog konfirmasi aksi custom: `ActionConfirmDialog` dari `confirmState` (`confirm` bisa fungsi `(rows) => obj`).
    - Dev: `useEffect(() => { warnMissingRequires(allActions, data?.data ?? []); }, [allActions, data])`.
    - Hapus import `Trash2Icon` bila tak terpakai lagi.
    - Tambah key i18n sisa: `selected`, `bulk_count`, `bulk_count_partial`, `bulk_skipped`, `clear_selection`, `select_mode`, `delete`, `delete_selected`, `delete_selected_description`, `confirm`, `cancel` (en + id).
  - [ ] 8.4 Run `npx vitest run resources/js/Pages/Core/DataTable2.rtl.test.jsx resources/js/Pages/Core/DataTable2.test.js` → PASS. Commit `feat(datatable2): default row selection, ⋯ actions menu, bulk actions`.

- [ ] 9. Frontend: `DataTable2` mobile (mode pilih) **(model: sonnet)**

  **Files:** Modify `resources/js/Pages/Core/DataTable2.jsx`, `resources/js/Pages/Core/DataTable2.rtl.test.jsx`.

  - [ ] 9.1 Test di describe "mode mobile": kartu dibungkus (tombol `TR:core.datatable.row_actions` per kartu); item header menu `TR:core.datatable.select_mode` → checkbox muncul di tiap kartu (`getAllByRole("forminput")` atau label `select_row`); centang → bulk bar mobile (kelas `fixed`) dengan `selected` count; `clear_selection` → checkbox hilang (mode pilih selesai); long-press kartu (fake timers + `fireEvent.pointerDown`/advance 500ms/`pointerUp`) → mode pilih dengan kartu itu tercentang. Test lama "templateItem menerima closure deleteItem" tetap lulus (deleteItem dipertahankan, deprecated).
  - [ ] 9.2 Run → FAIL.
  - [ ] 9.3 Implementasi: state `selectionMode`; `useEffect(() => { if (selection.count === 0) setSelectionMode(false); }, [selection.count])` (jangan matikan saat baru masuk mode via menu tanpa centang — gunakan flag: matikan hanya saat count turun dari >0 ke 0, simpan prev count di ref); `wrapMobile(row)` → `const item = mobileItem(row); if (!item) return null; return <MobileRowShell key={row.id} selectionMode={selectionMode} checked={selection.isSelected(row)} onToggle={(c) => selection.toggle(row, c)} onLongPress={() => { setSelectionMode(true); selection.toggle(row, true); }} label={t("core.datatable.select_row")} menu={<RowActionsMenu row={row} actions={allActions} onRun={(a, rows) => runAction(a, rows, "single")} />}>{item}</MobileRowShell>`. Ganti kedua jalur render mobile (flat & GroupTree `renderRow`). Tambah `DropdownMenuItem` "Pilih" di header mobile (`isMobile && selectable`). Render `<BulkActionBar variant="mobile" ... />` saat `isMobile && selectionMode`; `onClear={() => { selection.clear(); setSelectionMode(false); }}`. Tambahkan padding bawah container mobile (`pb-20`) saat bar tampil.
  - [ ] 9.4 Run → PASS. Commit `feat(datatable2): mobile long-press selection mode`.

- [ ] 10. Migrasi halaman **(model: haiku)**

  **Files:** Modify `resources/js/Pages/Core/GlPostingStatuses/Index.jsx` (+ `.rtl.test.jsx`), dan setiap `resources/js/Pages/**/Index.jsx` yang `templateItem`-nya memakai `deleteItem` (cari dengan Grep pattern `deleteItem` glob `resources/js/Pages/**/Index.jsx`) beserta `Index.rtl.test.jsx`-nya.

  - [ ] 10.1 GlPostingStatuses: ganti `actions={...}` dengan
    ```jsx
    rowActions={[
      {
        key: "retry",
        label: t("core.glPostingStatus.retry"),
        icon: RefreshCw,
        requires: ["canRetry"],
        enabled: (row) => row.canRetry === true && can("write"),
        onAction: ([row]) => handleRetry(row.id),
      },
    ]}
    ```
    Hapus import `Button` bila tak terpakai. Update test-nya: assert `capturedProps.rowActions[0]` (key, `enabled({canRetry:true})` true, `enabled({canRetry:false})` false, `onAction([{id:5}])` → `router.post("gl-posting-statuses.retry/5")` sesuai mock route di test).
  - [ ] 10.2 Untuk tiap halaman lain: hapus `<Button variant="destructive" ...><Trash2Icon /></Button>` (dan pembungkus yang jadi tak perlu) dari `templateItem`, hapus `deleteItem` dari destructuring parameter, hapus import `Trash2Icon`/`Button` yang tak terpakai. Jangan ubah markup lain. Update test-nya: hapus test "tombol hapus memanggil deleteItem" dan ganti dengan assert bahwa templateItem tidak lagi merender tombol hapus (mis. jumlah button = jumlah tombol non-hapus).
  - [ ] 10.3 Grep: tidak ada lagi `actions={` yang diteruskan ke `<DataTable2` di `resources/js/Pages` (abaikan `actions=` milik komponen lain seperti FormPage/FormTable).
  - [ ] 10.4 Run `npx vitest run resources/js/Pages` → PASS. Commit `refactor(pages): use DataTable2 row actions instead of manual delete buttons`.

- [ ] 11. Checkpoint: suite penuh, lint, Pint **(model: sonnet)**

  - [ ] 11.1 `npx vitest run` → semua PASS (catat jumlah test).
  - [ ] 11.2 `php artisan test --compact tests/Feature/Core tests/Feature/User tests/Feature/Models tests/Feature/LocaleKeysTest.php tests/Feature/Traits` → PASS. Bila ada kegagalan di file yang TIDAK disentuh spec ini, jangan diperbaiki — laporkan nama test + pesan error + analisis apakah terkait perubahan ini (`git diff 2525ba12 --stat` untuk daftar file yang berubah).
  - [ ] 11.3 `npm run lint` → 0 error (gunakan `npm run lint:fix` bila perlu, lalu ulangi test terdampak).
  - [ ] 11.4 `vendor/bin/pint --dirty --format agent` (dengan PATH php).
  - [ ] 11.5 `npm run build` → sukses.
  - [ ] 11.6 Commit perubahan lint/format bila ada: `chore: lint and format`.

- [ ] 12. Verifikasi browser (dikerjakan controller, bukan subagent)

  - [ ] 12.1 Jalankan dev server (`.claude/launch.json`), login admin/admin, buka index Supplier: checkbox + `⋯` tampil; menu berisi Hapus; centang 2 baris → bulk bar; batal pilih.
  - [ ] 12.2 Bulk delete pada data uji yang aman dihapus; seleksi kosong dan data dimuat ulang; pesan sukses.
  - [ ] 12.3 GL Posting Statuses: menu `⋯` berisi Retry hanya untuk status failed.
  - [ ] 12.4 Viewport mobile: long-press kartu → mode pilih → bulk bar bawah; tap kartu tidak bernavigasi; "Pilih" di menu header.
  - [ ] 12.5 Screenshot bukti.
