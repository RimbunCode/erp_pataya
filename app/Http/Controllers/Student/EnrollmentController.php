<?php

namespace App\Http\Controllers\Student;

use App\FormStatus;
use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class EnrollmentController extends Controller {
    public function store(Request $request) {
        $request->validate([
            'course_ids'     => 'nullable|array',
            'course_ids.*'   => 'exists:courses,id',
            'course_id'      => 'nullable|exists:courses,id',
            'payment_proof'  => 'required|file|mimes:jpg,jpeg,png,pdf|max:2048',
            'payment_method' => 'required|string|max:100',
            'notes'          => 'nullable|string|max:1000',
            'note'           => 'nullable|string|max:1000',
        ]);

        $courseIds = collect($request->input('course_ids', []));
        if ($request->filled('course_id')) {
            $courseIds->push($request->string('course_id')->toString());
        }

        $courseIds = $courseIds->filter()->unique()->values();

        if ($courseIds->isEmpty()) {
            throw ValidationException::withMessages([
                'course_ids' => 'Minimal satu course harus dipilih.',
            ]);
        }

        $path  = $request->file('payment_proof')->store('payment-proofs', 'local');
        $notes = $request->input('notes', $request->input('note'));

        try {
            DB::transaction(function () use ($courseIds, $notes, $path, $request) {
                foreach ($courseIds as $courseId) {
                    $course = Course::findOrFail($courseId);
                    $userId = (string) auth()->id();

                    $enrollment = Enrollment::query()
                        ->where('user_id', $userId)
                        ->where('course_id', $courseId)
                        ->first();

                    if (
                        $enrollment !== null
                        && \in_array(
                            (string) $enrollment->status,
                            [FormStatus::ACTIVE->value, FormStatus::PENDING->value],
                            true,
                        )
                    ) {
                        throw ValidationException::withMessages([
                            'course_ids' => "Course {$course->title} sudah terdaftar atau sedang menunggu verifikasi.",
                        ]);
                    }

                    $payment = Payment::create([
                        'user_id'          => $userId,
                        'course_id'        => $courseId,
                        'amount'           => $course->price,
                        'status'           => FormStatus::PENDING->value,
                        'payment_method'   => $request->payment_method,
                        'notes'            => $notes,
                        'rejection_reason' => null,
                        'proof_image'      => $path,
                        'paid_at'          => now(),
                        'verified_at'      => null,
                        'verified_by'      => null,
                    ]);

                    if ($enrollment === null) {
                        Enrollment::create([
                            'user_id'    => $userId,
                            'course_id'  => $courseId,
                            'payment_id' => $payment->id,
                            'status'     => FormStatus::PENDING->value,
                        ]);

                        continue;
                    }

                    $enrollment->update([
                        'payment_id' => $payment->id,
                        'status'     => FormStatus::PENDING->value,
                    ]);
                }
            });
        } catch (\Throwable $e) {
            Storage::disk('local')->delete($path);
            throw $e;
        }

        return back()->with('success', 'Pembayaran berhasil dikirim. Menunggu verifikasi admin.');
    }
}
