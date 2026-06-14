# Tutorial 5 — Menyiapkan Approval Scheme

> Mengaktifkan persetujuan berjenjang sebelum dokumen melanjutkan workflow.

Konsep: [Core · Approval](../modules/core.md#approval).

```
ApprovalScheme (config) → saat submit → ApprovalInstance (runtime) → step decision
```

## Langkah 1 — Buat Scheme

Menu **Settings → Approval Schemes → Tambah**.

| Field | Catatan |
|---|---|
| `name` | Nama scheme |
| `model` | FQCN dokumen, mis. `App\Models\Sales\SalesOrder` |
| `trigger_on` | `submit` |
| `is_active` | Aktifkan (hanya 1 scheme aktif per model + trigger) |

Route: `POST /settings/approvalSchemes` (`approvalSchemes.store`). Lihat [Core · ApprovalScheme](../modules/core.md#approval-scheme-konfigurasi).

## Langkah 2 — Tambah Steps

Tiap step (`ApprovalSchemeStep`):

| Field | Catatan |
|---|---|
| `sequence` | Urutan (0, 1, 2, ...) |
| `approver_type` | `role` atau `user` |
| `approverable` | Role/User penyetuju (polymorphic) |

Halaman: `Pages/Settings/ApprovalScheme/Form.jsx`, `Show.jsx`.

## Langkah 3 — Uji Submit

1. Buat & submit dokumen target (mis. Sales Order).
2. Karena ada scheme aktif → dokumen masuk `NEED_APPROVAL`, terbentuk `ApprovalInstance` + step.

## Langkah 4 — Proses Approval

Menu **Approvals** (`/approvals`):

| Aksi | Route |
|---|---|
| Daftar | `GET /approvals` (`approvalInstances.index`) |
| Detail | `GET /approvals/{instance}` (`approvalInstances.show`) |
| Keputusan | `POST /approvals/{step}/decision` (`approvalInstances.decision`) |

- Approver klik **Approve/Reject** (`ApproverDecision.jsx`).
- Semua step approved → callback `onApproved()` dokumen (status lanjut TO_DELIVER/TO_RECEIVE/dll).
- Salah satu rejected → `onRejected()` → status `REJECTED` (dapat di-**amend**).

## Catatan

- Tanpa scheme aktif / 0 step → dokumen langsung approved saat submit.
- `{level?}` di route update = level approval saat update di tengah proses. Lihat [Core · Trait Submitable](../modules/core.md#arti-level-pada-route-update).

---

*Lihat: [Core · Approval](../modules/core.md#approval) · [Auth · Workflow](../auth.md#workflow-dokumen)*
