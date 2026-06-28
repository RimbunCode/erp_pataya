<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class NotificationController extends Controller {
    public function markAsRead(Request $request, string $id) {
        $notification = $request->user()
            ->notifications()
            ->find($id);

        if ($notification) {
            $notification->markAsRead();
        }

        return back();
    }

    public function markAllAsRead(Request $request) {
        $request->user()->unreadNotifications()->update(['read_at' => now()]);

        return back();
    }
}
