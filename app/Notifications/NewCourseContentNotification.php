<?php

namespace App\Notifications;

use App\Models\CourseContent;

class NewCourseContentNotification extends BaseNotification {
    public function __construct(private CourseContent $content) {}

    public function via(object $notifiable): array {
        return ['database'];
    }

    public function toDatabase(object $notifiable): array {
        $course = $this->content->section?->course ?? $this->content->course;

        return [
            'type'       => 'new_course_content',
            'title'      => 'Konten Baru di Kursus',
            'body'       => "Materi baru \"{$this->content->name}\" tersedia di kursus \"{$course?->name}\"",
            'action_url' => '/student/my-courses',
            'menu_key'   => 'my-courses',
        ];
    }
}
