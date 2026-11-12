<?php

namespace App\Services\Finances\Posting;

use App\Enums\FormStatus;
use App\Models\Core\GlPostingStatus;
use App\Services\Finances\Posting\Contexts\PostingContext;
use BackedEnum;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Guard balapan cancel-vs-posting asinkron (F-16; Finance Fase 2, Requirement 5.5, 10.5-10.6). Memuat dokumen sumber
 * secara generik dari `sourceType`/`sourceId` konteks (tanpa mengimpor model modul, P-8) dan melaporkan apakah
 * statusnya memuat `canceled`. Sumber yang tidak dapat dimuat (kelas tidak dikenal, baris hilang, atau tanpa kolom
 * `status`) dianggap tidak dibatalkan: guard hanya menahan posting yang pasti salah.
 */
final class CanceledSourceGuard {
    public function isCanceled(PostingContext $ctx): bool {
        $class = $ctx->guardType();
        if (! class_exists($class) || ! is_subclass_of($class, Model::class)) {
            return false;
        }

        // Di dalam transaksi pemanggil, sumber dibaca dengan kunci baris: pembatalan yang bersamaan menunggu commit
        // posting (lalu membalik jurnalnya lewat jalur cancel), bukan menyelip antara pemeriksaan dan penulisan.
        $query = $class::query()->withoutGlobalScopes();
        if (DB::transactionLevel() > 0) {
            $query->lockForUpdate();
        }

        /** @var Model|null $source */
        $source = $query->find($ctx->guardId());
        if ($source === null) {
            return false;
        }

        foreach ((array) $source->getAttribute('status') as $status) {
            $value = $status instanceof BackedEnum ? $status->value : $status;
            if ($value === FormStatus::CANCELED->value) {
                return true;
            }
        }

        return false;
    }

    /**
     * Bila dokumen penjaga dibatalkan: tandai `GlPostingStatus` dokumen penjaga yang masih `pending` menjadi `skipped` (tidak muncul sebagai
     * kegagalan di halaman monitoring), catat log informasi, dan kembalikan true.
     */
    public function skipIfCanceled(PostingContext $ctx): bool {
        if (! $this->isCanceled($ctx)) {
            return false;
        }

        GlPostingStatus::query()
            ->where('referenceable_type', $ctx->guardType())
            ->where('referenceable_id', $ctx->guardId())
            ->where('status', FormStatus::PENDING->value)
            ->update(['status' => FormStatus::SKIPPED->value]);

        Log::info('posting.skipped_canceled_source', [
            'document_type' => $ctx->documentType->value,
            'source_type'   => $ctx->sourceType,
            'source_id'     => $ctx->sourceId,
            'guard_type'    => $ctx->guardType(),
            'guard_id'      => $ctx->guardId(),
        ]);

        return true;
    }
}
