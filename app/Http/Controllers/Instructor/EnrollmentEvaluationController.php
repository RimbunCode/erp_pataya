<?php

namespace App\Http\Controllers\Instructor;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Enrollment;
use App\Services\GradingService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Inertia\Inertia;

class EnrollmentEvaluationController extends Controller {
    public function __construct(private GradingService $gradingService) {
    }

    public function show(Course $course): \Inertia\Response {
        $instructorId = (string) auth()->id();

        if ((string) $course->created_by !== $instructorId) {
            abort(Response::HTTP_FORBIDDEN);
        }

        $enrollments = Enrollment::where('course_id', $course->id)
            ->with(['user:id,name,email', 'evaluation'])
            ->get();

        $rows = $enrollments->map(function (Enrollment $enrollment) {
            $evaluation = $this->gradingService->syncEvaluation($enrollment);

            return [
                'enrollmentId' => (string) $enrollment->id,
                'studentName'  => $enrollment->user->name,
                'studentEmail' => $enrollment->user->email,
                'finalScore'   => $evaluation->final_score,
                'grade'        => $evaluation->grade,
                'isPassed'     => $evaluation->is_passed,
                'status'       => $evaluation->status,
                'isEligible'   => $this->gradingService->isFullyEvaluated($enrollment),
            ];
        })->values();

        return Inertia::render('Instructors/EnrollmentEvaluations/show', [
            'course'      => ['id' => $course->id, 'title' => $course->title, 'graduationScheme' => $course->graduation_scheme],
            'evaluations' => $rows,
        ]);
    }

    public function submit(Request $request, Course $course): RedirectResponse {
        $instructorId = (string) auth()->id();

        if ((string) $course->created_by !== $instructorId) {
            abort(Response::HTTP_FORBIDDEN);
        }

        $validated = $request->validate([
            'enrollment_ids'   => ['required', 'array', 'min:1'],
            'enrollment_ids.*' => ['string'],
        ]);

        $enrollments = Enrollment::where('course_id', $course->id)
            ->whereIn('id', $validated['enrollment_ids'])
            ->get();

        $submittedCount = 0;

        foreach ($enrollments as $enrollment) {
            $evaluation = $this->gradingService->syncEvaluation($enrollment);

            if ($evaluation->status !== 'draft' || ! $this->gradingService->isFullyEvaluated($enrollment)) {
                continue;
            }

            $evaluation->update([
                'status'       => 'submitted_instructor',
                'submitted_by' => $instructorId,
                'submitted_at' => now(),
            ]);
            $submittedCount++;
        }

        if ($submittedCount === 0) {
            return back()->withErrors(['enrollment_ids' => 'Tidak ada peserta yang memenuhi syarat untuk disubmit.']);
        }

        return back()->with('success', "{$submittedCount} evaluasi berhasil disubmit ke admin.");
    }
}
