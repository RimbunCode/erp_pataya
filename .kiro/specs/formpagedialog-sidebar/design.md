# Design Document: FormPageDialog Right Sidebar

## Overview

`FormPageDialog` (di `resources/js/Pages/Core/FormPage.jsx`) adalah modal **create** berlayout single-column. Fitur ini menambahkan **sidebar sisi kanan collapsible & customable** yang me-reuse `SidebarChildren` (Attachments/Tags) dari `FormPage`.

Karena dialog beroperasi di mode CREATE (record belum ber-ID), attachment/tag **dibuffer di form state** lalu **otomatis ter-attach** ke record baru lewat hook Eloquent `created` pada trait `DataTable` (model trait yang dipakai hampir semua model).

---

## Architecture

```
FormPageDialog (mode create)
  └─ SidebarProvider (lokal, state buka/tutup)
       └─ <form> (grid: [1fr_auto] saat sidebar aktif)
            ├─ FormChildren (kolom kiri) ──► FormPageContext { form, data, setData, isCreate:true }
            └─ Sidebar collapsible="none" (kolom kanan, width-animate)
                 └─ SidebarChildren (reuse penuh)
                      ├─ Attachments (dual-mode)
                      └─ Tags        (dual-mode)

Submit ──► form.transform → router.post (multipart: data + buffered_tags + files[]/isPublic[]/name[])
            │
            ▼
Backend store() membuat record ──► trait DataTable::bootDataTable / static::created
            │
            ▼
   BufferedAttachmentService::attach → Taggable / Fileable (polymorphic) ke record.id baru
```

### Pemilihan mode (kunci zero-regression)

`Attachments`/`Tags` memilih cabang berdasarkan `isCreate` dari `FormPageContext` (via hook `useFormPage`, lihat `FormPage.jsx:424`).

| Mode | Sumber data | Aksi tambah/hapus |
| --- | --- | --- |
| **Edit** (existing) | `usePage().props.attachments/.tags` | `router.post/delete` ke `/{id}/file`, `/{id}/tag` — **tidak berubah** |
| **Create** (baru) | form buffer via `useFormPage()` | mutasi array di form state (`setData`) |

Pencarian tag (`route("tags.index")` via axios) tetap jalan di kedua mode.

---

## Components and Interfaces

### Frontend

**`FormPageDialog`** (modif, `FormPage.jsx:1628-1850`)
- Prop baru `sidebarContent` (default `false`; tristate sama seperti `FormPage`).
- Bungkus body dengan `SidebarProvider` lokal; render `SidebarChildren` di kolom grid kanan via shadcn `Sidebar collapsible="none"`.
- Layout `<form>` grid kondisional `[1fr_18rem]` ⇄ `[1fr_0rem]`; `AlertDialogContent` melebar `max-w-3xl` saat sidebar aktif. Animasi `transition-[grid-template-columns]` / `transition-[max-width]`.
- Tombol toggle (`PanelRightIcon`) di header.
- `_onSubmit` memakai `form.transform()` membentuk payload `{ ...data, files:[File], isPublic:[], name:[] }`, `forceFormData` bila ada file.

**`SidebarChildren`** (verifikasi, `FormPage.jsx:1474-1581`)
- Default content (`Attachments`+`Tags`) tidak bergantung `defaultData`. Blok `amended_from`/`hasConnections` sudah ber-guard truthy → aman di create. Tidak butuh perubahan kode (dipakai dengan `submitable={false}`, `defaultData={null}`, `hasConnections={false}`).

**`Tags`** (dual-mode, `Components/Tags.jsx`)
- `useFormPage("buffered_tags", { notUseWhenCreate: true })`.
- Create: `addTag`/`removeTag` mutasi `data.buffered_tags`. Edit: tak berubah. Search axios tetap.

**`Attachments`** (dual-mode, `Components/Attachments.jsx`)
- `useFormPage("files", { notUseWhenCreate: true })`.
- Create: list dari `data.files`; `removeFile` filter buffer. Edit: tak berubah.

**`UploadDialog`** (modif, `Components/UploadDialog.jsx`)
- Prop `onBuffer`. Saat ada `onBuffer` + menu `home`, push `{id,name,file}` ke buffer alih-alih `router.post`.

### Backend

**`BufferedAttachmentService`** (baru, `app/Services/Core/BufferedAttachmentService.php`)
- `attach(Model $model, Request $request): void`
  - `attachTags`: untuk tiap `buffered_tags` (`{id?, name, isNew?}`) → resolve/`Tag::firstOrCreate` → `Taggable::firstOrCreate([taggable_id, taggable_type, tag_id])`.
  - `attachFiles`: bila ada file `files`/`filesId` → `File::uploadFile(...)` + `Fileable::firstOrCreate([fileable_id, fileable_type, file_id])` (reuse pola `Controller::addFile`).

**`DataTable` trait** (modif, `app/Traits/DataTable.php:33-53`)
- Tambah di `bootDataTable()`:
  ```php
  static::created(function ($model) {
      if (! app()->bound('request')) {
          return;
      }
      $request = request();
      if (! $request->hasAny(['buffered_tags', 'buffered_files']) && ! $request->hasFile('files')) {
          return;
      }
      \App\Services\Core\BufferedAttachmentService::attach($model, $request);
  });
  ```

---

## Data Models / Payload

```
buffered_tags:  [{ id?, name, isNew? }, ...]
files:          [File, File, ...]   (multipart, sejajar dengan isPublic[]/name[])
```

`File::uploadFile` (`app/Models/Core/File.php:78-86`) membaca `files`/`isPublic`/`name` sebagai array sejajar. Service hanya meneruskan request → key payload harus `files`/`isPublic`/`name` (sama seperti `UploadDialog` existing).

---

## Error Handling

- **Guard non-request:** hook `created` skip bila tak ada request terikat / tanpa buffer → aman di seeder/factory/job.
- **Idempotensi:** `firstOrCreate` untuk pivot mencegah duplikat bila hook terpicu ganda (nested save).
- **Validasi tag duplikat:** reuse cek `findIndex` di `Tags.addTag`.
- **File size/type:** validasi existing di `File::uploadFile` (max 10MB) tetap berlaku.
- **Draft localStorage:** `form.transform()` mencegah File object (tak serializable) bocor ke draft.

---

## Testing Strategy

- **Feature (PHPUnit):** `tests/Feature/Core/BufferedAttachmentServiceTest.php` memakai model `Unit` (`use DataTable`), shim `is_example` (pola `TicketTest`), `RefreshDatabase`.
  - attach tags (existing+new), attach files (`UploadedFile::fake`+`Storage::fake`), no-buffer no-side-effect, hook auto-attach via `Model::create` + request global, factory-create aman.
- **Frontend:** verifikasi manual + `npm run build` (codebase tak punya FE test). Smoke test pada satu call-site dialog existing.

---

## Out of Scope (YAGNI)

- Connections & amended_from di sidebar create (butuh record).
- Draft-record server-side (ditolak; pilih buffer lokal).
- Mengubah `store()` per-controller (ditolak; pilih hook trait otomatis).
- `dd($data)` di `UnitController.php:81` — bug pre-existing, **tidak disentuh**.
