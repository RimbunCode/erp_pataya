<?php

namespace App\Http\Controllers\Admin;

use App\FormStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\RejectCoursePublishRequestRequest;
use App\Models\CoursePublishRequest;
use App\Notifications\CourseApprovalRespondedNotification;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class CourseApprovalController extends Controller {
    public function index(): Response {
        $requests = CoursePublishRequest::query()
            ->with([
                'course:id,title,description,thumbnail,total_hours,total_sessions,certificate_type,level,created_by',
                'course.categories:id,name',
                'course.creator:id,name',
                'requester:id,name',
                'reviewer:id,name',
            ])
            ->latest('created_at')
            ->get();

        $requestsByCourse = $requests->groupBy(
            fn (CoursePublishRequest $request) => $this->courseHistoryKey($request),
        );

        $requests = $requests
            ->map(function (CoursePublishRequest $request) use ($requestsByCourse): array {
                $course              = $request->course;
                $submittedPrice      = (float) $request->submitted_price;
                $submittedDiscount   = (float) $request->submitted_discount;
                $discountType        = (string) $request->submitted_discount_type;
                $submittedFinalPrice = $discountType === 'percentage'
                    ? max(0, $submittedPrice - (($submittedPrice * $submittedDiscount) / 100))
                    : max(0, $submittedPrice - $submittedDiscount);
                $history = $this->mapCourseRejectionHistory(
                    $request,
                    $requestsByCourse->get($this->courseHistoryKey($request), collect()),
                );

                return [
                    'id'                    => (string) $request->id,
                    'courseId'              => (string) ($request->course_id ?? ''),
                    'status'                => (string) $request->status,
                    'submittedAt'           => $request->created_at?->toIso8601String(),
                    'reviewedAt'            => $request->reviewed_at?->toIso8601String(),
                    'rejectReason'          => $request->rejection_reason,
                    'reviewedBy'            => $request->reviewer?->name,
                    'instructor'            => (string) ($course?->creator?->name ?? $request->requester?->name ?? '-'),
                    'title'                 => (string) ($course?->title ?? '-'),
                    'description'           => (string) ($course?->description ?? '-'),
                    'category'              => (string) ($course?->categories?->first()?->name ?? '-'),
                    'thumbnail'             => (string) ($course?->thumbnail ?? ''),
                    'totalHours'            => (int) ($course?->total_hours ?? 0),
                    'totalSessions'         => (int) ($course?->total_sessions ?? 0),
                    'certificateType'       => $course?->certificate_type,
                    'level'                 => $course?->level,
                    'submittedPrice'        => $submittedPrice,
                    'submittedDiscount'     => $submittedDiscount,
                    'submittedDiscountType' => $discountType,
                    'submittedFinalPrice'   => $submittedFinalPrice,
                    'rejectionHistory'      => $history,
                    'rejectionHistoryCount' => $history->count(),
                ];
            })
            ->values();

        return Inertia::render('Admin/Approvals', [
            'requests' => $requests,
        ]);
    }

    public function approve(CoursePublishRequest $coursePublishRequest): RedirectResponse {
        $this->ensurePendingRequest($coursePublishRequest);

        DB::transaction(function () use ($coursePublishRequest): void {
            $coursePublishRequest->update([
                'status'           => FormStatus::APPROVED->value,
                'reviewed_by'      => auth()->id(),
                'reviewed_at'      => now(),
                'rejection_reason' => null,
            ]);

            $coursePublishRequest->course()->update([
                'price'         => $coursePublishRequest->submitted_price,
                'discount'      => $coursePublishRequest->submitted_discount,
                'discount_type' => $coursePublishRequest->submitted_discount_type,
                'is_published'  => true,
            ]);
        });

        $coursePublishRequest->loadMissing(['course', 'requester']);
        if ($coursePublishRequest->requester) {
            $coursePublishRequest->requester->notify(new CourseApprovalRespondedNotification($coursePublishRequest));
        }

        return back()->with('success', 'Permintaan publish course disetujui.');
    }

    public function reject(
        RejectCoursePublishRequestRequest $request,
        CoursePublishRequest $coursePublishRequest,
    ): RedirectResponse {
        $this->ensurePendingRequest($coursePublishRequest);
        $validated = $request->validated();

        DB::transaction(function () use ($coursePublishRequest, $validated): void {
            $coursePublishRequest->update([
                'status'           => FormStatus::REJECTED->value,
                'reviewed_by'      => auth()->id(),
                'reviewed_at'      => now(),
                'rejection_reason' => $validated['reason'],
            ]);
        });

        $coursePublishRequest->loadMissing(['course', 'requester']);
        if ($coursePublishRequest->requester) {
            $coursePublishRequest->requester->notify(new CourseApprovalRespondedNotification($coursePublishRequest));
        }

        return back()->with('success', 'Permintaan publish course ditolak.');
    }

    private function courseHistoryKey(CoursePublishRequest $coursePublishRequest): string {
        return (string) ($coursePublishRequest->course_id ?? '');
    }

    /**
     * @param  Collection<int, CoursePublishRequest>  $courseRequests
     * @return Collection<int, array{id: string, reason: string, reviewedBy: string, reviewedAt: ?string, submittedAt: ?string}>
     */
    private function mapCourseRejectionHistory(
        CoursePublishRequest $coursePublishRequest,
        Collection $courseRequests,
    ): Collection {
        return $courseRequests
            ->filter(function (CoursePublishRequest $historyRequest) use ($coursePublishRequest): bool {
                return (string) $historyRequest->id !== (string) $coursePublishRequest->id
                    && (string) $historyRequest->status === FormStatus::REJECTED->value
                    && filled($historyRequest->rejection_reason);
            })
            ->sortByDesc(fn (CoursePublishRequest $historyRequest) => $historyRequest->reviewed_at ?? $historyRequest->updated_at ?? $historyRequest->created_at)
            ->map(function (CoursePublishRequest $historyRequest): array {
                $reviewedAt = $historyRequest->reviewed_at ?? $historyRequest->updated_at ?? $historyRequest->created_at;

                return [
                    'id'          => (string) $historyRequest->id,
                    'reason'      => (string) $historyRequest->rejection_reason,
                    'reviewedBy'  => (string) ($historyRequest->reviewer?->name ?? '-'),
                    'reviewedAt'  => $reviewedAt?->toIso8601String(),
                    'submittedAt' => $historyRequest->created_at?->toIso8601String(),
                ];
            })
            ->values();
    }

    private function ensurePendingRequest(CoursePublishRequest $coursePublishRequest): void {
        if ($coursePublishRequest->status !== FormStatus::PENDING->value) {
            throw ValidationException::withMessages([
                'request' => 'Request ini tidak dapat diproses.',
            ]);
        }
    }
}
