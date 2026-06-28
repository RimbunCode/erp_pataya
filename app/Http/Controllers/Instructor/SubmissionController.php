<?php

namespace App\Http\Controllers\Instructor;

use App\Http\Controllers\Controller;
use App\Jobs\IssueCertificateJob;
use App\Models\Enrollment;
use App\Models\Submission;
use App\Models\UserProgress;
use App\Services\CertificateService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class SubmissionController extends Controller {
    public function __construct(private CertificateService $certificateService) {}

    public function grade(Request $request, Enrollment $enrollment, Submission $submission): RedirectResponse {
        $instructorId = (string) auth()->id();

        $enrollment->loadMissing('course:id,created_by');

        if ((string) $enrollment->course->created_by !== $instructorId) {
            abort(Response::HTTP_FORBIDDEN);
        }

        if ((string) $submission->user_id !== (string) $enrollment->user_id) {
            abort(Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $validated = $request->validate([
            'grade'    => ['nullable', 'integer', 'min:0', 'max:100'],
            'feedback' => ['nullable', 'string', 'max:2000'],
        ]);

        $submission->update([
            'grade'     => $validated['grade'] ?? null,
            'feedback'  => $validated['feedback'] ?? null,
            'graded_at' => now(),
        ]);

        // Mark content as completed in user_progress when graded
        if ($validated['grade'] !== null) {
            UserProgress::firstOrCreate([
                'user_id'    => $submission->user_id,
                'content_id' => $submission->content_id,
            ], [
                'is_completed' => true,
                'completed_at' => now(),
            ]);

            $this->dispatchIfCourseCompleted($enrollment);
        }

        return back()->with('success', 'Nilai berhasil disimpan.');
    }

    private function dispatchIfCourseCompleted(Enrollment $enrollment): void {
        $enrollment->load(['course.sections.contents', 'certificate']);

        if ($enrollment->certificate) return;

        if ($this->certificateService->isCourseCompleted($enrollment)) {
            IssueCertificateJob::dispatch($enrollment);
        }
    }
}
