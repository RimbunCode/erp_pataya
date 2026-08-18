<?php

namespace App\Listeners\Core\Approval;

use App\Enums\FormStatus;
use App\Events\Core\DocumentCanceled;
use App\Notifications\ApprovalCanceledNotification;
use App\Services\Core\Notification\NotifyUser;

class CancelPendingApprovalSteps {
    public function handle(DocumentCanceled $event): void {
        $steps = $event->approvalInstance->steps()
            ->whereIn('status', [FormStatus::PENDING->value, FormStatus::WAITING->value])
            ->get();

        foreach ($steps as $step) {
            $step->update(['status' => FormStatus::CANCELED->value]);

            if ($step->is_advanced) {
                $step->approvers()
                    ->where('status', FormStatus::PENDING->value)
                    ->update(['status' => FormStatus::CANCELED->value]);
            }
        }

        $candidates = $steps
            ->flatMap(fn ($step) => $step->resolveCandidateUsers())
            ->unique('id')
            ->values();

        if ($candidates->isNotEmpty()) {
            app(NotifyUser::class)->send(
                $candidates,
                new ApprovalCanceledNotification($event->approvalInstance, $steps->pluck('sequence')->all()),
            );
        }
    }
}
