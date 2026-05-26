<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdateLandingPageContentRequest;
use App\Services\Guest\GuestPageContentService;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class LandingPageSettingController extends Controller {
    public function __construct(private GuestPageContentService $guestPageContentService) {}

    public function index(): Response {
        return Inertia::render('Admin/LandingPageSettings/index', [
            'content' => $this->guestPageContentService->resolve(),
        ]);
    }

    public function update(UpdateLandingPageContentRequest $request): RedirectResponse {
        $validated = $request->validated();

        $this->guestPageContentService->store($validated['content']);

        return back()->with('success', 'Landing page content berhasil diperbarui.');
    }
}
