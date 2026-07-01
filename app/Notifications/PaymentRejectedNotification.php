<?php

namespace App\Notifications;

use App\Models\Payment;

class PaymentRejectedNotification extends BaseNotification {
    public function __construct(private Payment $payment) {}

    public function via(object $notifiable): array {
        return ['database'];
    }

    public function toDatabase(object $notifiable): array {
        $course = $this->payment->course;
        $reason = $this->payment->rejection_reason;

        return [
            'type'       => 'payment_rejected',
            'title'      => 'Pembayaran Ditolak',
            'body'       => "Pembayaran untuk kursus \"{$course?->title}\" ditolak." . ($reason ? " Alasan: {$reason}" : ''),
            'action_url' => '/student/my-courses',
            'menu_key'   => 'my-courses',
        ];
    }
}
