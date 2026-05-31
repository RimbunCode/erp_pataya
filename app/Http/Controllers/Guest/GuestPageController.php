<?php

namespace App\Http\Controllers\Guest;

use App\Http\Controllers\Controller;
use App\Services\Admin\AdminPermissionService;
use App\Services\Guest\GuestPageContentService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class GuestPageController extends Controller {
    public function __construct(
        private GuestPageContentService $guestPageContentService,
        private AdminPermissionService $adminPermissionService,
    ) {}

    public function home(Request $request): Response {
        return Inertia::render('Guest/Index', [
            'content'    => $this->guestPageContentService->resolve(),
            'liveEditor' => $this->resolveLiveEditor($request, 'home'),
        ]);
    }

    public function verify(Request $request): Response {
        return Inertia::render('Guest/VerifyCTA/VerifyCTA', [
            'content'    => $this->guestPageContentService->resolve(),
            'liveEditor' => $this->resolveLiveEditor($request, 'verify'),
        ]);
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
