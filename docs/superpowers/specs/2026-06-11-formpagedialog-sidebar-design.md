# Design: Sidebar (Sisi Kanan) pada FormPageDialog

**Tanggal:** 2026-06-11
**Status:** Draft — menunggu review
**Spec ID:** db63279b-1290-4e2b-98cd-9227becaf96c

## Overview

`FormPageDialog` (di `resources/js/Pages/Core/FormPage.jsx`) adalah modal **create** yang saat ini berlayout single-column. Tujuan: menambahkan **sidebar sisi kanan yang collapsible & customable**, meniru kemampuan sidebar pada komponen `FormPage`, dengan me-**reuse `SidebarChildren` penuh** (termasuk `Attachments` & `Tags`).

Tantangan inti: `FormPageDialog` beroperasi di **mode CREATE** — record belum punya ID. Sementara `Attachments`/`Tags` saat ini meng-persist langsung ke server lewat URL berbasis record (`/{id}/file`, `/{id}/tag`). Solusinya: **buffer lokal** di form state saat create, lalu attach otomatis ke record baru lewat hook Eloquent di trait `DataTable`.

## Keputusan Desain (disepakati)

1. **Layout** — dialog **melebar otomatis** saat sidebar aktif; **width-animate in-flow** (sidebar di dalam grid, mendorong/menyempitkan form, bukan overlay).
2. **Container** — pakai shadcn `Sidebar` dengan `collapsible="none"` di dalam grid dialog + `SidebarProvider` lokal untuk state buka/tutup.
3. **Content** — reuse `SidebarChildren` penuh; `Attachments` & `Tags` di-upgrade jadi **dual-mode** (create=buffer, edit=perilaku sekarang).
4. **Persistence CREATE** — **buffer lokal** di `useDraftForm` state, dikirim multipart saat submit.
5. **Backend auto-attach** — hook Eloquent `created` di trait **`DataTable`** (model trait). Otomatis untuk semua model yang `use DataTable`, **tanpa mengubah `store()` controller manapun**.

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

Submit ──► router.post (multipart: data + buffered_tags[] + buffered_files[])
            │
            ▼
Backend store() record dibuat ──► trait DataTable::bootDataTable / created event
            │
            ▼
   attach buffered → Taggable / Fileable (polymorphic) ke record.id baru
```

### Pemilihan mode (kunci zero-regression)

Komponen `Attachments`/`Tags` memilih cabang berdasarkan `isCreate` dari `FormPageContext`:

| Mode | Sumber data | Aksi tambah/hapus |
|------|-------------|-------------------|
| **Edit** (existing) | `usePage().props.attachments/.tags` | `router.post/delete` ke `/{id}/file`, `/{id}/tag` — **tidak berubah** |
| **Create** (baru) | form buffer via `useFormPage()` | mutasi array di form state (`setData`) |

Tags search (`route("tags.index")` via axios) tetap jalan di kedua mode — tak diubah.

## Components & Interfaces

### Frontend

**1. `FormPageDialog` (modifikasi) — `resources/js/Pages/Core/FormPage.jsx`**
- Prop baru: `sidebarContent` (default `false` = tak ada sidebar; tristate sama seperti `FormPage`: `false`/`undefined`/function/element). Saat create + ada sidebar → render `SidebarChildren`.
- Bungkus body dengan `SidebarProvider` lokal.
- Ubah layout `<form>` dari `flex flex-col` → grid kondisional: `grid-cols-[1fr_auto]` saat sidebar aktif, animasi lebar.
- Lebar `AlertDialogContent` melebar saat sidebar aktif (mis. `max-w-3xl`), normal saat tidak.
- Tambah trigger toggle (icon) di header dialog.
- Kirim `buffered_tags`/`buffered_files` sebagai bagian payload submit (`_onSubmit`), `forceFormData: true` bila ada file.

**2. `SidebarChildren` (modifikasi) — `FormPage.jsx`**
- Saat ini di-guard `{!isCreate && <SidebarChildren/>}`. Hapus guard agar bisa render di create. Default content (`Attachments`+`Tags`) tetap; `Connections`/`amended_from` di-skip saat create (butuh record).

**3. `Attachments` (dual-mode) — `resources/js/Pages/Core/Components/Attachments.jsx`**
- Konsumsi `useFormPage()` → cek `isCreate`.
- Create: baca daftar file dari form buffer (`data.buffered_files`); `UploadDialog` push File object ke buffer (bukan `router.post`); remove = filter buffer.
- Edit: tak berubah.

**4. `Tags` (dual-mode) — `resources/js/Pages/Core/Components/Tags.jsx`**
- Create: `addTag`/`removeTag` mutasi `data.buffered_tags` (bukan `router`). Search axios tetap.
- Edit: tak berubah.

**5. `UploadDialog` (modifikasi) — `Components/UploadDialog.jsx`**
- `onAttach` terima callback/mode buffer: saat create, panggil handler yang push ke form state alih-alih `router.post`.

### Backend

**6. Trait `DataTable` (modifikasi) — `app/Traits/DataTable.php`**
- Tambah di `bootDataTable()`:
  ```php
  static::created(function ($model) {
      // guard: hanya saat ada HTTP request dengan buffer
      if (! request()->hasAny(['buffered_tags', 'buffered_files'])) {
          return;
      }
      BufferedAttachmentService::attach($model, request());
  });
  ```
- Logic attach dipisah ke service/helper statis agar model tak langsung bocor ke `request()` lebih dari guard.

**7. `BufferedAttachmentService` (baru) — `app/Services/Core/BufferedAttachmentService.php`**
- `attach(Model $model, Request $request): void`
  - `buffered_tags[]` → untuk tiap tag (id existing atau `{name, isNew}`): resolve/`Tag::create`, lalu `Taggable::create([taggable_id => $model->id, taggable_type => get_class($model), tag_id])`.
  - `buffered_files[]` → `File::uploadFile(...)` + `Fileable::create([fileable_id => $model->id, fileable_type => get_class($model), file_id])`.
  - Reuse pola yang sudah ada di `Controller::addTag`/`addFile`.

## Data Flow — Buffer payload

```
buffered_tags:  [{ id, name, isNew? }, ...]      (JSON / array field)
buffered_files: [File, File, ...]                (multipart file[])
```

Saat submit `store`: `router.post(route(name.store), { ...data, buffered_tags, buffered_files }, { forceFormData: true })`.

## Error Handling

- **Guard non-request context:** hook `created` skip bila tak ada request/buffer (seeder, factory, job) → cegah error di luar HTTP.
- **Transaksi:** attach buffered dibungkus dalam transaksi store yang sama bila memungkinkan; bila record sudah commit, attach jalan setelahnya dengan try/catch (kegagalan attach tidak meng-orphan record, tapi di-log).
- **Validasi tag duplikat:** reuse cek `findIndex` existing di `Tags.addTag`.
- **File size/type:** validasi existing di `UploadDialog`/`File::uploadFile` tetap berlaku.

## Testing

- **Feature (backend):**
  - Store record dengan `buffered_tags` → `Taggable` terbuat dengan `taggable_id` benar.
  - Store dengan `buffered_files` → `Fileable`+`File` terbuat.
  - Store tanpa buffer → tak ada side-effect.
  - Create via factory/seeder (tanpa request) → hook tak meledak.
- **Frontend (manual/visual):**
  - Toggle sidebar di dialog → dialog melebar/menyempit animasi.
  - `sidebarContent={false}`/default/function → tristate benar.
  - Edit-mode `FormPage` Attachments/Tags → regression check (tetap instant-persist).

## Out of Scope (YAGNI)

- Connections & amended_from di sidebar create (butuh record) — di-skip, tidak dihapus.
- Draft-record server-side (ditolak; pilih buffer lokal).
- Mengubah `store()` per-controller (ditolak; pilih hook trait otomatis).

## File yang Tersentuh

| File | Aksi |
|------|------|
| `resources/js/Pages/Core/FormPage.jsx` | modif `FormPageDialog`, `SidebarChildren` |
| `resources/js/Pages/Core/Components/Attachments.jsx` | dual-mode |
| `resources/js/Pages/Core/Components/Tags.jsx` | dual-mode |
| `resources/js/Pages/Core/Components/UploadDialog.jsx` | buffer mode |
| `app/Traits/DataTable.php` | hook `created` |
| `app/Services/Core/BufferedAttachmentService.php` | baru |
| `tests/Feature/...` | test backend buffered-attach |
