<?php

namespace App\Notifications;

use App\Models\Link;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Notifications\Notification;

class BaseNotification extends Notification
{
    use SoftDeletes;
    // public ?Link $link;
}
