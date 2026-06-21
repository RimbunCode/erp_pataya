<?php

namespace App\Http\Controllers\Admin;

use App\FormStatus;
use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\CoursePublishRequest;
use App\Models\Enrollment;
use App\Models\Finance\InstructorPayoutRequest;
use App\Models\Payment;
use App\Models\User\User;
use App\Services\Admin\AdminPermissionService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller {
    public function __construct(private AdminPermissionService $adminPermissionService) {}

    public function index(Request $request): Response {
        $user        = $request->user();
        $permissions = $user ? $this->adminPermissionService->resolveUserPermissionNames($user) : [];

        $isSuperAdmin   = \in_array('super_admin', $permissions, true);
        $isFinance      = $isSuperAdmin || \in_array('finance_admin', $permissions, true);
        $isCourseAdmin  = $isSuperAdmin || \in_array('course_admin', $permissions, true);
        $isUserAdmin    = $isSuperAdmin || \in_array('user_admin', $permissions, true);
        $isCourseOrUser = $isCourseAdmin || $isUserAdmin || \in_array('content_admin', $permissions, true);

        $since = Carbon::now()->subYear();

        // --- Stats umum (semua admin) ---
        $totalStudents    = User::whereHas('roles', fn (Builder $q) => $q->where('name', 'student'))->count();
        $totalInstructors = User::whereHas('roles', fn (Builder $q) => $q->where('name', 'instructor'))->count();
        $totalCourses     = Course::count();
        $publishedCourses = Course::where('is_published', true)->count();

        // --- Stats finance ---
        $totalRevenue    = null;
        $pendingPayments = null;
        $pendingPayouts  = null;
        $recentPayments  = [];

        if ($isFinance) {
            $paymentStats = Payment::query()
                ->selectRaw('
                    SUM(CASE WHEN status = ? THEN amount ELSE 0 END) as total_revenue,
                    SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as pending_count
                ', [FormStatus::APPROVED->value, FormStatus::PENDING->value])
                ->first();

            $totalRevenue    = (float) ($paymentStats->total_revenue ?? 0);
            $pendingPayments = (int) ($paymentStats->pending_count ?? 0);
            $pendingPayouts  = InstructorPayoutRequest::whereIn('status', ['pending', 'approved'])->count();

            $recentPayments = Payment::query()
                ->with(['user:id,name', 'course:id,title'])
                ->whereNotNull('course_id')
                ->latest('created_at')
                ->limit(6)
                ->get(['id', 'user_id', 'course_id', 'amount', 'status', 'created_at'])
                ->map(fn (Payment $p) => [
                    'id'          => (string) $p->id,
                    'studentName' => (string) ($p->user?->name ?? '-'),
                    'courseName'  => (string) ($p->course?->title ?? '-'),
                    'amount'      => (float) $p->amount,
                    'status'      => (string) $p->status,
                    'submittedAt' => $p->created_at?->toIso8601String(),
                ])->values()->all();
        }

        // --- Stats course ---
        $pendingApprovals = null;
        $recentApprovals  = [];

        if ($isCourseAdmin) {
            $pendingApprovals = CoursePublishRequest::where('status', FormStatus::PENDING->value)->count();

            $recentApprovals = CoursePublishRequest::query()
                ->with(['course:id,title', 'requester:id,name'])
                ->where('status', FormStatus::PENDING->value)
                ->latest('created_at')
                ->limit(6)
                ->get(['id', 'course_id', 'requested_by', 'status', 'created_at'])
                ->map(fn (CoursePublishRequest $r) => [
                    'id'             => (string) $r->id,
                    'courseTitle'    => (string) ($r->course?->title ?? '-'),
                    'instructorName' => (string) ($r->requester?->name ?? '-'),
                    'submittedAt'    => $r->created_at?->toIso8601String(),
                ])->values()->all();
        }

        // --- Time series charts ---
        $revenueTimeSeries    = [];
        $enrollmentTimeSeries = [];

        if ($isFinance) {
            $revenueTimeSeries = Payment::query()
                ->where('status', FormStatus::APPROVED->value)
                ->whereNotNull('verified_at')
                ->where('verified_at', '>=', $since)
                ->get(['amount', 'verified_at'])
                ->map(fn (Payment $p) => [
                    'date'   => $p->verified_at->toDateString(),
                    'amount' => (float) $p->amount,
                ])->values()->all();
        }

        if ($isCourseOrUser) {
            $enrollmentTimeSeries = Enrollment::query()
                ->where(function ($q): void {
                    $q->where('status', FormStatus::ACTIVE->value)->orWhereNull('status');
                })
                ->where('enrolled_at', '>=', $since)
                ->get(['enrolled_at'])
                ->map(fn (Enrollment $e) => [
                    'date'  => $e->enrolled_at->toDateString(),
                    'count' => 1,
                ])->values()->all();
        }

        return Inertia::render('Admin/Dashboard', [
            'stats' => [
                'totalStudents'    => (int) $totalStudents,
                'totalInstructors' => (int) $totalInstructors,
                'totalCourses'     => (int) $totalCourses,
                'publishedCourses' => (int) $publishedCourses,
                'totalRevenue'     => $totalRevenue,
                'pendingPayments'  => $pendingPayments,
                'pendingPayouts'   => $pendingPayouts,
                'pendingApprovals' => $pendingApprovals,
            ],
            'recentPayments'       => $recentPayments,
            'recentApprovals'      => $recentApprovals,
            'revenueTimeSeries'    => $revenueTimeSeries,
            'enrollmentTimeSeries' => $enrollmentTimeSeries,
            'chartVisibility'      => [
                'revenue'    => $isFinance,
                'enrollment' => $isCourseOrUser,
            ],
        ]);
    }
}
