# Context Handoff — Event/Listener Migration Fase 2

Dokumen ini untuk agent/developer yang MELANJUTKAN implementasi spec ini tanpa histori brainstorming sebelumnya. Baca `requirements.md` → `design.md` → `tasks.md` secara berurutan dulu (ini bukan pengganti ketiganya, cuma orientasi cepat + jebakan yang perlu diwaspadai).

## Status saat ini

Spec **selesai didesain**, `requirements.md`/`design.md`/`tasks.md` sudah final dan disetujui user. **Belum ada satupun task diimplementasikan** — semua checkbox di `tasks.md` masih `[ ]`. Prasyarat (`event-listener-migration-phase-1` dan `approval-system-rewrite`) sudah selesai dan di-commit di branch `dev-rahmad-5`.

## Kenapa spec ini bentuknya begini (histori singkat)

Spec ini melalui **banyak koreksi** dari draft awal — bukan karena proses brainstorming buruk, tapi karena user secara sistematis menantang tiap asumsi dengan pertanyaan spesifik, dan tiap kali jawabannya "ternyata saya salah audit". Pola yang berulang:

1. **Draft awal declare "Service X exclude total dari Fase 2"** begitu ketemu 1 blok kode yang entangled dengan Stock/GL/SLE — TANPA mengaudit method itu sampai baris terakhir.
2. **User tanya "kenapa Y gak ada"** (mis. "kenapa DeliveryNote gak update InternalOrder juga", "kenapa PurchaseReceipt gak ada status-sync ke PurchaseOrder").
3. **Audit ulang baris-per-baris** nemuin bahwa SEBAGIAN method itu ternyata BERSIRI SENDIRI (biasanya kode SETELAH loop item yang entangled, SEBELUM GL posting) — layak masuk Fase 2, meski method induknya tetap Fase 3.

**Pelajaran untuk siapapun yang lanjutin kerjaan ini**: JANGAN percaya klaim "Service X exclude total" dari spec ini secara membabi buta kalau nemuin kode baru yang belum tercantum eksplisit di `requirements.md`. Kalau ada operasi lain di `PurchaseReceiptService`/`DeliveryNoteService` yang belum disebut di spec, AUDIT DULU (cek apakah dia interleaved dengan Stock/SLE dalam loop yang sama, atau berdiri sendiri) — jangan asumsikan otomatis Fase 3 atau otomatis Fase 2.

## Struktur scope final (ringkas)

| Area | Status Fase 2 |
|---|---|
| `SalesOrderService`/`PurchaseOrderService`/`InternalOrderService` — reservasi stok submit/rollback | **Masuk penuh** (Requirement 2) |
| `PaymentEntryService::onApproved()` — paid_amount/status | **Masuk penuh** (Requirement 3) |
| `DeliveryNoteService::onApproved()` — loop item (rental/retur/forward), Stock, SLE | **TIDAK masuk** — Fase 3, interleaved |
| `DeliveryNoteService::onApproved()` — dispatch status-sync ke SalesOrder/InternalOrder (SETELAH loop) | **Masuk** (Requirement 4) — satu-satunya bagian dari method ini yang diambil |
| `SalesInvoiceService::onApproved()` — GL posting | **TIDAK masuk** — tetap kode Service |
| `SalesInvoiceService::onApproved()` — item billing, status retur, status-sync SalesOrder | **Masuk penuh** (Requirement 4 & 7) |
| `PurchaseInvoiceService::onApproved()` — pola sama SalesInvoice (GL tetap, sisanya masuk) | **Masuk sebagian** (Requirement 4 & 7) |
| `PurchaseReceiptService::onApproved()` — loop item, Stock, SLE, GL | **TIDAK masuk** — Fase 3, interleaved |
| `PurchaseReceiptService::onApproved()` — dispatch status-sync ke PurchaseOrder (baris 374, SATU baris) | **Masuk** (Requirement 4) — satu-satunya bagian yang diambil |

**Pola umum**: kalau sebuah Service `onApproved()` method campur Stock/SLE/GL dalam satu loop item, method itu Fase 3 SECARA KESELURUHAN — TAPI kalau ada dispatch status-sync yang posisinya SETELAH loop selesai dan SEBELUM GL posting (baca agregat via query baru, bukan variabel loop), titik dispatch ITU SAJA bisa diambil ke Fase 2 tanpa menyentuh sisa method.

## Keputusan arsitektur kunci (jangan diubah tanpa alasan kuat)

1. **Semua listener Fase 2 SYNC, bukan `ShouldQueue`** — beda dari Fase 1. Alasan: setiap kandidat di sini punya dependency baca-balik dalam request yang sama (reservasi stok dipakai validasi request berikutnya) atau butuh konsistensi transaksional immediate (status dokumen harus benar begitu approval selesai). Jangan tambah `ShouldQueue` ke listener manapun di fase ini.

2. **GL posting TIDAK PERNAH lewat event** — di seluruh spec ini, `GeneralLedgerEntry::create()` tetap kode langsung di Service. Event cuma untuk mutasi item/status yang berdiri sendiri dari GL. Ini prinsip yang membedakan mana yang "bisa Fase 2" vs "harus Fase 3".

3. **Struktur folder Event mengikuti aturan proyek** (`app/{Layer}/{Domain}/{Feature}/`) — nested `{Feature}` HANYA kalau >1 file terkait di domain yang sama, BUKAN otomatis ikut Listener-nya. Event yang berpasangan (dispatch dari Service `onApproved()` yang sama) DINESTED simetris dengan Listener-nya:
   - `App\Events\Sales\Order\` (1 event: `DocumentDeliveryStatusRecalculationRequested`, nested preemptif)
   - `App\Events\Purchase\Order\` (2 event: bill status + receive status)
   - `App\Events\Sales\Invoice\` (2 event: item billing + return status)
   - `App\Events\Purchase\Invoice\` (2 event: item billing + return status)
   - `App\Events\Inventory\` dan `App\Events\Finances\` — FLAT (satu-satunya event di domainnya)

4. **`lockForUpdate()` di 2 titik baru** (`PaymentEntryService`, `SalesOrderService::updateSalesOrderStatus()`) HANYA efektif kalau dipanggil di dalam transaksi database aktif — verifikasi ini eksplisit saat implementasi Task 7.9 (lihat `tasks.md`), jangan cuma percaya urutan kode.

5. **3 listener Fase 1 dikoreksi jadi sync** (`CancelPendingApprovalSteps`, `CreateDocumentConnection`, `RecordAuditLog`) — ini technically di luar scope asli Fase 2 (koreksi ke kode Fase 1 yang sudah commit), tapi dimasukkan sebagai Task 1 karena user eksplisit minta.

## Titik rawan yang WAJIB diverifikasi ulang saat implementasi

Spec ini dibuat dengan audit manual terhadap kode di titik waktu penulisan (2026-08-08). **Baris kode yang disebut di `requirements.md`/`design.md` BISA SUDAH BERGESER** kalau ada commit lain masuk di antara waktu spec ditulis dan implementasi dimulai — jangan asumsikan nomor baris di spec masih akurat, verifikasi ulang terhadap kode aktual sebelum edit.

Titik yang paling perlu dicek ulang persis (karena hasil audit berlapis, rawan human/agent error saat transcribe ke kode):
- `SalesInvoiceService::onApproved()` — urutan blok loop item vs GL posting (baris 266-297 di audit terakhir)
- `PurchaseInvoiceService::onApproved()` — sama, plus lokasi pemanggilan `updatePurchaseOrderBillStatus()` (baris 342)
- `DeliveryNoteService::onApproved()` — batas persis loop item (baris 185-365) vs dispatch status-sync (baris 367+) — JANGAN sampai kode Task 7.9 nyenggol bagian dalam loop
- `PurchaseReceiptService::onApproved()` — batas persis loop item (baris 185-371) vs pemanggilan status-sync (baris 374) vs GL (baris 376+) — Task 7.11 CUMA boleh ubah baris 374

## Referensi terkait

- Rencana 3-fase migrasi lengkap: memory `project_event_listener_migration_phases.md`
- Prasyarat arsitektur approval: `.kiro/specs/approval-system-rewrite/` (interface `SubmitableService`, resolusi via `$document::$service`)
- Fase 1 (referensi pola sync vs queued, dan bug yang pernah ditemukan): `.kiro/specs/event-listener-migration-phase-1/`
- Percobaan gagal yang JANGAN diulang tanpa desain ulang: memory `project_audit_log_auth_guard_revert.md` (soal `loadRelations()` yang mutate cache relasi model di boot hook — bukan langsung relevan ke Fase 2, tapi pola bahayanya sama: hati-hati kalau ada kebutuhan baca-relasi di listener sync, jangan sampai mutate state model asli yang dipakai kode lain)
