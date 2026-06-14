# Tasks: Approval Auto-Approve & Multi-Approver

> Status: `[ ]` todo · `[~]` queued · `[-]` in progress · `[x]` done
> Optional task ditandai `- [ ]* <id>`. **Pint/ESLint hanya dijalankan setelah SEMUA task selesai.**

## T01: Migration — Tabel Anak & Flag Step

- [x] 1. Migration `create_approval_scheme_step_approvers_table`: `id` ulid, `approval_scheme_step_id` FK cascadeOnDelete, `approver_type` string, `ulidMorphs('approverable')`, `config` json nullable, softDeletes, timestamps
- [x] 2. Migration `create_approval_instance_step_approvers_table`: kolom seperti T01.1 + `status` string default `pending`, `acted_by_id` FK users nullOnDelete nullable, `acted_at` timestamp nullable
- [x] 3. Migration tambah kolom `is_advanced` boolean default false ke `approval_scheme_steps`
- [x] 4. Migration tambah kolom `is_advanced` boolean default false ke `approval_instance_steps`

## T02: Model — Approver Anak & Relasi

- [x] 5. `app/Models/Core/ApprovalSchemeStepApprover.php`: `belongsTo(ApprovalSchemeStep)`, `morphTo('approver','approverable_type','approverable_id')`, cast `config` Json, HasUlids + SoftDeletes
- [x] 6. `app/Models/Core/ApprovalInstanceStepApprover.php`: `belongsTo(ApprovalInstanceStep)`, `morphTo('approver', …)`, `belongsTo(User,'acted_by_id')` sbg `actedBy`, cast `status` FormStatusCast / `acted_at` datetime / `config` Json
- [x] 7. `ApprovalSchemeStep`: tambah `hasMany(ApprovalSchemeStepApprover)` `approvers()`, cast `is_advanced` boolean
- [x] 8. `ApprovalInstanceStep`: tambah `hasMany(ApprovalInstanceStepApprover)` `approvers()`, cast `is_advanced` boolean; sertakan `approvers.approver` di `$with`/`loadRelationsOnShow()`
- [x] 9. Helper `approverCandidates()` pada `ApprovalInstanceStep` (kembalikan approver anak bila `is_advanced`, else kolom step) untuk dipakai auto-approve & query akses

## T03: Backend — Snapshot Approver Anak + Auto-Approve (`makeInstance`)

- [x] 10. `ApprovalInstance::makeInstance()`: saat membuat tiap instance step, set `is_advanced` dari scheme step; jika advanced, snapshot baris approver anak dari `approval_scheme_step_approvers` ke `approval_instance_step_approvers` (status `pending`)
- [x] 11. Auto-approve pass (hanya `wasRecentlyCreated`): hitung requester (`created_by_id` + roles), tandai step cocok `APPROVED` (match terakhir), step sebelumnya `SKIPPED`
- [x] 12. Step advanced yang cocok: tandai approver anak yang cocok `APPROVED` (acted_by requester), sisanya `SKIPPED`
- [x] 13. Partial: set step pending pertama setelah match → `PENDING` + `current_sequence`; instance tetap `PENDING`
- [x] 14. Full: tanpa step `WAITING` setelah match → instance `APPROVED` (biarkan `checkApproval()` memanggil `onApproved`)
- [x] 15. Tanpa match → perilaku lama tetap (regression-safe)

## T04: Backend — Race Multi-Approver (`approve`/`reject`)

- [x] 16. `ApprovalInstanceController::approve()`: jika `step->is_advanced`, set approver anak milik aktor `APPROVED` (acted_by, acted_at), lalu approver anak `pending` lain → `SKIPPED`, sebelum set step `APPROVED`
- [x] 17. `ApprovalInstanceController::reject()`: jika `step->is_advanced`, set approver anak milik aktor `REJECTED`, approver anak `pending` lain → `SKIPPED`, sebelum set step `REJECTED`
- [x] 18. Pastikan advancement `current_sequence` & penetapan instance `APPROVED`/`REJECTED` existing tidak berubah

## T05: Backend — Inbox & Akses

- [x] 19. `ApprovalInstanceController::index()`: perluas query agar step `is_advanced` pending tampil bila salah satu approver anak cocok user/role aktif (`orWhereHas('approvers', …)`)
- [x] 20. `canAccessApprovalInstance()`: izinkan akses bila user salah satu approver anak (atau `acted_by_id`)

## T06: Backend — Scheme Controller & Request

- [x] 21. `ApprovalSchemeRequest`: tambah rules `steps.*.is_advanced`, conditional `approver_type`/`approver.id` (single) vs `approvers`/`approvers.*` (advanced)
- [x] 22. `ApprovalSchemeController::fillStepRelation()` + `store()`: simpan `is_advanced`; saat advanced, create baris `approvers` anak
- [x] 23. `ApprovalSchemeController::update()`: sync child `approvers` (delete hilang, create/update sisanya via `Ulid::isValid`), mengikuti pola sync `steps`

## T07: Frontend — Scheme Form (Advance Mode + Nested FormTable)

- [x] 24. `Settings/ApprovalScheme/Form.jsx`: tambah kolom `is_advanced` (FormCheckbox) di `stepColumns`
- [x] 25. Saat `dataRow.is_advanced`: render sel `approver_type`/`approver` sebagai komponen text (`Multiple`, `"role:X","user:Y",…`)
- [x] 26. Dialog edit baris: tampilkan nested FormTable (1 level) terikat `dataRow.approvers` saat advanced; kolom `approver_type` + `approver` (pola sama)
- [x] 27. Batasi nested FormTable satu level (tanpa Advance Mode di dalam nested)

## T08: Frontend — Tab Approvals Dokumen

- [x] 28. Pastikan payload `approvalable.steps` membawa `approvers.approver` (efek T02.8)
- [x] 29. `Core/FormPage.jsx` `ApprovalItem`: render daftar approver multi (label `Multiple` + status step + daftar approver anak dgn status & aktor)
- [x] 30. `Core/Components/ApproverDecision.jsx`: gate izin = user salah satu `currentStep.approvers` (user/role) saat advanced; tampilkan info race

## T09: i18n

- [x] 31. Tambah key `is_advanced`, `approver_type.options.multiple`, label approver multi di `lang/id/core/approvalScheme.php` & `lang/en/core/approvalScheme.php`
- [x] 32. Tambah key tab Approvals (Multiple, status approver, info race) di `lang/*/core/approvalInstance.php` & `lang/*/core/form.php`

## T10: Tests

- [x] 33. Feature test auto-approve **Contoh 1** (step 0 match → APPROVED, step 1 PENDING, instance PENDING)
- [x] 34. Feature test auto-approve **Contoh 2** (last match full → step 0 SKIPPED, step 1 APPROVED, instance APPROVED)
- [x] 35. Feature test tanpa match → perilaku lama (step PENDING, no acted_by)
- [x] 36. Feature test race **approve**: approver A approve → step `APPROVED`, approver B child `SKIPPED`, lanjut step berikut
- [x] 37. Feature test race **reject**: approver A reject → instance `REJECTED`, sisa step `SKIPPED`
- [x] 38. Feature test auto + multi: requester salah satu approver step multi → step `APPROVED`, step sebelumnya `SKIPPED`
- [x] 39. Feature test payload: step multi membawa `approvers.approver` ter-load untuk tab Approvals
- [x] 40. Feature test backward-compat: scheme/instance single-approver lama tetap berjalan identik

## T11: Checkpoint Final

- [x] 41. Jalankan `php artisan test --compact --filter=Approval` — semua pass
- [x] 42. `vendor/bin/pint --dirty --format agent` (PHP) + ESLint (frontend) — **hanya di sini**
- [x] 43. `npm run build` untuk perubahan FormTable nested + tab Approvals
- [ ] 44. Konfirmasi ke user sebelum menjalankan full test suite
