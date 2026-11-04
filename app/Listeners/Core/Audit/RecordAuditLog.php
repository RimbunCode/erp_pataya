<?php

namespace App\Listeners\Core\Audit;

use App\Events\Core\AuditableModelSaved;
use App\Models\Core\Log;
use Illuminate\Support\Facades\Auth;

class RecordAuditLog {
    private const ACTIVITY = [
        'created'   => ['en' => ':user created this',        'id' => ':user telah membuat ini'],
        'updated'   => ['en' => ':user updated this',        'id' => ':user memperbarui ini'],
        'deleted'   => ['en' => ':user deleted this',        'id' => ':user menghapus ini'],
        'cancelled' => ['en' => ':user canceled this',       'id' => ':user telah membatalkan'],
        'submitted' => ['en' => ':user submitted this',      'id' => ':user telah mengajukan ini'],
        'amended'   => ['en' => ':user amended this',        'id' => ':user telah mengembalikan ini'],
        // Finance Fase 1: reversal jurnal dan penutupan/pembukaan periode fiskal (Requirement 14.2).
        'reversed' => ['en' => ':user reversed this',        'id' => ':user telah membalik ini'],
        'closed'   => ['en' => ':user closed this',          'id' => ':user telah menutup ini'],
        'reopened' => ['en' => ':user reopened this',        'id' => ':user telah membuka kembali ini'],
    ];

    public function handle(AuditableModelSaved $event): void {
        // Model bisa opt-out dari audit log lewat $auditable = false (pola sama dgn
        // $skipAttachmentOnCreate di DataTable trait).
        if (property_exists($event->model, 'auditable') && ! $event->model->auditable) {
            return;
        }

        Log::create([
            'user_id'       => Auth::id(),
            'loggable_id'   => $event->model->getKey(),
            'loggable_type' => get_class($event->model),
            'action'        => $event->action,
            'activity'      => self::ACTIVITY[$event->action],
            'data_before'   => $event->dataBefore ?: null,
            'data_after'    => $event->dataAfter ?: null,
        ]);
    }
}
