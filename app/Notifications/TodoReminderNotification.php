<?php

namespace App\Notifications;

use App\Enums\TodoReminderStage;
use App\Models\Core\Todo;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Due-date reminder untuk sebuah ToDo. Satu class mencakup seluruh stage
 * (lead H-x, hari-H, overdue) karena stage cuma beda di lang key mana yang
 * di-resolve — documentType/documentId identik, dan kontrak toArray()
 * empat-key tidak menyisakan ruang untuk data khusus per stage.
 */
class TodoReminderNotification extends Notification {
    use Queueable;

    public function __construct(
        public Todo $todo,
        public TodoReminderStage $stage,
        public int $offsetDays,
    ) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array {
        return ['database', 'broadcast', 'mail'];
    }

    public function toArray(object $notifiable): array {
        return [
            'title'        => $this->title(),
            'message'      => $this->message(),
            'documentType' => Todo::class,
            'documentId'   => $this->todo->id,
        ];
    }

    public function toMail(object $notifiable): MailMessage {
        return (new MailMessage)
            ->subject($this->title())
            ->line($this->message());
    }

    public function toBroadcast(object $notifiable): BroadcastMessage {
        return new BroadcastMessage($this->toArray($notifiable));
    }

    private function title(): string {
        return __("notification.todo_reminder.{$this->stage->value}.title");
    }

    private function message(): string {
        return __("notification.todo_reminder.{$this->stage->value}.message", [
            'document' => $this->documentLabel(),
            'days'     => abs($this->offsetDays),
            'due_date' => $this->todo->due_date?->format('d/m/Y H:i') ?? '',
        ]);
    }

    private function documentLabel(): string {
        $reference = $this->todo->reference;

        return $reference?->code ?? $reference?->name ?? $this->todo->description ?? '';
    }
}
