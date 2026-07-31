<?php

namespace App\Notifications;

use App\Models\Core\Todo;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Dikirim saat ToDo bertipe momen (event/meeting) ditutup otomatis oleh
 * sweep karena due_date-nya sudah lewat. Class terpisah dari
 * TodoReminderNotification — ini informasi status, bukan pengingat.
 */
class TodoAutoClosedNotification extends Notification {
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
            'title'        => __('notification.todo_auto_closed.title'),
            'message'      => __('notification.todo_auto_closed.message', ['document' => $this->documentLabel()]),
            'documentType' => Todo::class,
            'documentId'   => $this->todo->id,
        ];
    }

    public function toMail(object $notifiable): MailMessage {
        return (new MailMessage)
            ->subject(__('notification.todo_auto_closed.title'))
            ->line(__('notification.todo_auto_closed.message', ['document' => $this->documentLabel()]));
    }

    public function toBroadcast(object $notifiable): BroadcastMessage {
        return new BroadcastMessage($this->toArray($notifiable));
    }

    private function documentLabel(): string {
        $reference = $this->todo->reference;

        return $reference?->code ?? $reference?->name ?? $this->todo->description ?? '';
    }
}
