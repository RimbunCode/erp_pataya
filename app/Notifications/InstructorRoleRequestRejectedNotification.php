<?php

namespace App\Notifications;

use App\Models\RoleRequest;

class InstructorRoleRequestRejectedNotification extends BaseNotification {
    public function __construct(private RoleRequest $roleRequest) {}

    public function via(object $notifiable): array {
        return ['database'];
    }

    public function toDatabase(object $notifiable): array {
        $reason = $this->roleRequest->rejection_reason;

        return [
            'type'       => 'instructor_role_request_rejected',
            'title'      => 'Permintaan Instructor Ditolak',
            'body'       => 'Permintaan role instructor kamu ditolak.' . ($reason ? " Alasan: {$reason}" : ''),
            'action_url' => '/student/profile',
            'menu_key'   => null,
        ];
    }
}
