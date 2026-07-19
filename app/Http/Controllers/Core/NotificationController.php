<?php

namespace App\Http\Controllers\Core;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller {
    public function __construct(Request $request) {
        $this->ignorePermission = true;
        parent::__construct($request);
    }

    public function index(Request $request): JsonResponse {
        $user = $request->user();

        return response()->json([
            'notifications' => $user->notifications()->latest()->limit(20)->get(),
            'unread_count'  => $user->unreadNotifications()->count(),
        ]);
    }

    public function markAsRead(Request $request, string $id): JsonResponse {
        $notification = $request->user()->notifications()->where('id', $id)->firstOrFail();
        $notification->markAsRead();

        $data = $notification->data;

        return response()->json([
            'documentType' => $data['documentType'] ?? null,
            'documentId'   => $data['documentId'] ?? null,
        ]);
    }

    public function markAllAsRead(Request $request): JsonResponse {
        $request->user()->unreadNotifications->markAsRead();

        return response()->json(['success' => true]);
    }
}
