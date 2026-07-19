<?php

namespace App\Notifications;

use App\Models\Core\Todo;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent to a user when they are assigned a ToDo on any document (or a
 * standalone/referenceless ToDo). documentType/documentId always point
 * at the Todo itself (not the referenced document) — the Todo is
 * guaranteed navigable regardless of reference type, mirroring how
 * ApprovalPendingNotification always points at something resolvable.
 * The Todo's own Show page links onward to its `reference` when present.
 */
class TodoAssignedNotification extends Notification {
    use Queueable;

    public function __construct(
        public Todo $todo,
    ) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array {
        return ['database', 'broadcast', 'mail'];
    }

    public function toArray(object $notifiable): array {
        return [
            'title'   => __('notification.todo_assigned.title'),
            'message' => __('notification.todo_assigned.message', [
                'document' => $this->documentLabel(),
                'assigner' => $this->todo->assignedBy?->name ?? '',
            ]),
            'documentType' => Todo::class,
            'documentId'   => $this->todo->id,
        ];
    }

    public function toMail(object $notifiable): MailMessage {
        return (new MailMessage)
            ->subject(__('notification.todo_assigned.title'))
            ->line(__('notification.todo_assigned.message', [
                'document' => $this->documentLabel(),
                'assigner' => $this->todo->assignedBy?->name ?? '',
            ]));
    }

    public function toBroadcast(object $notifiable): BroadcastMessage {
        return new BroadcastMessage($this->toArray($notifiable));
    }

    private function documentLabel(): string {
        $reference = $this->todo->reference;

        return $reference?->code ?? $reference?->name ?? $this->todo->description ?? '';
    }
}
