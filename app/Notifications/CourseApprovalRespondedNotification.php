<?php

namespace App\Notifications;

use App\Models\CoursePublishRequest;

class CourseApprovalRespondedNotification extends BaseNotification {
    public function __construct(private CoursePublishRequest $publishRequest) {}

    public function via(object $notifiable): array {
        return ['database'];
    }

    public function toDatabase(object $notifiable): array {
        $course    = $this->publishRequest->course;
        $isApprove = $this->publishRequest->status === 'approved';
        $reason    = $this->publishRequest->rejection_reason;

        $courseId = $this->publishRequest->course_id;

        return [
            'type'       => 'course_approval_responded',
            'title'      => $isApprove ? 'Course Disetujui' : 'Course Ditolak',
            'body'       => $isApprove
                ? "Course \"{$course?->title}\" telah disetujui dan sekarang aktif."
                : "Course \"{$course?->title}\" ditolak." . ($reason ? " Alasan: {$reason}" : ''),
            'action_url' => "/instructor/classes/{$courseId}",
            'menu_key'   => 'manage-classes',
        ];
    }
}
