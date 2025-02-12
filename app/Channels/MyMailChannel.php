<?php

namespace App\Channels;

use App\Jobs\SendEmailNotificationJob;
use Illuminate\Contracts\Mail\Mailable;
use Illuminate\Notifications\Notification;

final class MyMailChannel {
  /**
   * Send the given notification.
   *
   * @param  mixed  $notifiable
   * @param  \Illuminate\Notifications\Notification  $notification
   */
  public function send($notifiable, Notification $notification) {
    SendEmailNotificationJob::dispatch($notifiable, $notification);
  }
}
