<?php

namespace App\Http\Controllers\Instructor;

use App\FormStatus;
use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Finance\InstructorEarning;
use App\Models\Finance\InstructorPayoutRequest;
use App\Services\Finance\InstructorPayoutService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller {
    public function __construct(private InstructorPayoutService $instructorPayoutService) {}

    public function index(Request $request): Response {
        $user = $request->user();
        if (! $user) {
            abort(401);
        }

        $courses = Course::query()
            ->where('created_by', $user->id)
            ->with('latestPublishRequest')
            ->withCount([
                'enrollments as students_count' => function (Builder $query): void {
                    $query->where(function (Builder $query): void {
                        $query
                            ->where('status', FormStatus::ACTIVE->value)
                            ->orWhereNull('status');
                    });
                },
            ])
            ->get(['id', 'title', 'is_published', 'updated_at']);

        $courseEarnings = InstructorEarning::query()
            ->where('instructor_id', $user->id)
            ->whereNotNull('course_id')
            ->selectRaw('course_id, SUM(instructor_amount) as total')
            ->groupBy('course_id')
            ->pluck('total', 'course_id');

        $courseSummaries = $courses->map(function (Course $course) use ($courseEarnings): array {
            $status = $this->resolveCourseStatus($course);

            return [
                'id'              => (string) $course->id,
                'title'           => (string) $course->title,
                'status'          => $status,
                'studentsCount'   => (int) ($course->students_count ?? 0),
                'lifetimeEarning' => (float) ($courseEarnings[$course->id] ?? 0),
                'updatedAt'       => $course->updated_at?->toIso8601String(),
            ];
        })->values();

        $totalStudents = Enrollment::query()
            ->where(function (Builder $query): void {
                $query
                    ->where('status', FormStatus::ACTIVE->value)
                    ->orWhereNull('status');
            })
            ->whereHas('course', function (Builder $query) use ($user): void {
                $query->where('created_by', $user->id);
            })
            ->select('user_id')
            ->distinct()
            ->count('user_id');

        $pendingPayoutAmount = (float) InstructorPayoutRequest::query()
            ->where('instructor_id', $user->id)
            ->whereIn('status', [
                FormStatus::DRAFT->value,
                FormStatus::PENDING->value,
                FormStatus::APPROVED->value,
            ])
            ->sum('requested_amount');

        $recentEnrollments = Enrollment::query()
            ->where(function (Builder $query): void {
                $query
                    ->where('status', FormStatus::ACTIVE->value)
                    ->orWhereNull('status');
            })
            ->whereHas('course', function (Builder $query) use ($user): void {
                $query->where('created_by', $user->id);
            })
            ->with(['user:id,name', 'course:id,title'])
            ->orderByDesc('enrolled_at')
            ->limit(8)
            ->get(['id', 'user_id', 'course_id', 'enrolled_at'])
            ->map(function (Enrollment $enrollment): array {
                return [
                    'id'          => (string) $enrollment->id,
                    'studentName' => (string) ($enrollment->user?->name ?? '-'),
                    'courseTitle' => (string) ($enrollment->course?->title ?? '-'),
                    'enrolledAt'  => $enrollment->enrolled_at?->toIso8601String(),
                ];
            })
            ->values()
            ->all();

        $topCourses = $courseSummaries
            ->sort(function (array $left, array $right): int {
                if ($left['studentsCount'] === $right['studentsCount']) {
                    return $right['lifetimeEarning'] <=> $left['lifetimeEarning'];
                }

                return $right['studentsCount'] <=> $left['studentsCount'];
            })
            ->take(5)
            ->values()
            ->all();

        $since = Carbon::now()->subYear();

        $earningTimeSeries = InstructorEarning::query()
            ->where('instructor_id', $user->id)
            ->where('created_at', '>=', $since)
            ->get(['instructor_amount', 'created_at'])
            ->map(fn (InstructorEarning $e) => [
                'date'   => $e->created_at->toDateString(),
                'amount' => (float) $e->instructor_amount,
            ])->values()->all();

        $enrollmentTimeSeries = Enrollment::query()
            ->where(function (Builder $q): void {
                $q->where('status', FormStatus::ACTIVE->value)->orWhereNull('status');
            })
            ->whereHas('course', fn (Builder $q) => $q->where('created_by', $user->id))
            ->where('enrolled_at', '>=', $since)
            ->get(['enrolled_at'])
            ->map(fn (Enrollment $e) => [
                'date'  => $e->enrolled_at->toDateString(),
                'count' => 1,
            ])->values()->all();

        return Inertia::render('Instructors/Dashboard', [
            'overview' => [
                'totalCourses'     => $courseSummaries->count(),
                'publishedCourses' => $courseSummaries->where('status', 'published')->count(),
                'totalStudents'    => (int) $totalStudents,
                'availableBalance' => (float) $this->instructorPayoutService->calculateEligibleBalance($user),
            ],
            'attention' => [
                'pendingApprovalCourses' => $courseSummaries->where('status', 'pending')->count(),
                'rejectedCourses'        => $courseSummaries->where('status', 'rejected')->count(),
                'pendingPayoutAmount'    => $pendingPayoutAmount,
            ],
            'topCourses'           => $topCourses,
            'recentEnrollments'    => $recentEnrollments,
            'earningTimeSeries'    => $earningTimeSeries,
            'enrollmentTimeSeries' => $enrollmentTimeSeries,
        ]);
    }

    private function resolveCourseStatus(Course $course): string {
        if ($course->is_published) {
            return 'published';
        }

        $latestPublishRequestStatus = (string) ($course->latestPublishRequest?->status ?? '');
        if ($latestPublishRequestStatus === FormStatus::PENDING->value) {
            return 'pending';
        }

        if ($latestPublishRequestStatus === FormStatus::REJECTED->value) {
            return 'rejected';
        }

        return 'draft';
    }
}
