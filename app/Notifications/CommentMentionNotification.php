<?php

namespace App\Notifications;

use App\Models\User\User;
use Illuminate\Bus\Queueable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent to a user who is @mentioned in a comment on a document. Dispatched
 * when a comment is added, and on edit only for mentions that were not in
 * the comment before (see MentionService). documentType/documentId point at
 * the PARENT document the comment belongs to (Log.loggable_type/loggable_id),
 * never at the Log row itself: NotificationController::markAsRead navigates
 * by these two keys, and a Log id would open the log page instead of the
 * document the person was mentioned on.
 */
class CommentMentionNotification extends Notification {
    use Queueable;

    public function __construct(
        public Model $document,
        public User $commenter,
    ) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array {
        return ['database', 'broadcast', 'mail'];
    }

    public function toArray(object $notifiable): array {
        return [
            'title'   => __('notification.mention.title'),
            'message' => __('notification.mention.message', [
                'commenter' => $this->commenter->name ?? '',
                'document'  => $this->documentLabel(),
            ]),
            'documentType' => $this->document::class,
            'documentId'   => $this->document->getKey(),
        ];
    }

    public function toMail(object $notifiable): MailMessage {
        return (new MailMessage)
            ->subject(__('notification.mention.title'))
            ->line(__('notification.mention.message', [
                'commenter' => $this->commenter->name ?? '',
                'document'  => $this->documentLabel(),
            ]));
    }

    public function toBroadcast(object $notifiable): BroadcastMessage {
        return new BroadcastMessage($this->toArray($notifiable));
    }

    private function documentLabel(): string {
        return (string) ($this->document->code ?? $this->document->name ?? '');
    }
}
