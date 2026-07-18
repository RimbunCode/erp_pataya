<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent when a User transitions into FormStatus::INVITED. Mail-only —
 * `database`/`broadcast` are deliberately excluded since the recipient
 * cannot yet log in to see an in-app notification.
 */
class UserInvitedNotification extends Notification {
    use Queueable;

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage {
        return (new MailMessage)
            ->subject(__('notification.user_invited.subject'))
            ->greeting(__('notification.user_invited.greeting', ['name' => $notifiable->name]))
            ->line(__('notification.user_invited.line'))
            ->action(__('notification.user_invited.action'), url('/setup'));
    }
}
