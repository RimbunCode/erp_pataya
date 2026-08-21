<?php

namespace App\Listeners\Core\Desk;

use App\Events\Core\DeskDeleted;

class DetachDeskAssignments {
    public function handle(DeskDeleted $event): void {
        $event->desk->menuItems()->detach();
        $event->desk->users()->detach();
        $event->desk->roles()->detach();
    }
}
