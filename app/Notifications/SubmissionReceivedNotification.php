<?php

namespace App\Notifications;

use App\Models\Submission;

class SubmissionReceivedNotification extends BaseNotification {
    public function __construct(private Submission $submission) {}

    public function via(object $notifiable): array {
        return ['database'];
    }

    public function toDatabase(object $notifiable): array {
        $student = $this->submission->user;
        $content = $this->submission->content;
        $course  = $content?->section?->course ?? $content?->course;

        return [
            'type'       => 'submission_received',
            'title'      => 'Tugas Baru Diterima',
            'body'       => "{$student->name} mengumpulkan tugas \"{$content?->name}\"",
            'action_url' => '/instructor/students',
            'menu_key'   => 'student-management',
        ];
    }
}
