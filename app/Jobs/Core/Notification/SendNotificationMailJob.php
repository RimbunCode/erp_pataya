<?php

namespace App\Jobs\Core\Notification;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Notifications\Notification;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification as NotificationFacade;
use Throwable;

/**
 * Generic queued mail dispatch for the Notification Center — replaces the
 * legacy `MyMailChannel`/`SendEmailNotificationJob` pattern (which resolved
 * `MailChannel` manually via the container and was never captured by
 * `Notification::fake()`/`Mail::fake()`). Uses `Notification::sendNow()`
 * with an explicit `mail` channel instead, which is portable and testable.
 *
 * Never touches the `notifications` table — a mail failure must not affect
 * database/broadcast notifications already delivered by `NotifyUser`.
 */
class SendNotificationMailJob implements ShouldQueue {
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        public mixed $notifiable,
        public Notification $notification,
    ) {}

    public function handle(): void {
        NotificationFacade::sendNow($this->notifiable, $this->notification, ['mail']);
    }

    public function failed(Throwable $e): void {
        Log::error('SendNotificationMailJob gagal — email notifikasi tidak terkirim', [
            'notification' => get_class($this->notification),
            'notifiable'   => get_class($this->notifiable) . ':' . ($this->notifiable->getKey() ?? ''),
            'error'        => $e->getMessage(),
        ]);
    }
}
