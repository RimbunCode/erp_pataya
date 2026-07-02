<?php

namespace Database\Seeders;

use App\FormStatus;
use App\Models\Core\Preference;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Payment;
use App\Models\User\User;
use App\Notifications\PaymentApprovedNotification;
use App\Notifications\PaymentReceivedNotification;
use App\Notifications\PayoutRequestedNotification;
use App\Services\Finance\InstructorPayoutService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class EnrollmentPaymentSeeder extends Seeder {
    private const PAYMENT_METHODS = ['bank_transfer', 'virtual_account', 'qris'];

    public function run(): void {
        Preference::query()->firstOrCreate(
            ['key' => 'company_fee_percentage'],
            ['value' => 15],
        );
        Preference::query()->firstOrCreate(
            ['key' => 'payout_delay_days'],
            ['value' => 0],
        );

        $students = User::query()
            ->whereHas('roles', fn ($query) => $query->where('name', 'student'))
            ->get();

        $courses = Course::query()->orderBy('created_at')->get();

        $adminRecipients = User::query()
            ->whereHas('roles', fn ($query) => $query->where('name', 'admin'))
            ->whereHas('adminPermissions', fn ($query) => $query->whereIn('name', ['finance_admin', 'super_admin']))
            ->get();

        $verifier = $adminRecipients->first();

        if ($students->isEmpty() || $courses->isEmpty() || ! $verifier) {
            return;
        }

        $proofPath     = $this->seedProofImage();
        $payoutService = app(InstructorPayoutService::class);
        $courseIndex   = 0;

        foreach ($students as $studentIndex => $student) {
            $coursesForStudent = $courses->slice($courseIndex % $courses->count(), 2)->values();
            if ($coursesForStudent->count() < 2) {
                $coursesForStudent = $coursesForStudent->merge($courses->take(2 - $coursesForStudent->count()));
            }
            $courseIndex += 2;

            foreach ($coursesForStudent as $enrollmentIndex => $course) {
                $alreadyEnrolled = Enrollment::query()
                    ->where('user_id', $student->id)
                    ->where('course_id', $course->id)
                    ->exists();

                if ($alreadyEnrolled) {
                    continue;
                }

                $shouldApprove = $enrollmentIndex === 0;
                $payment       = null;

                DB::transaction(function () use ($student, $course, $proofPath, $shouldApprove, $verifier, $payoutService, $studentIndex, &$payment): void {
                    $payment = Payment::create([
                        'user_id'          => $student->id,
                        'course_id'        => $course->id,
                        'amount'           => $course->price,
                        'status'           => FormStatus::PENDING->value,
                        'payment_method'   => self::PAYMENT_METHODS[$studentIndex % \count(self::PAYMENT_METHODS)],
                        'notes'            => 'Pembayaran kursus melalui transfer bank.',
                        'rejection_reason' => null,
                        'proof_image'      => $proofPath,
                        'paid_at'          => now(),
                        'verified_at'      => null,
                        'verified_by'      => null,
                    ]);

                    $enrollment = Enrollment::create([
                        'user_id'    => $student->id,
                        'course_id'  => $course->id,
                        'payment_id' => $payment->id,
                        'status'     => FormStatus::PENDING->value,
                    ]);

                    if (! $shouldApprove) {
                        return;
                    }

                    $payment->update([
                        'status'      => FormStatus::APPROVED->value,
                        'verified_at' => now(),
                        'verified_by' => $verifier->id,
                    ]);

                    $enrollment->update([
                        'status'      => FormStatus::ACTIVE->value,
                        'enrolled_at' => now(),
                    ]);

                    $payment->refresh();
                    $payoutService->createEarningFromApprovedPayment($payment);
                });

                $payment->loadMissing(['user:id,name', 'course:id,title']);

                if ($shouldApprove) {
                    $payment->user?->notify(new PaymentApprovedNotification($payment));

                    continue;
                }

                if ($adminRecipients->isNotEmpty()) {
                    Notification::send($adminRecipients, new PaymentReceivedNotification($payment));
                }
            }
        }

        $this->seedPendingPayoutRequests($payoutService, $courses, $adminRecipients);
    }

    private function seedPendingPayoutRequests(InstructorPayoutService $payoutService, Collection $courses, Collection $adminRecipients): void {
        $instructors = User::query()
            ->whereIn('id', $courses->pluck('created_by')->unique())
            ->get();

        foreach ($instructors as $instructor) {
            $eligibleBalance = $payoutService->calculateEligibleBalance($instructor);

            if ($eligibleBalance <= 0) {
                continue;
            }

            $payoutRequest = $payoutService->createInstructorRequest(
                $instructor,
                $eligibleBalance,
                'Request payout otomatis dari data seed.',
            );

            if ($adminRecipients->isNotEmpty()) {
                Notification::send($adminRecipients, new PayoutRequestedNotification($payoutRequest));
            }
        }
    }

    private function seedProofImage(): string {
        $path = 'payment-proofs/' . Str::ulid() . '.png';

        if (! Storage::disk('local')->exists($path)) {
            $pixelPng = base64_decode(
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
            );
            Storage::disk('local')->put($path, $pixelPng);
        }

        return $path;
    }
}
