<?php

namespace App\Channels;

use Illuminate\Notifications\Notification;
use Illuminate\Notifications\Channels\DatabaseChannel as IlluminateDatabaseChannel;

class DatabaseChannel extends IlluminateDatabaseChannel {
  /**
   * Send the given notification.
   *
   * @param mixed $notifiable
   * @param \Illuminate\Notifications\Notification $notification
   * @return array
   */
  public function buildPayload($notifiable, Notification $notification) {
    return [
      'id' => $notification->id,
      'type' => method_exists($notification, 'databaseType')
        ? $notification->databaseType($notifiable)
        : get_class($notification),
      'data' => $this->getData($notifiable, $notification),
      'read_at' => null,
      'sub_gate_id' => $notification->subGate->id ?? null,
      'link_id' => $notification->link->id ?? null,
    ];
  }
}
