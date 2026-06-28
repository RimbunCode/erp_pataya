<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Models\Certificate;
use App\Services\CertificateService;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class CertificateController extends Controller {
    public function __construct(private CertificateService $service) {}

    public function index() {
        $certificates = Certificate::with(['course'])
            ->where('user_id', Auth::id())
            ->latest('issued_at')
            ->get()
            ->map(fn ($cert) => [
                'id'           => $cert->id,
                'title'        => $cert->course->title,
                'issuer'       => 'INKINDO Learning Center',
                'issuedDate'   => $cert->issued_at->format('d M Y'),
                'expiryDate'   => $cert->expires_at?->format('d M Y') ?? 'No Expiry',
                'credentialId' => $cert->credential_id,
                'status'       => $cert->effective_status,
                'downloadUrl'  => $cert->gdrive_download_url,
                'viewUrl'      => $cert->gdrive_view_url,
            ]);

        return Inertia::render('Students/Certificates', [
            'certificates' => $certificates,
        ]);
    }

    public function verify(string $credentialId) {
        $cert = $this->service->verify($credentialId);

        if (! $cert) {
            return response()->json(['valid' => false, 'message' => 'Certificate not found.'], 404);
        }

        return response()->json([
            'valid'         => $cert->effective_status === 'active',
            'status'        => $cert->effective_status,
            'student_name'  => $cert->user->name,
            'course_title'  => $cert->course->title,
            'issued_at'     => $cert->issued_at->format('d M Y'),
            'expires_at'    => $cert->expires_at?->format('d M Y'),
            'credential_id' => $cert->credential_id,
        ]);
    }
}
