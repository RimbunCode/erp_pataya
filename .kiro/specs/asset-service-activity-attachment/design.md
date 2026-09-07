# Design Document: Attachment pada Log Aktivitas AssetService

## Overview

`AssetServiceActivity` (Log Aktivitas di dalam fitur AssetService / "Work Orders") saat ini sama sekali tidak punya dukungan file: tidak ada relasi `files()`, tidak ada kolom terkait file, dan `ActivityFormDialog` (`resources/js/Pages/Asset/Services/ServiceActivityLog.jsx:18-90`) tidak punya input upload apapun.

**Keputusan user (setelah draft pertama)**: fitur ini HARUS meniru persis pola widget "Lampiran" generic yang sudah dipakai di semua Show/Form page lain — `resources/js/Pages/Core/Components/Attachments.jsx` (Paperclip icon, tombol "+" → `UploadDialog`, daftar file dengan tombol "X" hapus per-file) — termasuk kemampuan **hapus lampiran yang sudah tersimpan**, bukan cuma tambah. Batas ukuran/jumlah file pakai default `File::uploadFile()` apa adanya (tidak ada batas khusus tambahan).

Codebase sudah punya pola attachment yang established dan dipakai berulang — bukan mekanisme baru:

- **`Fileable`** (`app/Models/Core/Fileable.php`) — pivot polymorphic (`fileable_type`/`fileable_id` ↔ `file_id`).
- **`File::uploadFile()`** (`app/Models/Core/File.php:72-118`) — terima `filesId[]` (file draft yang SUDAH di-upload, tinggal di-link) ATAU `files[]` (upload baru mentah, divalidasi `max:10240` KB/file — default, tidak diubah).
- **`BufferedAttachmentService::attach(Model $model, Request $request)`** (`app/Services/Core/BufferedAttachmentService.php:14-18`) — dipanggil eksplisit dari controller.
- **`Attachments.jsx`** (`resources/js/Pages/Core/Components/Attachments.jsx`) — widget "Lampiran" generic, DUA MODE:
  - **Create** (`isCreate` true, record belum py ID): `UploadDialog` dengan `onBuffer` → file di-upload sebagai DRAFT (`files.store`) lalu id-nya dibuffer lokal di `data.files`; hapus = filter array lokal (belum pernah ke-attach). Saat Simpan (create), id-id ini dikirim sebagai `filesId` → di-attach di server.
  - **Edit** (record sudah py ID): `UploadDialog` dengan `onBuffer=null` + `options.route` → upload LANGSUNG attach ke server (generic `{resource}/{id}/file` → `Controller::addFile`), list di-refresh via Inertia `reset`. Hapus = `router.delete` ke `{resource}/{id}/file/{fileId}` (generic `Controller::removeFile`) — **efek langsung, tanpa perlu tombol Simpan terpisah**.

`ActivityFormDialog` BUKAN halaman ber-URL sendiri (modal di atas Show AssetService) dan `AssetServiceActivity` bukan resource dengan controller/model binding generic sendiri — jadi mode "edit = immediate attach/detach" `Attachments.jsx` tidak bisa dipakai apa adanya (rely ke `currentPath`/prop `attachments` generic). Desain ini mereplikasi PERILAKU dan TAMPILANNYA persis, dengan route kecil khusus activity (lihat Backend).

`AssetServiceActivity` sengaja TIDAK dijadikan pakai trait `DataTable` (dibuat lewat `$assetService->activities()->create()` langsung di `AssetServiceController`, bukan generic resource endpoint) — mengadopsi trait itu penuh hanya demi attachment berarti ikut menyeret `initPermissions()`, code-series, kolom submitable, dll yang tidak relevan untuk child log record ini. Cukup tambah relasi `files()` + 2 route/method kecil yang meniru `Controller::addFile`/`removeFile`.

## Architecture

```text
FE: ActivityFormDialog (Tambah/Edit Aktivitas)
┌──────────────────────────────────────────────┐
│ DatetimePicker / UserLinkModel / Textarea /   │
│ Checkbox is_done                              │
│                                                │
│ [Paperclip] Lampiran            [+]           │
│  - file-1.pdf                    [X]          │
│  - file-2.jpg                    [X]          │
│                                                │
│ [Simpan]                                      │
└──────────────────┬─────────────────────────────┘
                    │
        ┌───────────┴────────────┐
        │ MODE CREATE (belum ada id)      │ MODE EDIT (activity.id ada)
        ▼                                  ▼
  [+] → UploadDialog                  [+] → UploadDialog
    onBuffer: files.store (draft)       onBuffer: null
    → form.files += {id,name}          options.route = assetServices.activities.addFile(activity.id)
  [X] → filter form.files (lokal)      → upload LANGSUNG ter-attach (server), lalu reload
                                       [X] → router.delete
                                         assetServices.activities.removeFile(activity.id, file.id)
                                         → LANGSUNG ke-soft-delete, reload
  Simpan → payload += filesId:
    form.files.map(f => f.id)
        │                                  (tidak kirim filesId apapun — sudah live)
        ▼
POST assetServices.activities.store
┌────────────────────────────────────────────┐
│ AssetServiceController::storeActivity        │
│  $activity = $assetService->activities()     │
│                ->create(...)                 │
│  BufferedAttachmentService::attach(           │  ◀── HANYA di create, pola TicketController:89
│      $activity, $request)                    │
└────────────────────────────────────────────┘

POST assetServices/activities/{activity}/file        (BARU)
┌────────────────────────────────────────────┐
│ AssetServiceController::addActivityFile      │
│  File::uploadFile($request, 'AssetServiceActivity', │
│    fn($file) => Fileable::firstOrCreate([    │
│      fileable_id => $activity->id,           │
│      fileable_type => AssetServiceActivity::class, │
│      file_id => $file->id,                   │
│    ]))                                       │
│  return back();                              │
└────────────────────────────────────────────┘

DELETE assetServices/activities/{activity}/file/{file}   (BARU)
┌────────────────────────────────────────────┐
│ AssetServiceController::removeActivityFile   │
│  Fileable::where('fileable_id', $activity->id) │
│    ->where('fileable_type', AssetServiceActivity::class) │
│    ->where('file_id', $file->id)->delete()   │
│  return back();                              │
└────────────────────────────────────────────┘
```

### Prinsip kunci

- **Meniru `Attachments.jsx` persis** — dua mode (buffer saat create, immediate attach/detach saat edit) — bukan versi simplified single-mode. Ini yang memenuhi permintaan "hapus lampiran" (efek langsung, bukan menunggu Simpan) sekaligus "samakan dengan pola yang sudah ada".
- **`updateActivity` TIDAK lagi perlu terima `filesId`** — perubahan lampiran pada activity yang sudah ada terjadi lewat 2 route baru, independen dari Simpan field lain (action_date/pic/description/is_done). Ini konsisten dengan `Attachments.jsx` edit-mode: attach/detach adalah aksi sendiri, bukan bagian payload form utama.
- **`storeActivity` tetap pakai `BufferedAttachmentService::attach()`** — satu-satunya titik dimana attach lewat `filesId` dalam payload utama, karena saat CREATE belum ada `activity.id` untuk dijadikan target route addFile/removeFile.
- **2 route baru bukan generic `Controller::addFile`/`removeFile`** — karena `AssetServiceController::$model` adalah `AssetService::class`, bukan `AssetServiceActivity::class`. Method baru meniru isi `Controller::addFile`/`removeFile` (`Controller.php:307-333`) tapi hardcode `AssetServiceActivity::class` sebagai `fileable_type`.

## Components and Interfaces

### Backend

**`app/Models/Asset/AssetServiceActivity.php`** — tambah relasi `files()`:

```php
public function files() {
    return $this->morphToMany(File::class, 'fileable')
        ->whereNull('fileables.deleted_at');
}
```

**`routes/web.php`** — tambah 2 route baru persis di bawah baris 341 (`assetServices.activities.update`):

```php
Route::post('/assetServices/activities/{activity}/file', [AssetServiceController::class, 'addActivityFile'])->name('assetServices.activities.addFile');
Route::delete('/assetServices/activities/{activity}/file/{file}', [AssetServiceController::class, 'removeActivityFile'])->name('assetServices.activities.removeFile');
```

**`app/Http/Controllers/Asset/AssetServiceController.php`**:

```php
public function storeActivity(AssetServiceActivityRequest $request, AssetService $assetService) {
    $this->assertApproved($assetService);

    $activity = $assetService->activities()->create($request->validated());
    BufferedAttachmentService::attach($activity, $request);   // baris baru — mode create saja

    return back();
}

public function updateActivity(AssetServiceActivityRequest $request, AssetServiceActivity $activity) {
    $this->assertApproved($activity->assetService);

    $activity->update($request->validated());
    // TIDAK ada BufferedAttachmentService::attach() di sini — lampiran activity
    // yang sudah ada diubah lewat addActivityFile/removeActivityFile, bukan lewat update ini.

    return back();
}

public function addActivityFile(Request $request, AssetServiceActivity $activity) {
    $this->assertApproved($activity->assetService);

    File::uploadFile($request, 'AssetServiceActivity', function ($file) use ($activity) {
        Fileable::firstOrCreate([
            'fileable_id'   => $activity->id,
            'fileable_type' => AssetServiceActivity::class,
            'file_id'       => $file->id,
        ]);
    });

    return back();
}

public function removeActivityFile(Request $request, AssetServiceActivity $activity, File $file) {
    Fileable::where('fileable_id', $activity->id)
        ->where('fileable_type', AssetServiceActivity::class)
        ->where('file_id', $file->id)
        ->delete();

    return back();
}
```

(`assertApproved()` dipakai juga di `addActivityFile` — konsisten dengan `storeActivity`/`updateActivity`: lampiran activity cuma boleh diubah kalau AssetService induknya sudah approved, sama seperti field lain.)

**`app/Models/Asset/AssetService.php::loadRelationsOnShow()`** — tambah `'activities.files'` ke array existing (baris 77-88 saat ini, sejajar `'activities.pic'`), supaya daftar file per-activity ikut termuat saat AssetService di-show.

### Frontend

**`resources/js/Pages/Asset/Services/ServiceActivityLog.jsx` — `ActivityFormDialog`**:

Tampilan & interaksi mengikuti persis `Attachments.jsx` (Paperclip + label "Lampiran", tombol bulat "+" di kanan, daftar file dengan ikon + nama + link `files.preview` + tombol bulat "X" per-item) — dipasang di bawah field `is_done`, sebelum footer tombol Simpan.

```jsx
const isEdit = !!activity?.id;
const [attachOpen, setAttachOpen] = useState(false);

// Create: buffer lokal. Edit: list live dari activity.files (di-refresh server tiap add/remove).
const attachments = isEdit ? (activity?.files ?? []) : (form.files ?? []);

const handleBuffer = (items) => {
  setForm((f) => ({ ...f, files: [...(f.files ?? []), ...items] }));
};

const removeAttachment = (fileId) => {
  if (!isEdit) {
    setForm((f) => ({ ...f, files: (f.files ?? []).filter((x) => x.id !== fileId) }));
    return;
  }
  router.delete(route("assetServices.activities.removeFile", [activity.id, fileId]), {
    preserveScroll: true,
  });
};
```

`UploadDialog` dipasang dengan cabang identik `Attachments.jsx`:

```jsx
<UploadDialog
  open={attachOpen}
  onClose={() => setAttachOpen(false)}
  onBuffer={isEdit ? null : handleBuffer}
  options={
    isEdit
      ? { route: route("assetServices.activities.addFile", activity.id) }
      : undefined
  }
/>
```

`submit()` (baris 27-47 saat ini) — HANYA tambah `filesId` di mode create:

```js
const payload = {
  action_date: form.action_date,
  pic_id: form.pic?.id ?? null,
  description: form.description,
  is_done: form.is_done ?? false,
  ...(!isEdit && { filesId: (form.files ?? []).map((f) => f.id).filter(Boolean) }),
};
```

**Render list activity** (`ServiceActivityLog`, baris 166-184 saat ini) — tambah indikator jumlah lampiran (ikon Paperclip + count) per baris activity kalau `activity.files?.length > 0`, memakai `activity.files` yang sudah ke-load lewat `loadRelationsOnShow`.

## Data Models

Tidak ada migration baru — `fileables` (pivot) dan `files` sudah ada, generik untuk model manapun via `fileable_type`/`fileable_id`. `AssetServiceActivity` cukup tambah method relasi, tidak ada kolom baru di `asset_service_activities`.

## Correctness Properties

Property 1: Lampiran ter-attach ke Activity yang benar, bukan ke AssetService induknya

_For any_ activity A milik AssetService S, file F yang di-attach lewat `filesId` (create) ATAU `addActivityFile` (edit), `Fileable` row SHALL punya `fileable_type = AssetServiceActivity::class` dan `fileable_id = A.id` — BUKAN `fileable_id = S.id`.

**Validates: Isolasi lampiran per-activity**

Property 2: Hapus lampiran berefek langsung, tidak menunggu Simpan

_For any_ activity A yang sudah punya id (mode edit), memanggil `removeActivityFile(A, F)` SHALL langsung soft-delete `Fileable` row yang menghubungkan A↔F, TERLEPAS dari apakah tombol Simpan pada `ActivityFormDialog` ditekan.

**Validates: Requirement "fitur hapus lampiran" — efek langsung sesuai pola `Attachments.jsx`**

Property 3: Activity tanpa lampiran tidak terpengaruh

_For any_ `storeActivity` call TANPA `filesId`/`files` di request, behavior SHALL identik dengan sebelum perubahan ini (tidak ada row `Fileable` baru, tidak ada error).

**Validates: Regresi nihil untuk activity existing**

## Error Handling

| Scenario | Behavior |
| --- | --- |
| `filesId`/upload berisi id File yang tidak ada / sudah dihapus | Validasi `exists:files,id` bawaan `File::uploadFile()` (`File.php:76`) atau `max:10240` per file (`File.php:85`) → 422 validation error standar Inertia |
| `addActivityFile`/`removeActivityFile` dipanggil saat AssetService BELUM approved | `assertApproved()` melempar `LogicException` (`asset/service.activity_requires_approval`), konsisten dengan gating `storeActivity`/`updateActivity` yang sudah ada |
| User upload file di dialog create lalu batal (tutup tanpa Simpan) | File draft (`is_draft=true`) tetap ada di tabel `files` tapi tidak pernah ter-`Fileable`-kan — perilaku sama seperti form lain yang pakai `UploadDialog` buffer (bukan gap baru dari fitur ini, sudah ada di seluruh codebase) |
| Activity dihapus (soft delete) | `Fileable` pivot tidak ikut soft-delete otomatis (tidak ada cascade) — konsisten dengan model lain yang punya `files()` (tidak ada precedent cascade), di luar scope iterasi ini |

## Testing Strategy

- **Feature test baru** `tests/Feature/Asset/AssetServiceActivityAttachmentTest.php`:
  - `storeActivity` dengan `filesId` → assert `Fileable` row `fileable_type = AssetServiceActivity::class`, `fileable_id` = id activity baru (bukan id AssetService).
  - `storeActivity` tanpa `filesId`/`files` → tidak ada `Fileable` baru, tidak ada exception (regresi — `AssetServiceActivityGatingTest.php` existing harus tetap hijau).
  - `addActivityFile` pada activity approved → `Fileable` baru dengan target activity yang benar.
  - `addActivityFile`/`removeActivityFile` pada AssetService belum approved → `LogicException`.
  - `removeActivityFile` → `Fileable` row ter-soft-delete (`deleted_at` terisi), file lain pada activity yang sama TIDAK ikut terhapus.
- **Test FE** (`ServiceActivityLog.rtl.test.jsx`, sudah ada) — tambah case:
  - Mode create: pilih file (mock `onBuffer`), assert `filesId` masuk payload `router.post` saat Simpan.
  - Mode edit: klik "+", assert `UploadDialog` menerima `options.route` mengarah ke `assetServices.activities.addFile`. Klik "X" pada file existing, assert `router.delete` dipanggil ke `assetServices.activities.removeFile` dengan id activity+file yang benar.
