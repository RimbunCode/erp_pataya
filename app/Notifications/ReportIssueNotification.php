<?php

namespace App\Notifications;

use App\Models\Helpdesk\Ticket;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Dikirim ke anggota role tim IT saat laporan dengan KPI tidak cocok dilaporkan.
 * Menunjuk ke Ticket yang dibuat, bukan ke laporannya.
 */
class ReportIssueNotification extends Notification {
    use Queueable;

    public function __construct(
        public Ticket $ticket,
        public string $reportName,
    ) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array {
        return ['database', 'broadcast', 'mail'];
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array {
        return [
            'title'   => __('report.notification.title'),
            'message' => __('report.notification.message', [
                'ticket' => $this->ticket->code,
                'report' => $this->reportName,
            ]),
            'documentType' => Ticket::class,
            'documentId'   => $this->ticket->id,
        ];
    }

    public function toMail(object $notifiable): MailMessage {
        return (new MailMessage)
            ->subject(__('report.notification.title'))
            ->line(__('report.notification.message', [
                'ticket' => $this->ticket->code,
                'report' => $this->reportName,
            ]));
    }

    public function toBroadcast(object $notifiable): BroadcastMessage {
        return new BroadcastMessage($this->toArray($notifiable));
    }
}
