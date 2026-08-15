<?php

namespace App\Listeners\Core\Approval;

use App\Enums\FormStatus;
use App\Events\Core\DocumentCanceled;

class CancelPendingApprovalSteps {
    public function handle(DocumentCanceled $event): void {
        $steps = $event->approvalInstance->steps()
            ->whereIn('status', [FormStatus::PENDING->value, FormStatus::WAITING->value])
            ->get();

        foreach ($steps as $step) {
            $step->update(['status' => FormStatus::CANCELED]);

            if ($step->is_advanced) {
                $step->approvers()
                    ->where('status', FormStatus::PENDING->value)
                    ->update(['status' => FormStatus::CANCELED->value]);
            }
        }
    }
}
