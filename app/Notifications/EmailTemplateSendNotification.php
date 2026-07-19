<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class EmailTemplateSendNotification extends Notification implements ShouldQueue {
    use Queueable;

    public function __construct(
        protected string $renderedSubject,
        protected string $renderedBody,
        protected array $attachments = [],
        protected ?string $fromName = null,
    ) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage {
        $mail = (new MailMessage)
            ->subject($this->renderedSubject)
            ->view('mail.email-template', ['body' => $this->renderedBody]);

        if ($this->fromName) {
            // Alamat pengirim TETAP dari config, tidak pernah dari input
            // user — hanya nama tampilan yang berasal dari request.
            $mail->from(config('mail.from.address'), $this->fromName);
        }

        foreach ($notifiable->cc ?? [] as $ccAddress) {
            $mail->cc($ccAddress);
        }
        foreach ($notifiable->bcc ?? [] as $bccAddress) {
            $mail->bcc($bccAddress);
        }

        foreach ($this->attachments as $attachment) {
            $mail->attach($attachment['path'], ['as' => $attachment['name']]);
        }

        return $mail;
    }
}
