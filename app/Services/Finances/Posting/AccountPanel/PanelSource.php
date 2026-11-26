<?php

namespace App\Services\Finances\Posting\AccountPanel;

use App\Enums\PostingDocumentType;
use App\Services\Finances\Posting\Contexts\PostingContext;
use Illuminate\Database\Eloquent\Model;

/**
 * Sisi baca satu jenis dokumen untuk panel "Akun pencatatan" (Finance Fase 2, Task 12.4; Requirement 13.4). Milik domain
 * pemilik dokumen (P-8: engine tidak mengimpor model Sales/Purchase/Inventory/Asset), berdampingan dengan
 * `PostedAccountRecorder` (sisi tulis, Task 12.1), dan didaftarkan di `PanelSourceRegistry`. Implementasi hanya boleh
 * membaca: tanpa tulis DB, tanpa event, tanpa memicu posting.
 */
interface PanelSource {
    public function documentType(): PostingDocumentType;

    /**
     * Konteks posting dari data tersimpan, sama seperti yang dibangun saat approve, untuk pratinjau akun. Null bila
     * dokumen jenis ini tidak dapat dipratinjau sebelum approve (nilainya baru dihitung saat approve).
     */
    public function previewContext(Model $document): ?PostingContext;

    /**
     * Apakah konteks pratinjau hanya perkiraan: ada angka yang baru pasti saat approve (mis. nilai stok Purchase
     * Invoice). Akun per peran tidak bergantung pada angka itu; hanya jurnal mana yang terbentuk yang dapat berbeda.
     */
    public function previewIsEstimate(): bool;

    /**
     * Akun tercatat pada dokumen sesudah posting, dibaca dari kolom catatan.
     *
     * @return list<RecordedAccount>
     */
    public function recorded(Model $document): array;
}
