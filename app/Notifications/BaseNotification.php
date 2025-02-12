<?php

namespace App\Notifications;

use App\Models\Link;
use App\Models\SubGate;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class BaseNotification extends Notification {
  use SoftDeletes;
  // public ?Link $link;
}
