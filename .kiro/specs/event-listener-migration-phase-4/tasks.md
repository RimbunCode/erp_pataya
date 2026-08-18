# Implementation Plan: Event/Listener Migration — Phase 4

## Overview

Implementasi berjalan dalam 3 grup: buat event/listener baru (domain CRM, pertama kali), migrasi `LeadController::convert()` ke pola dispatch dengan pre-generated ID, lalu hapus `LeadService::convertToCustomer()` (setelah verifikasi tidak ada pemanggil lain). Listener SYNC (bukan `ShouldQueue`) — Controller butuh hasil operasi selesai sebelum response dikirim. Setiap grup diakhiri checkpoint test regresi.

## Tasks

- [x] 1. Event dan listener `LeadConvertedToCustomer` (Requirement 1)
  - [x] 1.1 Buat `App\Events\CRM\LeadConvertedToCustomer`
    - Payload: `lead` (Model Lead), `customerId` (string), `customerData` (array) — lihat design.md untuk struktur field lengkap
    - _Requirements: 1.3_

  - [x] 1.2 Buat listener `App\Listeners\CRM\CreateCustomerFromLead` (sync, TANPA `ShouldQueue`)
    - `handle()`: `Customer::create(['id' => $event->customerId, ...$event->customerData])`, panggil `app(CustomerService::class)->storeBranches($customer, [])`, `$event->lead->update([...])` — logic identik `LeadService::convertToCustomer()` lama, lihat design.md
    - Tambahan (di luar rencana awal): guard idempoten `if ($event->lead->fresh()->converted_customer_id) return;` di awal `handle()` — mitigasi bug sistemik double-registration listener yang ditemukan saat implementasi (lihat CONTEXT.md/memory `project_event_listener_double_registration_bug.md`)
    - _Requirements: 1.4, 1.5, 1.7_

  - [x] 1.3 Register event di `EventServiceProvider`
    - _Requirements: 1.4_ (struktur)

  - [x] 1.4 Write unit test `CreateCustomerFromLeadTest`
    - **Test: Customer dibuat dengan id sesuai `$event->customerId`** — assert field lain identik payload
    - **Test: Lead ter-update status/converted_customer_id/converted_at** setelah listener jalan
    - **Test: `CustomerService::storeBranches()` terpanggil dengan array kosong** (mock/spy)
    - **Validates: Requirements 1.5, 1.7, Property 1, Property 4**

- [x] 2. Checkpoint - Pastikan Task 1 tidak regresi
  - Jalankan test dari Task 1.4. Pastikan `Customer::create(['id' => ..., ...])` tidak konflik `HasUlids` (verifikasi eksplisit — lihat design.md catatan trait). 3/3 PASS.

- [x] 3. Migrasi `LeadController::convert()` (Requirement 1, 2)
  - [x] 3.1 Ubah `LeadController::convert()`
    - Pindahkan guard idempotent (`$lead->converted_customer_id`) ke SEBELUM `DB::beginTransaction()` — early return jika sudah dikonversi (lihat design.md, perbedaan dari kode lama)
    - Generate `$customerId = (string) Str::ulid()` SEBELUM dispatch
    - Susun `customerData` dari `$lead` (field identik `LeadService::convertToCustomer()` lama baris 47-56), dispatch `event(new LeadConvertedToCustomer($lead, $customerId, $customerData))`
    - `return back()->with('id', $customerId)` (bukan lagi `$customer->id` dari return value Service)
    - _Requirements: 1.1, 1.2, 1.3, 1.6_

  - [x] 3.2 Verifikasi transaksi & error handling
    - Konfirmasi listener sync jalan DI DALAM transaksi `LeadController::convert()` yang sama (bukan buka transaksi baru)
    - Keputusan (atas arahan user): tambah `try { ... DB::commit(); } catch (\Throwable $e) { DB::rollBack(); throw $e; }` — beda dari pola Controller lain di proyek (yang tidak punya try/catch), tapi diperlukan karena `convert()` satu-satunya titik yang bikin record BARU (Customer) lewat listener; tanpa ini, Customer row bisa "nyangkut" tanpa rollback kalau listener gagal setelah `Customer::create()` sukses
    - _Requirements: 1.6, 1.8_

  - [x] 3.3 Write test Controller (regression + idempotent + rollback)
    - **Test: `convert()` pada Lead baru** — assert response `id` SAMA dengan `Customer::id` tersimpan di DB (cross-check query, bukan cuma assert response)
    - **Test: `convert()` idempotent** — panggil 2x pada Lead sama, assert Customer HANYA dibuat sekali, assert `event()` TIDAK dipatch pada panggilan kedua (`Event::fake()`)
    - **Test: rollback saat `Customer::create()` gagal** — paksa exception (mock `CustomerService::storeBranches()` throw), assert Lead TIDAK ter-update `status`/`converted_customer_id`, assert `Customer::count() === 0`
    - **Validates: Requirements 1.1, 1.2, 1.6, 1.8, Property 2, Property 3**

- [x] 4. Checkpoint - Pastikan Task 3 tidak regresi
  - Jalankan test dari Task 3.3. 3/3 PASS setelah fix try/catch. Tidak ada test existing `LeadController`/`LeadService` lain yang menyentuh alur convert.

- [x] 5. Hapus `LeadService::convertToCustomer()` (Requirement 2)
  - [x] 5.1 Verifikasi tidak ada pemanggil lain method ini di codebase
    - Grep + graphify query menyeluruh `convertToCustomer` — nol referensi selain definisi method itu sendiri
    - _Requirements: 2.2_

  - [x] 5.2 Hapus method `LeadService::convertToCustomer()`
    - `app/Services/CRM/LeadService.php` — method dihapus beserta import `Customer`/`CustomerService` yang tidak lagi dipakai, `storeActivities()` TIDAK disentuh (Requirement 2.1)
    - _Requirements: 2.1, 2.2_

  - [x] 5.3 Write test non-regresi `storeActivities()`
    - Tidak ada test unit langsung `LeadService` di codebase — non-regresi `storeActivities()` tercakup transitif lewat `LeadConvertControllerTest` (exercise via `store()`/`update()` Controller, tidak diubah Fase 4)
    - **Validates: Requirements 2.1**

- [x] 6. Final checkpoint - Full regression
  - Jalankan `php -d memory_limit=1024M vendor/bin/phpunit` (full suite). VERIFIED 2026-08-11: 1004 test, 2745 assertion, 0 Error, 1 Failure (pre-existing `PrintPdfControllerTest`, dikenal sejak baseline Fase 1), 2 Skipped (disengaja, `LockForUpdateIntegrationTest` Fase 3). Tidak ada regresi di luar scope Fase 4.

## Notes

- Task 1 (event/listener) independen dari Task 3 (Controller) secara teknis, TAPI Task 3.1 butuh Task 1 selesai dulu (dispatch event yang belum ada class-nya akan error) — kerjakan berurutan.
- Task 5 (hapus method lama) SENGAJA di akhir, setelah Task 3 terverifikasi — pola sama Fase 2/3 (jangan hapus kode lama sebelum kode baru terbukti bekerja).
- Berbeda dari Fase 1-3, spec ini TIDAK ada `lockForUpdate()` baru — `convertToCustomer()` tidak pernah diidentifikasi punya race condition di audit manapun (operasi create murni, bukan read-modify-write pada row shared).
- Domain `CRM` di `app/Events`/`app/Listeners` BARU pertama kali dipakai di Fase 4 ini — pastikan struktur folder `App\Events\CRM\`/`App\Listeners\CRM\` konsisten pola domain lain (flat, karena cuma 1 event di domain ini untuk saat ini).

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3"] },
    { "id": 2, "tasks": ["1.4"] },
    { "id": 3, "tasks": ["3.1"] },
    { "id": 4, "tasks": ["3.2"] },
    { "id": 5, "tasks": ["3.3"] },
    { "id": 6, "tasks": ["5.1"] },
    { "id": 7, "tasks": ["5.2"] },
    { "id": 8, "tasks": ["5.3"] }
  ]
}
```
