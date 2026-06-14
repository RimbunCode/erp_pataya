# Requirements: Approval Auto-Approve & Multi-Approver

## 1. Ringkasan

Approval system menambah dua kemampuan di atas alur single-approver manual yang ada:

1. **Auto-Approve** — step yang approver-nya sama dengan **requester** (pembuat dokumen) diselesaikan otomatis saat instance dibuat.
2. **Multi-Approver per step (race)** — satu step dapat punya banyak approver; approve/reject pertama menentukan hasil step.

**Yang DIPERTAHANKAN (tidak diubah):** advancement `current_sequence`, hook `onApproved()`/`onRejected()`, dan perilaku step single-approver. Enum `FormStatus` tidak bertambah (`SKIPPED`/`APPROVED`/`PENDING`/`WAITING`/`REJECTED` sudah ada).

**Definisi requester:** `document.created_by_id` (diisi otomatis oleh trait `Submitable`) beserta role-role yang dimiliki user tersebut.

**Basis pencocokan (match):** sebuah kandidat approver cocok requester jika:
- `approver_type = user` **dan** `approverable_id = requester.id`, **ATAU**
- `approver_type = role` **dan** `approverable_id ∈ requester.roles`.

## 2. Functional Requirements

### FR1: Auto-Approve — Aturan Inti

Saat `ApprovalInstance` baru dibuat (`makeInstance`), sistem mengevaluasi tiap step terhadap requester:

| Kondisi | Perilaku |
| --- | --- |
| Step cocok requester | Step → `APPROVED`, `acted_by_id` = requester, `acted_at` = now |
| Step **sebelum** step yang cocok (sequence lebih kecil) | Step → `SKIPPED` |
| Requester cocok di **beberapa** step | Pakai step cocok dengan **sequence terbesar (terakhir)** sebagai titik `APPROVED`; semua sebelumnya `SKIPPED` |
| Requester **tidak** cocok step manapun | Tidak ada auto-approve; perilaku lama (step seq 0 `PENDING`, sisanya `WAITING`) |

**Acceptance:**
- Step yang di-skip ber-status `SKIPPED` (bukan `APPROVED`).
- Auto-approve hanya dijalankan sekali, saat instance benar-benar baru dibuat (idempoten terhadap resubmit; `firstOrCreate`).

### FR2: Auto-Approve — Partial vs Full (acceptance dari contoh user)

**Contoh 1 — requester Purchase Manager:**

```
step 1 : Purchase Officer  → SKIPPED
step 2 : Purchase Manager  → APPROVED
step 3 : Finance Manager   → PENDING
instance → PENDING, current_sequence = step3
```

**Contoh 2 — requester Finance Manager:**

```
step 1 : Purchase Officer  → SKIPPED
step 2 : Purchase Manager  → SKIPPED
step 3 : Finance Manager   → APPROVED
instance → APPROVED  (onApproved dipanggil)
```

**Acceptance:**
- **Partial:** jika ada step `WAITING` setelah step yang cocok → step pending pertama setelahnya menjadi `PENDING`, `current_sequence` menunjuk ke sana, instance tetap `PENDING` (Contoh 1).
- **Full:** jika tidak ada step `WAITING` setelah step yang cocok → instance `APPROVED` dan efek dokumen dijalankan via `onApproved()` (Contoh 2).

### FR3: Multi-Approver — Penyimpanan

Satu step dapat punya banyak approver, disimpan pada **tabel anak**:
- `approval_scheme_step_approvers` (konfigurasi scheme).
- `approval_instance_step_approvers` (snapshot per instance, menyimpan status race per approver).

Step dibedakan oleh kolom `is_advanced` (boolean). Single-approver (`is_advanced=false`) tetap memakai kolom morph `approverable_*` pada baris step.

**Acceptance:**
- Membuat scheme step Advance Mode menyimpan ≥1 baris approver anak.
- Single approver (`is_advanced=false`) tidak membuat baris anak dan berperilaku seperti sebelumnya.

### FR4: Multi-Approver — Race Approve/Reject

Pada step `is_advanced`:

| Aksi | Perilaku |
| --- | --- |
| Salah satu approver **approve** | Step → `APPROVED` (acted_by = aktor); approver anak lain yang masih `pending` → `SKIPPED`; advancement ke step berikutnya (existing) |
| Salah satu approver **reject** | Step → `REJECTED` (acted_by = aktor); approver anak lain `pending` → `SKIPPED`; sisa step → `SKIPPED`; instance → `REJECTED` |

**Acceptance:**
- Setelah satu approver memutuskan, approver lain di step yang sama tidak bisa lagi memutuskan (step bukan lagi `pending`).
- Approver winner tercatat di `acted_by_id` step dan approver anak terkait.

### FR5: Auto-Approve + Multi-Approver

Step `is_advanced` dianggap **cocok requester** bila requester cocok **salah satu** approver anaknya. Aturan skip/approve sama dengan FR1.

**Acceptance:** requester yang termasuk salah satu approver step multi memicu step `APPROVED` dan skip step-step sebelumnya.

### FR6: UI Scheme — Advance Mode

Pada form scheme (`Settings/ApprovalScheme/Form.jsx`), tiap baris FormTable step:
- Ada checkbox **"Advance Mode"**.
- Saat aktif: sel `approver_type`/`approver` di tabel utama menjadi **komponen text** read-only — `Approver Type: Multiple`, `Approver: "role:RoleA", "user:UserB", …`.
- Saat aktif: dialog edit baris menampilkan **satu** nested FormTable (1 level) untuk mengelola daftar approver (kolom `approver_type` + `approver`).
- Nested FormTable **dibatasi satu level** (approver di dalamnya tidak punya Advance Mode lagi).

**Acceptance:** toggling checkbox mengubah tampilan sel & memunculkan/menyembunyikan nested FormTable; data approver tersimpan & ter-load saat edit scheme.

### FR7: UI Dokumen — Tab Approvals

Pada tab **Approvals** di halaman dokumen (`Core/FormPage.jsx`):
- Step multi-approver menampilkan label `Multiple` + status step, lalu daftar approver anak beserta status masing-masing (`approved`/`rejected`/`skipped`/`pending`) dan aktor bila ada.
- Tombol keputusan (`ApproverDecision.jsx`) muncul untuk user yang cocok **salah satu** approver step `pending` (by user atau role).

**Acceptance:**
- Payload `approvalable.steps` membawa relasi `approvers.approver`.
- User yang merupakan salah satu approver step multi pending dapat membuka dialog keputusan; user yang bukan approver tidak.

## 3. Non-Functional Requirements

- **Backward-compat:** scheme & instance lama (`is_advanced=false`, tanpa baris anak) berperilaku identik dengan sebelum fitur ini. Tidak ada migrasi data wajib.
- **Idempotensi:** auto-approve hanya saat instance baru dibuat.
- **Konsistensi pola:** approver anak memakai morph + `approver_type` seperti step; sync child mengikuti pola sync `steps` di `ApprovalSchemeController::update()`.
- **i18n:** label baru (Advance Mode, Multiple, status approver) tersedia di file lang `id` & `en`.

## 4. Out of Scope

- Approval kuorum (mis. "butuh 2 dari 3 approve") — saat ini murni race (1 approve / 1 reject).
- Lebih dari satu level nesting FormTable.
- Notifikasi/email ke approver.
- Perubahan mekanisme `onApproved()`/`onRejected()` dan accounting/SLE downstream.
