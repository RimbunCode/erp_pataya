<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent to every user of a configured role when a submitable document
 * transitions into a status that role should be notified about (e.g.
 * Warehouse notified when a SalesOrder is submitted). Which role(s) map to
 * which status is configured per-model via `$notifyRolesOnStatus`, not
 * hardcoded here.
 */
class DocumentSubmittedNotification extends Notification {
    use Queueable;

    public function __construct(
        public Model $document,
        public string $role,
    ) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array {
        return ['database', 'broadcast', 'mail'];
    }

    public function toArray(object $notifiable): array {
        $label   = $this->document->code ?? $this->document->name ?? '';
        $creator = $this->document->createdBy?->name ?? '';

        return [
            'title'   => __('notification.document_submitted.title'),
            'message' => __('notification.document_submitted.message', [
                'document' => $label,
                'creator'  => $creator,
            ]),
            'documentType' => $this->document::class,
            'documentId'   => $this->document->getKey(),
        ];
    }

    public function toMail(object $notifiable): MailMessage {
        $label   = $this->document->code ?? $this->document->name ?? '';
        $creator = $this->document->createdBy?->name ?? '';

        return (new MailMessage)
            ->subject(__('notification.document_submitted.title'))
            ->line(__('notification.document_submitted.message', [
                'document' => $label,
                'creator'  => $creator,
            ]));
    }

    public function toBroadcast(object $notifiable): BroadcastMessage {
        return new BroadcastMessage($this->toArray($notifiable));
    }
}
