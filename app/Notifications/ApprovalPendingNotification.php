<?php

namespace App\Notifications;

use App\Models\Core\ApprovalInstanceStep;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent to each candidate approver (direct user, or every user in a role)
 * when a step becomes PENDING — either the first step of a new approval
 * instance, or the next step after the previous one was decided.
 */
class ApprovalPendingNotification extends Notification {
    use Queueable;

    public function __construct(
        public ApprovalInstanceStep $step,
    ) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array {
        return ['database', 'broadcast', 'mail'];
    }

    public function toArray(object $notifiable): array {
        $document = $this->step->approvalInstance->document;
        $label    = $document->code ?? $document->name ?? '';

        return [
            'title'        => __('notification.approval.pending.title'),
            'message'      => __('notification.approval.pending.message', ['document' => $label]),
            'documentType' => $document::class,
            'documentId'   => $document->getKey(),
        ];
    }

    public function toMail(object $notifiable): MailMessage {
        $document = $this->step->approvalInstance->document;
        $label    = $document->code ?? $document->name ?? '';

        return (new MailMessage)
            ->subject(__('notification.approval.pending.title'))
            ->line(__('notification.approval.pending.message', ['document' => $label]));
    }

    public function toBroadcast(object $notifiable): BroadcastMessage {
        return new BroadcastMessage($this->toArray($notifiable));
    }
}
