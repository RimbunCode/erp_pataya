<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Services\CourseProgressService;
use Inertia\Inertia;

class CourseListController extends Controller {
    public function __construct(private CourseProgressService $courseProgressService) {}

    public function index() {
        $user = auth()->user();

        $enrollments = $user->enrollments()
            ->with(['course.categories', 'course.creator', 'course.sections.contents'])
            ->get();

        $completedContentIds = $user->progress()
            ->where('is_completed', true)
            ->pluck('content_id');

        $submissions = $user->submissions()
            ->with('files')
            ->get();
        $submittedContentIds = $submissions
            ->filter(fn ($submission) => $submission->files->isNotEmpty())
            ->pluck('content_id');
        $submissionsByContent   = $submissions->keyBy('content_id');
        $completedContentLookup = $this->courseProgressService->toLookup($completedContentIds);
        $submittedContentLookup = $this->courseProgressService->toLookup($submittedContentIds);

        $courses = $enrollments->map(fn ($enrollment) => [
            'id'             => $enrollment->course->id,
            'title'          => $enrollment->course->title,
            'instructor'     => $enrollment->course->creator?->name,
            'category'       => $enrollment->course->categories->first()?->name ?? '-',
            'thumbnail'      => $enrollment->course->thumbnail,
            'total_hours'    => $enrollment->course->total_hours,
            'total_sessions' => $enrollment->course->total_sessions,
            'enrolled_at'    => $enrollment->enrolled_at->format('d M Y'),
            'progress'       => $this->courseProgressService->calculateProgress(
                $enrollment->course->sections->flatMap->contents,
                $completedContentLookup,
                $submittedContentLookup,
            ),
            'sections' => $enrollment->course->sections->map(function ($section) use ($completedContentLookup, $submittedContentLookup, $submissionsByContent) {
                return [
                    'id'       => $section->id,
                    'title'    => $section->title,
                    'order'    => $section->order,
                    'contents' => $section->contents->map(function ($content) use ($completedContentLookup, $submittedContentLookup, $submissionsByContent) {
                        $submission = $submissionsByContent->get($content->id);

                        return [
                            'id'                    => $content->id,
                            'title'                 => $content->title,
                            'type'                  => $content->type,
                            'is_optional'           => $content->is_optional,
                            'deadline_label'        => $content->deadlineLabel(),
                            'can_manage_submission' => $content->isSubmissionType() && ! $content->hasDeadlinePassed(),
                            'is_completed'          => $this->courseProgressService->isContentCompleted(
                                (string) $content->type,
                                (string) $content->id,
                                $completedContentLookup,
                                $submittedContentLookup,
                            ),
                            'submission' => $submission ? [
                                'status'       => $submission->status,
                                'submitted_at' => $submission->submitted_at?->format('d M Y H:i'),
                                'notes'        => $submission->notes,
                                'files'        => $submission->files->map(fn ($file) => [
                                    'id'        => $file->id,
                                    'name'      => $file->name,
                                    'extension' => $file->extension,
                                    'fullname'  => $file->fullname,
                                    'mime_type' => $file->mime_type,
                                ])->values()->toArray(),
                            ] : null,
                        ];
                    })->values()->toArray(),
                ];
            })->values()->toArray(),
        ]);

        // dd($courses->first());

        return Inertia::render('Students/MyCourses', [
            'courses' => $courses,
        ]);
    }
}
