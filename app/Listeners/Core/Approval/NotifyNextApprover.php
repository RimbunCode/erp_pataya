<?php

namespace App\Listeners\Core\Approval;

use App\Events\Core\ApprovalDecided;
use App\Notifications\ApprovalPendingNotification;
use App\Services\Core\Notification\NotifyUser;
use Illuminate\Contracts\Queue\ShouldQueue;

class NotifyNextApprover implements ShouldQueue {
    public function handle(ApprovalDecided $event): void {
        if (! $event->nextPendingStep) {
            return;
        }

        $candidates = $event->nextPendingStep->resolveCandidateUsers();
        if ($candidates->isNotEmpty()) {
            app(NotifyUser::class)->send($candidates, new ApprovalPendingNotification($event->nextPendingStep));
        }
    }
}
