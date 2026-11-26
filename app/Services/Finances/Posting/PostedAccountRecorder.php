<?php

namespace App\Services\Finances\Posting;

use App\Enums\PostingDocumentType;
use App\Services\Finances\Posting\Contexts\PostingContext;

/**
 * Penulis-balik akun yang dipakai ke dokumen sumber (Requirement 13.2, Task 12.1). Dipanggil `PostingService::post()`
 * di dalam transaksi yang sama dengan jurnal, hanya pada hasil `posted`. Implementasi hidup di domain pemilik
 * dokumen (bernama `<Dokumen>PostedAccountRecorder`), menulis senyap lewat query builder (tanpa event model dan
 * audit log), dan tidak boleh memakai transaksi sendiri yang melepas atomisitas.
 */
interface PostedAccountRecorder {
    public function documentType(): PostingDocumentType;

    public function record(PostingContext $ctx, PostedAccountNotes $notes): void;
}
