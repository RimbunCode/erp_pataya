<?php

namespace App\Notifications;

use App\Models\Submission;

class SubmissionGradedNotification extends BaseNotification {
    public function __construct(private Submission $submission) {}

    public function via(object $notifiable): array {
        return ['database'];
    }

    public function toDatabase(object $notifiable): array {
        $content = $this->submission->content;
        $course  = $content?->section?->course ?? $content?->course;
        $grade   = $this->submission->grade;

        return [
            'type'       => 'submission_graded',
            'title'      => 'Tugas Kamu Sudah Dinilai',
            'body'       => "Tugas \"{$content?->title}\" pada kursus \"{$course?->title}\" sudah dinilai."
                . ($grade !== null ? " Nilai: {$grade}/100." : ''),
            'action_url' => '/student/my-courses',
            'menu_key'   => 'my-courses',
        ];
    }
}
