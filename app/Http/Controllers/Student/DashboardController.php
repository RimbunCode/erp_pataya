<?php

namespace App\Http\Controllers\Student;

use App\FormStatus;
use App\Http\Controllers\Controller;
use App\Models\Enrollment;
use App\Models\Submission;
use App\Services\CourseProgressService;
use Carbon\CarbonInterface;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller {
    private const CONTINUE_LEARNING_LIMIT  = 5;
    private const UPCOMING_DEADLINES_LIMIT = 5;

    public function __construct(private CourseProgressService $courseProgressService) {}

    public function index(Request $request): Response {
        $user = $request->user();
        if (! $user) {
            abort(401);
        }

        $enrollments = Enrollment::query()
            ->where('user_id', $user->id)
            ->with([
                'course:id,title,thumbnail,created_by',
                'course.creator:id,name',
                'course.sections:id,course_id,title,order',
                'course.sections.contents:id,section_id,title,type,is_required,deadline,order',
            ])
            ->orderByDesc('enrolled_at')
            ->get(['id', 'user_id', 'course_id', 'status', 'enrolled_at']);

        $activeEnrollments = $enrollments->filter(function (Enrollment $enrollment): bool {
            return $this->isEnrollmentActive((string) $enrollment->status);
        })->values();

        $pendingVerificationCourses = $enrollments->filter(function (Enrollment $enrollment): bool {
            return $this->isEnrollmentPendingVerification((string) $enrollment->status);
        })->count();

        $completedProgress = $user->progress()
            ->where('is_completed', true)
            ->get(['content_id', 'completed_at']);

        $completedContentLookup = $this->courseProgressService->toLookup(
            $completedProgress->pluck('content_id'),
        );

        /** @var array<string, CarbonInterface> $completedAtByContent */
        $completedAtByContent = $completedProgress
            ->mapWithKeys(function ($progress): array {
                return [(string) $progress->content_id => $progress->completed_at];
            })
            ->all();

        $submissions = $user->submissions()
            ->with('files:id')
            ->get(['id', 'content_id', 'submitted_at']);

        $validSubmissions = $submissions->filter(function (Submission $submission): bool {
            return $submission->files->isNotEmpty();
        })->values();

        $submittedContentLookup = $this->courseProgressService->toLookup(
            $validSubmissions->pluck('content_id'),
        );

        /** @var array<string, CarbonInterface> $submittedAtByContent */
        $submittedAtByContent = $validSubmissions
            ->mapWithKeys(function (Submission $submission): array {
                return [(string) $submission->content_id => $submission->submitted_at];
            })
            ->all();

        $activeCourseSummaries = $activeEnrollments->map(function (Enrollment $enrollment) use (
            $completedAtByContent,
            $completedContentLookup,
            $submittedAtByContent,
            $submittedContentLookup
        ): array {
            $course = $enrollment->course;
            if (! $course) {
                return [
                    'id'               => '',
                    'title'            => '-',
                    'instructor'       => '-',
                    'thumbnail'        => null,
                    'progress'         => 0,
                    'nextContentTitle' => null,
                    'lastActivityAt'   => $enrollment->enrolled_at?->toIso8601String(),
                    'lastActivitySort' => $enrollment->enrolled_at?->getTimestamp() ?? 0,
                    'contents'         => collect(),
                ];
            }

            $contents = $course->sections->flatMap->contents->values();

            $progress = $this->courseProgressService->calculateProgress(
                $contents,
                $completedContentLookup,
                $submittedContentLookup,
            );

            $nextContent = $contents->first(function ($content) use ($completedContentLookup, $submittedContentLookup): bool {
                return ! $this->courseProgressService->isContentCompleted(
                    (string) $content->type,
                    (string) $content->id,
                    $completedContentLookup,
                    $submittedContentLookup,
                );
            });

            $lastActivity = $this->resolveLastActivity(
                $contents,
                $completedAtByContent,
                $submittedAtByContent,
                $enrollment->enrolled_at,
            );

            return [
                'id'               => (string) $course->id,
                'title'            => (string) $course->title,
                'instructor'       => (string) ($course->creator?->name ?? '-'),
                'thumbnail'        => $course->thumbnail,
                'progress'         => $progress,
                'nextContentTitle' => $nextContent?->title,
                'lastActivityAt'   => $lastActivity?->toIso8601String(),
                'lastActivitySort' => $lastActivity?->getTimestamp() ?? 0,
                'contents'         => $contents,
            ];
        })->values();

        $ongoingCourses   = $activeCourseSummaries->where('progress', '<', 100)->count();
        $completedCourses = $activeCourseSummaries->where('progress', 100)->count();

        $continueLearning = $activeCourseSummaries
            ->filter(fn (array $course): bool => $course['progress'] < 100)
            ->sortByDesc('lastActivitySort')
            ->take(self::CONTINUE_LEARNING_LIMIT)
            ->values()
            ->map(function (array $course): array {
                return [
                    'id'               => $course['id'],
                    'title'            => $course['title'],
                    'instructor'       => $course['instructor'],
                    'thumbnail'        => $course['thumbnail'],
                    'progress'         => (int) $course['progress'],
                    'nextContentTitle' => $course['nextContentTitle'],
                    'lastActivityAt'   => $course['lastActivityAt'],
                ];
            })
            ->all();

        $now = now();

        $pendingSubmissions = 0;
        $upcomingDeadlines  = [];

        foreach ($activeCourseSummaries as $course) {
            foreach ($course['contents'] as $content) {
                if (! $content->isSubmissionType() || ! $content->is_required) {
                    continue;
                }

                $isCompleted = $this->courseProgressService->isContentCompleted(
                    (string) $content->type,
                    (string) $content->id,
                    $completedContentLookup,
                    $submittedContentLookup,
                );

                if ($isCompleted) {
                    continue;
                }

                $pendingSubmissions++;

                if (! $content->deadline) {
                    continue;
                }

                $upcomingDeadlines[] = [
                    'courseId'     => (string) $course['id'],
                    'courseTitle'  => (string) $course['title'],
                    'contentId'    => (string) $content->id,
                    'contentTitle' => (string) $content->title,
                    'type'         => (string) $content->type,
                    'deadlineAt'   => $content->deadline->toIso8601String(),
                    'isOverdue'    => $content->deadline->lte($now),
                    'deadlineSort' => $content->deadline->getTimestamp(),
                ];
            }
        }

        $upcomingDeadlines = collect($upcomingDeadlines)
            ->sortBy('deadlineSort')
            ->take(self::UPCOMING_DEADLINES_LIMIT)
            ->values()
            ->map(function (array $item): array {
                return [
                    'courseId'     => $item['courseId'],
                    'courseTitle'  => $item['courseTitle'],
                    'contentId'    => $item['contentId'],
                    'contentTitle' => $item['contentTitle'],
                    'type'         => $item['type'],
                    'deadlineAt'   => $item['deadlineAt'],
                    'isOverdue'    => (bool) $item['isOverdue'],
                ];
            })
            ->all();

        $averageProgress = $activeCourseSummaries->isEmpty()
            ? 0
            : (int) round((float) $activeCourseSummaries->avg('progress'));

        $resumeCourse = $continueLearning[0] ?? null;

        return Inertia::render('Students/Dashboard', [
            'overview' => [
                'ongoingCourses'             => (int) $ongoingCourses,
                'completedCourses'           => (int) $completedCourses,
                'pendingVerificationCourses' => (int) $pendingVerificationCourses,
                'pendingSubmissions'         => (int) $pendingSubmissions,
            ],
            'hero' => [
                'averageProgress' => $averageProgress,
                'resumeCourse'    => $resumeCourse ? [
                    'id'       => $resumeCourse['id'],
                    'title'    => $resumeCourse['title'],
                    'progress' => $resumeCourse['progress'],
                ] : null,
            ],
            'continueLearning'  => $continueLearning,
            'upcomingDeadlines' => $upcomingDeadlines,
        ]);
    }

    private function isEnrollmentActive(string $status): bool {
        return $status === '' || $status === FormStatus::ACTIVE->value;
    }

    private function isEnrollmentPendingVerification(string $status): bool {
        return in_array(
            $status,
            [FormStatus::PENDING->value, FormStatus::REJECTED->value],
            true,
        );
    }

    /**
     * @param  array<string, CarbonInterface>  $completedAtByContent
     * @param  array<string, CarbonInterface>  $submittedAtByContent
     */
    private function resolveLastActivity(
        $contents,
        array $completedAtByContent,
        array $submittedAtByContent,
        ?CarbonInterface $fallback,
    ): ?CarbonInterface {
        $activityTimestamps = [];

        foreach ($contents as $content) {
            $contentId = (string) $content->id;

            $completedAt = $completedAtByContent[$contentId] ?? null;
            if ($completedAt instanceof CarbonInterface) {
                $activityTimestamps[] = $completedAt;
            }

            $submittedAt = $submittedAtByContent[$contentId] ?? null;
            if ($submittedAt instanceof CarbonInterface) {
                $activityTimestamps[] = $submittedAt;
            }
        }

        if ($activityTimestamps === []) {
            return $fallback;
        }

        usort($activityTimestamps, function (CarbonInterface $left, CarbonInterface $right): int {
            return $right->getTimestamp() <=> $left->getTimestamp();
        });

        return $activityTimestamps[0] ?? $fallback;
    }
}
