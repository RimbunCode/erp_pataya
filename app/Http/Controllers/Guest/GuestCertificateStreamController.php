<?php

namespace App\Http\Controllers\Guest;

use App\Http\Controllers\Controller;
use App\Models\Certificate;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class GuestCertificateStreamController extends Controller {
    public function stream(Certificate $certificate): StreamedResponse {
        abort_unless($certificate->source === 'template', 404);
        abort_unless($certificate->file_path && Storage::exists($certificate->file_path), 404);

        return Storage::response(
            $certificate->file_path,
            "Certificate_{$certificate->credential_id}.pdf",
            ['Content-Type' => 'application/pdf'],
        );
    }
}
