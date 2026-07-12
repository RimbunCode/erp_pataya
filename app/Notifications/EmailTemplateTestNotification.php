<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class EmailTemplateTestNotification extends Notification implements ShouldQueue {
    use Queueable;

    public function __construct(
        protected string $renderedSubject,
        protected string $renderedBody,
    ) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage {
        return (new MailMessage)
            ->subject($this->renderedSubject)
            ->view('mail.email-template', ['body' => $this->renderedBody]);
    }
}
