<?php

namespace App\Listeners\Core\Desk;

use App\Events\Core\DeskDeleted;
use App\Models\User\User;

class ClearDefaultDeskForUsers {
    public function handle(DeskDeleted $event): void {
        User::where('default_desk_id', $event->desk->id)
            ->update(['default_desk_id' => null]);
    }
}
