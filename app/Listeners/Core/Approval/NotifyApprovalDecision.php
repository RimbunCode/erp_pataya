<?php

namespace App\Listeners\Core\Approval;

use App\Events\Core\ApprovalDecided;
use App\Notifications\ApprovalDecidedNotification;
use App\Services\Core\Notification\NotifyUser;
use Illuminate\Contracts\Queue\ShouldQueue;

class NotifyApprovalDecision implements ShouldQueue {
    public function handle(ApprovalDecided $event): void {
        $creator = $event->approvalInstance->document?->createdBy;
        if (! $creator) {
            return;
        }

        app(NotifyUser::class)->send($creator, new ApprovalDecidedNotification(
            $event->approvalInstance,
            $event->decision,
            $event->notes,
        ));
    }
}
