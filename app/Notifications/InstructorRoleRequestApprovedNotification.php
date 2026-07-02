<?php

namespace App\Notifications;

use App\Models\RoleRequest;

class InstructorRoleRequestApprovedNotification extends BaseNotification {
    public function __construct(private RoleRequest $roleRequest) {}

    public function via(object $notifiable): array {
        return ['database'];
    }

    public function toDatabase(object $notifiable): array {
        return [
            'type'       => 'instructor_role_request_approved',
            'title'      => 'Permintaan Instructor Disetujui',
            'body'       => 'Selamat! Permintaan role instructor kamu telah disetujui.',
            'action_url' => '/instructor/dashboard',
            'menu_key'   => null,
        ];
    }
}
