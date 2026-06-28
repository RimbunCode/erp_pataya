<?php

namespace App\Http\Controllers\Instructor;

use App\Http\Controllers\Controller;
use App\Models\Enrollment;
use App\Services\CertificateService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Response;

class CertificateIssueController extends Controller {
    public function __construct(private CertificateService $service) {}

    public function issue(Enrollment $enrollment): RedirectResponse {
        $instructorId = (string) auth()->id();

        $enrollment->loadMissing('course:id,title,created_by');

        if ((string) $enrollment->course->created_by !== $instructorId) {
            abort(Response::HTTP_FORBIDDEN);
        }

        if ($enrollment->certificate) {
            return back()->with('info', 'Sertifikat sudah pernah diterbitkan untuk student ini.');
        }

        $enrollment->load(['user', 'course.sections.contents', 'certificate']);

        if (! $this->service->isCourseCompleted($enrollment)) {
            return back()->withErrors([
                'certificate' => 'Student belum menyelesaikan semua konten kursus.',
            ]);
        }

        $this->service->issueCertificate($enrollment);

        return back()->with('success', 'Sertifikat berhasil diterbitkan untuk ' . $enrollment->user->name . '.');
    }
}
