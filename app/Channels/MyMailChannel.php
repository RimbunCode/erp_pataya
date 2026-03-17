<?php

namespace App\Channels;

use App\Jobs\SendEmailNotificationJob;
use Illuminate\Notifications\Notification;

final class MyMailChannel {
    /**
     * Send the given notification.
     *
     * @param  mixed  $notifiable
     */
    public function send($notifiable, Notification $notification) {
        SendEmailNotificationJob::dispatch($notifiable, $notification);
    }
}
