<?php

namespace App\Http\Controllers\Student;

use App\FormStatus;
use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Payment;
use DB;
use Illuminate\Http\Request;
use Storage;

class EnrollmentController extends Controller {
    public function store(Request $request) {
        $request->validate([
            'course_ids'     => 'required|array',
            'course_ids.*'   => 'exists:courses,id',
            'payment_proof'  => 'required|file|mimes:jpg,jpeg,png,pdf|max:2048',
            'payment_method' => 'required|string',  // ← tambah
            'notes'          => 'nullable|string|max:1000',
        ]);

        $path = $request->file('payment_proof')
            ->store('payment-proofs', 'local');

        try {
            DB::transaction(function () use ($request, $path) {
                foreach ($request->course_ids as $courseId) {
                    $course = Course::findOrFail($courseId);

                    $payment = Payment::create([
                        'user_id'        => auth()->id(),
                        'course_id'      => $courseId,
                        'amount'         => $course->price,
                        'status'         => FormStatus::PAID->value,
                        'payment_method' => $request->payment_method,  // ← tambah
                        'notes'          => $request->notes,
                        'proof_image'    => $path,
                        'paid_at'        => now(),
                        'verified_at'    => now(),
                    ]);

                    Enrollment::firstOrCreate([
                        'user_id'   => auth()->id(),
                        'course_id' => $courseId,
                    ], [
                        'payment_id' => $payment->id,
                    ]);
                }
            });
        } catch (\Exception $e) {
            Storage::disk('local')->delete($path);
            throw $e;
        }

        return back()->with('success', 'Pembayaran berhasil disubmit!');
    }
}
