<?php

namespace App\Notifications;

use App\Models\Payment;

class PaymentApprovedNotification extends BaseNotification {
    public function __construct(private Payment $payment) {}

    public function via(object $notifiable): array {
        return ['database'];
    }

    public function toDatabase(object $notifiable): array {
        $course = $this->payment->course;

        return [
            'type'       => 'payment_approved',
            'title'      => 'Pembayaran Disetujui',
            'body'       => "Pembayaran untuk kursus \"{$course?->title}\" telah disetujui. Kamu sudah bisa mulai belajar!",
            'action_url' => '/student/my-courses',
            'menu_key'   => 'my-courses',
        ];
    }
}
