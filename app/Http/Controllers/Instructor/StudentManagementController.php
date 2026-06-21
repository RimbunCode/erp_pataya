<?php

namespace App\Http\Controllers\Instructor;

use App\FormStatus;
use App\Http\Controllers\Controller;
use App\Models\Enrollment;
use App\Services\CourseProgressService;
use App\Services\Instructor\StudentProgressBuilder;
use App\Traits\HasInitials;
use Inertia\Inertia;
use Inertia\Response;

class StudentManagementController extends Controller {
    use HasInitials;

    public function __construct(
        private CourseProgressService $courseProgressService,
        private StudentProgressBuilder $progressBuilder,
    ) {}

    public function index(): Response {
        $instructorId = (string) auth()->id();

        $enrollments = Enrollment::query()
            ->where(function ($query) {
                $query
                    ->where('status', FormStatus::ACTIVE->value)
                    ->orWhereNull('status');
            })
            ->whereHas('course', function ($query) use ($instructorId) {
                $query->where('created_by', $instructorId);
            })
            ->with([
                'user:id,name,email,image,updated_at',
                'course:id,title,created_by',
                'course.sections:id,course_id,title,order',
                'course.sections.contents:id,section_id,title,type,order',
            ])
            ->orderByDesc('enrolled_at')
            ->get();

        $studentIds = $enrollments->pluck('user_id')->map(static fn ($userId) => (string) $userId)->unique()->values();
        $contentIds = $enrollments
            ->flatMap(fn ($enrollment) => $enrollment->course->sections->flatMap->contents->pluck('id'))
            ->map(static fn ($contentId) => (string) $contentId)
            ->unique()
            ->values();

        [$completedLookupByUser, $completedAtByUserContent] = $this->progressBuilder->buildCompletedContentMaps($studentIds, $contentIds);
        [$submittedLookupByUser, $submittedAtByUserContent] = $this->progressBuilder->buildSubmittedContentMaps($studentIds, $contentIds);
        $submissionsByUserContent                           = $this->progressBuilder->buildSubmissionsWithFiles($studentIds, $contentIds);

        $students = $enrollments->map(function ($enrollment) use ($completedLookupByUser, $completedAtByUserContent, $submittedLookupByUser, $submittedAtByUserContent, $submissionsByUserContent) {
            $userId         = (string) $enrollment->user_id;
            $courseContents = $enrollment->course->sections->flatMap->contents;

            $completedLookup = $completedLookupByUser[$userId] ?? [];
            $submittedLookup = $submittedLookupByUser[$userId] ?? [];

            $progress = $this->courseProgressService->calculateProgress(
                $courseContents,
                $completedLookup,
                $submittedLookup,
            );

            $lastActiveAt = $this->progressBuilder->resolveLastActiveAt(
                $enrollment->enrolled_at,
                $courseContents->pluck('id')->map(static fn ($contentId) => (string) $contentId),
                $completedAtByUserContent[$userId] ?? [],
                $submittedAtByUserContent[$userId] ?? [],
            );

            $userSubmissions = $submissionsByUserContent[$userId] ?? [];
            $submissions     = $courseContents
                ->filter(fn ($content) => $content->isSubmissionType())
                ->map(function ($content) use ($userSubmissions) {
                    $contentId  = (string) $content->id;
                    $submission = $userSubmissions[$contentId] ?? null;

                    return [
                        'content_id'    => $contentId,
                        'content_title' => (string) $content->title,
                        'content_type'  => (string) $content->type,
                        'submission_id' => $submission ? (string) $submission['id'] : null,
                        'submitted_at'  => $submission ? $submission['submitted_at'] : null,
                        'notes'         => $submission ? $submission['notes'] : null,
                        'grade'         => $submission ? $submission['grade'] : null,
                        'feedback'      => $submission ? $submission['feedback'] : null,
                        'graded_at'     => $submission ? $submission['graded_at'] : null,
                        'files'         => $submission ? $submission['files'] : [],
                    ];
                })
                ->values()
                ->all();

            return [
                'id'         => (string) $enrollment->id,
                'name'       => (string) $enrollment->user->name,
                'avatar'     => $this->initials((string) $enrollment->user->name),
                'image'      => $enrollment->user->image !== null ? (string) $enrollment->user->image : null,
                'updated_at' => $enrollment->user->updated_at?->toIso8601String(),
                'email'      => (string) $enrollment->user->email,
                'course'     => (string) $enrollment->course->title,
                'progress'   => $progress,
                'status'     => $this->courseProgressService->resolveStatusFromProgress($progress),
                'joinDate'   => $enrollment->enrolled_at->format('d M Y'),
                'lastActive' => $lastActiveAt->diffForHumans(),
                'modules'    => $this->courseProgressService->buildModules(
                    $enrollment->course->sections,
                    $completedLookup,
                    $submittedLookup,
                ),
                'submissions' => $submissions,
            ];
        })->values();

        $courses = collect(['All Courses'])
            ->merge($students->pluck('course')->unique()->values())
            ->values();

        return Inertia::render('Instructors/StudentManagement', [
            'students' => $students,
            'courses'  => $courses,
        ]);
    }
}
