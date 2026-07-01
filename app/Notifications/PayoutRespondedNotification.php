<?php

namespace App\Notifications;

use App\Models\Finance\InstructorPayoutRequest;

class PayoutRespondedNotification extends BaseNotification {
    public function __construct(private InstructorPayoutRequest $payoutRequest) {}

    public function via(object $notifiable): array {
        return ['database'];
    }

    public function toDatabase(object $notifiable): array {
        $status = $this->payoutRequest->status;
        $amount = number_format((float) $this->payoutRequest->approved_amount ?? $this->payoutRequest->requested_amount, 0, ',', '.');

        [$title, $body] = match ($status) {
            'approved' => [
                'Payout Disetujui',
                "Permintaan payout Rp {$amount} telah disetujui dan sedang diproses.",
            ],
            'paid' => [
                'Payout Sudah Ditransfer',
                "Payout Rp {$amount} telah ditransfer ke akunmu."
                    . ($this->payoutRequest->transfer_reference ? " Referensi: {$this->payoutRequest->transfer_reference}" : ''),
            ],
            default => [
                'Payout Ditolak',
                "Permintaan payout Rp {$amount} ditolak."
                    . ($this->payoutRequest->rejection_reason ? " Alasan: {$this->payoutRequest->rejection_reason}" : ''),
            ],
        };

        return [
            'type'       => 'payout_responded',
            'title'      => $title,
            'body'       => $body,
            'action_url' => '/instructor/financial',
            'menu_key'   => 'financials',
        ];
    }
}
