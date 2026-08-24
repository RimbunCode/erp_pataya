<?php

namespace App\Listeners\Core\Desk;

use App\Events\Core\DeskDeleted;

class DetachDeskAssignments {
    public function handle(DeskDeleted $event): void {
        $event->desk->menuItems()->detach();
        $event->desk->assignables()->delete();
        // Desk pakai SoftDeletes — FK cascadeOnDelete di desk_user_preferences
        // TIDAK ter-trigger (cuma UPDATE deleted_at, bukan DELETE fisik),
        // harus dibersihkan manual sama seperti assignables.
        $event->desk->userPreferences()->delete();
    }
}
