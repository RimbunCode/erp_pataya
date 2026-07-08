<?php

namespace App\Services;

use App\Models\Certificate;
use App\Models\CertificateTemplate;
use App\Models\CourseContent;
use App\Models\Enrollment;
use App\Models\Submission;
use App\Models\UserProgress;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Milon\Barcode\Facades\DNS1DFacade;
use Milon\Barcode\Facades\DNS2DFacade;

class CertificateService {
    public function issueCertificate(Enrollment $enrollment): Certificate {
        if ($enrollment->certificate) {
            return $enrollment->certificate;
        }

        $this->assertCourseCompleted($enrollment);
        $this->assertEvaluationFinalAndPassed($enrollment);

        $template    = $this->resolveTemplate($enrollment->course_id);
        $credentialId = $this->generateCredentialId($enrollment);
        $issuedAt    = now();
        $expiresAt   = $this->resolveExpiry($enrollment, $issuedAt);

        $data = [
            'student_name'     => $enrollment->user->name,
            'course_title'     => $enrollment->course->title,
            'issued_date'      => $issuedAt->format('d F Y'),
            'expiry_date'      => $expiresAt ? $expiresAt->format('d F Y') : '-',
            'credential_id'    => $credentialId,
            'certificate_type' => $enrollment->course->certificate_type ?? 'Participation',
            'filename'         => "Certificate_{$credentialId}",
        ];

        $templateDocId = $template?->gdoc_template_id ?? config('services.google_docs.template_doc_id');
        $driveFolderId = config('services.google_docs.drive_folder_id');

        $driveResult = app(GoogleDocsService::class)->generateAndUploadCertificate($data, $templateDocId, $driveFolderId);

        return Certificate::create([
            'enrollment_id'           => $enrollment->id,
            'user_id'                 => $enrollment->user_id,
            'course_id'               => $enrollment->course_id,
            'certificate_template_id' => $template?->id,
            'credential_id'           => $credentialId,
            'issued_at'               => $issuedAt,
            'expires_at'              => $expiresAt,
            'gdrive_file_id'          => $driveResult['file_id'],
            'gdrive_view_url'         => $driveResult['view_url'],
            'gdrive_download_url'     => $driveResult['download_url'],
            'status'                  => 'active',
        ]);
    }

    public function isCourseCompleted(Enrollment $enrollment): bool {
        $enrollment->load('course.sections.contents');

        $requiredContents = $enrollment->course->sections
            ->flatMap(fn($s) => $s->contents)
            ->where('is_optional', false);

        if ($requiredContents->isEmpty()) return false;

        $requiredContentIds = $requiredContents->pluck('id');

        // Material: selesai jika ada user_progress.is_completed = true
        $completedViaProgress = UserProgress::where('user_id', $enrollment->user_id)
            ->whereIn('content_id', $requiredContentIds)
            ->where('is_completed', true)
            ->pluck('content_id');

        // Assignment/pre_assessment: fallback ke submissions yang sudah di-grade
        // untuk menangani data lama sebelum fitur user_progress di-grade
        $submittableIds = $requiredContents
            ->whereIn('type', ['assignment', 'pre_assessment'])
            ->pluck('id');

        $completedViaSubmission = $submittableIds->isNotEmpty()
            ? Submission::where('user_id', $enrollment->user_id)
                ->whereIn('content_id', $submittableIds)
                ->whereNotNull('grade')
                ->pluck('content_id')
            : collect();

        $completedIds = $completedViaProgress->merge($completedViaSubmission)->unique();

        return $requiredContentIds->diff($completedIds)->isEmpty();
    }

    public function issueFromTemplate(Enrollment $enrollment, CertificateTemplate $template, GradingService $gradingService): Certificate {
        if ($enrollment->certificate) {
            return $enrollment->certificate;
        }

        $this->assertEvaluationFinalAndPassed($enrollment);

        $enrollment->load('course.sections.contents', 'course.creator', 'user');

        $credentialId = $this->generateCredentialId($enrollment);
        $issuedAt     = now();
        $expiresAt    = $this->resolveExpiry($enrollment, $issuedAt);
        $evaluation   = $enrollment->evaluation;

        $materials = $enrollment->course->sections
            ->flatMap(fn ($section) => $section->contents)
            ->pluck('title')
            ->values()
            ->all();

        $period = $enrollment->course->total_sessions
            ? "{$enrollment->course->total_sessions} sesi ({$enrollment->course->total_hours} jam)"
            : $issuedAt->format('F Y');

        $verifyUrl       = route('guest.verify.show', ['credentialId' => $credentialId]);
        $barcode1dBase64 = DNS1DFacade::getBarcodePNG($credentialId, 'C128', 1, 25);
        $qrCodeBase64    = DNS2DFacade::getBarcodePNG($verifyUrl, 'QRCODE', 4, 4);

        $partnerLogos = collect($template->partner_logo_paths ?? [])
            ->map(fn (string $path) => Storage::path($path))
            ->values()
            ->all();

        $viewData = [
            'organizerName'        => 'INKINDO JATIM',
            'logoPath'             => $template->logo_path ? Storage::path($template->logo_path) : null,
            'partnerLogos'         => $partnerLogos,
            'studentName'          => $enrollment->user->name,
            'courseTitle'          => $enrollment->course->title,
            'period'               => $period,
            'finalScore'           => $evaluation?->final_score,
            'grade'                => $evaluation?->grade,
            'signatureImagePath'   => $template->signature_image_path ? Storage::path($template->signature_image_path) : null,
            'signerName'           => $template->signer_name,
            'signerTitle'          => $template->signer_title,
            'signatureImagePath2'  => $template->signature_image_path_2 ? Storage::path($template->signature_image_path_2) : null,
            'signerName2'          => $template->signer_name_2,
            'signerTitle2'         => $template->signer_title_2,
            'credentialId'         => $credentialId,
            'instructorName'       => $enrollment->course->creator?->name,
            'materials'            => $materials,
            'verifyUrl'            => $verifyUrl,
            'barcode1dBase64'      => $barcode1dBase64,
            'qrCodeBase64'         => $qrCodeBase64,
        ];

        $pdf = Pdf::loadView('certificates.pdf', $viewData)->setPaper('a4', 'landscape');
        $relativePath = "certificates/{$credentialId}.pdf";
        Storage::put($relativePath, $pdf->output());

        return Certificate::create([
            'enrollment_id'           => $enrollment->id,
            'user_id'                 => $enrollment->user_id,
            'course_id'               => $enrollment->course_id,
            'certificate_template_id' => $template->id,
            'credential_id'           => $credentialId,
            'issued_at'               => $issuedAt,
            'expires_at'              => $expiresAt,
            'status'                  => 'active',
            'source'                  => 'template',
            'file_path'               => $relativePath,
            'snapshot'                => $viewData,
        ]);
    }

    public function verify(string $credentialId): ?Certificate {
        return Certificate::with(['course', 'user'])
            ->where('credential_id', $credentialId)
            ->first();
    }

    public function assertEvaluationFinalAndPassed(Enrollment $enrollment): void {
        $evaluation = $enrollment->evaluation;

        if (! $evaluation || $evaluation->status !== 'final') {
            throw new \RuntimeException('Evaluasi peserta belum final.');
        }

        if (! $evaluation->is_passed) {
            throw new \RuntimeException('Peserta belum memenuhi syarat lulus.');
        }
    }

    private function assertCourseCompleted(Enrollment $enrollment): void {
        if (! $this->isCourseCompleted($enrollment)) {
            throw new \RuntimeException('Course is not yet completed.');
        }
    }

    private function resolveTemplate(string $courseId): ?CertificateTemplate {
        return CertificateTemplate::where('course_id', $courseId)->where('is_active', true)->first()
            ?? CertificateTemplate::whereNull('course_id')->where('is_active', true)->first();
    }

    private function generateCredentialId(Enrollment $enrollment): string {
        $year   = now()->format('Y');
        $prefix = strtoupper(Str::substr($enrollment->course->title ?? 'CERT', 0, 3));
        $seq    = str_pad(Certificate::count() + 1, 3, '0', STR_PAD_LEFT);

        return "INK-{$year}-{$prefix}-{$seq}";
    }

    private function resolveExpiry(Enrollment $enrollment, \Carbon\Carbon $issuedAt): ?\Carbon\Carbon {
        $certType = $enrollment->course->certificate_type;
        if (in_array($certType, ['professional', 'competency'], true)) {
            return $issuedAt->copy()->addYears(2);
        }
        return null;
    }
}
