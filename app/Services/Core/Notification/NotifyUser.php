<?php

namespace App\Services\Core\Notification;

use App\Jobs\Core\Notification\SendNotificationMailJob;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Notification as NotificationFacade;

/**
 * Sends one notification across channels with different delivery speeds:
 * `database`/`broadcast` synchronously (Notification::sendNow()), so the
 * bell icon updates instantly, while `mail` is deferred to a queue job so
 * the triggering request never waits on SMTP.
 *
 * The notification class itself is never `ShouldQueue` — that would defer
 * every channel including database/broadcast. Splitting is done here by
 * calling sendNow() with an explicit channel subset per delivery speed.
 */
class NotifyUser {
    /**
     * @param  Collection<int, object>|object  $notifiable
     */
    public function send($notifiable, Notification $notification): void {
        $channels = $notification->via($notifiable);

        $syncChannels = array_values(array_intersect($channels, ['database', 'broadcast']));
        if ($syncChannels !== []) {
            NotificationFacade::sendNow($notifiable, $notification, $syncChannels);
        }

        if (in_array('mail', $channels, true)) {
            SendNotificationMailJob::dispatch($notifiable, $notification);
        }
    }
}
