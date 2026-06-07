<?php

namespace App\Http\Controllers\Admin;

use App\FormStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\MarkPayoutPaidRequest;
use App\Http\Requests\Admin\RejectPayoutRequestRequest;
use App\Http\Requests\Admin\UpdateCompanyFeeRequest;
use App\Http\Requests\Admin\UpdatePayoutDelayRequest;
use App\Models\Finance\InstructorPayoutRequest;
use App\Models\Payment;
use App\Services\Finance\InstructorPayoutService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class SystemFinanceController extends Controller {
    public function __construct(private InstructorPayoutService $instructorPayoutService) {}

    public function index(): Response {
        $payments = Payment::query()
            ->with([
                'user:id,name,email',
                'course:id,title,created_by',
                'course.creator:id,name',
                'course.categories:id,name',
                'verifier:id,name',
            ])
            ->whereNotNull('course_id')
            ->latest('created_at')
            ->get();

        $paymentsByContext = $payments->groupBy(
            fn (Payment $payment) => $this->paymentHistoryKey($payment),
        );

        $paymentsPayload = $payments
            ->map(function (Payment $payment) use ($paymentsByContext): array {
                $history = $this->mapPaymentRejectionHistory(
                    $payment,
                    $paymentsByContext->get($this->paymentHistoryKey($payment), collect()),
                );

                return [
                    'id'                    => (string) $payment->id,
                    'studentName'           => (string) ($payment->user?->name ?? '-'),
                    'studentEmail'          => (string) ($payment->user?->email ?? '-'),
                    'avatar'                => $this->initials((string) ($payment->user?->name ?? 'NA')),
                    'courseName'            => (string) ($payment->course?->title ?? '-'),
                    'courseCategory'        => (string) ($payment->course?->categories?->first()?->name ?? '-'),
                    'instructor'            => (string) ($payment->course?->creator?->name ?? '-'),
                    'amount'                => (float) $payment->amount,
                    'method'                => $this->mapMethod((string) $payment->payment_method),
                    'bank'                  => null,
                    'refCode'               => strtoupper(substr((string) preg_replace('/[^A-Za-z0-9]/', '', (string) $payment->id), 0, 10)),
                    'submittedAt'           => $payment->paid_at?->toIso8601String() ?? $payment->created_at->toIso8601String(),
                    'status'                => $this->resolveStatus((string) $payment->status),
                    'proofUrl'              => route('admin.finance.proof', ['payment' => $payment->id]),
                    'proofFileName'         => $payment->proof_image ? basename($payment->proof_image) : null,
                    'studentNote'           => $payment->notes,
                    'rejectReason'          => $payment->rejection_reason,
                    'rejectionHistory'      => $history,
                    'rejectionHistoryCount' => $history->count(),
                ];
            })
            ->values();

        $payoutRequests = InstructorPayoutRequest::query()
            ->with([
                'instructor',
                'requestedBy',
                'approvedBy',
                'paidBy',
            ])
            ->latest('created_at')
            ->get();

        $payoutRequestsPayload = $payoutRequests
            ->map(function (InstructorPayoutRequest $payoutRequest): array {
                return [
                    'id'                => (string) $payoutRequest->id,
                    'instructorId'      => (string) ($payoutRequest->instructor_id ?? ''),
                    'instructorName'    => (string) ($payoutRequest->instructor?->name ?? '-'),
                    'instructorEmail'   => (string) ($payoutRequest->instructor?->email ?? '-'),
                    'status'            => (string) $payoutRequest->status,
                    'source'            => (string) $payoutRequest->source,
                    'requestedAmount'   => (float) $payoutRequest->requested_amount,
                    'approvedAmount'    => (float) ($payoutRequest->approved_amount ?? 0),
                    'requestedAt'       => $payoutRequest->requested_at?->toIso8601String() ?? $payoutRequest->created_at?->toIso8601String(),
                    'approvedAt'        => $payoutRequest->approved_at?->toIso8601String(),
                    'paidAt'            => $payoutRequest->paid_at?->toIso8601String(),
                    'requestedBy'       => $payoutRequest->requestedBy?->name,
                    'approvedBy'        => $payoutRequest->approvedBy?->name,
                    'paidBy'            => $payoutRequest->paidBy?->name,
                    'note'              => $payoutRequest->note,
                    'rejectionReason'   => $payoutRequest->rejection_reason,
                    'transferReference' => $payoutRequest->transfer_reference,
                    'proofUrl'          => $payoutRequest->proof_file_path
                        ? route('admin.finance.payouts.proof', ['payoutRequest' => $payoutRequest->id])
                        : null,
                ];
            })
            ->values();

        $since = Carbon::now()->subYear();

        $allPaymentsForChart = Payment::query()
            ->whereNotNull('course_id')
            ->where('verified_at', '>=', $since)
            ->get(['amount', 'status', 'verified_at', 'created_at']);

        $revenueTimeSeries = $allPaymentsForChart
            ->filter(fn (Payment $p) => $this->resolveStatus((string) $p->status) === FormStatus::APPROVED->value && $p->verified_at)
            ->map(fn (Payment $p) => [
                'date'   => $p->verified_at->toDateString(),
                'amount' => (float) $p->amount,
            ])->values()->all();

        $paymentStatusTimeSeries = $allPaymentsForChart
            ->filter(fn (Payment $p) => $p->verified_at || $p->created_at)
            ->map(function (Payment $p): array {
                $resolvedStatus = $this->resolveStatus((string) $p->status);
                $date = ($p->verified_at ?? $p->created_at)->toDateString();

                return [
                    'date'     => $date,
                    'approved' => $resolvedStatus === FormStatus::APPROVED->value ? 1 : 0,
                    'pending'  => $resolvedStatus === FormStatus::PENDING->value ? 1 : 0,
                    'rejected' => $resolvedStatus === FormStatus::REJECTED->value ? 1 : 0,
                ];
            })->values()->all();

        return Inertia::render('Admin/SystemFinance', [
            'payments'              => $paymentsPayload,
            'payoutRequests'        => $payoutRequestsPayload,
            'payoutDelayDays'       => $this->instructorPayoutService->resolvePayoutDelayDays(),
            'companyFeePercentage'  => $this->instructorPayoutService->resolveCompanyFeePercentage(),
            'payoutStats'           => [
                'eligibleBalanceTotal' => $this->instructorPayoutService->calculateGlobalEligibleBalance(),
                'pendingRequestTotal'  => (float) $payoutRequests
                    ->whereIn('status', ['draft', 'pending', 'approved'])
                    ->sum('requested_amount'),
                'paidTotal' => (float) $payoutRequests
                    ->where('status', FormStatus::PAID->value)
                    ->sum('approved_amount'),
            ],
            'revenueTimeSeries'        => $revenueTimeSeries,
            'paymentStatusTimeSeries'  => $paymentStatusTimeSeries,
        ]);
    }

    public function approve(Payment $payment): RedirectResponse {
        if ($this->resolveStatus((string) $payment->status) !== FormStatus::PENDING->value) {
            throw ValidationException::withMessages([
                'payment' => 'Pembayaran ini sudah diproses.',
            ]);
        }

        $payment->loadMissing('enrollment');
        if ($payment->enrollment === null) {
            throw ValidationException::withMessages([
                'payment' => 'Enrollment untuk pembayaran ini tidak ditemukan.',
            ]);
        }

        DB::transaction(function () use ($payment): void {
            $payment->update([
                'status'           => FormStatus::APPROVED->value,
                'verified_at'      => now(),
                'verified_by'      => auth()->id(),
                'rejection_reason' => null,
            ]);

            $payment->enrollment->update([
                'status'      => FormStatus::ACTIVE->value,
                'enrolled_at' => now(),
            ]);

            $payment->refresh();
            $this->instructorPayoutService->createEarningFromApprovedPayment($payment);
        });

        return back()->with('success', 'Pembayaran berhasil disetujui.');
    }

    public function reject(Request $request, Payment $payment): RedirectResponse {
        if ($this->resolveStatus((string) $payment->status) !== FormStatus::PENDING->value) {
            throw ValidationException::withMessages([
                'payment' => 'Pembayaran ini sudah diproses.',
            ]);
        }

        $validated = $request->validate([
            'reason' => 'required|string|max:1000',
        ]);

        $payment->loadMissing('enrollment');
        if ($payment->enrollment === null) {
            throw ValidationException::withMessages([
                'payment' => 'Enrollment untuk pembayaran ini tidak ditemukan.',
            ]);
        }

        DB::transaction(function () use ($payment, $validated): void {
            $payment->update([
                'status'           => FormStatus::REJECTED->value,
                'verified_at'      => now(),
                'verified_by'      => auth()->id(),
                'rejection_reason' => $validated['reason'],
            ]);

            $payment->enrollment->update([
                'status' => FormStatus::REJECTED->value,
            ]);
        });

        return back()->with('success', 'Pembayaran berhasil ditolak.');
    }

    public function proof(Payment $payment): StreamedResponse {
        if (empty($payment->proof_image) || ! Storage::disk('local')->exists($payment->proof_image)) {
            abort(404);
        }

        return Storage::disk('local')->response($payment->proof_image, basename($payment->proof_image));
    }

    public function updatePayoutDelay(UpdatePayoutDelayRequest $request): RedirectResponse {
        $validated = $request->validated();
        $this->instructorPayoutService->updatePayoutDelayDays((int) $validated['delay_days']);

        return back()->with('success', 'Pengaturan delay payout berhasil diperbarui.');
    }

    public function updateCompanyFee(UpdateCompanyFeeRequest $request): RedirectResponse {
        $validated = $request->validated();
        $this->instructorPayoutService->updateCompanyFeePercentage((float) $validated['company_fee_percentage']);

        return back()->with('success', 'Pengaturan fee perusahaan berhasil diperbarui.');
    }

    public function runPayoutBatch(Request $request): RedirectResponse {
        $actor = $request->user();
        if (! $actor) {
            abort(401);
        }

        $result = $this->instructorPayoutService->runBatchDraftPayouts($actor);

        return back()->with('success', "Batch payout selesai. Draft dibuat: {$result['created']}, dilewati: {$result['skipped']}.");
    }

    public function approvePayoutRequest(InstructorPayoutRequest $payoutRequest, Request $request): RedirectResponse {
        $actor = $request->user();
        if (! $actor) {
            abort(401);
        }

        $this->instructorPayoutService->approvePayoutRequest($payoutRequest, $actor);

        return back()->with('success', 'Request payout berhasil disetujui.');
    }

    public function rejectPayoutRequest(RejectPayoutRequestRequest $request, InstructorPayoutRequest $payoutRequest): RedirectResponse {
        $actor = $request->user();
        if (! $actor) {
            abort(401);
        }

        $validated = $request->validated();
        $this->instructorPayoutService->rejectPayoutRequest($payoutRequest, $actor, (string) $validated['reason']);

        return back()->with('success', 'Request payout berhasil ditolak.');
    }

    public function markPayoutRequestAsPaid(MarkPayoutPaidRequest $request, InstructorPayoutRequest $payoutRequest): RedirectResponse {
        $actor = $request->user();
        if (! $actor) {
            abort(401);
        }

        $validated = $request->validated();
        $proofPath = $request->file('proof_file')->store('payout-proofs', 'local');

        try {
            $this->instructorPayoutService->markPayoutAsPaid(
                $payoutRequest,
                $actor,
                (string) $validated['transfer_reference'],
                $proofPath,
            );
        } catch (\Throwable $exception) {
            Storage::disk('local')->delete($proofPath);
            throw $exception;
        }

        return back()->with('success', 'Payout berhasil ditandai paid.');
    }

    public function payoutProof(InstructorPayoutRequest $payoutRequest): StreamedResponse {
        if (empty($payoutRequest->proof_file_path) || ! Storage::disk('local')->exists($payoutRequest->proof_file_path)) {
            abort(404);
        }

        return Storage::disk('local')->response($payoutRequest->proof_file_path, basename($payoutRequest->proof_file_path));
    }

    private function paymentHistoryKey(Payment $payment): string {
        return "{$payment->user_id}|{$payment->course_id}";
    }

    /**
     * @param  Collection<int, Payment>  $relatedPayments
     * @return Collection<int, array{id: string, reason: string, reviewedBy: string, reviewedAt: ?string, submittedAt: ?string}>
     */
    private function mapPaymentRejectionHistory(Payment $payment, Collection $relatedPayments): Collection {
        return $relatedPayments
            ->filter(function (Payment $historyPayment) use ($payment): bool {
                return (string) $historyPayment->id !== (string) $payment->id
                    && $this->resolveStatus((string) $historyPayment->status) === FormStatus::REJECTED->value
                    && filled($historyPayment->rejection_reason);
            })
            ->sortByDesc(fn (Payment $historyPayment) => $historyPayment->verified_at ?? $historyPayment->updated_at ?? $historyPayment->created_at)
            ->map(function (Payment $historyPayment): array {
                $reviewedAt = $historyPayment->verified_at ?? $historyPayment->updated_at ?? $historyPayment->created_at;

                return [
                    'id'          => (string) $historyPayment->id,
                    'reason'      => (string) $historyPayment->rejection_reason,
                    'reviewedBy'  => (string) ($historyPayment->verifier?->name ?? '-'),
                    'reviewedAt'  => $reviewedAt?->toIso8601String(),
                    'submittedAt' => $historyPayment->paid_at?->toIso8601String()
                        ?? $historyPayment->created_at?->toIso8601String(),
                ];
            })
            ->values();
    }

    private function resolveStatus(string $status): string {
        return match ($status) {
            FormStatus::PAID->value => FormStatus::APPROVED->value,
            default                 => $status,
        };
    }

    private function mapMethod(string $method): string {
        return match ($method) {
            'tf'    => 'Bank Transfer',
            'va'    => 'Virtual Account',
            'qris'  => 'QRIS',
            default => Str::headline($method),
        };
    }

    private function initials(string $name): string {
        $parts = preg_split('/\s+/', trim($name)) ?: [];
        $parts = array_values(array_filter($parts));

        if (count($parts) === 0) {
            return 'NA';
        }

        $first  = mb_substr($parts[0], 0, 1);
        $second = count($parts) > 1 ? mb_substr($parts[1], 0, 1) : '';

        return mb_strtoupper($first . $second);
    }
}
