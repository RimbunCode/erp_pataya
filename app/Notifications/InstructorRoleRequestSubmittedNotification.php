<?php

namespace App\Notifications;

use App\Models\RoleRequest;

class InstructorRoleRequestSubmittedNotification extends BaseNotification {
    public function __construct(private RoleRequest $roleRequest) {}

    public function via(object $notifiable): array {
        return ['database'];
    }

    public function toDatabase(object $notifiable): array {
        $applicant = $this->roleRequest->user;

        return [
            'type'       => 'instructor_role_request_submitted',
            'title'      => 'Permintaan Role Instructor Baru',
            'body'       => "{$applicant?->name} mengajukan permintaan untuk menjadi instructor.",
            'action_url' => '/admin/user?tab=requests',
            'menu_key'   => 'user',
        ];
    }
}
