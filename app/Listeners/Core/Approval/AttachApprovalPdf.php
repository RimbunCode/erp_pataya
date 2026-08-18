<?php

namespace App\Listeners\Core\Approval;

use App\Enums\FormStatus;
use App\Events\Core\ApprovalDecided;
use App\Jobs\Core\AttachGeneratedPdfJob;
use Illuminate\Contracts\Queue\ShouldQueue;

class AttachApprovalPdf implements ShouldQueue {
    public function handle(ApprovalDecided $event): void {
        if ($event->decision !== 'approved' || $event->approvalInstance->status?->value !== FormStatus::APPROVED->value) {
            return;
        }

        AttachGeneratedPdfJob::dispatch($event->approvalInstance);
    }
}
