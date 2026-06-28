<?php

namespace App\Notifications;

use App\Models\CourseNote;

class NewCourseNoteNotification extends BaseNotification {
    public function __construct(private CourseNote $note) {}

    public function via(object $notifiable): array {
        return ['database'];
    }

    public function toDatabase(object $notifiable): array {
        $course = $this->note->course;

        return [
            'type'       => 'new_course_note',
            'title'      => 'Catatan Baru di Kursus',
            'body'       => "Ada catatan baru di kursus \"{$course->name}\"",
            'action_url' => '/student/my-courses',
            'menu_key'   => 'my-courses',
        ];
    }
}
