<?php

namespace App\Notifications;

use App\Models\Payment;

class PaymentReceivedNotification extends BaseNotification {
    public function __construct(private Payment $payment) {}

    public function via(object $notifiable): array {
        return ['database'];
    }

    public function toDatabase(object $notifiable): array {
        $student = $this->payment->user;
        $course  = $this->payment->course;
        $amount  = number_format((float) $this->payment->amount, 0, ',', '.');

        return [
            'type'       => 'payment_received',
            'title'      => 'Bukti Bayar Baru',
            'body'       => "{$student?->name} mengajukan pembayaran Rp {$amount} untuk kursus \"{$course?->title}\".",
            'action_url' => '/admin/finance?tab=payments',
            'menu_key'   => 'finance',
        ];
    }
}
