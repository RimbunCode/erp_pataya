<?php

namespace App\Listeners\Core\Submission;

use App\Events\Core\DocumentStatusChanged;
use App\Models\User\User;
use App\Notifications\DocumentSubmittedNotification;
use App\Services\Core\Notification\NotifyUser;
use Illuminate\Contracts\Queue\ShouldQueue;

class NotifyRoleOnStatusChange implements ShouldQueue {
    public function handle(DocumentStatusChanged $event): void {
        $candidates = User::whereHas('roles', fn ($q) => $q->whereIn('name', $event->roles))->get();
        if ($candidates->isEmpty()) {
            return;
        }

        app(NotifyUser::class)->send($candidates, new DocumentSubmittedNotification(
            $event->document,
            implode(',', $event->roles),
        ));
    }
}
