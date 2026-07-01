<?php

namespace App\Notifications;

use App\Models\Finance\InstructorPayoutRequest;
use Illuminate\Notifications\Messages\DatabaseMessage;

class PayoutRequestedNotification extends BaseNotification {
    public function __construct(private InstructorPayoutRequest $payoutRequest) {}

    public function via(object $notifiable): array {
        return ['database'];
    }

    public function toDatabase(object $notifiable): array {
        $instructor = $this->payoutRequest->instructor;
        $amount     = number_format((float) $this->payoutRequest->requested_amount, 0, ',', '.');

        return [
            'type'       => 'payout_requested',
            'title'      => 'Permintaan Payout Baru',
            'body'       => "{$instructor->name} mengajukan payout sebesar Rp {$amount}",
            'action_url' => '/admin/finance?tab=payouts',
            'menu_key'   => 'finance',
        ];
    }
}
