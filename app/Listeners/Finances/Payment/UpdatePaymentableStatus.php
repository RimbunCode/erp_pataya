<?php

namespace App\Listeners\Finances\Payment;

use App\Enums\FormStatus;
use App\Events\Finances\PaymentApplied;
use App\Utils;

class UpdatePaymentableStatus {
    public function handle(PaymentApplied $event): void {
        $paymentable = $event->paymentable;

        if ($event->newPaidAmount >= $paymentable->amount) {
            $status = Utils::replaceStatus(
                $paymentable->status,
                [FormStatus::UNPAID, FormStatus::PARTIALLY_PAID],
                FormStatus::PAID,
            );
        } elseif ($event->newPaidAmount > 0) {
            $status = Utils::replaceStatus(
                $paymentable->status,
                [FormStatus::UNPAID, FormStatus::PAID],
                FormStatus::PARTIALLY_PAID,
            );
        } else {
            $status = Utils::replaceStatus(
                $paymentable->status,
                [FormStatus::UNPAID, FormStatus::PARTIALLY_PAID],
                FormStatus::PARTIALLY_PAID,
            );
        }

        $paymentable->paid_amount = $event->newPaidAmount;
        $paymentable->status      = $status;
        $paymentable->save();
    }
}
