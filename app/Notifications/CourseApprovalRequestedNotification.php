<?php

namespace App\Notifications;

use App\Models\CoursePublishRequest;

class CourseApprovalRequestedNotification extends BaseNotification {
    public function __construct(private CoursePublishRequest $publishRequest) {}

    public function via(object $notifiable): array {
        return ['database'];
    }

    public function toDatabase(object $notifiable): array {
        $course = $this->publishRequest->course;
        $author = $this->publishRequest->requester;

        return [
            'type'       => 'course_approval_requested',
            'title'      => 'Kursus Menunggu Persetujuan',
            'body'       => "\"{$course->name}\" oleh {$author->name} menunggu review",
            'action_url' => '/admin/approvals',
            'menu_key'   => 'approval',
        ];
    }
}
