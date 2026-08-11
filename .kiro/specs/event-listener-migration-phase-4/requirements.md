# Requirements Document

## Introduction

Fase 4 memindahkan `LeadService::convertToCustomer()` ke pola Event/Listener. Ini kandidat TERAKHIR dari daftar 19 awal (lihat memory `project_event_listener_migration_phases.md`) yang belum ditangani — dikeluarkan dari Fase 3 karena kategorinya beda total dari kandidat GL-entangled.

**Kenapa method ini beda dari Fase 1-3**: Fase 1-3 semuanya soal SIDE-EFFECT setelah suatu aksi (audit log, notifikasi, reservasi stok, sinkronisasi status, posting GL) — caller (Controller/Service lain) TIDAK PERNAH butuh apa-apa balik dari side-effect itu, cuma butuh efeknya terjadi. `convertToCustomer()` berbeda: dia MEMBUAT record baru (`Customer`) dan Controller (`LeadController::convert()`) BUTUH `Customer::id` sebagai return value LANGSUNG — dipakai untuk `back()->with('id', $customer->id)`, dibaca frontend untuk redirect/highlight. Event dispatch by design tidak punya return value (void), jadi migrasi lurus (dispatch lalu selesai) akan MEMATAHKAN kontrak return value ini.

Audit menyeluruh 2026-08-10 (sebelum requirements ini ditulis) menemukan 16 method Service LAIN dengan pola serupa (`Service::create()` → Controller pakai return value untuk redirect) — SEMUANYA DIKELUARKAN dari scope Fase 4 secara sadar, karena `create()` awal dokumen (SalesOrder, PurchaseOrder, DeliveryNote, dst) murni operasi domain sendiri tanpa cross-domain effect yang jadi alasan migrasi Fase 1-3. `convertToCustomer()` tetap masuk scope karena BEDA: dia genuinely cross-model (`Lead` → `Customer`, 2 domain CRM berbeda meski sama-sama modul CRM/Sales) — konsisten prinsip desain "mutasi yang mempengaruhi domain lain harus lewat Event/Listener".

**Keputusan desain kunci**: ID `Customer` baru di-generate di CONTROLLER (`Str::ulid()`) SEBELUM event di-dispatch, dikirim sebagai bagian payload — BUKAN dibaca dari return value listener. Ini pola berbeda dari event-listener lain di codebase (yang semuanya void, tidak pernah perlu caller tahu ID record baru), tapi menghindari kebutuhan listener return value (yang secara arsitektur Laravel event/listener tidak didukung — `event()` selalu return array hasil semua listener, bukan didesain untuk dikonsumsi caller sebagai nilai tunggal).

## Glossary

- **Return-value-dependent**: method yang side-effect-nya TIDAK bisa dipisah murni dari kebutuhan caller mendapatkan hasil (biasanya objek/ID record baru) secara langsung — beda dari "pure side-effect" (Fase 1-3) yang callernya tidak peduli hasil apapun.
- **Pre-generated ID**: pola di mana primary key record baru ditentukan SEBELUM `Model::create()` dipanggil (bukan auto-generate saat create), supaya kode yang men-trigger pembuatan record bisa langsung tahu ID-nya tanpa menunggu return value dari proses pembuatan itu sendiri.

## Requirements

### Requirement 1: Event `LeadConvertedToCustomer` dengan pre-generated Customer ID

**User Story:** Sebagai pemilik sistem, saya ingin konversi Lead ke Customer berjalan lewat Event/Listener (konsisten prinsip cross-domain mutation), TANPA mengubah kontrak `LeadController::convert()` yang butuh `Customer::id` untuk redirect.

#### Acceptance Criteria

1. WHEN `LeadController::convert()` dipanggil DAN `$lead->converted_customer_id` masih kosong (belum pernah dikonversi), THE sistem SHALL generate `$customerId` baru (`Str::ulid()`) di Controller SEBELUM dispatch event.
2. WHEN `$lead->converted_customer_id` SUDAH terisi (lead pernah dikonversi sebelumnya), THE sistem SHALL TIDAK generate ID baru maupun dispatch event — Controller langsung pakai `$lead->converted_customer_id` existing untuk redirect (perilaku idempotent, identik logic lama baris 43-45 `LeadService::convertToCustomer()`).
3. THE sistem SHALL membuat event `App\Events\CRM\LeadConvertedToCustomer` dengan payload: `lead` (Model Lead), `customerId` (string, pre-generated), `customerData` (array — name/email/phone/street/city/province/zip_code/country_id dari Lead, disiapkan di Controller atau Service, BUKAN di listener membaca ulang `$lead` — hindari race kalau Lead berubah di antara dispatch dan listener jalan).
4. THE sistem SHALL membuat listener `App\Listeners\CRM\CreateCustomerFromLead` (SYNC — TIDAK `ShouldQueue`, konsisten alasan Fase 1-3: Controller butuh hasil operasi ini selesai SEBELUM response dikirim, karena redirect memakai ID yang baru dibuat).
5. WHEN listener `CreateCustomerFromLead::handle()` dijalankan, THE sistem SHALL: (a) `Customer::create(['id' => $event->customerId, ...$event->customerData])`, (b) panggil `CustomerService::storeBranches($customer, [])` (logic identik lama), (c) `$lead->update(['status' => 'converted', 'converted_customer_id' => $event->customerId, 'converted_at' => now()])`.
6. THE sistem SHALL menjalankan seluruh Requirement 1.5 di dalam SATU transaksi DB yang SAMA dengan yang dibuka `LeadController::convert()` (transaksi existing, `DB::beginTransaction()`/`DB::commit()`) — TIDAK membuka transaksi baru di listener.
7. THE sistem SHALL TIDAK mengubah field/logic Customer yang dibuat (nama field, `storeBranches([])` dengan array kosong) — migrasi murni pindah LOKASI kode, bukan ubah hasil.
8. IF `Customer::create()` di listener throw exception (mis. constraint violation), THEN sistem SHALL membiarkan exception propagate ke transaksi Controller (`DB::rollBack()` existing tetap berfungsi, karena listener sync jalan di transaksi yang sama) — TIDAK ada penanganan retry/queue-failure seperti Fase 3 (ini bukan operasi async).

### Requirement 2: Non-regresi `LeadService`

**User Story:** Sebagai pemilik sistem, saya ingin `LeadService::storeActivities()` (method lain di file yang sama, tidak terkait konversi) tetap tidak berubah.

#### Acceptance Criteria

1. THE sistem SHALL TIDAK mengubah `LeadService::storeActivities()` sama sekali.
2. WHEN `LeadService::convertToCustomer()` dihapus (digantikan dispatch event di Controller + listener), THE sistem SHALL memverifikasi tidak ada pemanggil lain method ini di codebase selain `LeadController::convert()` sebelum dihapus.

## Catatan Audit (referensi implementasi)

- `LeadService::convertToCustomer()` (`app/Services/CRM/LeadService.php:42-66`) — baseline snapshot 2026-08-10, verifikasi ulang baris sebelum implementasi.
- `LeadController::convert()` (`app/Http/Controllers/CRM/LeadController.php:83-89`) — transaksi dibuka/ditutup di Controller, bukan Service (beda dari pola Fase 1-3 yang transaksinya di Service `onApproved()`).
- `Customer` model pakai `HasUlids` (`app/Models/Sales/Customer.php:13`) — trait ini TIDAK override `id` kalau sudah diisi manual sebelum `create()`, jadi pola pre-generated ID valid tanpa ubah trait/model.
- 16 kandidat lain (`SalesOrderService::create()`, `PurchaseOrderService::create()`, dst — daftar lengkap di histori audit) DIKELUARKAN dari scope Fase 4 — `create()` awal dokumen bukan migrasi kandidat, hanya dicatat sebagai referensi kalau ada perubahan kebijakan di masa depan.
