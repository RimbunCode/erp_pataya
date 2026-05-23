<?php

namespace App\Http\Controllers\Admin;

use App\FormStatus;
use App\Http\Controllers\Controller;
use App\Models\Payment;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class SystemFinanceController extends Controller {
    public function index(): Response {
        $payments = Payment::query()
            ->with([
                'user:id,name,email',
                'course:id,title,created_by',
                'course.creator:id,name',
                'course.categories:id,name',
            ])
            ->whereHas('enrollment')
            ->latest('created_at')
            ->get()
            ->map(fn (Payment $payment) => [
                'id'             => (string) $payment->id,
                'studentName'    => (string) ($payment->user?->name ?? '-'),
                'studentEmail'   => (string) ($payment->user?->email ?? '-'),
                'avatar'         => $this->initials((string) ($payment->user?->name ?? 'NA')),
                'courseName'     => (string) ($payment->course?->title ?? '-'),
                'courseCategory' => (string) ($payment->course?->categories?->first()?->name ?? '-'),
                'instructor'     => (string) ($payment->course?->creator?->name ?? '-'),
                'amount'         => (float) $payment->amount,
                'method'         => $this->mapMethod((string) $payment->payment_method),
                'bank'           => null,
                'refCode'        => strtoupper(substr((string) preg_replace('/[^A-Za-z0-9]/', '', (string) $payment->id), 0, 10)),
                'submittedAt'    => $payment->paid_at?->toIso8601String() ?? $payment->created_at->toIso8601String(),
                'status'         => $this->resolveStatus((string) $payment->status),
                'proofUrl'       => route('admin.finance.proof', ['payment' => $payment->id]),
                'proofFileName'  => $payment->proof_image ? basename($payment->proof_image) : null,
                'studentNote'    => $payment->notes,
                'rejectReason'   => $payment->rejection_reason,
            ])
            ->values();

        return Inertia::render('Admin/SystemFinance', [
            'payments' => $payments,
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

        DB::transaction(function () use ($payment) {
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

        DB::transaction(function () use ($payment, $validated) {
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
