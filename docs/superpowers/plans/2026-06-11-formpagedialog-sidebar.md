# FormPageDialog Right Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambahkan sidebar sisi kanan yang collapsible & customable pada `FormPageDialog`, me-reuse `SidebarChildren` (Attachments/Tags), dengan persistence buffer-lokal saat CREATE yang otomatis ter-attach ke record baru.

**Architecture:** Frontend — `FormPageDialog` dibungkus `SidebarProvider` lokal, render `SidebarChildren` di kolom grid kanan (width-animate in-flow); `Attachments`/`Tags` jadi dual-mode (create=buffer di form state, edit=perilaku sekarang). Backend — `BufferedAttachmentService` baru meng-attach buffered tags/files ke record; dipanggil otomatis lewat hook `static::created` di trait `DataTable` (model trait, dipakai hampir semua model).

**Tech Stack:** Laravel 12, Inertia v2 + React 19, shadcn Sidebar, Tailwind v4, PHPUnit 11.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `app/Services/Core/BufferedAttachmentService.php` (baru) | Attach `buffered_tags`/`buffered_files` dari request ke record (Taggable/Fileable polymorphic) |
| `app/Traits/DataTable.php` (modif) | Hook `static::created` memanggil service bila request punya buffer |
| `tests/Feature/Core/BufferedAttachmentServiceTest.php` (baru) | Test service: tags, files, no-buffer, non-request safety |
| `resources/js/Pages/Core/FormPage.jsx` (modif) | `FormPageDialog`: prop `sidebarContent`, `SidebarProvider`, grid layout, toggle, kirim buffer saat submit. `SidebarChildren`: izinkan render di create |
| `resources/js/Pages/Core/Components/Tags.jsx` (modif) | Dual-mode via `useFormPage().isCreate` |
| `resources/js/Pages/Core/Components/Attachments.jsx` (modif) | Dual-mode via `useFormPage().isCreate` |
| `resources/js/Pages/Core/Components/UploadDialog.jsx` (modif) | Mode buffer: push File ke form state alih-alih `router.post` |

**Urutan:** Backend dulu (Task 1–2, ada test otomatis & jadi fondasi payload), lalu Frontend (Task 3–6, verifikasi manual). Frontend menulis ke field `buffered_tags`/`buffered_files` yang dikonsumsi backend.

---

## Task 1: BufferedAttachmentService — attach tags

**Files:**
- Create: `app/Services/Core/BufferedAttachmentService.php`
- Test: `tests/Feature/Core/BufferedAttachmentServiceTest.php`

- [ ] **Step 1: Tulis test gagal (attach tags)**

Buat file test. Pakai model `Unit` (simpel, `use DataTable`). Reuse shim `is_example` seperti `TicketTest` agar global scope `HasExampleData` tak error di SQLite.

```php
<?php

namespace Tests\Feature\Core;

use App\Models\Core\Tag;
use App\Models\Core\Taggable;
use App\Models\Inventory\Unit;
use App\Models\User\User;
use App\Services\Core\BufferedAttachmentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class BufferedAttachmentServiceTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();
        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }
    }

    public function test_attaches_existing_and_new_buffered_tags(): void {
        $user = User::factory()->create();
        $this->actingAs($user);
        $existing = Tag::create(['name' => 'urgent']);
        $unit = Unit::create(['name' => 'Box', 'group' => 'Others']);

        $request = Request::create('/', 'POST', [
            'buffered_tags' => [
                ['id' => $existing->id, 'name' => 'urgent'],
                ['name' => 'baru-banget', 'isNew' => true],
            ],
        ]);
        $request->setUserResolver(fn () => $user);

        BufferedAttachmentService::attach($unit, $request);

        $this->assertDatabaseHas('taggables', [
            'taggable_id' => $unit->id,
            'taggable_type' => Unit::class,
            'tag_id' => $existing->id,
        ]);
        $newTag = Tag::where('name', 'baru-banget')->firstOrFail();
        $this->assertDatabaseHas('taggables', [
            'taggable_id' => $unit->id,
            'taggable_type' => Unit::class,
            'tag_id' => $newTag->id,
        ]);
    }
}
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `php artisan test --compact --filter=test_attaches_existing_and_new_buffered_tags`
Expected: FAIL — `Class "App\Services\Core\BufferedAttachmentService" not found`.

- [ ] **Step 3: Buat service (tags saja)**

Reuse pola `Controller::addTag` (resolve/create Tag → Taggable::create).

```php
<?php

namespace App\Services\Core;

use App\Models\Core\Tag;
use App\Models\Core\Taggable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

class BufferedAttachmentService {
    public static function attach(Model $model, Request $request): void {
        static::attachTags($model, $request);
    }

    protected static function attachTags(Model $model, Request $request): void {
        $tags = $request->input('buffered_tags', []);
        if (! is_array($tags)) {
            return;
        }
        foreach ($tags as $tag) {
            if (! is_array($tag)) {
                continue;
            }
            $isNew = filter_var($tag['isNew'] ?? false, FILTER_VALIDATE_BOOLEAN);
            $tagModel = $isNew || empty($tag['id'])
                ? Tag::firstOrCreate(['name' => $tag['name']])
                : Tag::find($tag['id']);
            if (! $tagModel) {
                continue;
            }
            Taggable::firstOrCreate([
                'taggable_id'   => $model->id,
                'taggable_type' => get_class($model),
                'tag_id'        => $tagModel->id,
            ]);
        }
    }
}
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `php artisan test --compact --filter=test_attaches_existing_and_new_buffered_tags`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/Services/Core/BufferedAttachmentService.php tests/Feature/Core/BufferedAttachmentServiceTest.php
git commit -m "feat(core): add BufferedAttachmentService tag attaching"
```

---

## Task 2: BufferedAttachmentService — attach files + DataTable hook

**Files:**
- Modify: `app/Services/Core/BufferedAttachmentService.php`
- Modify: `app/Traits/DataTable.php:33-53` (dalam `bootDataTable`)
- Test: `tests/Feature/Core/BufferedAttachmentServiceTest.php`

- [ ] **Step 1: Tulis test gagal (files via service)**

Tambahkan method ke test class. Pakai `UploadedFile::fake()` + `Storage::fake('local')`.

```php
    public function test_attaches_buffered_files(): void {
        \Illuminate\Support\Facades\Storage::fake('local');
        $user = User::factory()->create();
        $this->actingAs($user);
        $unit = Unit::create(['name' => 'Carton', 'group' => 'Others']);

        $request = Request::create('/', 'POST', [
            'isPublic' => ['false'],
            'name'     => ['doc'],
        ], [], [
            'files' => [\Illuminate\Http\UploadedFile::fake()->create('doc.pdf', 10)],
        ]);
        $request->setUserResolver(fn () => $user);

        BufferedAttachmentService::attach($unit, $request);

        $this->assertDatabaseHas('fileables', [
            'fileable_id'   => $unit->id,
            'fileable_type' => \App\Models\Inventory\Unit::class,
        ]);
    }

    public function test_no_buffer_produces_no_side_effects(): void {
        $user = User::factory()->create();
        $this->actingAs($user);
        $unit = Unit::create(['name' => 'Pcs', 'group' => 'Others']);

        BufferedAttachmentService::attach($unit, Request::create('/', 'POST'));

        $this->assertDatabaseCount('taggables', 0);
        $this->assertDatabaseCount('fileables', 0);
    }
```

> Catatan: `File::uploadFile` membaca `files`, `isPublic`, `name` dari request (lihat `app/Models/Core/File.php:78-86`). Service hanya meneruskan request apa adanya, jadi key buffered file di payload submit = `files`/`isPublic`/`name` (sama seperti `UploadDialog` existing), bukan nama lain.

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `php artisan test --compact --filter=test_attaches_buffered_files`
Expected: FAIL — `fileables` kosong (attachFiles belum ada).

- [ ] **Step 3: Tambah attachFiles ke service**

Edit `attach()` dan tambah method. Reuse `Controller::addFile` pattern (`File::uploadFile` + `Fileable::create`).

```php
    public static function attach(Model $model, Request $request): void {
        static::attachTags($model, $request);
        static::attachFiles($model, $request);
    }

    protected static function attachFiles(Model $model, Request $request): void {
        if (! $request->hasFile('files') && ! $request->has('filesId')) {
            return;
        }
        preg_match('/[^\\\\]+$/', get_class($model), $folderName);
        \App\Models\Core\File::uploadFile($request, $folderName[0], function ($file) use ($model) {
            \App\Models\Core\Fileable::firstOrCreate([
                'fileable_id'   => $model->id,
                'fileable_type' => get_class($model),
                'file_id'       => $file->id,
            ]);
        });
    }
```

Tambah import di atas: `use App\Models\Core\File; use App\Models\Core\Fileable;`.

- [ ] **Step 4: Jalankan test files + no-buffer, pastikan lulus**

Run: `php artisan test --compact --filter=BufferedAttachmentServiceTest`
Expected: PASS semua (tags, files, no-buffer).

- [ ] **Step 5: Pasang hook di trait DataTable**

Di `app/Traits/DataTable.php`, dalam `bootDataTable()` (setelah blok `self::saved(...)` yang ada, sebelum closing `}` method di baris 53), tambahkan:

```php
        static::created(function ($model) {
            if (! app()->bound('request')) {
                return;
            }
            $request = request();
            if (! $request->hasAny(['buffered_tags', 'buffered_files'])
                && ! $request->hasFile('files')) {
                return;
            }
            \App\Services\Core\BufferedAttachmentService::attach($model, $request);
        });
```

> Guard `app()->bound('request')` + `hasAny`/`hasFile` mencegah eksekusi di seeder/factory/job (tanpa HTTP request atau tanpa buffer).

- [ ] **Step 6: Tulis test hook auto-attach via model create**

Tambahkan ke test class — membuktikan hook jalan otomatis saat `Model::create` dengan request global yang punya buffer.

```php
    public function test_datatable_hook_auto_attaches_on_create(): void {
        $user = User::factory()->create();
        $this->actingAs($user);
        $tag = Tag::create(['name' => 'hooked']);

        // Set request global agar request() di hook melihat buffer
        $request = Request::create('/units', 'POST', [
            'name' => 'Bag', 'group' => 'Others',
            'buffered_tags' => [['id' => $tag->id, 'name' => 'hooked']],
        ]);
        $request->setUserResolver(fn () => $user);
        $this->app->instance('request', $request);

        $unit = Unit::create(['name' => 'Bag', 'group' => 'Others']);

        $this->assertDatabaseHas('taggables', [
            'taggable_id' => $unit->id,
            'taggable_type' => Unit::class,
            'tag_id' => $tag->id,
        ]);
    }

    public function test_factory_create_without_request_buffer_is_safe(): void {
        $user = User::factory()->create();
        $this->actingAs($user);

        $unit = Unit::create(['name' => 'Safe', 'group' => 'Others']);

        $this->assertDatabaseCount('taggables', 0);
    }
```

- [ ] **Step 7: Jalankan seluruh test file, pastikan lulus**

Run: `php artisan test --compact tests/Feature/Core/BufferedAttachmentServiceTest.php`
Expected: PASS semua 5 test.

- [ ] **Step 8: Commit**

```bash
git add app/Services/Core/BufferedAttachmentService.php app/Traits/DataTable.php tests/Feature/Core/BufferedAttachmentServiceTest.php
git commit -m "feat(core): auto-attach buffered tags/files via DataTable created hook"
```

---

## Task 3: Tags — dual-mode (create buffer)

**Files:**
- Modify: `resources/js/Pages/Core/Components/Tags.jsx`

Tujuan: saat `isCreate`, `addTag`/`removeTag` mengubah `data.buffered_tags` di form state (via `useFormPage`), bukan `router`. Saat edit, perilaku sekarang tetap.

- [ ] **Step 1: Tambah akses form context**

Di atas `Tags.jsx`, tambah import `useFormPage` (di-export dari `FormPage.jsx`):

```jsx
import { useFormPage } from "@/Pages/Core/FormPage";
```

Di dalam `function Tags()`, di awal:

```jsx
  const { isCreate, data, setData } = useFormPage("buffered_tags", {
    notUseWhenCreate: true,
  });
  const bufferedTags = data?.buffered_tags ?? [];
```

> `useFormPage(defaultValue, options)` (lihat `FormPage.jsx:424`) memberi akses `form/data/setData/isCreate` dari context dialog. Field default `buffered_tags` di-set ke `[]` saat create.

- [ ] **Step 2: Pilih sumber tags by mode**

Ganti baris `const { tags: _tags } = usePage().props;` dan efek sinkronnya agar saat create memakai `bufferedTags`:

```jsx
  const { tags: _tags } = usePage().props;
  useEffect(() => {
    setTags(isCreate ? bufferedTags : (_tags ?? []));
  }, [_tags, isCreate, JSON.stringify(bufferedTags)]);
```

- [ ] **Step 3: Cabangkan addTag/removeTag**

Di `addTag`, bungkus sisi server dengan cek mode:

```jsx
  const addTag = (tag) => {
    if (tags.findIndex((t) => t.name == tag.name) >= 0) {
      setSearch("");
      setShowSearch(false);
      return;
    }
    if (isCreate) {
      const next = [...bufferedTags, { id: tag.id, name: tag.name, isNew: tag.isNew }];
      setData("buffered_tags", next);
      setTags(next);
      setSearch("");
      setShowSearch(false);
      return;
    }
    setTags([...tags, { ...tag, isLoading: true }]);
    router.post(
      `${basePath}${currentQueryString}`,
      { ...tag },
      { reset: ["tags"], preserveScroll: true, preserveState: true, replace: true, onSuccess: () => {} },
    );
    setSearch("");
    setShowSearch(false);
  };

  const removeTag = (id) => {
    if (isCreate) {
      const next = bufferedTags.filter((t) => t.id !== id);
      setData("buffered_tags", next);
      setTags(next);
      return;
    }
    router.delete(`${basePath}/${id}${currentQueryString}`, {
      reset: ["tags"], preserveScroll: true, preserveState: true, replace: true,
    });
  };
```

- [ ] **Step 4: Verifikasi build**

Run: `npm run build`
Expected: build sukses tanpa error import/JSX.

- [ ] **Step 5: Commit**

```bash
git add resources/js/Pages/Core/Components/Tags.jsx
git commit -m "feat(core): Tags dual-mode buffer in create"
```

---

## Task 4: Attachments + UploadDialog — dual-mode (create buffer)

**Files:**
- Modify: `resources/js/Pages/Core/Components/Attachments.jsx`
- Modify: `resources/js/Pages/Core/Components/UploadDialog.jsx`

Tujuan: saat create, daftar attachment dibaca dari `data.files` buffer; `UploadDialog` push File object ke buffer alih-alih `router.post`.

- [ ] **Step 1: Attachments baca sumber by mode**

Di `Attachments.jsx`, tambah import & context:

```jsx
import { useFormPage } from "@/Pages/Core/FormPage";
```

Di dalam komponen, ganti `const attachments = usePage().props.attachments;`:

```jsx
  const { isCreate, data, setData } = useFormPage("files", { notUseWhenCreate: true });
  const propAttachments = usePage().props.attachments;
  const bufferedFiles = data?.files ?? [];
  const attachments = isCreate
    ? bufferedFiles.map((f, i) => ({ id: f.id ?? i, name: f.name || f.file?.name }))
    : propAttachments;
```

- [ ] **Step 2: Cabangkan removeFile (create = buffer)**

Ganti `removeFile` agar saat create memfilter buffer:

```jsx
  const removeFile = useCallback(
    (id) => {
      if (isCreate) {
        setData("files", (data?.files ?? []).filter((f) => (f.id ?? null) !== id));
        return;
      }
      const currentPath = window.location.pathname.replace(/\/$/, "");
      const currentQueryString = window.location.search;
      const basePath = `${currentPath}/file`;
      router.delete(`${basePath}/${id}${currentQueryString}`, {
        reset: ["attachments"], preserveScroll: true, preserveState: true, replace: true,
      });
    },
    [isCreate, data, setData],
  );
```

- [ ] **Step 3: UploadDialog terima handler buffer**

Di `UploadDialog.jsx`, tambah prop `onBuffer` (opsional). Di `onAttach`, jika `onBuffer` ada, push ke buffer alih-alih `router.post`:

```jsx
function UploadDialog({
  onClose,
  single = false,
  imageOnly = false,
  onBuffer = null,
  options: { route: routeProp, ...optionsProp } = {},
}) {
```

Di awal `onAttach`, sebelum `const formData = ...`:

```jsx
  const onAttach = useCallback((menu, files) => {
    if (onBuffer && menu === "home") {
      onBuffer(files.map((f) => ({ id: f.id, name: f.name || f.file?.name, file: f.file })));
      setFiles([]);
      onClose();
      return;
    }
    const formData = new FormData();
    // ...sisa kode router.post tetap...
```

- [ ] **Step 4: Attachments pasang onBuffer ke UploadDialog**

Di `Attachments.jsx` render `UploadDialog`, saat create teruskan `onBuffer`:

```jsx
          <UploadDialog
            open={openAttachment}
            onBuffer={isCreate ? (items) => setData("files", [ ...(data?.files ?? []), ...items ]) : null}
            onClose={() => { setOpenAttachment(false); }}
          />
```

- [ ] **Step 5: Verifikasi build**

Run: `npm run build`
Expected: build sukses.

- [ ] **Step 6: Commit**

```bash
git add resources/js/Pages/Core/Components/Attachments.jsx resources/js/Pages/Core/Components/UploadDialog.jsx
git commit -m "feat(core): Attachments+UploadDialog dual-mode buffer in create"
```

---

## Task 5: SidebarChildren — izinkan render di create

**Files:**
- Modify: `resources/js/Pages/Core/FormPage.jsx`

`SidebarChildren` saat ini di-guard `{!isCreate && ...}` (baris ~1095) di render `FormPage`. Komponennya sendiri sudah men-skip `Connections`/`amended_from` bila `hasConnections`/`amended_from_id` falsy — jadi aman di create. Tidak perlu mengubah `FormPage` render; perubahan create-render dilakukan di `FormPageDialog` (Task 6). Task ini hanya memastikan default content (`Attachments`+`Tags`) tidak bergantung pada `defaultData` saat create.

- [ ] **Step 1: Pastikan default content aman di create**

Tinjau `SidebarChildren` (`FormPage.jsx:1474-1581`). `defaultSidebarChildren` hanya render `<Attachments />` + `<Tags />` — keduanya kini dual-mode (Task 3–4). Blok `amended_from` dan `hasConnections` sudah ber-guard kondisi truthy. **Tidak ada perubahan kode diperlukan di sini** — Task ini adalah verifikasi, bukan edit. Lanjut ke Task 6.

- [ ] **Step 2: (tanpa commit)** — verifikasi catatan saja, tidak ada perubahan file.

---

## Task 6: FormPageDialog — sidebar collapsible + kirim buffer

**Files:**
- Modify: `resources/js/Pages/Core/FormPage.jsx` (`FormPageDialog`, baris ~1628-1850)

Tujuan: prop `sidebarContent`; bungkus `SidebarProvider`; layout grid melebar saat sidebar aktif; tombol toggle; kirim `buffered_tags` + buffered `files` saat submit.

- [ ] **Step 1: Tambah prop + state sidebar**

Tambah `sidebarContent = false` ke daftar props `FormPageDialog`. Di dalam komponen tambah:

```jsx
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const hasSidebar = sidebarContent !== false;
```

Import yang dibutuhkan di atas file (cek dulu apakah sudah ada; tambah yang belum):

```jsx
import { SidebarProvider, Sidebar } from "@/Components/ui/sidebar";
import { PanelRightIcon } from "lucide-react";
```

- [ ] **Step 2: Lebarkan dialog + grid saat sidebar aktif**

Ubah `AlertDialogContent` className agar melebar saat ada sidebar:

```jsx
        <AlertDialogContent
          className={cn(
            className,
            "py-0 overflow-hidden transition-[max-width] duration-200",
            hasSidebar && sidebarOpen ? "max-w-3xl!" : "",
          )}
        >
```

Ganti `<div className="overflow-y-auto">` pembungkus konten menjadi grid bila sidebar aktif:

```jsx
              <div
                className={cn(
                  "overflow-y-auto",
                  hasSidebar &&
                    "grid gap-4 transition-[grid-template-columns] duration-200",
                  hasSidebar && sidebarOpen
                    ? "grid-cols-[1fr_18rem]"
                    : hasSidebar
                      ? "grid-cols-[1fr_0rem]"
                      : "",
                )}
              >
```

- [ ] **Step 2b: Tutup div grid + render sidebar**

Bungkus `FormChildren` di kolom kiri dan tambahkan kolom kanan sidebar (di dalam div grid, setelah `<FormChildren>...</FormChildren>`):

```jsx
                {hasSidebar && (
                  <SidebarProvider
                    open={sidebarOpen}
                    onOpenChange={setSidebarOpen}
                    className="min-h-0 w-auto overflow-hidden"
                  >
                    <Sidebar
                      collapsible="none"
                      className="w-full bg-transparent border-l pl-4"
                    >
                      <SidebarChildren
                        content={sidebarContent}
                        submitable={false}
                        defaultData={null}
                        hasConnections={false}
                      />
                    </Sidebar>
                  </SidebarProvider>
                )}
```

> `Sidebar collapsible="none"` (lihat `Components/ui/sidebar.jsx:169-181`) render `<div class="flex h-full w-(--sidebar-width) flex-col">` — in-flow, tidak `fixed`, jadi aman di dalam dialog. Animasi lebar dikendalikan kolom grid induk, bukan offcanvas bawaan.

- [ ] **Step 3: Tombol toggle di header**

Di `AlertDialogTitle`, setelah `{badge}`, tambahkan toggle (hanya bila `hasSidebar`):

```jsx
                  {hasSidebar && (
                    <button
                      type="button"
                      onClick={() => setSidebarOpen((v) => !v)}
                      className="ml-auto p-1 rounded hover:bg-muted"
                      aria-label="Toggle sidebar"
                    >
                      <PanelRightIcon className="size-4" />
                    </button>
                  )}
```

- [ ] **Step 4: Kirim buffer saat submit**

Di `_onSubmit`, payload sudah berasal dari `data` (form state) yang kini berisi `buffered_tags` dan `files`. Pastikan `submit` mengirim sebagai FormData saat ada file. Ubah pemanggilan `submit`:

```jsx
    const _onSubmit = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;
      if (!name) return;
      const pluralized = routeName ?? `${pluralize.plural(name ?? "")}.store`;
      const hasFiles = Array.isArray(data?.files) && data.files.length > 0;
      submit(method, route(pluralized, routeParams), {
        preserveState: true,
        preserveUrl: false,
        forceFormData: hasFiles,
        onSuccess: () => {
          _setData(defaultValue ?? {});
          setOpen(false);
        },
      });
    };
```

> Saat `forceFormData`, Inertia menserialisasi `files` (array berisi `{file: File}`) + `buffered_tags`. Backend membaca `files`/`isPublic`/`name` (via `File::uploadFile`) dan `buffered_tags` (via service). **Penting:** struktur `files` yang dikirim harus cocok dengan yang dibaca `File::uploadFile` (`files[]`, `isPublic[]`, `name[]`). Lihat Step 5.

- [ ] **Step 5: Bentuk payload files sesuai backend**

`File::uploadFile` membaca `files`, `isPublic`, `name` sebagai array sejajar (`app/Models/Core/File.php:78-86`). Buffer `data.files` saat ini array `{id,name,file}`. Transform sebelum submit. Ganti blok `submit(...)` agar membentuk payload eksplisit:

```jsx
      const files = Array.isArray(data?.files) ? data.files : [];
      const payload = {
        ...data,
        files: files.map((f) => f.file),
        isPublic: files.map((f) => f.isPublic ?? false),
        name: files.map((f) => f.name || f.file?.name),
      };
      form.transform(() => payload);
      submit(method, route(pluralized, routeParams), {
        preserveState: true,
        preserveUrl: false,
        forceFormData: files.length > 0,
        onSuccess: () => {
          _setData(defaultValue ?? {});
          setOpen(false);
        },
      });
```

> `form.transform` (Inertia useForm) mengubah payload tepat sebelum kirim tanpa memutasi `data`. `form` berasal dari `useDraftForm` (baris 1658) yang mewarisi API `useForm`.

- [ ] **Step 6: Verifikasi build**

Run: `npm run build`
Expected: build sukses tanpa error.

- [ ] **Step 7: Commit**

```bash
git add resources/js/Pages/Core/FormPage.jsx
git commit -m "feat(core): collapsible right sidebar on FormPageDialog with create buffer submit"
```

---

## Task 7: Verifikasi end-to-end + full suite

**Files:** —

- [ ] **Step 1: Pilih satu call-site dialog untuk uji**

Pakai contoh existing yang memakai `FormPageDialog` (mis. `resources/js/Pages/Users/ManageUsers/Show.jsx:126`). Tambahkan sementara `sidebarContent={undefined}` (default content Attachments+Tags) untuk smoke test. **Jangan commit perubahan call-site smoke test ini** kecuali user minta.

- [ ] **Step 2: Manual verify (minta user jalankan dev)**

Minta user `npm run dev` lalu buka dialog create yang diuji. Cek:
- Sidebar tampil di kanan, dialog melebar.
- Toggle menyempit/melebar dengan animasi.
- Tambah tag → muncul di buffer (tidak ada network call per tag).
- Upload file → muncul di daftar (tidak ada upload langsung).
- Submit → record tersimpan; tag & file ter-attach (cek DB `taggables`/`fileables`).

- [ ] **Step 3: Revert smoke-test call-site**

Kembalikan call-site Step 1 ke kondisi semula bila tak diinginkan permanen.

- [ ] **Step 4: Jalankan full backend suite**

Run: `php artisan test --compact`
Expected: PASS (atau hanya kegagalan pre-existing yang tak terkait — laporkan bila ada).

- [ ] **Step 5: Pint**

Run: `vendor/bin/pint --dirty --format agent`
Expected: file PHP yang diubah ter-format.

- [ ] **Step 6: Commit akhir bila ada perubahan format**

```bash
git add -A
git commit -m "style: pint formatting"
```

---

## Catatan Implementasi

- **Jangan sentuh** `UnitController.php:81` (`dd($data)` — bug pre-existing di luar scope).
- Edit-mode `FormPage` (Attachments/Tags instant-persist) **tidak boleh berubah perilakunya** — semua cabang baru dijaga di belakang `isCreate`. Verifikasi regression saat manual test bila sempat.
- `firstOrCreate` dipakai di service untuk idempotensi (cegah duplikat Taggable/Fileable bila hook terpanggil ganda).
