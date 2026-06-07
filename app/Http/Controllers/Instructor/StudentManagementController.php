<?php

namespace App\Http\Controllers\Instructor;

use App\FormStatus;
use App\Http\Controllers\Controller;
use App\Models\Enrollment;
use App\Models\Submission;
use App\Models\UserProgress;
use App\Services\CourseProgressService;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

class StudentManagementController extends Controller {
    public function __construct(private CourseProgressService $courseProgressService) {}

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

        [$completedLookupByUser, $completedAtByUserContent] = $this->buildCompletedContentMaps($studentIds, $contentIds);
        [$submittedLookupByUser, $submittedAtByUserContent] = $this->buildSubmittedContentMaps($studentIds, $contentIds);
        $submissionsByUserContent = $this->buildSubmissionsWithFiles($studentIds, $contentIds);

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

            $lastActiveAt = $this->resolveLastActiveAt(
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
                'id'          => (string) $enrollment->id,
                'name'        => (string) $enrollment->user->name,
                'avatar'      => $this->initials((string) $enrollment->user->name),
                'image'       => $enrollment->user->image !== null ? (string) $enrollment->user->image : null,
                'updated_at'  => $enrollment->user->updated_at?->toIso8601String(),
                'email'       => (string) $enrollment->user->email,
                'course'      => (string) $enrollment->course->title,
                'progress'    => $progress,
                'status'      => $this->courseProgressService->resolveStatusFromProgress($progress),
                'joinDate'    => $enrollment->enrolled_at->format('d M Y'),
                'lastActive'  => $lastActiveAt->diffForHumans(),
                'modules'     => $this->courseProgressService->buildModules(
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

    /**
     * @param  Collection<int, string>  $studentIds
     * @param  Collection<int, string>  $contentIds
     * @return array{
     *     0: array<string, array<string, bool>>,
     *     1: array<string, array<string, CarbonInterface>>
     * }
     */
    private function buildCompletedContentMaps(Collection $studentIds, Collection $contentIds): array {
        if ($studentIds->isEmpty() || $contentIds->isEmpty()) {
            return [[], []];
        }

        $progressRecords = UserProgress::query()
            ->whereIn('user_id', $studentIds)
            ->whereIn('content_id', $contentIds)
            ->where('is_completed', true)
            ->get(['user_id', 'content_id', 'completed_at']);

        $completedLookupByUser    = [];
        $completedAtByUserContent = [];

        foreach ($progressRecords as $record) {
            $userId    = (string) $record->user_id;
            $contentId = (string) $record->content_id;

            $completedLookupByUser[$userId][$contentId] = true;

            if ($record->completed_at !== null) {
                $completedAtByUserContent[$userId][$contentId] = $record->completed_at;
            }
        }

        return [$completedLookupByUser, $completedAtByUserContent];
    }

    /**
     * @param  Collection<int, string>  $studentIds
     * @param  Collection<int, string>  $contentIds
     * @return array{
     *     0: array<string, array<string, bool>>,
     *     1: array<string, array<string, CarbonInterface>>
     * }
     */
    private function buildSubmittedContentMaps(Collection $studentIds, Collection $contentIds): array {
        if ($studentIds->isEmpty() || $contentIds->isEmpty()) {
            return [[], []];
        }

        $submissions = Submission::query()
            ->whereIn('user_id', $studentIds)
            ->whereIn('content_id', $contentIds)
            ->with('files')
            ->get(['id', 'user_id', 'content_id', 'submitted_at']);

        $submittedLookupByUser    = [];
        $submittedAtByUserContent = [];

        foreach ($submissions as $submission) {
            if ($submission->files->isEmpty()) {
                continue;
            }

            $userId    = (string) $submission->user_id;
            $contentId = (string) $submission->content_id;

            $submittedLookupByUser[$userId][$contentId] = true;

            if ($submission->submitted_at !== null) {
                $submittedAtByUserContent[$userId][$contentId] = $submission->submitted_at;
            }
        }

        return [$submittedLookupByUser, $submittedAtByUserContent];
    }

    /**
     * @param  Collection<int, string>  $courseContentIds
     * @param  array<string, CarbonInterface>  $completedAtByContent
     * @param  array<string, CarbonInterface>  $submittedAtByContent
     */
    private function resolveLastActiveAt(
        CarbonInterface $enrolledAt,
        Collection $courseContentIds,
        array $completedAtByContent,
        array $submittedAtByContent,
    ): CarbonInterface {
        $latestAt = $enrolledAt;

        foreach ($courseContentIds as $contentId) {
            if (isset($completedAtByContent[$contentId]) && $completedAtByContent[$contentId]->gt($latestAt)) {
                $latestAt = $completedAtByContent[$contentId];
            }

            if (isset($submittedAtByContent[$contentId]) && $submittedAtByContent[$contentId]->gt($latestAt)) {
                $latestAt = $submittedAtByContent[$contentId];
            }
        }

        return $latestAt;
    }

    /**
     * @param  Collection<int, string>  $studentIds
     * @param  Collection<int, string>  $contentIds
     * @return array<string, array<string, array<string, mixed>>>
     */
    private function buildSubmissionsWithFiles(Collection $studentIds, Collection $contentIds): array {
        if ($studentIds->isEmpty() || $contentIds->isEmpty()) {
            return [];
        }

        $submissions = Submission::query()
            ->whereIn('user_id', $studentIds)
            ->whereIn('content_id', $contentIds)
            ->with('files')
            ->get(['id', 'user_id', 'content_id', 'notes', 'status', 'grade', 'feedback', 'submitted_at', 'graded_at']);

        $result = [];

        foreach ($submissions as $submission) {
            if ($submission->files->isEmpty()) {
                continue;
            }

            $userId    = (string) $submission->user_id;
            $contentId = (string) $submission->content_id;

            $result[$userId][$contentId] = [
                'id'           => (string) $submission->id,
                'submitted_at' => $submission->submitted_at?->format('d M Y H:i'),
                'notes'        => $submission->notes,
                'grade'        => $submission->grade,
                'feedback'     => $submission->feedback,
                'graded_at'    => $submission->graded_at?->format('d M Y H:i'),
                'files'        => $submission->files->map(fn ($file) => [
                    'id'       => (string) $file->id,
                    'fullname' => $file->fullname,
                    'name'     => $file->name,
                    'extension' => $file->extension,
                ])->values()->all(),
            ];
        }

        return $result;
    }

    private function initials(string $name): string {
        $parts = preg_split('/\s+/', trim($name)) ?: [];
        $parts = array_values(array_filter($parts));

        if (\count($parts) === 0) {
            return 'NA';
        }

        $first  = mb_substr($parts[0], 0, 1);
        $second = \count($parts) > 1 ? mb_substr($parts[1], 0, 1) : '';

        return mb_strtoupper($first . $second);
    }
}
