<?php

namespace App\Notifications;

use App\Models\Core\ApprovalInstance;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent to candidate approvers of steps still PENDING/WAITING when the
 * underlying document is canceled — they no longer need to review it.
 * Deliberately reads step status as-is; does not assume steps were
 * cascade-updated to CANCELED (that cascade is a separate, unrelated gap —
 * see design.md Requirement 3.9).
 */
class ApprovalCanceledNotification extends Notification {
    use Queueable;

    public function __construct(
        public ApprovalInstance $approval,
        public array $canceledStepSequences,
    ) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array {
        return ['database', 'broadcast', 'mail'];
    }

    public function toArray(object $notifiable): array {
        $document = $this->approval->document;
        $label    = $document->code ?? $document->name ?? '';

        return [
            'title'        => __('notification.approval.canceled.title'),
            'message'      => __('notification.approval.canceled.message', ['document' => $label]),
            'documentType' => $document::class,
            'documentId'   => $document->getKey(),
        ];
    }

    public function toMail(object $notifiable): MailMessage {
        $document = $this->approval->document;
        $label    = $document->code ?? $document->name ?? '';

        return (new MailMessage)
            ->subject(__('notification.approval.canceled.title'))
            ->line(__('notification.approval.canceled.message', ['document' => $label]));
    }

    public function toBroadcast(object $notifiable): BroadcastMessage {
        return new BroadcastMessage($this->toArray($notifiable));
    }
}
