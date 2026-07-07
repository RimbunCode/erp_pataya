<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\EnrollmentEvaluation;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class EnrollmentEvaluationController extends Controller {
    public function index(): Response {
        $courses = Course::query()
            ->whereHas('enrollments.evaluation', fn ($q) => $q->where('status', 'submitted_instructor'))
            ->withCount(['enrollments as pending_count' => function ($q) {
                $q->whereHas('evaluation', fn ($eq) => $eq->where('status', 'submitted_instructor'));
            }])
            ->get(['id', 'title'])
            ->map(fn ($course) => [
                'id'           => $course->id,
                'title'        => $course->title,
                'pendingCount' => $course->pending_count,
            ]);

        return Inertia::render('Admin/EnrollmentEvaluations/index', [
            'courses' => $courses,
        ]);
    }

    public function show(Course $course): Response {
        $enrollments = Enrollment::where('course_id', $course->id)
            ->with(['user:id,name,email', 'evaluation'])
            ->get()
            ->map(fn (Enrollment $enrollment) => [
                'enrollmentId' => (string) $enrollment->id,
                'studentName'  => $enrollment->user->name,
                'studentEmail' => $enrollment->user->email,
                'finalScore'   => $enrollment->evaluation?->final_score,
                'grade'        => $enrollment->evaluation?->grade,
                'isPassed'     => $enrollment->evaluation?->is_passed ?? false,
                'status'       => $enrollment->evaluation?->status ?? 'draft',
            ])
            ->values();

        return Inertia::render('Admin/EnrollmentEvaluations/show', [
            'course'      => ['id' => $course->id, 'title' => $course->title],
            'evaluations' => $enrollments,
        ]);
    }

    public function submitFinal(Request $request, Course $course): RedirectResponse {
        $adminId = (string) auth()->id();

        $validated = $request->validate([
            'enrollment_ids'   => ['required', 'array', 'min:1'],
            'enrollment_ids.*' => ['string'],
        ]);

        $evaluations = EnrollmentEvaluation::whereHas(
            'enrollment',
            fn ($q) => $q->where('course_id', $course->id)->whereIn('id', $validated['enrollment_ids']),
        )->where('status', 'submitted_instructor')->get();

        foreach ($evaluations as $evaluation) {
            $evaluation->update([
                'status'       => 'final',
                'finalized_by' => $adminId,
                'finalized_at' => now(),
            ]);
        }

        if ($evaluations->isEmpty()) {
            return back()->withErrors(['enrollment_ids' => 'Tidak ada evaluasi yang memenuhi syarat untuk difinalisasi.']);
        }

        return back()->with('success', "{$evaluations->count()} evaluasi berhasil difinalisasi.");
    }
}
