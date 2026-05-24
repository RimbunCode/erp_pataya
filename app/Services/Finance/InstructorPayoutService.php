<?php

namespace App\Services\Finance;

use App\FormStatus;
use App\Models\Core\Preference;
use App\Models\Finance\InstructorEarning;
use App\Models\Finance\InstructorPayoutRequest;
use App\Models\Finance\InstructorPayoutRequestItem;
use App\Models\Payment;
use App\Models\User\User;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class InstructorPayoutService {
    /**
     * @var array<int, string>
     */
    private const RESERVED_STATUSES = ['draft', 'pending', 'approved', 'paid'];

    private const PAYOUT_DELAY_DAYS_KEY      = 'payout_delay_days';
    private const COMPANY_FEE_PERCENTAGE_KEY = 'company_fee_percentage';

    public function resolvePayoutDelayDays(): int {
        $rawValue = Preference::query()->where('key', self::PAYOUT_DELAY_DAYS_KEY)->value('value');
        $days     = is_numeric($rawValue) ? (int) $rawValue : 0;

        return max(0, $days);
    }

    public function updatePayoutDelayDays(int $delayDays): void {
        Preference::query()->updateOrCreate(
            ['key' => self::PAYOUT_DELAY_DAYS_KEY],
            ['value' => max(0, $delayDays)],
        );
    }

    public function resolveCompanyFeePercentage(): float {
        $rawValue = Preference::query()->where('key', self::COMPANY_FEE_PERCENTAGE_KEY)->value('value');
        $value    = is_numeric($rawValue) ? (float) $rawValue : 0.0;

        return $this->normalizeCompanyFeePercentage($value);
    }

    public function updateCompanyFeePercentage(float $feePercentage): void {
        Preference::query()->updateOrCreate(
            ['key' => self::COMPANY_FEE_PERCENTAGE_KEY],
            ['value' => $this->normalizeCompanyFeePercentage($feePercentage)],
        );
    }

    public function createEarningFromApprovedPayment(Payment $payment): InstructorEarning {
        $payment->loadMissing('course.creator');

        $instructor = $payment->course?->creator;
        if (! $instructor) {
            throw ValidationException::withMessages([
                'payment' => 'Instructor untuk payment ini tidak ditemukan.',
            ]);
        }

        $grossAmount          = (float) $payment->amount;
        $companyFeePercentage = $this->resolveCompanyFeePercentage();
        $rawCompanyAmount     = ($grossAmount * $companyFeePercentage) / 100;
        $companyAmount        = min($grossAmount, max(0.0, round($rawCompanyAmount, 2)));
        $instructorAmount     = max(0.0, round($grossAmount - $companyAmount, 2));
        $approvedAt           = $payment->verified_at ?? now();
        $availableAt          = Carbon::instance($approvedAt)->copy()->addDays($this->resolvePayoutDelayDays());

        /** @var InstructorEarning $earning */
        $earning = InstructorEarning::query()->updateOrCreate(
            [
                'payment_id' => $payment->id,
            ],
            [
                'instructor_id'     => $instructor->id,
                'course_id'         => $payment->course_id,
                'gross_amount'      => $grossAmount,
                'company_amount'    => $companyAmount,
                'instructor_amount' => $instructorAmount,
                'available_at'      => $availableAt,
                'released_at'       => null,
            ],
        );

        return $earning;
    }

    public function calculateEligibleBalance(User $instructor): float {
        return $this->queryEligibleEarnings($instructor->id)
            ->sum(fn (InstructorEarning $earning) => (float) $earning->getAttribute('available_amount'));
    }

    public function calculateGlobalEligibleBalance(): float {
        return $this->queryEligibleEarningSnapshots(null)
            ->sum(fn (array $snapshot) => (float) $snapshot['available_amount']);
    }

    /**
     * @return Collection<int, InstructorEarning>
     */
    public function queryEligibleEarnings(string $instructorId): Collection {
        return $this->queryEligibleEarningSnapshots($instructorId)
            ->map(function (array $snapshot): InstructorEarning {
                /** @var InstructorEarning $earning */
                $earning = $snapshot['earning'];
                $earning->setAttribute('available_amount', (float) $snapshot['available_amount']);

                return $earning;
            })
            ->values();
    }

    public function createInstructorRequest(User $instructor, float $requestedAmount, ?string $note = null): InstructorPayoutRequest {
        $eligibleEarnings = $this->queryEligibleEarnings($instructor->id);
        $eligibleBalance  = $eligibleEarnings->sum(fn (InstructorEarning $earning) => (float) $earning->getAttribute('available_amount'));

        if ($requestedAmount <= 0) {
            throw ValidationException::withMessages([
                'requested_amount' => 'Nominal request payout harus lebih besar dari nol.',
            ]);
        }

        if ($requestedAmount > $eligibleBalance) {
            throw ValidationException::withMessages([
                'requested_amount' => 'Nominal request melebihi saldo yang tersedia.',
            ]);
        }

        return DB::transaction(function () use ($eligibleEarnings, $eligibleBalance, $instructor, $note, $requestedAmount): InstructorPayoutRequest {
            $payoutRequest = InstructorPayoutRequest::query()->create([
                'instructor_id'    => $instructor->id,
                'requested_by'     => $instructor->id,
                'requested_amount' => $requestedAmount,
                'status'           => 'pending',
                'source'           => 'manual',
                'note'             => $note,
                'requested_at'     => now(),
            ]);

            $remainingAmount = min($requestedAmount, $eligibleBalance);
            foreach ($eligibleEarnings as $earning) {
                if ($remainingAmount <= 0) {
                    break;
                }

                $earningAvailableAmount = (float) $earning->getAttribute('available_amount');
                if ($earningAvailableAmount <= 0) {
                    continue;
                }

                $itemAmount = min($earningAvailableAmount, $remainingAmount);

                InstructorPayoutRequestItem::query()->create([
                    'payout_request_id' => $payoutRequest->id,
                    'earning_id'        => $earning->id,
                    'amount'            => $itemAmount,
                ]);

                $remainingAmount -= $itemAmount;
            }

            return $payoutRequest->load('items');
        });
    }

    /**
     * @return array{created: int, skipped: int}
     */
    public function runBatchDraftPayouts(User $actor): array {
        $created = 0;
        $skipped = 0;

        $instructorIds = $this->resolveBatchCandidateInstructorIds();

        foreach ($instructorIds as $instructorId) {
            $eligibleEarnings = $this->queryEligibleEarnings((string) $instructorId);
            $amount           = $eligibleEarnings->sum(fn (InstructorEarning $earning) => (float) $earning->getAttribute('available_amount'));

            if ($amount <= 0) {
                $skipped++;

                continue;
            }

            DB::transaction(function () use (&$created, $actor, $amount, $eligibleEarnings, $instructorId): void {
                $draft = InstructorPayoutRequest::query()->create([
                    'instructor_id'    => $instructorId,
                    'requested_by'     => $actor->id,
                    'requested_amount' => $amount,
                    'status'           => 'draft',
                    'source'           => 'batch',
                    'note'             => 'Generated by payout batch.',
                    'requested_at'     => now(),
                ]);

                foreach ($eligibleEarnings as $earning) {
                    $availableAmount = (float) $earning->getAttribute('available_amount');
                    if ($availableAmount <= 0) {
                        continue;
                    }

                    InstructorPayoutRequestItem::query()->create([
                        'payout_request_id' => $draft->id,
                        'earning_id'        => $earning->id,
                        'amount'            => $availableAmount,
                    ]);
                }

                $created++;
            });
        }

        return ['created' => $created, 'skipped' => $skipped];
    }

    /**
     * @return array{creatable: int, skipped: int, totalAmount: float}
     */
    public function previewBatchDraftPayouts(): array {
        $creatable   = 0;
        $skipped     = 0;
        $totalAmount = 0.0;

        $instructorIds = $this->resolveBatchCandidateInstructorIds();
        foreach ($instructorIds as $instructorId) {
            $eligibleEarnings = $this->queryEligibleEarnings((string) $instructorId);
            $amount           = $eligibleEarnings->sum(fn (InstructorEarning $earning) => (float) $earning->getAttribute('available_amount'));

            if ($amount <= 0) {
                $skipped++;

                continue;
            }

            $creatable++;
            $totalAmount += $amount;
        }

        return [
            'creatable'   => $creatable,
            'skipped'     => $skipped,
            'totalAmount' => $totalAmount,
        ];
    }

    public function approvePayoutRequest(InstructorPayoutRequest $payoutRequest, User $reviewer): InstructorPayoutRequest {
        if (! \in_array($payoutRequest->status, ['draft', 'pending'], true)) {
            throw ValidationException::withMessages([
                'payout' => 'Request payout ini tidak dapat disetujui.',
            ]);
        }

        $approvedAmount = max(0, (float) $payoutRequest->requested_amount);

        $payoutRequest->update([
            'status'           => FormStatus::APPROVED->value,
            'approved_by'      => $reviewer->id,
            'approved_at'      => now(),
            'approved_amount'  => $approvedAmount,
            'rejection_reason' => null,
        ]);

        return $payoutRequest->refresh();
    }

    public function rejectPayoutRequest(InstructorPayoutRequest $payoutRequest, User $reviewer, string $reason): InstructorPayoutRequest {
        if (! \in_array($payoutRequest->status, ['draft', 'pending', 'approved'], true)) {
            throw ValidationException::withMessages([
                'payout' => 'Request payout ini tidak dapat ditolak.',
            ]);
        }

        $payoutRequest->update([
            'status'           => FormStatus::REJECTED->value,
            'approved_by'      => $reviewer->id,
            'approved_at'      => now(),
            'rejection_reason' => $reason,
        ]);

        return $payoutRequest->refresh();
    }

    public function markPayoutAsPaid(
        InstructorPayoutRequest $payoutRequest,
        User $actor,
        string $transferReference,
        string $proofFilePath,
    ): InstructorPayoutRequest {
        if ((string) $payoutRequest->status !== FormStatus::APPROVED->value) {
            throw ValidationException::withMessages([
                'payout' => 'Hanya request payout yang sudah approved yang dapat ditandai paid.',
            ]);
        }

        DB::transaction(function () use ($actor, $payoutRequest, $proofFilePath, $transferReference): void {
            $payoutRequest->update([
                'status'             => FormStatus::PAID->value,
                'paid_by'            => $actor->id,
                'paid_at'            => now(),
                'transfer_reference' => $transferReference,
                'proof_file_path'    => $proofFilePath,
            ]);

            $earningIds = $payoutRequest->items()
                ->pluck('earning_id')
                ->values()
                ->all();

            if (\count($earningIds) > 0) {
                $paidAmountsPerEarning = InstructorPayoutRequestItem::query()
                    ->join('instructor_payout_requests', 'instructor_payout_requests.id', '=', 'instructor_payout_request_items.payout_request_id')
                    ->whereIn('instructor_payout_request_items.earning_id', $earningIds)
                    ->where('instructor_payout_requests.status', FormStatus::PAID->value)
                    ->whereNull('instructor_payout_requests.deleted_at')
                    ->whereNull('instructor_payout_request_items.deleted_at')
                    ->groupBy('instructor_payout_request_items.earning_id')
                    ->select(
                        'instructor_payout_request_items.earning_id',
                        DB::raw('SUM(instructor_payout_request_items.amount) as paid_amount'),
                    )
                    ->pluck('paid_amount', 'instructor_payout_request_items.earning_id');

                $earnings = InstructorEarning::query()->whereIn('id', $earningIds)->get();
                foreach ($earnings as $earning) {
                    $paidAmount      = (float) ($paidAmountsPerEarning[$earning->id] ?? 0);
                    $isFullyReleased = $paidAmount >= (float) $earning->instructor_amount;

                    $earning->update([
                        'released_at' => $isFullyReleased ? now() : null,
                    ]);
                }
            }
        });

        return $payoutRequest->refresh();
    }

    /**
     * @return Collection<int, array{earning: InstructorEarning, available_amount: float}>
     */
    private function queryEligibleEarningSnapshots(?string $instructorId): Collection {
        $reservedAmountsSubquery = InstructorPayoutRequestItem::query()
            ->join('instructor_payout_requests', 'instructor_payout_requests.id', '=', 'instructor_payout_request_items.payout_request_id')
            ->whereIn('instructor_payout_requests.status', self::RESERVED_STATUSES)
            ->whereNull('instructor_payout_requests.deleted_at')
            ->whereNull('instructor_payout_request_items.deleted_at')
            ->groupBy('instructor_payout_request_items.earning_id')
            ->select(
                'instructor_payout_request_items.earning_id',
                DB::raw('SUM(instructor_payout_request_items.amount) as reserved_amount'),
            );

        $earnings = InstructorEarning::query()
            ->leftJoinSub($reservedAmountsSubquery, 'reserved_amounts', function ($join): void {
                $join->on('reserved_amounts.earning_id', '=', 'instructor_earnings.id');
            })
            ->whereNotNull('instructor_earnings.available_at')
            ->where('instructor_earnings.available_at', '<=', now())
            ->whereNull('instructor_earnings.released_at')
            ->when(
                filled($instructorId),
                fn ($query) => $query->where('instructor_earnings.instructor_id', $instructorId),
            )
            ->select('instructor_earnings.*', DB::raw('COALESCE(reserved_amounts.reserved_amount, 0) as reserved_amount'))
            ->get();

        return $earnings
            ->map(function (InstructorEarning $earning): array {
                $reservedAmount  = (float) ($earning->getAttribute('reserved_amount') ?? 0);
                $availableAmount = max(0, (float) $earning->instructor_amount - $reservedAmount);

                return [
                    'earning'          => $earning,
                    'available_amount' => $availableAmount,
                ];
            })
            ->filter(fn (array $snapshot): bool => $snapshot['available_amount'] > 0)
            ->values();
    }

    /**
     * @return Collection<int, string>
     */
    private function resolveBatchCandidateInstructorIds(): Collection {
        return InstructorEarning::query()
            ->whereNotNull('available_at')
            ->where('available_at', '<=', now())
            ->pluck('instructor_id')
            ->unique()
            ->values();
    }

    private function normalizeCompanyFeePercentage(float $value): float {
        return round(min(100.0, max(0.0, $value)), 2);
    }
}
