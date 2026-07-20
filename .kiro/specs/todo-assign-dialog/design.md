# Design Document

## Overview

Desain ini mengganti alur inline-picker pada widget `AssignedTo.jsx` dengan dialog modal (`AssignDialog.jsx`, komponen baru) yang mereuse field inti `Todos/Form.jsx` setelah direfactor agar bisa beroperasi di atas state lokal (bukan hanya `useFormPage()`). Pola dialog mengikuti `UploadDialog.jsx` + `Attachments.jsx` yang sudah ada (shadcn `Dialog`/`DialogTrigger`, state `open` dikontrol parent).

Perubahan backend: `AssigneeRequest` menambah `date`/`due_date`; `Controller::addAssignee` diganti dari `firstOrCreate` jadi cek-`exists()`-lalu-`create()` eksplisit, menolak dengan `ValidationException` kalau assignee yang dipilih sudah punya `Todo` row (status apapun, belum soft-deleted) untuk dokumen yang sama (Requirement 9, lihat §6); query `assignees` pada `DataTable::showDetail()` menghapus filter `status='open'` dan menyertakan `status`+`allocated_to_id` di payload; `TodoController::create()` mengirim default assignee.

## Architecture

```
AssignedTo.jsx (sidebar widget, tak berubah strukturnya secara drastis)
 ├─ state: showDialog (boolean), editingAssignee (null | {id, ...} untuk edit buffer/existing)
 ├─ tombol "+"       → buka AssignDialog dalam mode "create baru"
 ├─ klik assignee row:
 │    IF create-mode dokumen induk (buffer item) → buka AssignDialog mode "edit buffer"
 │    IF edit-mode dokumen induk (Todo tersimpan) → router.visit ke /todos/{id}
 └─ tombol X (hanya row status=open) → removeAssignee (tak berubah)

AssignDialog.jsx (BARU)
 ├─ props: open, onOpenChange, initialValue (null saat tambah baru, berisi data saat edit buffer),
 │         onSubmit(payload)
 ├─ state lokal: { allocated_to, priority, date, due_date, description } — TANPA key status
 └─ render ulang <AssignedToFields disableStatus /> (field yang diekstrak dari Todos/Form.jsx, lihat Component Design)

Todos/Form.jsx (DIREFACTOR)
 ├─ AssignedToFields.jsx (BARU, diekstrak) — field: allocated_to, priority, status, date, due_date, description
 │    props: value, onChange(key, val), disableStatus (default false)
 ├─ Todos/Form.jsx bungkus AssignedToFields dengan adapter ke useFormPage() (value=data, onChange=setData), disableStatus=false
 └─ AssignDialog.jsx bungkus AssignedToFields dengan adapter ke useState lokal, disableStatus=true (field status tampil tapi disabled+terkunci "open")
```

## Components and Interfaces

### 1. `resources/js/Pages/Core/Todos/AssignedToFields.jsx` (BARU)

Diekstrak dari isi `Todos/Form.jsx` saat ini (baris 24-96) TERMASUK field `status` (berbeda dari draft desain sebelumnya yang mengecualikan `status` — lihat Requirement 3 revisi: field status tetap dirender di kedua konteks, hanya `disabled` yang membedakan). Kontrak murni presentational:

```jsx
function AssignedToFields({ value, onChange, layout = "grid", disableStatus = false }) {
  // value: { allocated_to, priority, status, date, due_date, description }
  // onChange: (key, val) => void
  // layout "grid": 2 kolom (dipakai Todos/Form.jsx) — "stack": 1 kolom (dipakai AssignDialog, lebih sempit)
  // disableStatus: true saat dipakai dari AssignDialog — field status dirender <Select disabled value="open" />
}
```

Memenuhi Requirement 7.1: satu definisi field (termasuk `status`), dipakai di dua tempat tanpa duplikasi. `layout` prop menghindari kebutuhan CSS grid 2 kolom yang terlalu lebar untuk konteks dialog sidebar (yang lebih sempit dari halaman penuh `/todos`). `disableStatus` menggantikan pendekatan "field status dikecualikan total" — field tetap terlihat sebagai referensi visual (konsisten dengan `Todos/Form.jsx`), tapi tidak bisa diubah dan value-nya tidak pernah masuk payload `onChange` (lihat catatan implementasi di §3).

### 2. `resources/js/Pages/Core/Todos/Form.jsx` (DIREFACTOR, bukan ditulis ulang)

Seluruh field (assignee/priority/status/date/due_date/description) dipindah ke `<AssignedToFields value={data} onChange={setData} layout="grid" />` — `status` IKUT diekstrak (revisi dari draft desain sebelumnya), `disableStatus` TIDAK diset (default `false`) sehingga field status tetap aktif seperti semula. Memenuhi Requirement 7.2 — perilaku halaman `/todos` standalone tidak berubah karena `value`/`onChange` yang dioper persis `data`/`setData` dari `useFormPage()` yang sama seperti sebelumnya, dan Requirement 7.4 (field status TETAP hadir di kedua konteks, hanya beda `disabled`).

### 3. `resources/js/Pages/Core/Components/AssignDialog.jsx` (BARU)

Mengikuti pola `UploadDialog.jsx` (dipanggil sebagai children `<Dialog>`, bukan mengelola `Dialog` sendiri — parent `AssignedTo.jsx` yang pegang `<Dialog open={} onOpenChange={}>`):

```jsx
function AssignDialog({ initialValue, activeAssigneeIds = [], onSubmit, onClose }) {
  const [value, setValue] = useState(
    initialValue ?? { allocated_to: null, priority: "medium", date: null, due_date: null, description: null }
  );
  // reset value ke initialValue setiap dialog dibuka ulang dengan initialValue berbeda (useEffect[initialValue])
  // value TIDAK punya key "status" — field status dirender AssignedToFields dari nilai hardcode
  // "open" (lihat disableStatus), bukan dari value.status, supaya tidak bisa terkirim ikut payload.

  const handleChange = (key, val) => setValue((prev) => ({ ...prev, [key]: val }));
  const canSubmit = !!value.allocated_to;

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{t("core.form.assigned_to")}</DialogTitle></DialogHeader>
      <AssignedToFields
        value={value}
        onChange={handleChange}
        layout="stack"
        disableStatus
        // Assignee yang sedang diedit (initialValue.allocated_to.id) tetap boleh
        // muncul di picker — hanya assignee AKTIF LAIN yang di-exclude, supaya
        // edit buffer item tidak "mengunci diri sendiri" keluar dari opsi.
        excludeAssigneeIds={activeAssigneeIds.filter((id) => id !== value.allocated_to?.id)}
      />
      <DialogFooter>
        <Button variant="secondary" onClick={onClose}>{t("core.form.cancel")}</Button>
        <Button disabled={!canSubmit} onClick={() => onSubmit(value)}>{t("core.form.assign")}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
```

Field status ditampilkan (Requirement 3.1, revisi) lewat `disableStatus` — di dalam `AssignedToFields`, saat `disableStatus === true`, `<Select>` status dirender `disabled` dengan `value="open"` HARDCODE (bukan `value.status`, yang memang tidak pernah ada di state `AssignDialog`) — sehingga walau field terlihat, tidak ada jalur di mana `onChange("status", ...)` bisa terpanggil dari dalam dialog ini, dan `value` yang dikirim ke `onSubmit` tidak pernah membawa key `status` sama sekali (Requirement 3.3). Validasi tombol submit disabled (Requirement 1.6) memenuhi client-side saja; server tetap validasi via `AssigneeRequest` (`allocated_to` required, dan sejak Requirement 9 juga cek assignee belum aktif) sebagai pertahanan kedua — lihat §Assignee Aktif.

### 4. `resources/js/Pages/Core/Components/AssignedTo.jsx` (DIUBAH)

Perubahan dari versi sekarang:
- State baru: `const [dialogState, setDialogState] = useState(null)` — `null` = dialog tertutup, `{}` = mode tambah baru, `{...existingItem}` = mode edit buffer item.
- Tombol `+`: `onClick={() => setDialogState({})}` (ganti `setShowPicker`).
- Klik assignee row (bukan tombol X):
  ```jsx
  onClick={() => {
    if (isCreate) {
      setDialogState(bufferedAssignees.find((a) => a.id === id)); // buka dialog isi ulang
    } else {
      router.visit(route("todos.show", id)); // id = Todo.id asli
    }
  }}
  ```
  (Requirement 4.1, 4.2)
- `AssignDialog` dipasang menggantikan blok `showPicker && <AssignableLinkModel .../>` (baris 133-144 versi lama). Prop `activeAssigneeIds` (Requirement 9.1) diisi dari `assignees.map((a) => a.id_assignee)` — CATATAN: `assignees` (baik `_assignees` server maupun `bufferedAssignees`) menyimpan `id` sebagai **Todo.id**, bukan **assignee's own id** (`allocated_to_id`); perlu field tambahan `allocated_to_id` di payload map `showDetail()` (§8) dan di shape buffer item, supaya `activeAssigneeIds` bisa dihitung dari `allocated_to_id`, bukan `id` milik `Todo`:
  ```jsx
  <Dialog open={!!dialogState} onOpenChange={(v) => !v && setDialogState(null)}>
    {dialogState && (
      <AssignDialog
        initialValue={dialogState.id ? dialogState : null}
        activeAssigneeIds={assignees.map((a) => a.allocated_to_id)}
        onClose={() => setDialogState(null)}
        onSubmit={(value) => {
          if (isCreate) {
            const isEdit = !!dialogState.id;
            const next = isEdit
              ? bufferedAssignees.map((a) => (a.id === dialogState.id ? { ...a, ...value } : a))
              : [...bufferedAssignees, { ...value.allocated_to, ...value, id: generateRandom(8) }];
            setData("buffered_assignees", next);
            setAssignees(next);
          } else {
            setAssignees([...assignees, { ...value.allocated_to, isLoading: true }]);
            router.post(`${basePath}${currentQueryString}`, value, {
              reset: ["assignees"], preserveScroll: true, preserveState: true, replace: true,
            });
          }
          setDialogState(null);
        }}
      />
    )}
  </Dialog>
  ```
  (Requirement 1.5, 2.1, 2.2, 4.3)
- Render row: tombol X hanya muncul `{item.status !== "closed" && item.status !== "canceled" && (<Button ...>)}` (Requirement 6.1, 6.2 — buffer item di create-mode tidak punya `status` sama sekali sehingga kondisi selalu lolos, memenuhi 6.3).
- Tambah `<BadgeStatus status={item.status ?? "open"} className="..." />` kecil di tiap row (Requirement 5.2). Buffer item (create-mode) tidak punya field status asli — tampilkan `"open"` secara implisit (konsisten Requirement 3.2).

### 5. Backend — `app/Http/Requests/Core/AssigneeRequest.php`

Tambah dua rule (berlaku juga untuk `TodoRequest.php`, yang sudah punya `date`/`due_date` tapi belum ada validasi urutan):
```php
'date'     => ['nullable', 'date'],
'due_date' => ['nullable', 'date', 'after_or_equal:date'],
```

### 6. Backend — `app/Http/Controllers/Controller.php::addAssignee`

`Controller::addAssignee` HANYA dipanggil dari tombol `+` di **edit-mode** dokumen induk (dokumen sudah tersimpan) — "edit assignee via dialog" (Requirement 4.2/4.3) tidak pernah memanggil endpoint ini sama sekali, karena itu murni operasi `Array.map()` atas **Buffer item** lokal (§4, blok `onSubmit` cabang `isCreate`). Jalur `addAssignee` karenanya SELALU "assign baru" — tapi sekarang menolak eksplisit (Requirement 9.2) bila assignee yang diminta sudah punya `Todo` row (status apapun, belum soft-deleted) untuk `reference` yang sama, alih-alih diam-diam `firstOrCreate` menemukan row lama dan membuang `values` baru dari dialog:

```php
public function addAssignee(AssigneeRequest $request, $param) {
    $data          = $request->validated();
    $allocatedToId = $data['allocated_to']['id'];

    $exists = Todo::where('reference_id', $param)
        ->where('reference_type', $this->model)
        ->where('allocated_to_id', $allocatedToId)
        ->exists();

    if ($exists) {
        throw ValidationException::withMessages([
            'allocated_to' => [__('core.todo.errors.already_assigned')],
        ]);
    }

    $todo = Todo::create([
        'reference_id'      => $param,
        'reference_type'    => $this->model,
        'allocated_to_id'   => $allocatedToId,
        'code'              => TodoService::generateCode($data),
        'allocated_to_type' => $data['allocated_to']['type'],
        'assigned_by_id'    => $request->user()->id,
        'status'            => 'open',
        'priority'          => $data['priority'] ?? 'medium',
        'description'       => $data['description'] ?? null,
        'date'              => $data['date'] ?? null,
        'due_date'          => $data['due_date'] ?? null,
    ]);

    app(TodoService::class)->notifyAssignee($todo);
    ...
```

`firstOrCreate` diganti eksplisit jadi cek-lalu-`create` (Requirement 9.2, 9.3) — query `->exists()` TIDAK memakai `withTrashed()`, sehingga row yang sudah soft-deleted (`removeAssignee` sebelumnya) otomatis tidak terhitung "sudah ada" dan tetap boleh di-assign ulang (Requirement 9.4), persis perilaku idempoten `firstOrCreate` yang sudah ada sebelumnya untuk kasus non-konflik — hanya kasus "assignee AKTIF sudah ada" yang sekarang eksplisit ditolak alih-alih senyap diabaikan. `if ($todo->wasRecentlyCreated)` yang membungkus `notifyAssignee()` di kode saat ini juga tidak diperlukan lagi karena `create()` baru SELALU baru (guard `$exists` sudah menjamin itu sebelumnya).

### 7. Backend — `app/Services/Core/BufferedAttachmentService.php::attachAssignees`

Payload per item buffer sekarang membawa lebih dari `id`/`type`/`name` — tambah `priority`/`date`/`due_date`/`description` ke `values` saat `firstOrCreate`. Method ini TIDAK perlu guard Requirement 9 tambahan — buffer di create-mode dijamin tidak bisa berisi assignee duplikat pada level frontend (Requirement 9.1, filter picker berlaku sama di buffer-mode), dan `firstOrCreate` di sini tetap aman dipertahankan karena dokumen induknya sendiri baru dibuat (tidak ada `Todo` row lama yang mungkin collide).

### 8. Backend — `app/Traits/DataTable.php::showDetail()`

```php
'assignees' => Inertia::defer(
    fn () => Todo::where('reference_type', static::class)
        ->where('reference_id', $this->id)
        ->with('allocatedTo:id,type,name')
        ->get(['id', 'allocated_to_id', 'allocated_to_type', 'status'])
        ->map(fn ($todo) => [
            'id'               => $todo->id,
            'allocated_to_id'  => $todo->allocated_to_id,
            'type'             => $todo->allocated_to_type,
            'name'             => $todo->allocatedTo?->name,
            'status'           => $todo->status,
        ]),
    'assignees',
),
```

Hapus `->where('status', 'open')` (Requirement 5.1); tambah `'status' => $todo->status` (Requirement 5.2) dan `'allocated_to_id' => $todo->allocated_to_id` (dibutuhkan §4 untuk menghitung `activeAssigneeIds`, Requirement 9.1 — field ini beda dari `id` yang merujuk ke `Todo.id`, bukan ID assignee-nya) ke payload map.

**Shape Buffer item (create-mode) juga menyesuaikan**: item hasil `AssignDialog` (§4, cabang `isCreate`) disimpan sebagai `{ ...value.allocated_to, ...value, id: generateRandom(8) }` — karena `value.allocated_to` sudah berbentuk `{id, type, name}` dari `AssignableLinkModel`, spread pertama sudah membuat `allocated_to_id` TIDAK otomatis ada (field-nya bernama `id`, bukan `allocated_to_id`, dan langsung ditimpa `id: generateRandom(8)` di akhir). Buffer item perlu eksplisit menyimpan `allocated_to_id: value.allocated_to.id` supaya konsisten dengan shape row `Todo` tersimpan:
```jsx
{ ...value, allocated_to_id: value.allocated_to.id, name: value.allocated_to.name, type: value.allocated_to.type, id: generateRandom(8) }
```

### 9. Backend — `app/Http/Controllers/Core/TodoController.php::create`

```php
public function create() {
    $this->setBreadcrumbs();

    return Inertia::render('Core/Todos/Show', [
        'defaultData' => [
            'allocated_to' => [
                'id'   => auth()->id(),
                'type' => 'user',
                'name' => auth()->user()->name,
            ],
        ],
    ]);
}
```

`Todos/Show.jsx` sudah menerima `defaultData` dari `usePage().props` secara implisit lewat destructuring prop `defaultData` yang diteruskan ke `<FormPage defaultValues={defaultData}>` (lihat baris 8 & 18 file saat ini) — TIDAK perlu ubah `Todos/Show.jsx` sama sekali, murni tambahan di controller (Requirement 8.1, 8.3).

## Data Models

Tidak ada perubahan skema database. `Todo` model, migrasi, `FormatingSeries` — semua tidak berubah. Perubahan murni pada payload request/response dan komponen React.

## Error Handling

- Dialog: tombol submit disabled selama `allocated_to` kosong (client-side, Requirement 1.6) — server tetap jadi sumber kebenaran via `AssigneeRequest` validation (kalau lolos client tapi gagal server, Inertia error bag akan muncul lewat mekanisme error handling `FormPage` yang sudah ada, tidak perlu penanganan baru).
- `ValidationException` dari guard `$exists` (§6, Requirement 9.2) mengikuti jalur error-handling standar Laravel/Inertia — otomatis muncul di error bag form (`errors.allocated_to`) tanpa penanganan khusus tambahan, konsisten dengan cara `AssigneeRequest`/`TodoRequest` validation lain sudah ditangani `FormPage`.
- `addAssignee` TIDAK dibungkus try/catch (konsisten dengan perilaku saat ini) — error di luar guard `$exists` (mis. constraint violation lain yang tak terduga) tetap propagate sebagai 500.

## Testing Strategy

- **Feature test** `tests/Feature/Core/AssignedToSidebarTest.php` (sudah ada, diperluas):
  - Assign baru dengan priority/date/due_date/description terisi → assert `todos` row menyimpan field-field itu, bukan default.
  - Assign ke assignee yang statusnya masih `open` untuk dokumen yang sama → assert response ditolak (`ValidationException`, error bag `allocated_to`), TIDAK ada row baru/terupdate (Requirement 9.2).
  - Assign ke assignee yang `Todo`-nya sudah `closed`/`canceled` (belum soft-deleted) untuk dokumen yang sama → assert TETAP ditolak sama seperti status `open` (Requirement 9.1/9.2 berlaku status apapun, bukan cuma `open`).
  - Assign ke assignee yang `Todo` sebelumnya sudah di-soft-delete (`removeAssignee`) untuk dokumen yang sama → assert row BARU berhasil dibuat dengan `code` baru (Requirement 9.4 — soft-deleted tidak terhitung "sudah ada").
- **Feature test** `tests/Feature/Core/TodoTest.php` (sudah ada, tambah kasus):
  - `GET /todos/create` → assert response Inertia `props.defaultData.allocated_to.id === $user->id` (Requirement 8.1).
- **Feature test baru** `tests/Feature/Core/TodoServiceTest.php` atau file baru — tidak ada perubahan service layer signifikan di luar `BufferedAttachmentService`, cukup diperluas test yang sudah ada di `BufferedAttachmentServiceTest.php` untuk assert field priority/date/due_date/description ikut tersimpan dari buffer.
- **Frontend**: tidak ada automated test JS untuk komponen sidebar ini di codebase saat ini (dicek: tidak ada `AssignedTo*.test.js`) — konsisten dengan konvensi yang ada, verifikasi manual lewat `npm run build` + smoke test manual (buka dokumen apapun, assign lewat dialog, cek buffer create-mode, cek klik row navigasi/dialog edit, cek indikator status, cek tombol hapus disembunyikan untuk closed/canceled).
