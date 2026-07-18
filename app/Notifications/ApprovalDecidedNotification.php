<?php

namespace App\Notifications;

use App\Models\Core\ApprovalInstance;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent to a document's creator when its approval instance reaches a final
 * decision (all steps approved, or rejected at any step). Never `ShouldQueue`
 * — dispatched via `NotifyUser`, which splits sync (database/broadcast) from
 * async (mail) delivery itself.
 */
class ApprovalDecidedNotification extends Notification {
    use Queueable;

    public function __construct(
        public ApprovalInstance $approval,
        public string $decision,
        public ?string $notes = null,
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
            'title'        => __("notification.approval.{$this->decision}.title"),
            'message'      => __("notification.approval.{$this->decision}.message", ['document' => $label]),
            'documentType' => $document::class,
            'documentId'   => $document->getKey(),
            'notes'        => $this->notes,
        ];
    }

    public function toMail(object $notifiable): MailMessage {
        $document = $this->approval->document;
        $label    = $document->code ?? $document->name ?? '';

        return (new MailMessage)
            ->subject(__("notification.approval.{$this->decision}.title"))
            ->line(__("notification.approval.{$this->decision}.message", ['document' => $label]))
            ->when($this->notes, fn (MailMessage $mail) => $mail->line($this->notes));
    }

    public function toBroadcast(object $notifiable): BroadcastMessage {
        return new BroadcastMessage($this->toArray($notifiable));
    }
}
