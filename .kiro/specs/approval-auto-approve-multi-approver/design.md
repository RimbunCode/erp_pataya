# Design: Approval Auto-Approve & Multi-Approver

## 1. Ringkasan

Sistem approval saat ini bersifat **single-approver per step** dan **selalu manual**. Saat dokumen `Submitable` disubmit, `ApprovalInstance::makeInstance()` men-snapshot `approval_scheme_steps` menjadi `approval_instance_steps`, lalu tiap step menunggu approve/reject manual sesuai `current_sequence`.

Fitur ini menambah dua kemampuan, tanpa merusak alur single-approver lama:

1. **Auto-Approve** — saat instance dibuat, step yang approver-nya **= requester** (pembuat dokumen, `created_by_id`) langsung diselesaikan: step yang cocok → `APPROVED`, semua step **sebelumnya** → `SKIPPED`, lalu `current_sequence` loncat ke step pending pertama berikutnya (atau instance langsung `APPROVED` bila tidak ada lagi step menunggu). Tujuannya agar approval tidak "minta tanda tangan ke diri sendiri".

2. **Multi-Approver per step (race)** — satu step bisa punya banyak approver. **Approve pertama** meneruskan ke step berikutnya; **reject pertama** menggagalkan seluruh approval. Dikonfigurasi via checkbox **"Advance Mode"** per baris di FormTable scheme, yang membuka **satu** nested FormTable (dibatasi 1 level).

**Yang DIPERTAHANKAN (tidak diubah):**

- Mekanisme advancement berbasis `current_sequence` di `ApprovalInstanceController::approve()`/`reject()`.
- Hook `onApproved()`/`onRejected()` via `checkApproval()` dan `callWithRouteModels()`.
- Step single-approver tetap pakai kolom morph `approverable_*` yang ada (tidak wajib pindah ke tabel anak).
- Enum `FormStatus` — `SKIPPED`, `APPROVED`, `PENDING`, `WAITING`, `REJECTED` semua sudah ada, **tidak perlu case baru**.

## 2. Status Saat Ini

| Komponen | Status |
| --- | --- |
| `ApprovalScheme` + `steps` (`ApprovalSchemeStep`) | ✅ Lengkap; step 1:1 morph `approverable` (Role/User) |
| `ApprovalInstance` + `steps` (`ApprovalInstanceStep`) | ✅ Lengkap; snapshot dari scheme via `makeInstance()` |
| `ApprovalInstance::makeInstance()` | ⚠️ Perlu ditambah **auto-approve pass** + snapshot approver anak |
| `ApprovalInstanceController::approve()` / `reject()` | ⚠️ Perlu **race resolution** untuk step multi-approver |
| `ApprovalInstanceController::index()` / `canAccessApprovalInstance()` | ⚠️ Perlu sertakan approver anak saat step multi |
| `ApprovalSchemeController` (`store`/`update`/`fillStepRelation`) | ⚠️ Perlu simpan approver anak (Advance Mode) |
| `ApprovalSchemeRequest` | ⚠️ Perlu rules `is_advanced` + `approvers.*` |
| `FormStatus` enum | ✅ `SKIPPED`/`APPROVED`/`PENDING`/`WAITING`/`REJECTED` sudah ada |
| Frontend `Settings/ApprovalScheme/Form.jsx` | ⚠️ Perlu checkbox Advance Mode + nested FormTable + text-cell |
| Frontend tab Approvals (`Core/FormPage.jsx` → `ApprovalItem`) | ⚠️ Perlu render daftar approver multi |
| Frontend `ApproverDecision.jsx` | ⚠️ Perlu gate izin = salah satu approver anak |
| Tabel anak approver (scheme & instance) | ❌ Belum ada — dibuat di fitur ini |

## 3. Prinsip Desain

1. **No breaking change** — scheme & instance single-approver lama tetap jalan tanpa migrasi data.
2. **Tabel anak sebagai sumber kebenaran multi** — kolom morph lama di step dipertahankan untuk single-approver; saat `is_advanced=true`, daftar approver dibaca dari tabel anak.
3. **Konsisten pola morph existing** — approver anak pakai `ulidMorphs('approverable')` + `approver_type`, persis pola step.
4. **Auto-approve idempoten** — dijalankan sekali saat `makeInstance` (instance dibuat via `firstOrCreate`), tidak mengubah instance yang sudah ada.
5. **Race minim invasif** — instance step tetap **1 baris per sequence**; daftar approver di tabel anak. `current_sequence` tidak perlu paham banyak baris per sequence.

## 4. Arsitektur Data

### 4a. Tabel baru

**`approval_scheme_step_approvers`** (daftar approver per scheme step saat Advance Mode):

```
id                  ulid primary
approval_scheme_step_id  foreignUlid → approval_scheme_steps (cascadeOnDelete)
approver_type       string            // 'role' | 'user'
approverable        ulidMorphs        // Role / User
config              json nullable
softDeletes, timestamps
```

**`approval_instance_step_approvers`** (snapshot saat instance dibuat; menyimpan status race per approver):

```
id                  ulid primary
approval_instance_step_id  foreignUlid → approval_instance_steps (cascadeOnDelete)
approver_type       string
approverable        ulidMorphs
status              string default 'pending'   // pending | approved | rejected | skipped
acted_by_id         foreignUlid → users nullOnDelete nullable
acted_at            timestamp nullable
config              json nullable
softDeletes, timestamps
```

### 4b. Flag step

Tambah kolom `is_advanced` (boolean default false) pada **`approval_scheme_steps`** dan **`approval_instance_steps`** untuk membedakan mode:

- `is_advanced = false` → single-approver, pakai `approverable_*` di baris step (perilaku lama).
- `is_advanced = true` → multi-approver, daftar approver di tabel anak; kolom `approverable_*` step boleh diisi approver pertama (display fallback) atau dibiarkan.

### 4c. Diagram relasi

```
ApprovalScheme 1───* ApprovalSchemeStep ─(is_advanced)─* ApprovalSchemeStepApprover
                                                              └ morph approverable → Role|User

ApprovalInstance 1───* ApprovalInstanceStep ─(is_advanced)─* ApprovalInstanceStepApprover
                          │ status, acted_by_id                  └ status, acted_by_id, morph
                          └ approverable_* (single fallback)
```

## 5. Model

- **`App\Models\Core\ApprovalSchemeStepApprover`** — `belongsTo(ApprovalSchemeStep)`, `morphTo('approver','approverable_type','approverable_id')`, cast `config` Json.
- **`App\Models\Core\ApprovalInstanceStepApprover`** — `belongsTo(ApprovalInstanceStep)`, `morphTo('approver', …)`, `belongsTo(User,'acted_by_id')` sebagai `actedBy`, cast `status` `FormStatusCast`, `acted_at` datetime, `config` Json.
- **`ApprovalSchemeStep`** — tambah `hasMany(ApprovalSchemeStepApprover)` `approvers()`, cast `is_advanced` boolean.
- **`ApprovalInstanceStep`** — tambah `hasMany(ApprovalInstanceStepApprover)` `approvers()`, cast `is_advanced` boolean; sertakan `approvers.approver` di `$with`/`loadRelationsOnShow()` agar terbawa ke payload tab Approvals.

## 6. Backend — Auto-Approve di `makeInstance()`

Lokasi: `app/Models/Core/ApprovalInstance.php` (`makeInstance`, sekitar baris 60–94).

Setelah loop pembuatan `$instance->steps()` (dan snapshot approver anak untuk step `is_advanced`), jalankan auto-resolve **hanya bila instance baru dibuat** (`$instance->wasRecentlyCreated`):

```
$document       = $data;                       // model dokumen
$requesterId    = $document->created_by_id;
$requesterRoles = optional($document->createdBy)->roles->pluck('id') ?? collect();

$stepMatches = function (ApprovalInstanceStep $step) use ($requesterId, $requesterRoles): bool {
    // kumpulkan kandidat approver: tabel anak bila is_advanced, else kolom step
    foreach ($step->approverCandidates() as $cand) {     // {approver_type, approverable_id}
        if ($cand->approver_type === 'user' && $cand->approverable_id === $requesterId) return true;
        if ($cand->approver_type === 'role' && $requesterRoles->contains($cand->approverable_id)) return true;
    }
    return false;
};

$steps     = $instance->steps()->orderBy('sequence')->get();
$matchedSeq = null;
foreach ($steps as $step) {
    if ($stepMatches($step)) {
        $step->update(['status' => APPROVED, 'acted_by_id' => $requesterId, 'acted_at' => now()]);
        // bila is_advanced: tandai approver anak yang cocok APPROVED (acted_by requester), sisanya SKIPPED
        $matchedSeq = $step->sequence;                    // ambil match TERAKHIR
    }
}

if ($matchedSeq !== null) {
    // semua step sebelum match → SKIPPED
    $steps->where('sequence', '<', $matchedSeq)->each->update(['status' => SKIPPED]);
    // step pending pertama setelah match
    $next = $steps->first(fn ($s) => $s->sequence > $matchedSeq && $s->status === WAITING);
    if ($next) {
        $next->update(['status' => PENDING]);
        $instance->update(['current_sequence' => $next->sequence, 'status' => PENDING]);
    } else {
        $instance->update(['status' => APPROVED]);
    }
}
// tanpa match → perilaku lama (step seq 0 PENDING, sisanya WAITING) tetap dari loop awal
```

> **Edge:** requester cocok di beberapa step → dipakai `matchedSeq` **terakhir** (semua sebelumnya `SKIPPED`), konsisten dengan Contoh user. `checkApproval()` (controller) sudah memanggil `onApproved()` ketika `instance->status == APPROVED`, sehingga full auto-approve langsung mengeksekusi efek dokumen.

### Diagram alur (Contoh 1 — requester Purchase Manager)

```
step1 Purchase Officer (seq0)  → sebelum match → SKIPPED
step2 Purchase Manager (seq1)  → match (terakhir) → APPROVED  (acted_by = requester)
step3 Finance Manager (seq2)   → setelah match, WAITING → PENDING  (current_sequence=2)
instance → PENDING
```

### Diagram alur (Contoh 2 — requester Finance Manager)

```
step1 Purchase Officer (seq0)  → sebelum match → SKIPPED
step2 Purchase Manager (seq1)  → sebelum match → SKIPPED
step3 Finance Manager (seq2)   → match (terakhir) → APPROVED
tidak ada step WAITING setelahnya → instance → APPROVED (onApproved dipanggil)
```

## 7. Backend — Race Multi-Approver di `approve()` / `reject()`

Lokasi: `app/Http/Controllers/Core/ApprovalInstanceController.php` (`approve` ~160, `reject` ~209, `decision` ~253).

`decision()` menerima `ApprovalInstanceStep`. Tambahan: jika `step->is_advanced`, sebelum menyetel status step, catat keputusan pada **approver anak** milik aktor:

```
approve(step, notes):
  if step.is_advanced:
      myApprover = step.approvers()->where(approver cocok user/role aktor)->first()
      myApprover.update(status=APPROVED, acted_by_id=Auth::id(), acted_at=now())
      // race: approve pertama menang → approver anak lain yang masih pending → SKIPPED
      step.approvers()->where(status, PENDING)->update(status=SKIPPED)
  // lalu set step.status=APPROVED, acted_by_id=Auth::id() (winner) → lanjut advancement existing

reject(step, notes):
  if step.is_advanced:
      myApprover.update(status=REJECTED, acted_by_id=Auth::id(), acted_at=now())
      step.approvers()->where(status, PENDING)->update(status=SKIPPED)
  // set step.status=REJECTED → skip seluruh sisa step (logika existing)
```

Advancement `current_sequence` dan penetapan instance `APPROVED`/`REJECTED` **tidak berubah** — race hanya menentukan siapa "winner" yang mengisi status step.

## 8. Backend — Inbox & Akses (`index()` / `canAccessApprovalInstance()`)

Kedua query saat ini hanya membaca `approver_type`/`approverable_id` pada baris step. Untuk step `is_advanced`, approver ada di tabel anak. Solusi: tambahkan klausa `orWhereHas('approvers', …)` (atau union) agar:

- **`index()`** (inbox) menampilkan step `pending` yang salah satu approver anak-nya cocok user/role aktif.
- **`canAccessApprovalInstance()`** mengizinkan akses bila user salah satu approver anak (atau `acted_by_id`).

Pola match tetap sama: `approver_type=user & approverable_id=user.id` ATAU `approver_type=role & approverable_id ∈ user.roles`.

## 9. Backend — Scheme Controller & Request

**`ApprovalSchemeRequest`** — tambah rules:

```
'steps.*.is_advanced'             => ['nullable','boolean'],
'steps.*.approver_type'           => ['required_if:steps.*.is_advanced,false','in:role,user'],
'steps.*.approver.id'             => ['required_if:steps.*.is_advanced,false','string'],
'steps.*.approvers'               => ['required_if:steps.*.is_advanced,true','array','min:1'],
'steps.*.approvers.*.approver_type' => ['required_with:steps.*.approvers','in:role,user'],
'steps.*.approvers.*.approver.id'   => ['required_with:steps.*.approvers','string'],
```

**`ApprovalSchemeController`** — `fillStepRelation()` tetap mengisi `approverable_*` untuk single; saat `is_advanced`, setelah step dibuat/diupdate, sinkronkan child `approvers` (delete yang hilang, create/update sisanya), mirip pola sync `steps` di `update()` (pakai `Ulid::isValid` untuk bedakan create vs update).

## 10. Frontend — Scheme Form (Advance Mode)

Lokasi: `resources/js/Pages/Settings/ApprovalScheme/Form.jsx` + komponen `FormTable`.

- Tambah kolom **`is_advanced`** (checkbox) pada `stepColumns`, render via `col.cell` dengan `FormCheckbox`.
- Kolom `approver_type` & `approver` existing: bila `dataRow.is_advanced` aktif, render sebagai **komponen text** (read-only) yang menampilkan ringkasan: `Approver Type: Multiple` dan `Approver: "role:RoleA", "user:UserB", …` (dibangun dari `dataRow.approvers`). Edit detail dilakukan di dialog baris.
- **Nested FormTable (1 level)** muncul di **dialog edit baris** (prop `form`/`getColumn` milik FormTable) hanya saat `is_advanced` aktif:
  - Kolom nested: `approver_type` (Select role/user) + `approver` (LinkModel), identik pola `stepColumns`.
  - Terikat ke `dataRow.approvers` via `setData('approvers', val)`.
  - Dibatasi **satu** level nesting (nested FormTable tidak mengizinkan Advance Mode lagi).

`★ Catatan teknis:` FormTable mendukung kolom kustom (`col.cell`) dan dialog baris kustom (`form`). Nested FormTable di dalam dialog adalah pola paling aman karena menghindari nested grid di sel tabel utama (yang sempit) dan tetap memakai state baris yang sudah dikelola FormTable.

## 11. Frontend — Tab Approvals di Dokumen

Lokasi: `resources/js/Pages/Core/FormPage.jsx` (`Approvals` ~1371, `ApprovalItem` ~1265) + `resources/js/Pages/Core/Components/ApproverDecision.jsx`.

- Payload `defaultData.approvalable.steps` harus membawa `approvers.approver` (dari `$with`/`loadRelationsOnShow` `ApprovalInstanceStep`).
- **`ApprovalItem`**: bila `is_advanced` (atau `approvers.length > 0`), ganti baris tunggal `approver_type: approver` menjadi:
  - Header: `Multiple` + `BadgeStatus` status step.
  - Daftar approver anak: tiap baris `approver_type: approver` + badge status anak (`approved`/`rejected`/`skipped`/`pending`) + aktor bila ada.
- **`ApproverDecision`**: gate izin saat ini (`user.id == approver.id || user.id_roles.includes(approver.id)`) diperluas — untuk step `is_advanced`, izinkan bila user cocok **salah satu** `currentStep.approvers` (by user-id atau role). Tampilkan keterangan singkat bahwa ini step race ("salah satu approver dapat memutuskan").

## 12. Edge Cases

| Kasus | Perilaku |
| --- | --- |
| Requester tidak cocok step manapun | Tidak ada auto-approve; perilaku lama. |
| Requester cocok di beberapa step | Match **terakhir** = APPROVED; semua sebelumnya SKIPPED. |
| Full match (semua step cocok / step terakhir cocok & tak ada WAITING sesudahnya) | Instance APPROVED → `onApproved()` dipanggil. |
| Step multi tanpa approver (config salah) | Validasi request menolak (`approvers` min:1). |
| Reject pada step multi | Step REJECTED, approver anak pending → SKIPPED, sisa step SKIPPED, instance REJECTED. |
| Instance sudah ada (resubmit) | `firstOrCreate` → tidak menjalankan ulang auto-approve. |
| Backward-compat | Scheme/instance lama `is_advanced=false`, tanpa baris anak → tak ada perubahan perilaku. |

## 13. Testing (ringkas)

Feature test (`tests/Feature/Core/...`):

1. Auto-approve **Contoh 1** (requester Purchase Manager): assert step statuses `SKIPPED/APPROVED/PENDING`, instance `PENDING`, `current_sequence=2`.
2. Auto-approve **Contoh 2** (requester Finance Manager): assert `SKIPPED/SKIPPED/APPROVED`, instance `APPROVED`, `onApproved` ter-trigger.
3. Tanpa match → perilaku lama tetap.
4. Multi-approver race **approve**: approver A approve → step APPROVED, approver B child → SKIPPED, lanjut step berikut.
5. Multi-approver race **reject**: approver A reject → instance REJECTED.
6. Auto + multi: requester salah satu approver step multi → step APPROVED (skip sebelumnya).
7. Payload tab Approvals: step multi membawa `approvers.approver` ter-load.
