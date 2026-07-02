<?php

namespace App\Http\Controllers\Instructor;

use App\Http\Controllers\Controller;
use App\Http\Requests\Instructor\StorePayoutRequestRequest;
use App\Models\Finance\InstructorEarning;
use App\Models\Finance\InstructorPayoutRequest;
use App\Models\User\User;
use App\Notifications\PayoutRequestedNotification;
use App\Services\Finance\InstructorPayoutService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;
use Inertia\Inertia;
use Inertia\Response;

class FinancialController extends Controller {
    public function __construct(private InstructorPayoutService $instructorPayoutService) {}

    public function index(Request $request): Response {
        $user = $request->user();
        if (! $user) {
            abort(401);
        }

        $companyFeePercentage = $this->instructorPayoutService->resolveCompanyFeePercentage();
        $eligibleBalance      = $this->instructorPayoutService->calculateEligibleBalance($user);
        $lifetimeEarning      = InstructorEarning::query()
            ->where('instructor_id', $user->id)
            ->sum('instructor_amount');
        $pendingPayout = InstructorPayoutRequest::query()
            ->where('instructor_id', $user->id)
            ->whereIn('status', ['draft', 'pending', 'approved'])
            ->sum('requested_amount');

        $now       = now();
        $mutations = InstructorEarning::query()
            ->with([
                'course:id,title',
                'payment:id,verified_at,created_at',
            ])
            ->where('instructor_id', $user->id)
            ->latest('created_at')
            ->limit(100)
            ->get()
            ->map(function (InstructorEarning $earning) use ($now): array {
                $grossAmount   = (float) $earning->gross_amount;
                $companyAmount = (float) $earning->company_amount;

                if ($earning->released_at) {
                    $status = 'released';
                } elseif ($earning->available_at && $earning->available_at->lte($now)) {
                    $status = 'eligible';
                } else {
                    $status = 'pending';
                }

                return [
                    'id'                     => (string) $earning->id,
                    'courseName'             => (string) ($earning->course?->title ?? '-'),
                    'grossAmount'            => $grossAmount,
                    'companyAmount'          => $companyAmount,
                    'instructorAmount'       => (float) $earning->instructor_amount,
                    'effectiveFeePercentage' => $grossAmount > 0
                        ? round(($companyAmount / $grossAmount) * 100, 2)
                        : 0.0,
                    'earnedAt' => $earning->payment?->verified_at?->toIso8601String()
                        ?? $earning->payment?->created_at?->toIso8601String()
                        ?? $earning->created_at?->toIso8601String(),
                    'availableAt' => $earning->available_at?->toIso8601String(),
                    'releasedAt'  => $earning->released_at?->toIso8601String(),
                    'status'      => $status,
                ];
            })
            ->values();

        $payouts = InstructorPayoutRequest::query()
            ->where('instructor_id', $user->id)
            ->latest('created_at')
            ->limit(50)
            ->get()
            ->map(function (InstructorPayoutRequest $requestItem): array {
                return [
                    'id'                => (string) $requestItem->id,
                    'status'            => (string) $requestItem->status,
                    'source'            => (string) $requestItem->source,
                    'requestedAmount'   => (float) $requestItem->requested_amount,
                    'approvedAmount'    => (float) ($requestItem->approved_amount ?? 0),
                    'requestedAt'       => $requestItem->requested_at?->toIso8601String() ?? $requestItem->created_at?->toIso8601String(),
                    'approvedAt'        => $requestItem->approved_at?->toIso8601String(),
                    'paidAt'            => $requestItem->paid_at?->toIso8601String(),
                    'transferReference' => $requestItem->transfer_reference,
                    'rejectionReason'   => $requestItem->rejection_reason,
                    'note'              => $requestItem->note,
                ];
            })
            ->values();

        $since = Carbon::now()->subYear();

        $earningTimeSeries = InstructorEarning::query()
            ->where('instructor_id', $user->id)
            ->where('created_at', '>=', $since)
            ->selectRaw('DATE(created_at) as date, SUM(instructor_amount) as amount')
            ->groupByRaw('DATE(created_at)')
            ->orderByRaw('DATE(created_at)')
            ->get()
            ->map(fn ($row) => [
                'date'   => $row->date,
                'amount' => (float) $row->amount,
            ])->values()->all();

        return Inertia::render('Instructors/Financials', [
            'stats' => [
                'availableBalance' => (float) $eligibleBalance,
                'pendingPayout'    => (float) $pendingPayout,
                'lifetimeEarning'  => (float) $lifetimeEarning,
            ],
            'companyFeePercentage' => $companyFeePercentage,
            'mutations'            => $mutations,
            'payouts'              => $payouts,
            'earningTimeSeries'    => $earningTimeSeries,
        ]);
    }

    public function storePayoutRequest(StorePayoutRequestRequest $request): RedirectResponse {
        $user = $request->user();
        if (! $user) {
            abort(401);
        }

        $validated = $request->validated();
        $payoutRequest = $this->instructorPayoutService->createInstructorRequest(
            $user,
            (float) $validated['requested_amount'],
            $validated['note'] ?? null,
        );

        // Notifikasi ke semua admin dengan permission finance_admin atau super_admin
        $adminRecipients = User::query()
            ->whereHas('roles', fn ($q) => $q->where('name', 'admin'))
            ->whereHas('adminPermissions', fn ($q) => $q->whereIn('name', ['finance_admin', 'super_admin']))
            ->get();

        if ($adminRecipients->isNotEmpty() && $payoutRequest) {
            Notification::send($adminRecipients, new PayoutRequestedNotification($payoutRequest));
        }

        return back()->with('success', 'Request payout berhasil dikirim.');
    }
}
