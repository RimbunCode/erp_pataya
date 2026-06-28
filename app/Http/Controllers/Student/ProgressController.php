<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Jobs\IssueCertificateJob;
use App\Models\CourseContent;
use App\Models\Enrollment;
use App\Models\UserProgress;
use App\Services\CertificateService;

class ProgressController extends Controller {
    public function __construct(private CertificateService $certificateService) {}

    public function store(CourseContent $content) {
        // Hanya material yang bisa di mark as done manual
        if ($content->type !== 'material') {
            abort(403);
        }

        UserProgress::firstOrCreate([
            'user_id'    => auth()->id(),
            'content_id' => $content->id,
        ], [
            'is_completed' => true,
            'completed_at' => now(),
        ]);

        $this->dispatchIfCourseCompleted($content);

        return back();
    }

    private function dispatchIfCourseCompleted(CourseContent $content): void {
        $enrollment = Enrollment::with(['course.sections.contents', 'certificate'])
            ->where('user_id', auth()->id())
            ->whereHas('course.sections.contents', fn ($q) => $q->where('id', $content->id))
            ->first();

        if (! $enrollment || $enrollment->certificate) return;

        if ($this->certificateService->isCourseCompleted($enrollment)) {
            IssueCertificateJob::dispatch($enrollment);
        }
    }
}