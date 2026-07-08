<?php

namespace App\Http\Controllers\Guest;

use App\Http\Controllers\Controller;
use App\Models\Certificate;
use App\Models\Course;
use App\Services\Admin\AdminPermissionService;
use App\Services\CertificateService;
use App\Services\Guest\GuestPageContentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\URL;
use Inertia\Inertia;
use Inertia\Response;

class GuestPageController extends Controller {
    public function __construct(
        private GuestPageContentService $guestPageContentService,
        private AdminPermissionService $adminPermissionService,
        private CertificateService $certificateService,
    ) {}

    public function home(Request $request): Response {
        return Inertia::render('Guest/Index', [
            'content'    => $this->guestPageContentService->resolve(),
            'liveEditor' => $this->resolveLiveEditor($request, 'home'),
            'courses'    => $this->popularCourses(),
        ]);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function popularCourses(): array {
        return Course::with('creator')
            ->where('is_published', true)
            ->latest()
            ->take(3)
            ->get()
            ->map(fn (Course $course) => [
                'id'          => $course->id,
                'title'       => $course->title,
                'description' => $course->description,
                'level'       => $course->level,
                'price'       => $course->price,
                'final_price' => $course->final_price,
                'instructor'  => $course->creator?->name,
                'thumbnail'   => $course->thumbnail
                    ? route('files.preview', $course->thumbnail)
                    : null,
            ])
            ->toArray();
    }

    public function verify(Request $request): Response {
        return Inertia::render('Guest/VerifyCTA/VerifyCTA', [
            'content'    => $this->guestPageContentService->resolve(),
            'liveEditor' => $this->resolveLiveEditor($request, 'verify'),
        ]);
    }

    public function verifyShow(Request $request, string $credentialId): Response {
        $certificate = $this->certificateService->verify($credentialId);

        $result = $certificate === null
            ? ['found' => false]
            : $this->buildVerifyResult($certificate);

        return Inertia::render('Guest/VerifyCTA/VerifyCTA', [
            'content'      => $this->guestPageContentService->resolve(),
            'liveEditor'   => $this->resolveLiveEditor($request, 'verify'),
            'credentialId' => $credentialId,
            'result'       => $result,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function buildVerifyResult(Certificate $certificate): array {
        $result = [
            'found'        => true,
            'status'       => $certificate->effective_status,
            'studentName'  => $certificate->user->name,
            'courseTitle'  => $certificate->course->title,
            'credentialId' => $certificate->credential_id,
            'issuedDate'   => $certificate->issued_at->format('d F Y'),
            'expiresDate'  => $certificate->expires_at?->format('d F Y'),
            'pdfViewerUrl' => null,
        ];

        $canPreview = $certificate->effective_status === 'active'
            && $certificate->source === 'template'
            && $certificate->file_path;

        if ($canPreview) {
            $signedUrl = URL::temporarySignedRoute(
                'certificates.stream',
                now()->addMinutes(15),
                ['certificate' => $certificate->id],
            );

            $result['pdfViewerUrl'] = 'https://docs.google.com/viewerng/viewer?hl=en&embedded=true&url='
                . urlencode($signedUrl);
        }

        return $result;
    }

    public function about(Request $request): Response {
        return Inertia::render('Guest/AboutUs/AboutUs', [
            'content'    => $this->guestPageContentService->resolve(),
            'liveEditor' => $this->resolveLiveEditor($request, 'about'),
        ]);
    }

    public function contact(Request $request): Response {
        return Inertia::render('Guest/Contact/ContactInfo', [
            'content'    => $this->guestPageContentService->resolve(),
            'liveEditor' => $this->resolveLiveEditor($request, 'contact'),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function resolveLiveEditor(Request $request, string $pageKey): array {
        if (! $request->boolean('liveEdit')) {
            return [
                'enabled' => false,
                'pageKey' => $pageKey,
            ];
        }

        $user = $request->user();

        if (! $user) {
            abort(403, 'Unauthorized.');
        }

        $hasAdminRole = $user->roles()->where('name', 'admin')->exists();

        if (! $hasAdminRole || ! $this->adminPermissionService->hasAny($user, 'content_admin', 'super_admin')) {
            abort(403, 'Unauthorized.');
        }

        return [
            'enabled'     => true,
            'pageKey'     => $pageKey,
            'saveRoute'   => route('admin.landing-page-settings.update', absolute: false),
            'uploadRoute' => route('admin.landing-page-settings.media.upload', absolute: false),
        ];
    }
}
